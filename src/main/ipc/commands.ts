import { ipcMain } from 'electron';
import { commandStorage, Command } from '../core/command-storage';

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
}
