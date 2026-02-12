import { ElectronAPI } from '@electron-toolkit/preload';
import { IpcRendererEvent } from 'electron';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface API {
  shell: {
    execute: (command: string, cwd?: string) => Promise<string>;
  };
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
    getProviders: () => Promise<any[]>;
    getInfo: () => Promise<any>;
    getEnv: (key: string) => Promise<string | undefined>;
    getModels: (providerId: string) => Promise<any>;
    getPlatformInfo: () => Promise<{
      platform: NodeJS.Platform;
      release: string;
      type: string;
      homedir: string;
      shell: string;
      profilePath: string;
      profileType: 'bash' | 'zsh' | 'fish' | 'powershell' | 'cmd' | 'unknown';
    }>;
    saveEnvToSystem: (envVars: {
      ANTHROPIC_BASE_URL: string;
      ANTHROPIC_AUTH_TOKEN?: string;
      ANTHROPIC_MODEL?: string;
      ANTHROPIC_DEFAULT_SONNET_MODEL?: string;
    }) => Promise<{
      success: boolean;
      profilePath?: string;
      profileType?: string;
      platform?: NodeJS.Platform;
      message?: string;
      error?: string;
    }>;
    restoreEnvDefaults: () => Promise<{
      success: boolean;
      profilePath?: string;
      message?: string;
      error?: string;
    }>;
    checkSystemEnv: () => Promise<{
      configured: boolean;
      profilePath?: string;
      platformInfo?: any;
      currentValues?: Record<string, string>;
      error?: string;
    }>;
  };
  extendedTools: {
    getAll: () => Promise<any[]>;
    getByToolId: (toolId: string) => Promise<any>;
    upsert: (tool: any) => Promise<any>;
    delete: (id: string) => Promise<void>;
  };
  commands: {
    getAll: () => Promise<any[]>;
    add: (command: any) => Promise<boolean>;
    update: (id: string, updates: any) => Promise<boolean>;
    delete: (id: string) => Promise<boolean>;
    readFile: (filePath: string) => Promise<string>;
    writeFile: (filePath: string, content: string) => Promise<boolean>;
    listFiles: (path: string, recursive?: boolean) => Promise<string[]>;
    searchFiles: (params: { path: string; regex: string; pattern?: string }) => Promise<string>;
    checkPathExists: (path: string) => Promise<boolean>;
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
  version: {
    checkForUpdates: () => Promise<{
      updateAvailable: boolean;
      remoteVersion: string;
      currentVersion: string;
      updateType: 'app' | 'resource' | 'none';
    }>;
    performUpdate: (remoteVersion: string) => Promise<{ success: boolean; message: string }>;
  };
  dialog: {
    openDirectory: () => Promise<{ canceled: boolean; filePaths: string[] }>;
  };
  workspaces: {
    list: () => Promise<any[]>;
    link: (folderPath: string) => Promise<any>;
    getContext: (id: string) => Promise<{ workspace: string; rules: string }>;
    updateContext: (id: string, type: 'workspace' | 'rules', content: string) => Promise<void>;
    scan: (folderPath: string) => Promise<string>;
    getTree: (folderPath: string) => Promise<any[]>;
    getSummary: (workspaceId: string, conversationId: string) => Promise<string>;
    updateSummary: (workspaceId: string, conversationId: string, content: string) => Promise<void>;
    createSession: (
      workspaceId: string,
      conversationId: string,
      data: any,
    ) => Promise<{ sessionPath: string; summaryPath: string }>;
  };
  git: {
    status: (repoPath: string) => Promise<{
      modified: string[];
      staged: string[];
      untracked: string[];
      conflicted: string[];
      ahead: number;
      behind: number;
      current: string;
      tracking: string;
    }>;
    diffStats: (repoPath: string) => Promise<{
      files: { [path: string]: { insertions: number; deletions: number; binary: boolean } };
      total: { insertions: number; deletions: number };
    }>;
    add: (repoPath: string, files: string[]) => Promise<void>;
    commit: (repoPath: string, message: string) => Promise<void>;
  };
  watcher: {
    watch: (folderPath: string) => Promise<void>;
    unwatch: () => Promise<void>;
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
