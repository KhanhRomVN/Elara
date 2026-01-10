import { ipcRenderer } from 'electron';

export const accountsAPI = {
  getAll: () => ipcRenderer.invoke('accounts:get-all'),
  getById: (id: string) => ipcRenderer.invoke('accounts:get-by-id', id),
  add: (account: any) => ipcRenderer.invoke('accounts:add', account),
  login: (provider: string) => ipcRenderer.invoke('accounts:login', provider),
  delete: (id: string) => ipcRenderer.invoke('accounts:delete', id),
  update: (id: string, updates: any) => ipcRenderer.invoke('accounts:update', { id, updates }),
  export: () => ipcRenderer.invoke('accounts:export'),
};
