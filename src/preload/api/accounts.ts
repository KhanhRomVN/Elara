import { ipcRenderer } from 'electron';

export const accountsAPI = {
  getAll: () => ipcRenderer.invoke('accounts:get-all'),
  getById: (id: string) => ipcRenderer.invoke('accounts:get-by-id', id),
  add: (account: any) => ipcRenderer.invoke('accounts:add', account),
  create: (account: any) => ipcRenderer.invoke('accounts:create', account),
  login: (provider: string, options?: any) =>
    ipcRenderer.invoke('accounts:login', provider, options),
  delete: (id: string) => ipcRenderer.invoke('accounts:delete', id),
  update: (id: string, updates: any) => ipcRenderer.invoke('accounts:update', { id, updates }),
  export: () => ipcRenderer.invoke('accounts:export'),
  import: () => ipcRenderer.invoke('accounts:import'),
  // Antigravity specifcs
  antigravity: {
    prepareOAuth: () => ipcRenderer.invoke('accounts:antigravity:prepare-oauth'),
    completeOAuth: () => ipcRenderer.invoke('accounts:antigravity:complete-oauth'),
    addByToken: (token: string) => ipcRenderer.invoke('accounts:antigravity:add-by-token', token),
  },
  stepfun: {
    sendOTP: (email: string) => ipcRenderer.invoke('accounts:stepfun:send-otp', email),
    login: (email: string, code: string) =>
      ipcRenderer.invoke('accounts:stepfun:login', { email, code }),
  },
};
