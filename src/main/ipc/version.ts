import { ipcMain } from 'electron';
import { versionManager } from '../services/version-manager';

export const setupVersionHandlers = () => {
  ipcMain.handle('version:check', async () => {
    try {
      return await versionManager.checkForUpdates();
    } catch (error) {
      console.error('[IPC] version:check error:', error);
      throw error;
    }
  });

  ipcMain.handle('version:update', async (_, remoteVersion: string) => {
    try {
      return await versionManager.performUpdate(remoteVersion);
    } catch (error) {
      console.error('[IPC] version:update error:', error);
      throw error;
    }
  });
};
