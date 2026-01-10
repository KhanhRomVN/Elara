import { app } from 'electron';
import * as net from 'net';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { commandStorage } from './command-storage';
import { exec } from 'child_process';
import { promisify } from 'util';
import { chatCompletionStream, ChatPayload } from '../server/deepseek';

const execAsync = promisify(exec);
const SOCKET_PATH = process.platform === 'win32' ? '\\\\.\\pipe\\elara-cli' : '/tmp/elara.sock';
const ACCOUNTS_FILE = path.join(app.getPath('userData'), 'accounts.json');

let server: net.Server | null = null;
const startTime = Date.now();

interface Account {
  id: string;
  provider: 'Claude' | 'DeepSeek';
  email: string;
  credential: string;
}

interface AppInfo {
  name: string;
  version: string;
  pid: number;
  uptime: number;
  platform: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

function getAppInfo(): AppInfo {
  const memoryUsage = process.memoryUsage();

  return {
    name: app.getName(),
    version: app.getVersion(),
    pid: process.pid,
    uptime: Math.floor((Date.now() - startTime) / 1000), // in seconds
    platform: `${os.platform()} ${os.release()}`,
    arch: os.arch(),
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron || 'unknown',
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      external: Math.round(memoryUsage.external / 1024 / 1024), // MB
    },
  };
}

function getDeepSeekAccount(): Account | null {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return null;
    const accounts: Account[] = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'));
    // Prioritize DeepSeek
    return accounts.find((acc) => acc.provider === 'DeepSeek') || null;
  } catch (error) {
    console.error('Failed to read accounts:', error);
    return null;
  }
}

async function generateCommitMessage(diff: string, account: Account): Promise<string> {
  return new Promise((resolve, reject) => {
    let fullResponse = '';

    const payload: ChatPayload = {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: `Generate a single concise git commit message (Conventional Commits format) for the following changes.
Strictly output ONLY the message (e.g., "feat: add new feature").
Do NOT include any conversational text, reasoning, markdown code blocks, or explanations.
Do NOT output multiple lines.

Changes:
${diff}`,
        },
      ],
      stream: true,
    };

    // Extract token (remove "Bearer " if present, but the API expects it in Authorization header,
    // and deepseek.ts might expect just the token?
    // deepseek.ts: req.setHeader('Authorization', token);
    // accounts.ts saves Bearer token. So we pass it as is.

    // Note: deepseek.ts chatCompletionStream takes (token, payload, userAgent, callbacks)

    chatCompletionStream(
      account.credential,
      payload,
      account['userAgent'], // Account interface in this file doesn't have userAgent but actual data does
      {
        onContent: (content) => {
          fullResponse += content;
        },
        onDone: () => {
          resolve(fullResponse.trim());
        },
        onError: (error) => {
          reject(error);
        },
      },
    );
  });
}

