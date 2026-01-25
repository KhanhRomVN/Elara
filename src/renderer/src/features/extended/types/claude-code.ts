export interface ExtendedToolConfig {
  id: string;
  tool_id: string;
  tool_name: string;
  website: string;
  url: string;
  provider_id: string;
  model_id: string;
  mode: 'elara' | 'normal';
  ANTHROPIC_DEFAULT_OPUS_MODEL?: string;
  ANTHROPIC_DEFAULT_SONNET_MODEL?: string;
  ANTHROPIC_DEFAULT_HAIKU_MODEL?: string;
}

export interface PlatformInfo {
  platform: NodeJS.Platform;
  release: string;
  type: string;
  homedir: string;
  shell: string;
  profilePath: string;
  profileType: 'bash' | 'zsh' | 'fish' | 'powershell' | 'cmd' | 'unknown';
}

export interface SystemEnvStatus {
  configured: boolean;
  profilePath?: string;
  platformInfo?: PlatformInfo;
  currentValues?: Record<string, string>;
}
export interface CliSyncStatus {
  installed: boolean;
  version: string | null;
  is_synced: boolean;
  has_backup: boolean;
  current_base_url: string | null;
  files: string[];
}
