import { ElectronAPI } from '@electron-toolkit/preload';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface API {
  accounts: {
    getAll: () => Promise<any[]>;
    add: (account: any) => Promise<any>;
    login: (provider: string) => Promise<any>;
    delete: (id: string) => Promise<any>;
    update: (id: string, updates: any) => Promise<any>;
    export: () => Promise<any>;
  };
  server: {
    start: () => Promise<{ success: boolean; port?: number; error?: string }>;
    stop: () => Promise<{ success: boolean; message?: string }>;
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
