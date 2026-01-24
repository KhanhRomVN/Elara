import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { OpenCodeConfig } from '../types/opencode';

export const useOpenCode = () => {
  const [isOpenCodeInstalled, setIsOpenCodeInstalled] = useState<boolean | null>(null);
  const [config, setConfig] = useState<OpenCodeConfig>({});
  const [configPath, setConfigPath] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    checkInstallation();
    loadConfiguration();
  }, []);

  const checkInstallation = async () => {
    try {
      await window.api.shell.execute('opencode --version');
      setIsOpenCodeInstalled(true);
    } catch (e) {
      setIsOpenCodeInstalled(false);
    }
  };

  const loadConfiguration = async () => {
    setLoading(true);
    try {
      // Get home dir path via platform info
      const platformInfo = await window.api.server.getPlatformInfo();
      const homeDir = platformInfo.homedir;

      // Determine config path (works on Linux/macOS, might need adjustment for Windows if not using .config)
      // OpenCode standard path is ~/.config/opencode/opencode.json
      const path = `${homeDir}/.config/opencode/opencode.json`;
      setConfigPath(path);

      try {
        const content = await window.api.ide.readFile(path);
        if (content) {
          const json = JSON.parse(content);
          setConfig(json);

          // Load values into form state
          // Prioritize anthropic, then openai, or empty
          if (json.provider?.anthropic) {
            setBaseUrl(json.provider.anthropic.baseURL || '');
            setApiKey(json.provider.anthropic.apiKey || '');
          }
        }
      } catch (e: any) {
        // File might not exist, which is fine
        console.log('OpenCode config not found or unreadable:', e);
      }
    } catch (e) {
      console.error('Failed to load OpenCode config:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    setSaving(true);
    try {
      // Create new config object preserving existing fields
      const newConfig: OpenCodeConfig = {
        ...config,
        provider: {
          ...config.provider,
          anthropic: {
            ...(config.provider?.anthropic || {}),
            baseURL: baseUrl,
            apiKey: apiKey,
          },
        },
      };

      // Ensure directory exists (optional, mostly it should)
      // We rely on simple writeFile here assuming parent dir exists or user has run opencode at least once

      await window.api.ide.writeFile(configPath, JSON.stringify(newConfig, null, 2));
      setConfig(newConfig);
      toast.success('OpenCode configuration saved');
    } catch (e: any) {
      console.error('Failed to save OpenCode config:', e);
      toast.error('Failed to save configuration: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return {
    isOpenCodeInstalled,
    loading,
    saving,
    baseUrl,
    setBaseUrl,
    apiKey,
    setApiKey,
    saveConfiguration,
    configPath,
  };
};
