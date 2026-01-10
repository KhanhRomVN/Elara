import { ipcRenderer } from 'electron';

export const statsAPI = {
  getStats: () => ipcRenderer.invoke('get-stats'),
};
