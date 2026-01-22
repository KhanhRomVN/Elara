import { ipcRenderer } from 'electron';

export const versionAPI = {
  checkForUpdates: (): Promise<{
    updateAvailable: boolean;
    remoteVersion: string;
    currentVersion: string;
  }> => ipcRenderer.invoke('version:check'),
  performUpdate: (remoteVersion: string): Promise<{ success: boolean; message: string }> =>
    ipcRenderer.invoke('version:update', remoteVersion),
};
