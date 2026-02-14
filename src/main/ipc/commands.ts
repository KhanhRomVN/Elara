import { ipcMain } from 'electron';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { commandStorage, Command } from '../core/command-storage';
import { commandRegistry } from '../core/command-registry';

export function setupCommandsHandlers(): void {
  ipcMain.handle('commands:get-all', () => {
    return commandStorage.getAll();
  });

  ipcMain.handle('commands:add', (_, command: Command) => {
    commandStorage.add(command);
    return true;
  });

  ipcMain.handle(
    'commands:update',
    (_, { id, updates }: { id: string; updates: Partial<Command> }) => {
      commandStorage.update(id, updates);
      return true;
    },
  );

  ipcMain.handle('commands:delete', (_, id: string) => {
    commandStorage.delete(id);
    return true;
  });

  ipcMain.handle('commands:read-file', async (_, filePath: string) => {
    try {
      const path = await import('path');
      // Normalize path
      let targetPath = filePath;

      // If it's a relative path, try to resolve it from CWD or INIT_CWD
      if (!path.isAbsolute(targetPath)) {
        const cwd = process.cwd();
        const initCwd = process.env.INIT_CWD;

        const possiblePaths = [
          path.resolve(cwd, filePath),
          initCwd ? path.resolve(initCwd, filePath) : null,
        ].filter(Boolean) as string[];

        // Check availability
        const found = possiblePaths.find((p) => fs.existsSync(p));
        if (found) {
          targetPath = found;
        }
      }

      if (!fs.existsSync(targetPath)) {
        console.error(`[commands:read-file] File not found: ${filePath}`);
        console.error(`[commands:read-file] CWD: ${process.cwd()}`);
        console.error(`[commands:read-file] INIT_CWD: ${process.env.INIT_CWD}`);
        throw new Error(`File not found: ${filePath} (resolved: ${targetPath})`);
      }
      return fs.readFileSync(targetPath, 'utf-8');
    } catch (error) {
      console.error('Failed to read file:', error);
      throw error;
    }
  });

  ipcMain.handle(
    'commands:write-file',
    async (_, { filePath, content }: { filePath: string; content: string }) => {
      try {
        fs.writeFileSync(filePath, content, 'utf-8');
        return true;
      } catch (error) {
        console.error('Failed to write file:', error);
        throw error;
      }
    },
  );

  ipcMain.handle('shell:execute', async (_, command: string, cwd?: string) => {
    try {
      const options: { maxBuffer: number; cwd?: string } = { maxBuffer: 50 * 1024 * 1024 };
      if (cwd) {
        options.cwd = cwd;
      }
      const { stdout, stderr } = await execAsync(command, options);
      if (stderr) {
        console.warn('Shell command warning:', stderr);
      }
      return stdout.trim();
    } catch (error) {
      console.error('Failed to execute shell command:', error);
      throw error;
    }
  });

  ipcMain.handle('commands:list-files', async (_, filePath: string, recursive = false) => {
    try {
      if (!fs.existsSync(filePath)) throw new Error('Directory not found');
      const stats = fs.statSync(filePath);
      if (!stats.isDirectory()) throw new Error('Path is not a directory');

      const listDir = (dir: string, currentDepth: number): string[] => {
        const results: string[] = [];
        const files = fs.readdirSync(dir);
        const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', 'out', 'vendor'];

        for (const file of files) {
          if (IGNORE_DIRS.includes(file)) continue;

          const fullPath = `${dir}/${file}`;
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              results.push(`${fullPath}/`);
              if (recursive && currentDepth < 3) {
                // Reduced depth for mention search
                results.push(...listDir(fullPath, currentDepth + 1));
              }
            } else {
              results.push(fullPath);
            }
          } catch (e) {
            // Ignore files that can't be stat-ed (busy, restricted, etc.)
            continue;
          }

          // Safety limit
          if (results.length > 500) break;
        }
        return results;
      };

      return listDir(filePath, 0);
    } catch (error) {
      console.error('Failed to list files:', error);
      throw error;
    }
  });

  ipcMain.handle(
    'commands:search-files',
    async (_, { path, regex, pattern }: { path: string; regex: string; pattern?: string }) => {
      try {
        // Use grep -r for speed if available, or fallback to shell command
        const cmd = `grep -rE "${regex.replace(/"/g, '\\"')}" "${path}" ${pattern ? `--include="${pattern}"` : ''}`;
        const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
        return stdout.trim();
      } catch (error: any) {
        if (error.code === 1) return ''; // No matches found
        console.error('Failed to search files:', error);
        throw error;
      }
    },
  );

  ipcMain.on('commands:register', (event, commands: any[]) => {
    try {
      commandRegistry.register(commands, event.sender);
    } catch (error) {
      console.error('Failed to register commands:', error);
    }
  });

  ipcMain.on('command:execute-response', (_, { requestId, response }) => {
    commandRegistry.handleResponse(requestId, response);
  });

  ipcMain.handle('commands:exists', async (_, path: string) => {
    try {
      return fs.existsSync(path) && fs.statSync(path).isDirectory();
    } catch {
      return false;
    }
  });
}
