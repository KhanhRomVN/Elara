import { useState, useEffect, useMemo } from 'react';
import { Sparkles, History as HistoryIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ExtendedToolConfig, SystemEnvStatus, CliSyncStatus } from '../types/claude-code';
import { getApiBaseUrl } from '../../../utils/apiUrl';

export interface DropdownOption {
  value: string;
  label: string;
  subLabel?: string;
  icon?: string | React.ReactNode;
  details?: any;
  isCustom?: boolean;
  sequence?: number;
}

const STORAGE_KEYS = {
  URLS: 'claude_code_history_urls',
  TOKENS: 'claude_code_history_tokens',
  MODELS: 'claude_code_history_models',
};

export const useClaudeCode = () => {
  const [isClaudeInstalled, setIsClaudeInstalled] = useState<boolean | null>(null);

  // Simplified config state
  const [config, setConfig] = useState<Partial<ExtendedToolConfig>>({
    tool_id: 'claude_code',
    tool_name: 'Claude Code',
    website: 'https://claude.ai/',
    url: '',
    provider_id: 'auto',
    model_id: 'auto',
    mode: 'normal',
    ANTHROPIC_DEFAULT_OPUS_MODEL: '',
    ANTHROPIC_DEFAULT_SONNET_MODEL: '',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: '',
  });

  const [serverPort, setServerPort] = useState<number>(3030);

  const [systemEnvStatus, setSystemEnvStatus] = useState<SystemEnvStatus | null>(null);
  const [cliStatus, setCliStatus] = useState<CliSyncStatus | null>(null);

  // States for Environment Variables
  const [authToken, setAuthToken] = useState('');
  const [normalModel, setNormalModel] = useState('');
  const [normalOpus, setNormalOpus] = useState('');
  const [normalSonnet, setNormalSonnet] = useState('');
  const [normalHaiku, setNormalHaiku] = useState('');

  // History States
  const [historyUrls, setHistoryUrls] = useState<string[]>([]);
  const [historyTokens, setHistoryTokens] = useState<string[]>([]);
  const [historyModels, setHistoryModels] = useState<string[]>([]);

  // API Models State
  const [apiModels, setApiModels] = useState<DropdownOption[]>([]);
  const [sequences, setSequences] = useState<any[]>([]);

  const [savingToSystem, setSavingToSystem] = useState(false);
  const [restoringDefaults, setRestoringDefaults] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isNewConfig, setIsNewConfig] = useState(true);

  // Load History from LocalStorage
  useEffect(() => {
    const loadHistory = (key: string, setter: (val: string[]) => void) => {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          setter(JSON.parse(stored));
        }
      } catch (e) {
        console.error(`Failed to load history for ${key}`, e);
      }
    };

    loadHistory(STORAGE_KEYS.URLS, setHistoryUrls);
    loadHistory(STORAGE_KEYS.TOKENS, setHistoryTokens);
    loadHistory(STORAGE_KEYS.MODELS, setHistoryModels);
  }, []);

  const addToHistory = (
    key: string,
    value: string,
    currentList: string[],
    setter: (val: string[]) => void,
  ) => {
    if (!value || value === 'auto') return;
    const newList = [value, ...currentList.filter((item) => item !== value)].slice(0, 10); // Keep last 10
    setter(newList);
    localStorage.setItem(key, JSON.stringify(newList));
  };

  const handleUrlChange = (val: string) => {
    setConfig((prev) => ({ ...prev, url: val }));
    addToHistory(STORAGE_KEYS.URLS, val, historyUrls, setHistoryUrls);
  };

  const handleTokenChange = (val: string) => {
    setAuthToken(val);
    addToHistory(STORAGE_KEYS.TOKENS, val, historyTokens, setHistoryTokens);
  };

  const handleModelChange = (val: string, setter: (v: string) => void) => {
    setter(val);
    addToHistory(STORAGE_KEYS.MODELS, val, historyModels, setHistoryModels);

    // Persist to DB for backend mapping
    let key = '';
    if (setter === setNormalModel) key = 'claudecode_main_model';
    else if (setter === setNormalOpus) key = 'claudecode_opus_model';
    else if (setter === setNormalSonnet) key = 'claudecode_sonnet_model';
    else if (setter === setNormalHaiku) key = 'claudecode_haiku_model';

    if (key) {
      window.api.server.saveConfigValues({ [key]: val }).catch((e: any) => {
        console.error(`Failed to save ${key} to DB`, e);
      });
    }
  };

  const fetchSyncStatus = async (proxyUrl?: string) => {
    try {
      const url = proxyUrl || config.url || `http://localhost:${serverPort}`;
      const status = await window.api.server.getClaudeCodeSyncStatus(url);
      setCliStatus(status);
      return status;
    } catch (e) {
      console.error('Failed to fetch sync status', e);
      return null;
    }
  };

  const fetchDbConfig = async () => {
    try {
      const keys =
        'claudecode_main_model,claudecode_opus_model,claudecode_sonnet_model,claudecode_haiku_model';
      const response = await window.api.server.getConfigValues(keys);
      if (response && response.success && response.data) {
        const d = response.data;
        if (d.claudecode_main_model) setNormalModel(d.claudecode_main_model);
        if (d.claudecode_opus_model) setNormalOpus(d.claudecode_opus_model);
        if (d.claudecode_sonnet_model) setNormalSonnet(d.claudecode_sonnet_model);
        if (d.claudecode_haiku_model) setNormalHaiku(d.claudecode_haiku_model);
        return d;
      }
    } catch (e) {
      console.error('Failed to fetch DB config', e);
    }
    return null;
  };

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

        // 3. Fetch platform info - logic removed as it's not used by UI anymore

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
        const currentUrl = envBaseUrl || `http://localhost:${port}`;
        setConfig((prev) => ({
          ...prev,
          url: currentUrl,
          mode: 'normal',
        }));

        // 7. Fetch new CLI JSON sync status
        await fetchSyncStatus(currentUrl);

        // 8. Fetch preferences from DB
        await fetchDbConfig();

        setIsNewConfig(false);
      } catch (error) {
        console.error('Failed to initialize Claude Code:', error);
      }
    };

    init();
  }, [serverPort]);

  useEffect(() => {
    if (serverPort) {
      fetchProviders();
      fetchSequences();
    }
  }, [serverPort]);

  const fetchSequences = async () => {
    if (!serverPort) return;
    try {
      const baseUrl = getApiBaseUrl(serverPort);
      const res = await fetch(`${baseUrl}/v1/model-sequences`);
      const data = await res.json();
      if (data.success) {
        setSequences(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch sequences', e);
    }
  };

  const fetchProviders = async () => {
    if (!serverPort) return;
    try {
      const baseUrl = getApiBaseUrl(serverPort);
      const res = await fetch(`${baseUrl}/v1/providers`);
      const response = await res.json();
      const providers = response?.data || response; // Support both wrapped and direct array

      if (providers && Array.isArray(providers)) {
        const options: DropdownOption[] = [];
        providers.forEach((provider: any) => {
          if (provider?.models && Array.isArray(provider.models)) {
            provider.models.forEach((model: any) => {
              options.push({
                value: `${provider.provider_id}/${model.id || model.name}`,
                label: model.name,
                subLabel: provider.provider_id,
                icon:
                  provider.icon ||
                  (provider.website
                    ? `https://www.google.com/s2/favicons?domain=${provider.website}&sz=64`
                    : undefined),
                details: {
                  context_length: model.context_length,
                  description: model.is_thinking ? 'Thinking Model' : undefined,
                },
              });
            });
          }
        });
        console.log(
          `[useClaudeCode] Loaded ${options.length} models from ${providers.length} providers`,
        );
        setApiModels(options);
      }
    } catch (e) {
      console.error('Failed to fetch providers', e);
    }
  };

  const resetUrl = () => {
    const url = `http://localhost:${serverPort}`;
    handleUrlChange(url);
    toast.info('Base URL reset to local Elara server');
  };

  const handleSyncConfig = async () => {
    if (!config.url || !authToken) {
      toast.error('Please provide both Base URL and API Key');
      return;
    }

    setIsSyncing(true);
    try {
      // 1. Ensure models are saved to DB first
      await window.api.server.saveConfigValues({
        claudecode_main_model: normalModel,
        claudecode_opus_model: normalOpus,
        claudecode_sonnet_model: normalSonnet,
        claudecode_haiku_model: normalHaiku,
      });

      // 2. Execute file sync (Main Process will now only sync URL and Key)
      const result = await window.api.server.executeClaudeCodeSync({
        proxyUrl: config.url,
        apiKey: authToken,
      });

      if (result.success) {
        toast.success('Claude Code configuration synchronized successfully');
        await fetchSyncStatus();
      } else {
        toast.error(result.error || 'Failed to synchronize configuration');
      }
    } catch (error: any) {
      console.error('Failed to sync config:', error);
      toast.error(error.message || 'Failed to synchronize configuration');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreBackup = async () => {
    setRestoringDefaults(true);
    try {
      const result = await window.api.server.executeClaudeCodeRestore();
      if (result.success) {
        toast.success(result.message || 'Configuration restored from backup');
        await fetchSyncStatus();
      } else {
        toast.error(result.error || 'Failed to restore backup');
      }
    } catch (error: any) {
      console.error('Failed to restore backup:', error);
      toast.error(error.message || 'Failed to restore backup');
    } finally {
      setRestoringDefaults(false);
    }
  };

  const handleSaveToSystem = async () => {
    setSavingToSystem(true);
    try {
      const payload: any = {
        ANTHROPIC_BASE_URL: config.url,
        ANTHROPIC_AUTH_TOKEN: authToken || undefined,
        ANTHROPIC_MODEL: normalModel || undefined,
        ANTHROPIC_DEFAULT_OPUS_MODEL: normalOpus || undefined,
        ANTHROPIC_DEFAULT_SONNET_MODEL: normalSonnet || undefined,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: normalHaiku || undefined,
      };

      // Also save valid values to history before saving to system
      if (config.url) addToHistory(STORAGE_KEYS.URLS, config.url, historyUrls, setHistoryUrls);
      if (authToken) addToHistory(STORAGE_KEYS.TOKENS, authToken, historyTokens, setHistoryTokens);
      if (normalModel)
        addToHistory(STORAGE_KEYS.MODELS, normalModel, historyModels, setHistoryModels);
      if (normalOpus)
        addToHistory(STORAGE_KEYS.MODELS, normalOpus, historyModels, setHistoryModels);
      if (normalSonnet)
        addToHistory(STORAGE_KEYS.MODELS, normalSonnet, historyModels, setHistoryModels);
      if (normalHaiku)
        addToHistory(STORAGE_KEYS.MODELS, normalHaiku, historyModels, setHistoryModels);

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
      jsonSynced: cliStatus?.is_synced || false,
    };
  }, [
    config.url,
    authToken,
    normalModel,
    normalOpus,
    normalSonnet,
    normalHaiku,
    systemEnvStatus,
    cliStatus,
  ]);

  // Derive Options
  const urlOptions: DropdownOption[] = useMemo(() => {
    return historyUrls.map((url) => ({ value: url, label: url, isCustom: true }));
  }, [historyUrls]);

  const tokenOptions: DropdownOption[] = useMemo(() => {
    return historyTokens.map((t) => ({
      value: t,
      label: t.length > 10 ? `${t.substring(0, 10)}...` : t,
      subLabel: 'History',
      isCustom: true,
    }));
  }, [historyTokens]);

  const modelOptions: DropdownOption[] = useMemo(() => {
    const autoOption: DropdownOption = {
      value: 'auto',
      label: 'AUTO',
      subLabel: 'auto',
      icon: <Sparkles className="w-3.5 h-3.5 text-primary" />,
      details: {
        description:
          'Elara will automatically choose the best available model based on your priority sequence.',
      },
      sequence: -1, // Special case for sorting
    };

    // 1. Prepare history options
    const historyOpts = historyModels.map((m) => ({
      value: m,
      label: m,
      isCustom: true,
      subLabel: 'history',
      icon: <HistoryIcon className="w-3.5 h-3.5 text-zinc-500" />,
    }));

    // 2. Prepare API models with sequences
    const apiValues = new Set(apiModels.map((m) => m.value));
    const uniqueHistory = historyOpts.filter((h) => !apiValues.has(h.value));

    // Attach sequences to API models
    const enrichedApiModels = apiModels.map((m) => {
      const seq = sequences.find(
        (s) => `${s.provider_id}/${s.model_id}` === m.value || s.model_id === m.value,
      );
      return { ...m, sequence: seq?.sequence };
    });

    // Sort logic:
    // - Group 1: History (including AUTO)
    // - Group 2: Models with sequence (sorted by sequence num)
    // - Group 3: Models without sequence

    const sequenceModels = enrichedApiModels
      .filter((m) => m.sequence !== undefined)
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    const otherModels = enrichedApiModels.filter((m) => m.sequence === undefined);

    return [autoOption, ...uniqueHistory, ...sequenceModels, ...otherModels];
  }, [apiModels, historyModels, sequences]);

  return {
    isClaudeInstalled,
    config,
    setConfig, // Keeping for compatibility but handled via helpers
    handleUrlChange,
    handleTokenChange,
    handleModelChange,
    systemEnvStatus,
    authToken,
    normalModel,
    normalOpus,
    normalSonnet,
    normalHaiku,
    savingToSystem,
    restoringDefaults,
    resetUrl,
    handleSaveToSystem,
    handleRestoreDefaults,
    syncStatus,
    isNewConfig,
    urlOptions,
    tokenOptions,
    modelOptions,
    setNormalModel,
    setNormalOpus,
    setNormalSonnet,
    setNormalHaiku,
    cliStatus,
    isSyncing,
    handleSyncConfig,
    handleRestoreBackup,
  };
};
