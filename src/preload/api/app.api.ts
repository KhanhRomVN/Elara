import { ipcRenderer } from 'electron';

export const appAPI = {
  ping: () => ipcRenderer.invoke('ping'),
  getSystemInfo: () => ipcRenderer.invoke('app:get-system-info'),
  quit: () => ipcRenderer.send('app:quit'),
};
