import { ElectronAPI } from '@electron-toolkit/preload';
import { IpcRendererEvent } from 'electron';

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
    import: () => Promise<any>;
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
    readFile: (filePath: string) => Promise<string>;
    writeFile: (filePath: string, content: string) => Promise<boolean>;
    prompt: (message: string) => Promise<string>;
  };
  stats: {
    getStats: () => Promise<{
      todayRequests: number;
      todayTokens: number;
      history: Array<{ date: string; requests: number; tokens: number }>;
    }>;
  };
  proxy: {
    getConfig: () => Promise<{ success: boolean; config?: any; error?: string }>;
    updateConfig: (updates: any) => Promise<{ success: boolean; config?: any; error?: string }>;
    resetConfig: () => Promise<{ success: boolean; config?: any; error?: string }>;
    getServerInfo: () => Promise<{
      success: boolean;
      info?: {
        running: boolean;
        port: number;
        host: string;
        https: boolean;
        strategy: string;
        localhostOnly: boolean;
      };
      error?: string;
    }>;
    getCertificateInfo: () => Promise<{ success: boolean; info?: any; error?: string }>;
    exportCertificate: () => Promise<{ success: boolean; certificate?: string; error?: string }>;
    deleteCertificates: () => Promise<{ success: boolean; message?: string; error?: string }>;
    regenerateCertificates: () => Promise<{
      success: boolean;
      certificates?: any;
      error?: string;
    }>;
  };
  // General IPC methods
  on: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => () => void;
  send: (channel: string, ...args: any[]) => void;
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
