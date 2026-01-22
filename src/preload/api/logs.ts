import { ipcRenderer } from 'electron';

export const logsAPI = {
  create: (log: any) => ipcRenderer.invoke('logs:create', log),
  getByAccount: (options: { accountId: string; options?: any }) =>
    ipcRenderer.invoke('logs:get-by-account', options),
  getStatistics: (accountId: string) => ipcRenderer.invoke('logs:get-statistics', accountId),
  getTimeline: (options: { accountId: string; days?: number }) =>
    ipcRenderer.invoke('logs:get-timeline', options),
  cleanup: () => ipcRenderer.invoke('logs:cleanup'),
  deleteByAccount: (accountId: string) => ipcRenderer.invoke('logs:delete-by-account', accountId),
};
