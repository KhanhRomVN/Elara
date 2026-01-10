import { contextBridge } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import { appAPI } from './api';
import { accountsAPI } from './api/accounts';
import { serverAPI } from './api/server';
import { logsAPI } from './api/logs';
import { commandsAPI } from './api/commands';
import { statsAPI } from './api/stats';

const api = {
  app: appAPI,
  accounts: accountsAPI,
  server: serverAPI,
  logs: logsAPI,
  commands: commandsAPI,
  stats: statsAPI,
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
