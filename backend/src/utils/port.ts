import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const killPort = async (port: number): Promise<void> => {
  try {
    // Check if port is in use and get PID
    // lsof: list open files, -t: terse (PID only), -i: internet
    const { stdout } = await execAsync(`lsof -t -i:${port}`);

    if (stdout) {
      const pids = stdout.trim().split('\n');
      for (const pid of pids) {
        if (pid) {
          try {
            console.log(`[Port] Killing process ${pid} on port ${port}...`);
            process.kill(parseInt(pid), 'SIGKILL');
          } catch (e: any) {
            console.warn(`[Port] Failed to kill process ${pid}: ${e.message}`);
          }
        }
      }
    }
  } catch (error: any) {
    // If lsof fails (e.g. returns 1 when no process found), just ignore
    if (error.code !== 1) {
      console.warn(`[Port] Error checking port ${port}:`, error.message);
    }
  }
};
