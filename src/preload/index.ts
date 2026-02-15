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
    getStats: (period?: string, offset?: number): Promise<any> =>
      ipcRenderer.invoke('stats:get', period, offset),
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
  workspaces: {
    list: () => {
      console.log('[Preload] invoking workspaces:list');
      return ipcRenderer.invoke('workspaces:list');
    },
    // ...
    link: (folderPath: string) => ipcRenderer.invoke('workspaces:link', folderPath),
    unlink: (id: string) => ipcRenderer.invoke('workspaces:unlink', id),
    getContext: (id: string) => ipcRenderer.invoke('workspaces:get-context', id),
    updateContext: (id: string, type: 'workspace' | 'rules', content: string) =>
      ipcRenderer.invoke('workspaces:update-context', id, type, content),
    scan: (folderPath: string) => ipcRenderer.invoke('workspaces:scan', folderPath),
    getSummary: (workspaceId: string, conversationId: string) =>
      ipcRenderer.invoke('workspaces:get-summary', workspaceId, conversationId),
    updateSummary: (workspaceId: string, conversationId: string, content: string) =>
      ipcRenderer.invoke('workspaces:update-summary', workspaceId, conversationId, content),
    createSession: (workspaceId: string, conversationId: string, data: any) =>
      ipcRenderer.invoke('workspaces:create-session', workspaceId, conversationId, data),
    getSessions: (workspaceId: string) =>
      ipcRenderer.invoke('workspaces:get-sessions', workspaceId),
    getTree: (folderPath: string) => ipcRenderer.invoke('workspaces:get-tree', folderPath),
  },
  git: {
    status: (repoPath: string) => ipcRenderer.invoke('git:status', repoPath),
    diffStats: (repoPath: string) => ipcRenderer.invoke('git:diff-stats', repoPath),
    add: (repoPath: string, files: string[]) => ipcRenderer.invoke('git:add', repoPath, files),
    commit: (repoPath: string, message: string) =>
      ipcRenderer.invoke('git:commit', repoPath, message),
    diff: (repoPath: string, staged?: boolean) => ipcRenderer.invoke('git:diff', repoPath, staged),
    push: (repoPath: string) => ipcRenderer.invoke('git:push', repoPath),
  },
  watcher: {
    watch: (folderPath: string) => ipcRenderer.invoke('watcher:watch', folderPath),
    unwatch: () => ipcRenderer.invoke('watcher:unwatch'),
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
    console.log('[Preload] APIs exposed to main world (contextIsolated)');
    console.log('[Preload] API root keys:', Object.keys(api));
    console.log('[Preload] Workspaces API keys:', Object.keys(api.workspaces));
    console.log('[Preload] Git API keys:', api.git ? Object.keys(api.git) : 'MISSING');
    console.log('[Preload] Watcher API keys:', api.watcher ? Object.keys(api.watcher) : 'MISSING');
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-expect-error (define in d.ts)
  window.electron = electronAPI;
  // @ts-expect-error (api is defined in d.ts)
  window.api = api;
}
