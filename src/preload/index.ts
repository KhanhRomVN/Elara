import { contextBridge } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import { ipcRenderer } from 'electron';
import { appAPI } from './api';
import { accountsAPI } from './api/accounts';
import { serverAPI } from './api/server';
import { logsAPI } from './api/logs';
import { commandsAPI } from './api/commands';
import { versionAPI } from './api/version';
import { extendedToolsAPI } from './api/extended-tools';

console.log('[Preload] Initializing API object');
const api = {
  app: appAPI,
  accounts: {
    ...accountsAPI,
    login: (provider: string, options?: any) => {
      ipcRenderer.send('debug:log', `[Preload] invoking accounts:login for ${provider}`);
      // @ts-ignore
      return accountsAPI.login(provider, options);
    },
  },
  server: serverAPI,
  version: versionAPI,
  logs: logsAPI,
  commands: commandsAPI,
  extendedTools: extendedToolsAPI,
  stats: {
    getStats: (): Promise<any> => ipcRenderer.invoke('stats:get'),
  },
  ide: {
    openWindow: (folderPath: string) => ipcRenderer.invoke('ide:open-window', folderPath),
    listFiles: (dirPath: string) => ipcRenderer.invoke('ide:list-files', dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke('ide:read-file', filePath),
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke('ide:write-file', filePath, content),
    createItem: (parentPath: string, name: string, isDirectory: boolean) =>
      ipcRenderer.invoke('ide:create-item', parentPath, name, isDirectory),
    deleteItem: (itemPath: string) => ipcRenderer.invoke('ide:delete-item', itemPath),
    renameItem: (oldPath: string, newName: string) =>
      ipcRenderer.invoke('ide:rename-item', oldPath, newName),
  },
  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:open-directory'),
  },
  proxy: {
    getConfig: () => ipcRenderer.invoke('proxy:get-config'),
    updateConfig: (updates: any) => ipcRenderer.invoke('proxy:update-config', updates),
    resetConfig: () => ipcRenderer.invoke('proxy:reset-config'),
    getServerInfo: () => ipcRenderer.invoke('proxy:get-server-info'),
    getCertificateInfo: () => ipcRenderer.invoke('proxy:get-certificate-info'),
    exportCertificate: () => ipcRenderer.invoke('proxy:export-certificate'),
    deleteCertificates: () => ipcRenderer.invoke('proxy:delete-certificates'),
    regenerateCertificates: () => ipcRenderer.invoke('proxy:regenerate-certificates'),
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
    console.log('[Preload] APIs exposed to main world (contextIsolated)');
    console.log('[Preload] Server API keys:', Object.keys(api.server));
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error (define in d.ts)
  window.electron = electronAPI;
  // @ts-expect-error (api is defined in d.ts)
  window.api = api;
}
