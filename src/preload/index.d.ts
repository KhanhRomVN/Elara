import { ElectronAPI } from '@electron-toolkit/preload';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface API {
  accounts: {
    getAll: () => Promise<any[]>;
    getById: (id: string) => Promise<any>;
    add: (account: any) => Promise<any>;
    login: (provider: string) => Promise<any>;
    delete: (id: string) => Promise<any>;
    update: (id: string, updates: any) => Promise<any>;
    export: () => Promise<any>;
  };
  logs: {
    create: (log: any) => Promise<any>;
    getByAccount: (options: { accountId: string; options?: any }) => Promise<any>;
    getStatistics: (accountId: string) => Promise<any>;
    getTimeline: (options: { accountId: string; days?: number }) => Promise<any>;
    cleanup: () => Promise<any>;
    deleteByAccount: (accountId: string) => Promise<any>;
  };
  server: {
    start: () => Promise<{ success: boolean; port?: number; error?: string }>;
    stop: () => Promise<{ success: boolean; message?: string }>;
  };
  commands: {
    getAll: () => Promise<any[]>;
    add: (command: any) => Promise<boolean>;
    update: (id: string, updates: any) => Promise<boolean>;
    delete: (id: string) => Promise<boolean>;
  };
  stats: {
    getStats: () => Promise<{
      todayRequests: number;
      todayTokens: number;
      history: Array<{ date: string; requests: number; tokens: number }>;
    }>;
  };
}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ElectronIpcRenderer {}

declare global {
  interface Window {
    electron: ElectronAPI & {
      ipcRenderer: ElectronIpcRenderer;
    };
    api: API;
    electronAPI: API;
  }
}
