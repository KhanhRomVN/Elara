import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { ExtendedToolConfig, PlatformInfo, SystemEnvStatus } from '../types/claude-code';

export const useClaudeCode = () => {
  const [isClaudeInstalled, setIsClaudeInstalled] = useState<boolean | null>(null);

  // Simplified config state - removed 'activeMode' and Elara specific fields
  const [config, setConfig] = useState<Partial<ExtendedToolConfig>>({
    tool_id: 'claude_code',
    tool_name: 'Claude Code',
    website: 'https://claude.ai/',
    url: '',
    // Deprecated fields kept for type compatibility but unused
    provider_id: 'auto',
    model_id: 'auto',
    mode: 'normal',
    ANTHROPIC_DEFAULT_OPUS_MODEL: '',
    ANTHROPIC_DEFAULT_SONNET_MODEL: '',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: '',
  });

  const [serverPort, setServerPort] = useState<number>(3030);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);
  const [systemEnvStatus, setSystemEnvStatus] = useState<SystemEnvStatus | null>(null);

  // States for Environment Variables
  const [authToken, setAuthToken] = useState('');
  const [normalModel, setNormalModel] = useState('');
  const [normalOpus, setNormalOpus] = useState('');
  const [normalSonnet, setNormalSonnet] = useState('');
  const [normalHaiku, setNormalHaiku] = useState('');

  const [savingToSystem, setSavingToSystem] = useState(false);
  const [restoringDefaults, setRestoringDefaults] = useState(false);
  const [isNewConfig, setIsNewConfig] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        // 1. Check if Claude is installed
        try {
          await window.api.shell.execute('claude --version');
          setIsClaudeInstalled(true);
        } catch (e) {
          setIsClaudeInstalled(false);
        }

        // 2. Fetch server info
        const serverInfo = await window.api.server.getInfo();
        const port = serverInfo?.port || 3030;
        setServerPort(port);

        // 3. Fetch platform info
        const pInfo = await window.api.server.getPlatformInfo();
        setPlatformInfo(pInfo);

        // 4. Check system env status
        const sysEnv = await window.api.server.checkSystemEnv();
        setSystemEnvStatus(sysEnv);

        if (sysEnv.currentValues) {
          setAuthToken(sysEnv.currentValues.ANTHROPIC_AUTH_TOKEN || '');
          setNormalModel(sysEnv.currentValues.ANTHROPIC_MODEL || '');
          setNormalOpus(sysEnv.currentValues.ANTHROPIC_DEFAULT_OPUS_MODEL || '');
          setNormalSonnet(sysEnv.currentValues.ANTHROPIC_DEFAULT_SONNET_MODEL || '');
          setNormalHaiku(sysEnv.currentValues.ANTHROPIC_DEFAULT_HAIKU_MODEL || '');
        }

        // 5. Fetch env base URL
        const envBaseUrl = (await window.api.server.getEnv('ANTHROPIC_BASE_URL')) || '';

        // 6. Config is now purely managed via system env vars and defaults
        // Standard Anthropic SDK appends /v1/messages, so we point to server root
        setConfig((prev) => ({
          ...prev,
          url: envBaseUrl || `http://localhost:${port}`,
          mode: 'normal',
        }));

        // Check if legacy config exists locally to migrate once (optional, skipped for simplicity as per user request to rely on env vars)
        setIsNewConfig(false);
      } catch (error) {
        console.error('Failed to initialize Claude Code:', error);
      }
    };

    init();
  }, []);

  const resetUrl = () => {
    setConfig({ ...config, url: `http://localhost:${serverPort}` });
    toast.info('Base URL reset to local Elara server');
  };

  // handleSave removed as we no longer save to extended_tools db

  const handleSaveToSystem = async () => {
    setSavingToSystem(true);
    try {
      // Only process "Normal Mode" logic (direct env vars)
      const payload: any = {
        ANTHROPIC_BASE_URL: config.url,
        ANTHROPIC_AUTH_TOKEN: authToken || undefined,
        ANTHROPIC_MODEL: normalModel || undefined,
        ANTHROPIC_DEFAULT_OPUS_MODEL: normalOpus || undefined,
        ANTHROPIC_DEFAULT_SONNET_MODEL: normalSonnet || undefined,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: normalHaiku || undefined,
      };

      const result = await window.api.server.saveEnvToSystem(payload);

      if (result.success) {
        toast.success(result.message || 'Environment variables saved to system');
        const sysEnv = await window.api.server.checkSystemEnv();
        setSystemEnvStatus(sysEnv);
      } else {
        toast.error(result.error || 'Failed to save environment variables');
      }
    } catch (error: any) {
      console.error('Failed to save to system:', error);
      toast.error(error.message || 'Failed to save environment variables');
    } finally {
      setSavingToSystem(false);
    }
  };

  const handleRestoreDefaults = async () => {
    setRestoringDefaults(true);
    try {
      const result = await window.api.server.restoreEnvDefaults();
      if (result.success) {
        toast.success(result.message || 'Environment variables restored to defaults');
        const sysEnv = await window.api.server.checkSystemEnv();
        setSystemEnvStatus(sysEnv);
        // Reset local state from sysEnv
        if (sysEnv.currentValues) {
          setAuthToken(sysEnv.currentValues.ANTHROPIC_AUTH_TOKEN || '');
          setNormalModel(sysEnv.currentValues.ANTHROPIC_MODEL || '');
          setNormalOpus(sysEnv.currentValues.ANTHROPIC_DEFAULT_OPUS_MODEL || '');
          setNormalSonnet(sysEnv.currentValues.ANTHROPIC_DEFAULT_SONNET_MODEL || '');
          setNormalHaiku(sysEnv.currentValues.ANTHROPIC_DEFAULT_HAIKU_MODEL || '');
        }
      } else {
        toast.error(result.error || 'Failed to restore defaults');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to restore defaults');
    } finally {
      setRestoringDefaults(false);
    }
  };

  const syncStatus = useMemo(() => {
    if (!systemEnvStatus?.currentValues) return {};
    const env = systemEnvStatus.currentValues;

    const checkSync = (val1: string, val2?: string) => {
      if (!val1 && !val2) return true;
      return val1 === val2;
    };

    return {
      url: checkSync(config.url || '', env.ANTHROPIC_BASE_URL),
      authToken: checkSync(authToken, env.ANTHROPIC_AUTH_TOKEN),
      main: checkSync(normalModel, env.ANTHROPIC_MODEL),
      opus: checkSync(normalOpus, env.ANTHROPIC_DEFAULT_OPUS_MODEL),
      sonnet: checkSync(normalSonnet, env.ANTHROPIC_DEFAULT_SONNET_MODEL),
      haiku: checkSync(normalHaiku, env.ANTHROPIC_DEFAULT_HAIKU_MODEL),
    };
  }, [config.url, authToken, normalModel, normalOpus, normalSonnet, normalHaiku, systemEnvStatus]);

  return {
    isClaudeInstalled,
    config,
    setConfig,
    systemEnvStatus,
    authToken,
    setAuthToken,
    normalModel,
    setNormalModel,
    normalOpus,
    setNormalOpus,
    normalSonnet,
    setNormalSonnet,
    normalHaiku,
    setNormalHaiku,
    savingToSystem,
    restoringDefaults,
    resetUrl,
    handleSaveToSystem,
    handleRestoreDefaults,
    syncStatus,
    isNewConfig,
  };
};
