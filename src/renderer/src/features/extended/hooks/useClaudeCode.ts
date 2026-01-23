import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { ExtendedToolConfig, PlatformInfo, SystemEnvStatus } from '../types/claude-code';

export const useClaudeCode = () => {
  const [isClaudeInstalled, setIsClaudeInstalled] = useState<boolean | null>(null);
  const [activeMode] = useState<'normal'>('normal'); // Always normal mode now
  const [config, setConfig] = useState<Partial<ExtendedToolConfig>>({
    url: localStorage.getItem('claude_code_url') || '',
  });

  const [serverPort, setServerPort] = useState<number>(3030);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);
  const [systemEnvStatus, setSystemEnvStatus] = useState<SystemEnvStatus | null>(null);

  // States for Normal Mode (Inputs) - Loaded from localStorage
  const [authToken, setAuthToken] = useState(localStorage.getItem('claude_code_auth_token') || '');
  const [normalModel, setNormalModel] = useState(localStorage.getItem('claude_code_model') || '');
  const [normalOpus, setNormalOpus] = useState(localStorage.getItem('claude_code_opus') || '');
  const [normalSonnet, setNormalSonnet] = useState(
    localStorage.getItem('claude_code_sonnet') || '',
  );
  const [normalHaiku, setNormalHaiku] = useState(localStorage.getItem('claude_code_haiku') || '');

  const [savingToSystem, setSavingToSystem] = useState(false);
  const [restoringDefaults, setRestoringDefaults] = useState(false);

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

        let finalUrl = config.url;

        // Prioritize values from system environment
        if (sysEnv?.currentValues) {
          const env = sysEnv.currentValues;

          if (env.ANTHROPIC_BASE_URL) {
            finalUrl = env.ANTHROPIC_BASE_URL;
            localStorage.setItem('claude_code_url', finalUrl);
          }

          if (env.ANTHROPIC_AUTH_TOKEN) {
            setAuthToken(env.ANTHROPIC_AUTH_TOKEN);
            localStorage.setItem('claude_code_auth_token', env.ANTHROPIC_AUTH_TOKEN);
          }

          if (env.ANTHROPIC_MODEL) {
            setNormalModel(env.ANTHROPIC_MODEL);
            localStorage.setItem('claude_code_model', env.ANTHROPIC_MODEL);
          }

          if (env.ANTHROPIC_DEFAULT_OPUS_MODEL) {
            setNormalOpus(env.ANTHROPIC_DEFAULT_OPUS_MODEL);
            localStorage.setItem('claude_code_opus', env.ANTHROPIC_DEFAULT_OPUS_MODEL);
          }

          if (env.ANTHROPIC_DEFAULT_SONNET_MODEL) {
            setNormalSonnet(env.ANTHROPIC_DEFAULT_SONNET_MODEL);
            localStorage.setItem('claude_code_sonnet', env.ANTHROPIC_DEFAULT_SONNET_MODEL);
          }

          if (env.ANTHROPIC_DEFAULT_HAIKU_MODEL) {
            setNormalHaiku(env.ANTHROPIC_DEFAULT_HAIKU_MODEL);
            localStorage.setItem('claude_code_haiku', env.ANTHROPIC_DEFAULT_HAIKU_MODEL);
          }
        }

        // 5. Default URL if empty
        if (!finalUrl) {
          finalUrl = `http://localhost:${port}/v1/messages`;
          localStorage.setItem('claude_code_url', finalUrl);
        }

        setConfig({ url: finalUrl });
      } catch (error) {
        console.error('Failed to initialize Claude Code:', error);
      }
    };

    init();
  }, []);

  const resetUrl = () => {
    const defaultUrl = `http://localhost:${serverPort}/v1/messages`;
    setConfig({ url: defaultUrl });
    localStorage.setItem('claude_code_url', defaultUrl);
    toast.info('Base URL reset to local Elara server');
  };

  const handleSave = async () => {
    try {
      // Save all to localStorage
      localStorage.setItem('claude_code_url', config.url || '');
      localStorage.setItem('claude_code_auth_token', authToken);
      localStorage.setItem('claude_code_model', normalModel);
      localStorage.setItem('claude_code_opus', normalOpus);
      localStorage.setItem('claude_code_sonnet', normalSonnet);
      localStorage.setItem('claude_code_haiku', normalHaiku);

      toast.success('Configuration saved locally');
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration');
    }
  };

  const handleSaveToSystem = async () => {
    setSavingToSystem(true);
    try {
      // First save locally
      await handleSave();

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
    activeMode,
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
    handleSave,
    handleSaveToSystem,
    handleRestoreDefaults,
    syncStatus,
  };
};
