import { app } from 'electron';
import * as net from 'net';
import * as fs from 'fs';
import * as os from 'os';
import { commandStorage } from './command-storage';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const SOCKET_PATH = process.platform === 'win32' ? '\\\\.\\pipe\\elara-cli' : '/tmp/elara.sock';

let server: net.Server | null = null;
const startTime = Date.now();

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

        // Try parsing JSON, fallback to string for backward compatibility
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
              // Special handling for auto-commit demo
              try {
                // Check if it's a git repo
                const { stdout: diff } = await execAsync('git diff --cached', { cwd });
                if (!diff.trim()) {
                  // Try non-cached
                  const { stdout: diff2 } = await execAsync('git diff', { cwd });
                  if (!diff2.trim()) {
                    socket.write(
                      JSON.stringify({
                        type: 'execution-result',
                        output: 'No changes detected to commit.',
                      }),
                    );
                    socket.end();
                    return;
                  }
                  socket.write(
                    JSON.stringify({
                      type: 'execution-result',
                      output: `[Elara AI] Generating commit message for changes...\n(Simulated) feat: update project structure`,
                    }),
                  );
                } else {
                  socket.write(
                    JSON.stringify({
                      type: 'execution-result',
                      output: `[Elara AI] Generating commit message for staged changes...\n(Simulated) feat: update project structure`,
                    }),
                  );
                }
              } catch (err: any) {
                socket.write(
                  JSON.stringify({
                    type: 'execution-result',
                    output: `Error executing git: ${err.message}`,
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
