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
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }
      return fs.readFileSync(filePath, 'utf-8');
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

  ipcMain.handle('shell:execute', async (_, command: string) => {
    try {
      const { stdout, stderr } = await execAsync(command, { maxBuffer: 50 * 1024 * 1024 });
      if (stderr) {
        console.warn('Shell command warning:', stderr);
      }
      return stdout.trim();
    } catch (error) {
      console.error('Failed to execute shell command:', error);
      throw error;
    }
  });

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
}
