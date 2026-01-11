import { contextBridge } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import { ipcRenderer } from 'electron';
import { appAPI } from './api';
import { accountsAPI } from './api/accounts';
import { serverAPI } from './api/server';
import { logsAPI } from './api/logs';
import { commandsAPI } from './api/commands';

const api = {
  app: appAPI,
  accounts: accountsAPI,
  server: serverAPI,
  logs: logsAPI,
  commands: commandsAPI,
  stats: {
    getStats: (): Promise<any> => ipcRenderer.invoke('stats:get'),
  },
  shell: {
    execute: (command: string, cwd?: string): Promise<string> =>
      ipcRenderer.invoke('shell:execute', command, cwd),
  },
  on: (channel: string, listener: (event: any, ...args: any[]) => void) => {
    const subscription = (_event: any, ...args: any[]) => listener(_event, ...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error (define in d.ts)
  window.electron = electronAPI;
  // @ts-expect-error (api is defined in d.ts)
  window.api = api;
}