export function startCLIServer(): void {
  // Clean up existing socket file on Unix systems
  if (process.platform !== 'win32' && fs.existsSync(SOCKET_PATH)) {
    try {
      fs.unlinkSync(SOCKET_PATH);
    } catch (error) {
      console.error('Failed to remove existing socket:', error);
    }
  }

  server = net.createServer((socket) => {
    socket.on('data', async (data) => {
      try {
        const rawRequest = data.toString().trim();
        let request: any;

        try {
          request = JSON.parse(rawRequest);
        } catch {
          request = rawRequest === 'info' ? { type: 'info' } : { type: 'unknown' };
        }

        if (request.type === 'info') {
          const appInfo = getAppInfo();
          socket.write(JSON.stringify(appInfo));
        } else if (request.type === 'execute') {
          const { trigger, cwd } = request;
          const command = commandStorage.getByTrigger(trigger);

          if (!command) {
            socket.write(JSON.stringify({ error: `Command '${trigger}' not found` }));
          } else {
            // Execute command logic
            if (command.trigger === 'auto-commit') {
              try {
                // 1. Check Git Status
                let hasChanges = false;
                // Check staged
                try {
                  const { stdout } = await execAsync('git diff --cached --quiet', { cwd });
                  hasChanges = false; // exit code 0 means no chances
                } catch (e: any) {
                  if (e.code === 1) hasChanges = true; // exit code 1 means changes
                }

                if (!hasChanges) {
                  // Try to add all if user wants? Or strictly check changes.
                  // User requirement 1: "chỉ dùng được khi đã git add"
                  // So if no staged changes, error.
                  socket.write(
                    JSON.stringify({
                      type: 'execution-result',
                      output: '❌ No staged changes found. Please run "git add" first.',
                    }),
                  );
                  socket.end();
                  return;
                }

                // Get diff
                const { stdout: diff } = await execAsync('git diff --cached', { cwd });
                if (!diff.trim()) {
                  // Should be covered by hasChanges but double check
                  socket.write(
                    JSON.stringify({
                      type: 'execution-result',
                      output: '❌ No changes detected in diff.',
                    }),
                  );
                  socket.end();
                  return;
                }

                // 2. Get Account
                const account = getDeepSeekAccount();
                if (!account) {
                  socket.write(
                    JSON.stringify({
                      type: 'execution-result',
                      output: '❌ No DeepSeek account found. Please login in Elara app.',
                    }),
                  );
                  socket.end();
                  return;
                }

                socket.write(
                  JSON.stringify({
                    type: 'execution-result',
                    output: `Found staged changes. Generating message using ${account.email}...`,
                  }),
                );

                // 3. Generate Message
                const message = await generateCommitMessage(diff, account);

                // Clean up message (remove quotes if any)
                const cleanMessage = message.replace(/^"|"$/g, '').replace(/^`|`$/g, '');

                // 4. Commit and Push
                await execAsync(`git commit -m "${cleanMessage.replace(/"/g, '\\"')}"`, { cwd });
                socket.write(
                  JSON.stringify({
                    type: 'execution-result',
                    output: `✅ Committed: ${cleanMessage}`,
                  }),
                );

                socket.write(
                  JSON.stringify({
                    type: 'execution-result',
                    output: `Pushing to remote...`,
                  }),
                );

                await execAsync('git push', { cwd });

                socket.write(
                  JSON.stringify({
                    type: 'execution-result',
                    output: `🚀 Successfully pushed to remote!`,
                  }),
                );
              } catch (err: any) {
                socket.write(
                  JSON.stringify({
                    type: 'execution-result',
                    output: `❌ Error: ${err.message}`,
                  }),
                );
              }
            } else {
              socket.write(
                JSON.stringify({
                  type: 'execution-result',
                  output: `Executing custom command '${command.name}'...\nAction: ${command.action}`,
                }),
              );
            }
          }
        } else {
          socket.write(JSON.stringify({ error: 'Unknown command' }));
        }
      } catch (error) {
        console.error('Server error:', error);
        socket.write(JSON.stringify({ error: 'Server error' }));
      }

      socket.end();
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  server.listen(SOCKET_PATH, () => {
    console.log(`CLI server listening on ${SOCKET_PATH}`);

    // Set permissions on Unix systems
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(SOCKET_PATH, 0o666);
      } catch (error) {
        console.error('Failed to set socket permissions:', error);
      }
    }
  });

  server.on('error', (error) => {
    console.error('CLI server error:', error);
  });
}

export function stopCLIServer(): void {
  if (server) {
    server.close(() => {
      console.log('CLI server stopped');
    });

    // Clean up socket file on Unix systems
    if (process.platform !== 'win32' && fs.existsSync(SOCKET_PATH)) {
      try {
        fs.unlinkSync(SOCKET_PATH);
      } catch (error) {
        console.error('Failed to remove socket:', error);
      }
    }

    server = null;
  }
}
