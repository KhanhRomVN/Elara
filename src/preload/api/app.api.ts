import { ipcRenderer } from 'electron';

export const appAPI = {
  ping: () => ipcRenderer.invoke('ping'),
  quit: () => ipcRenderer.send('app:quit'),
};
