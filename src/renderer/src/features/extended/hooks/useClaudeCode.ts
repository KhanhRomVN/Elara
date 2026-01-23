import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { ExtendedToolConfig, PlatformInfo, SystemEnvStatus } from '../types/claude-code';

export const useClaudeCode = () => {
  const [isClaudeInstalled, setIsClaudeInstalled] = useState<boolean | null>(null);
  const [activeMode, setActiveMode] = useState<'elara' | 'normal'>('elara');
  const [config, setConfig] = useState<Partial<ExtendedToolConfig>>({
    tool_id: 'claude_code',
    tool_name: 'Claude Code',
    website: 'https://claude.ai/',
    url: '',
    provider_id: 'auto',
    model_id: 'auto',
    mode: 'elara',
    ANTHROPIC_DEFAULT_OPUS_MODEL: '',
    ANTHROPIC_DEFAULT_SONNET_MODEL: '',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: '',
  });

  const [providers, setProviders] = useState<any[]>([]);
  const [serverPort, setServerPort] = useState<number>(3030);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);
  const [systemEnvStatus, setSystemEnvStatus] = useState<SystemEnvStatus | null>(null);

  // States for Normal Mode (Inputs)
  const [authToken, setAuthToken] = useState('');
  const [normalModel, setNormalModel] = useState('');
  const [normalOpus, setNormalOpus] = useState('');
  const [normalSonnet, setNormalSonnet] = useState('');
  const [normalHaiku, setNormalHaiku] = useState('');

  // States for Elara Mode (Dropdowns per model)
  const [elaraConfigs, setElaraConfigs] = useState<
    Record<string, { provider: string; model: string }>
  >({
    main: { provider: 'auto', model: 'auto' },
    opus: { provider: 'auto', model: 'auto' },
    sonnet: { provider: 'auto', model: 'auto' },
    haiku: { provider: 'auto', model: 'auto' },
  });

  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({});
  const [availableModels, setAvailableModels] = useState<Record<string, any[]>>({});

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

        // 6. Fetch existing config from database
        const existingConfig: any = await window.api.extendedTools.getByToolId('claude_code');
        if (existingConfig) {
          setIsNewConfig(false);
          const flatConfig = {
            ...existingConfig,
            ...(existingConfig.config || {}),
          };
          delete flatConfig.config;

          setConfig(flatConfig);
          setActiveMode(flatConfig.mode || 'elara');

          // Load saved authToken if exists in config
          if (flatConfig.authToken) {
            setAuthToken(flatConfig.authToken);
          }

          // If Elara mode, parse the complex config from backend if stored
          if (flatConfig.mode === 'elara') {
            setElaraConfigs({
              main: {
                provider: flatConfig.provider_id || 'auto',
                model: flatConfig.model_id || 'auto',
              },
              opus: parseElaraModel(flatConfig.ANTHROPIC_DEFAULT_OPUS_MODEL),
              sonnet: parseElaraModel(flatConfig.ANTHROPIC_DEFAULT_SONNET_MODEL),
              haiku: parseElaraModel(flatConfig.ANTHROPIC_DEFAULT_HAIKU_MODEL),
            });
          } else {
            // Normal mode - load saved model values if they exist
            if (flatConfig.normalModel) setNormalModel(flatConfig.normalModel);
            if (flatConfig.normalOpus) setNormalOpus(flatConfig.normalOpus);
            if (flatConfig.normalSonnet) setNormalSonnet(flatConfig.normalSonnet);
            if (flatConfig.normalHaiku) setNormalHaiku(flatConfig.normalHaiku);
          }
        } else {
          setConfig((prev) => ({
            ...prev,
            url: envBaseUrl || `http://localhost:${port}/chat/messages`,
            mode: 'elara',
          }));
        }

        // 7. Fetch providers
        const providersData = await window.api.server.getProviders();
        setProviders(providersData || []);
      } catch (error) {
        console.error('Failed to initialize Claude Code:', error);
      }
    };

    init();
  }, []);

  const parseElaraModel = (val?: string) => {
    if (!val) return { provider: 'auto', model: 'auto' };
    if (val.startsWith('elara://')) {
      const parts = val.replace('elara://', '').split('/');
      return { provider: parts[0] || 'auto', model: parts[1] || 'auto' };
    }
    return { provider: 'auto', model: 'auto' };
  };

  const stringifyElaraModel = (p: string, m: string) => {
    if (p === 'auto' && m === 'auto') return '';
    return `elara://${p}/${m}`;
  };

  const fetchModelsForType = async (type: string, providerId: string) => {
    if (providerId === 'auto') {
      setAvailableModels((prev) => ({ ...prev, [type]: [] }));
      return;
    }
    setLoadingModels((prev) => ({ ...prev, [type]: true }));
    try {
      const result = await window.api.server.getModels(providerId);
      console.log(`[ClaudeCode] Fetched models for ${type}/${providerId}:`, result);

      // Handle different response formats
      let models: any[] = [];
      if (result.success && Array.isArray(result.data)) {
        models = result.data;
      } else if (Array.isArray(result)) {
        models = result;
      } else if (result.data && Array.isArray(result.data)) {
        models = result.data;
      }

      setAvailableModels((prev) => ({ ...prev, [type]: models }));
    } catch (e) {
      console.error(`Failed to fetch models for ${type}:`, e);
      setAvailableModels((prev) => ({ ...prev, [type]: [] }));
    } finally {
      setLoadingModels((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleElaraConfigChange = (type: string, field: 'provider' | 'model', value: string) => {
    const newConfigs = {
      ...elaraConfigs,
      [type]: { ...elaraConfigs[type], [field]: value },
    };

    if (field === 'provider') {
      newConfigs[type].model = 'auto';
      fetchModelsForType(type, value);
    }

    setElaraConfigs(newConfigs);

    // Update main config object
    if (type === 'main') {
      setConfig({
        ...config,
        provider_id: newConfigs.main.provider,
        model_id: newConfigs.main.model,
      });
    } else {
      const fieldName = `ANTHROPIC_DEFAULT_${type.toUpperCase()}_MODEL` as keyof ExtendedToolConfig;
      setConfig({
        ...config,
        [fieldName]: stringifyElaraModel(newConfigs[type].provider, newConfigs[type].model),
      });
    }
  };

  const resetUrl = () => {
    setConfig({ ...config, url: `http://localhost:${serverPort}/chat/messages` });
    toast.info('Base URL reset to local Elara server');
  };

  const handleSave = async () => {
    try {
      const { id, tool_id, tool_name, website, url, provider_id, model_id, ...toolSpecific } =
        config as any;

      const finalConfig = {
        id,
        tool_id,
        tool_name,
        website,
        url,
        provider_id,
        model_id,
        config: {
          ...toolSpecific,
          mode: activeMode,
          authToken,
          normalModel,
          normalOpus,
          normalSonnet,
          normalHaiku,
        },
      };

      const result: any = await window.api.extendedTools.upsert(finalConfig);

      const flatResult = {
        ...result,
        ...(result.config || {}),
      };
      delete flatResult.config;

      setConfig(flatResult);
      setIsNewConfig(false);
      toast.success('Configuration saved successfully');
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration');
    }
  };

  const handleSaveToSystem = async () => {
    setSavingToSystem(true);
    try {
      let payload: any = {
        ANTHROPIC_BASE_URL: config.url,
        ANTHROPIC_AUTH_TOKEN: authToken || undefined,
      };

      if (activeMode === 'elara') {
        payload.ANTHROPIC_MODEL = `elara://${elaraConfigs.main.provider}/${elaraConfigs.main.model}`;
        payload.ANTHROPIC_DEFAULT_OPUS_MODEL = stringifyElaraModel(
          elaraConfigs.opus.provider,
          elaraConfigs.opus.model,
        );
        payload.ANTHROPIC_DEFAULT_SONNET_MODEL = stringifyElaraModel(
          elaraConfigs.sonnet.provider,
          elaraConfigs.sonnet.model,
        );
        payload.ANTHROPIC_DEFAULT_HAIKU_MODEL = stringifyElaraModel(
          elaraConfigs.haiku.provider,
          elaraConfigs.haiku.model,
        );
      } else {
        payload.ANTHROPIC_MODEL = normalModel || undefined;
        payload.ANTHROPIC_DEFAULT_OPUS_MODEL = normalOpus || undefined;
        payload.ANTHROPIC_DEFAULT_SONNET_MODEL = normalSonnet || undefined;
        payload.ANTHROPIC_DEFAULT_HAIKU_MODEL = normalHaiku || undefined;
      }

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

    const status: Record<string, boolean> = {
      url: checkSync(config.url || '', env.ANTHROPIC_BASE_URL),
      authToken: checkSync(authToken, env.ANTHROPIC_AUTH_TOKEN),
    };

    if (activeMode === 'elara') {
      status.main = checkSync(
        `elara://${elaraConfigs.main.provider}/${elaraConfigs.main.model}`,
        env.ANTHROPIC_MODEL,
      );
      status.opus = checkSync(
        stringifyElaraModel(elaraConfigs.opus.provider, elaraConfigs.opus.model),
        env.ANTHROPIC_DEFAULT_OPUS_MODEL,
      );
      status.sonnet = checkSync(
        stringifyElaraModel(elaraConfigs.sonnet.provider, elaraConfigs.sonnet.model),
        env.ANTHROPIC_DEFAULT_SONNET_MODEL,
      );
      status.haiku = checkSync(
        stringifyElaraModel(elaraConfigs.haiku.provider, elaraConfigs.haiku.model),
        env.ANTHROPIC_DEFAULT_HAIKU_MODEL,
      );
    } else {
      status.main = checkSync(normalModel, env.ANTHROPIC_MODEL);
      status.opus = checkSync(normalOpus, env.ANTHROPIC_DEFAULT_OPUS_MODEL);
      status.sonnet = checkSync(normalSonnet, env.ANTHROPIC_DEFAULT_SONNET_MODEL);
      status.haiku = checkSync(normalHaiku, env.ANTHROPIC_DEFAULT_HAIKU_MODEL);
    }

    return status;
  }, [
    config.url,
    authToken,
    normalModel,
    normalOpus,
    normalSonnet,
    normalHaiku,
    elaraConfigs,
    activeMode,
    systemEnvStatus,
  ]);

  return {
    isClaudeInstalled,
    activeMode,
    setActiveMode,
    config,
    setConfig,
    providers,
    availableModels,
    loadingModels,
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
    elaraConfigs,
    handleElaraConfigChange,
    savingToSystem,
    restoringDefaults,
    resetUrl,
    handleSave,
    handleSaveToSystem,
    handleRestoreDefaults,
    syncStatus,
    isNewConfig,
  };
};
