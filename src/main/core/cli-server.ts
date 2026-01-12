import { app, ipcMain } from 'electron';
import * as net from 'net';
import * as fs from 'fs';
import * as os from 'os';
import { commandRegistry } from './command-registry';

const SOCKET_PATH = process.platform === 'win32' ? '\\\\.\\pipe\\elara-cli' : '/tmp/elara.sock';

let server: net.Server | null = null;
// Track active socket for interactive commands
let activeSocket: net.Socket | null = null;
let promptResolver: ((value: string) => void) | null = null;

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

function safeWrite(socket: net.Socket, data: any) {
  if (socket.writable) {
    socket.write(JSON.stringify(data) + '\n');
  }
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

  // Register IPC handler for prompts
  ipcMain.handle('commands:prompt', async (_event, message: string) => {
    if (!activeSocket) {
      throw new Error('No active CLI session to prompt');
    }

    return new Promise((resolve) => {
      promptResolver = resolve;
      safeWrite(activeSocket!, {
        type: 'prompt',
        query: message,
      });
    });
  });

  // Re-implementing the server listener with robust async handling
  server = net.createServer((socket) => {
    socket.on('data', async (data) => {
      // Basic splitting for safety
      const chunks = data.toString().split('\n').filter(Boolean);

      for (const rawChunk of chunks) {
        try {
          const rawRequest = rawChunk.trim();
          if (!rawRequest) continue;

          let request: any;
          try {
            request = JSON.parse(rawRequest);
          } catch {
            request = rawRequest === 'info' ? { type: 'info' } : { type: 'unknown' };
          }

          if (request.type === 'input') {
            if (promptResolver) {
              promptResolver(request.content);
              promptResolver = null;
            }
            continue; // Don't process as new command
          }

          // New Command Execution
          activeSocket = socket;

          if (request.type === 'info') {
            safeWrite(socket, { type: 'info', ...getAppInfo() });
            socket.end();
          } else if (request.type === 'execute') {
            const { trigger } = request;
            const rendererCommand = commandRegistry.getCommand(trigger);

            if (rendererCommand) {
              try {
                const output = await commandRegistry.executeCommand(trigger, request);
                safeWrite(socket, {
                  type: 'execution-result',
                  output: typeof output === 'string' ? output : JSON.stringify(output),
                });
              } catch (error: any) {
                safeWrite(socket, { error: `Command failed: ${error.message}` });
              }
            } else {
              safeWrite(socket, { error: `Command '${trigger}' not found` });
            }
            socket.end();
            activeSocket = null; // Clear active socket
          } else {
            safeWrite(socket, { error: 'Unknown request type' });
            socket.end();
          }
        } catch (e) {
          console.error(e);
          safeWrite(socket, { error: 'Internal server error' });
          socket.end();
        }
      }
    });
  });

  server.listen(SOCKET_PATH, () => {
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
    server.close(() => {});

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
