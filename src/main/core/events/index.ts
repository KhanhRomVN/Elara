import { ipcMain } from 'electron';

export function setupEventHandlers() {
  ipcMain.handle('ping', () => 'pong');
}
