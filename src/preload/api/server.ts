import { ipcRenderer } from 'electron';

export const serverAPI = {
  start: () => ipcRenderer.invoke('server:start'),
  stop: () => ipcRenderer.invoke('server:stop'),
  getProviders: () => ipcRenderer.invoke('server:get-providers'),
  getInfo: () => ipcRenderer.invoke('server:get-info'),
  getEnv: (key: string) => ipcRenderer.invoke('server:get-env', key),
  getModels: (providerId: string) => ipcRenderer.invoke('server:get-models', providerId),
  getPlatformInfo: () => ipcRenderer.invoke('server:get-platform-info'),
  saveEnvToSystem: (envVars: {
    ANTHROPIC_BASE_URL: string;
    ANTHROPIC_AUTH_TOKEN?: string;
    ANTHROPIC_MODEL?: string;
    ANTHROPIC_DEFAULT_OPUS_MODEL?: string;
    ANTHROPIC_DEFAULT_SONNET_MODEL?: string;
    ANTHROPIC_DEFAULT_HAIKU_MODEL?: string;
  }) => ipcRenderer.invoke('server:save-env-to-system', envVars),
  restoreEnvDefaults: () => ipcRenderer.invoke('server:restore-env-defaults'),
  checkSystemEnv: () => ipcRenderer.invoke('server:check-system-env'),

  // Claude Code CLI JSON Sync
  getClaudeCodeSyncStatus: (proxyUrl: string) =>
    ipcRenderer.invoke('server:get-claudecode-sync-status', proxyUrl),
  executeClaudeCodeSync: (params: { proxyUrl: string; apiKey: string }) =>
    ipcRenderer.invoke('server:execute-claudecode-sync', params),
  executeClaudeCodeRestore: () => ipcRenderer.invoke('server:execute-claudecode-restore'),

  // Generic Config
  getConfigValues: (keys: string) => ipcRenderer.invoke('server:get-config-values', keys),
  saveConfigValues: (values: Record<string, string>) =>
    ipcRenderer.invoke('server:save-config-values', values),
};
