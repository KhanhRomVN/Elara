import { app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';

let n8nProcess: ChildProcess | null = null;

export const N8N_PORT = 5678;

const checkPort = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(200);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true); // Port is in use
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
};

export async function startN8nServer() {
  if (n8nProcess) {
    console.log('n8n server is already running');
    return;
  }

  // Check if port is already in use
  const isPortInUse = await checkPort(N8N_PORT);
  if (isPortInUse) {
    console.log(
      `Port ${N8N_PORT} is already in use. Assuming n8n is running externally. Joining session...`,
    );
    return;
  }

  const userDataPath = app.getPath('userData');
  const n8nUserData = path.join(userDataPath, 'n8n');

  if (!fs.existsSync(n8nUserData)) {
    fs.mkdirSync(n8nUserData, { recursive: true });
  }

  const env = {
    ...process.env,
    N8N_PORT: N8N_PORT.toString(),
    N8N_USER_FOLDER: n8nUserData,
    N8N_NO_AUTH_OWNER: 'true',
    WEBHOOK_URL: `http://127.0.0.1:${N8N_PORT}/`,
    N8N_PROTOCOL: 'http',
    N8N_HOST: '127.0.0.1',
    N8N_LISTEN_ADDRESS: '127.0.0.1',
  };

  // Locate the n8n executable.
  // In development, it's likely in node_modules/.bin/n8n
  // In production, we might need a different strategy, but for now assuming it's available in the environment or node_modules
  const n8nPath = path.resolve(__dirname, '../../node_modules/.bin/n8n');

  console.log(`Starting n8n from ${n8nPath} on port ${N8N_PORT}...`);

  n8nProcess = spawn(n8nPath, ['start'], {
    env,
    stdio: 'pipe', // Pipe stdio so we can see logs
  });

  n8nProcess.stdout?.on('data', (data) => {
    console.log(`[n8n]: ${data}`);
  });

  n8nProcess.stderr?.on('data', (data) => {
    console.error(`[n8n err]: ${data}`);
  });

  n8nProcess.on('close', (code) => {
    console.log(`n8n process exited with code ${code}`);
    n8nProcess = null;
  });
}

export function stopN8nServer() {
  if (n8nProcess) {
    console.log('Stopping n8n server...');
    n8nProcess.kill();
    n8nProcess = null;
  }
}
