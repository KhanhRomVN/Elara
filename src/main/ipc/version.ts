import { ipcMain } from 'electron';
import { versionManager } from '../services/version-manager';

export const setupVersionHandlers = () => {
  ipcMain.handle('version:check', async () => {
    return await versionManager.checkForUpdates();
  });

  ipcMain.handle('version:update', async (_, remoteVersion: string) => {
    return await versionManager.performUpdate(remoteVersion);
  });
};
