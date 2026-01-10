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
          content: `Generate a detailed git commit message for the following changes.
Structure format:
<emoji> <type>: <concise title>
- <bullet point 1>
- <bullet point 2>
...

Example:
✨ feat: add new feature
- implement core logic
- update api endpoints

Return the result as a JSON object with a single key "message".
Example JSON Output:
{
  "message": "✨ feat: add feature...\n- details..."
}

Strictly output ONLY the JSON object. Do not explain.

Changes:
${diff}`,
        },
      ],
      stream: true,
    };

    chatCompletionStream(account.credential, payload, account['userAgent'], {
      onContent: (content) => {
        fullResponse += content;
      },
      onDone: () => {
        // Parse JSON from response (handling potential thinking text/markdown wrappers)
        let finalMessage = fullResponse;
        try {
          // Find first '{' and last '}'
          const start = fullResponse.indexOf('{');
          const end = fullResponse.lastIndexOf('}');
          if (start !== -1 && end !== -1) {
            const jsonStr = fullResponse.substring(start, end + 1);
            const parsed = JSON.parse(jsonStr);
            if (parsed.message) {
              finalMessage = parsed.message;
            }
          }
        } catch (e) {
          console.error('Failed to parse AI JSON:', e);
          // Fallback: cleanup raw text if not JSON
          finalMessage = fullResponse
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();
        }
        resolve(finalMessage.trim());
      },
      onError: (error) => {
        reject(error);
      },
    });
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
                socket.write(
                  JSON.stringify({
                    type: 'execution-result',
                    output: `\n🤖 \x1b[36mAI is generating commit message...\x1b[0m`,
                  }),
                );

                const message = await generateCommitMessage(diff, account);

                // 4. Commit and Push
                socket.write(
                  JSON.stringify({
                    type: 'execution-result',
                    output: `\n📝 \x1b[32mCommit Message:\x1b[0m\n\x1b[2m${message}\x1b[0m\n`,
                  }),
                );

                await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd });
                socket.write(
                  JSON.stringify({
                    type: 'execution-result',
                    output: `✅ \x1b[32mCommitted successfully\x1b[0m`,
                  }),
                );

                socket.write(
                  JSON.stringify({
                    type: 'execution-result',
                    output: `\n🚀 \x1b[36mPushing to remote...\x1b[0m`,
                  }),
                );

                await execAsync('git push', { cwd });

                socket.write(
                  JSON.stringify({
                    type: 'execution-result',
                    output: `✅ \x1b[32mSuccessfully pushed!\x1b[0m\n`,
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
