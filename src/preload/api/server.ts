import { ipcRenderer } from 'electron';

export const serverAPI = {
  start: () => ipcRenderer.invoke('server:start'),
  stop: () => ipcRenderer.invoke('server:stop'),
};
