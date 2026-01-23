import {
  ShieldCheck,
  ShieldAlert,
  Globe,
  Link,
  Download,
  Trash2,
  Terminal,
  Zap,
  Settings2,
} from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { useClaudeCode } from '../hooks/useClaudeCode';
import { CustomSelect } from './CustomSelect';
import { getFaviconUrl } from '../../../config/providers';

export const ClaudeCodePanel = () => {
  const {
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
    handleSave,
    handleSaveToSystem,
    handleRestoreDefaults,
    isNewConfig,
  } = useClaudeCode();

  const providerOptions = [
    { value: 'auto', label: 'Auto Select' },
    ...providers.map((p) => ({
      value: p.provider_id || p.id,
      label: p.provider_name || p.name || p.provider_id || p.id,
      icon: p.website ? getFaviconUrl(p.website) : undefined,
      disabled: p.is_enabled === false,
    })),
  ];

  const getModelOptions = (type: string) => {
    const models = availableModels[type];
    const modelList = Array.isArray(models) ? models : [];
    return [
      { value: 'auto', label: 'Auto (Default)' },
      ...modelList.map((m) => ({
        value: m.id,
        label: m.name || m.id,
      })),
    ];
  };

  const isProviderSelected = (type: string) => {
    return elaraConfigs[type]?.provider && elaraConfigs[type].provider !== 'auto';
  };

  const renderModelField = (
    label: string,
    type: 'main' | 'opus' | 'sonnet' | 'haiku',
    envKey: string,
    normalValue: string,
    setNormalValue: (v: string) => void,
  ) => {
    // Only show error for Elara mode when config is not saved
    const hasError = activeMode === 'elara' && isNewConfig;

    return (
      <div className="space-y-3">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Settings2 className="w-3 h-3" /> {label}
          </span>
        </label>

        {activeMode === 'elara' ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
                Provider ID
              </span>
              <CustomSelect
                value={elaraConfigs[type].provider}
                onChange={(value) => handleElaraConfigChange(type, 'provider', value)}
                options={providerOptions}
                placeholder="Select Provider"
                hasError={hasError}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
                Model ID
              </span>
              <CustomSelect
                value={elaraConfigs[type].model}
                onChange={(value) => handleElaraConfigChange(type, 'model', value)}
                options={getModelOptions(type)}
                placeholder="Select Model"
                disabled={!isProviderSelected(type) || loadingModels[type]}
                hasError={hasError}
              />
            </div>
          </div>
        ) : (
          <input
            type="text"
            value={normalValue}
            onChange={(e) => setNormalValue(e.target.value)}
            placeholder={`Enter ${envKey}...`}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
          />
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <span>Claude Code Configuration</span>
            {isNewConfig && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
                Not Saved
              </span>
            )}
          </div>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Configure Elara to act as a proxy for Claude Code. Select "Elara Mode" to use your
            configured accounts.
          </p>
        </div>

        <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => setActiveMode('elara')}
            className={cn(
              'px-4 py-1.5 text-xs font-semibold rounded-md transition-all',
              activeMode === 'elara'
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'text-zinc-400 hover:text-zinc-100',
            )}
          >
            Elara Mode
          </button>
          <button
            onClick={() => setActiveMode('normal')}
            className={cn(
              'px-4 py-1.5 text-xs font-semibold rounded-md transition-all',
              activeMode === 'normal'
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'text-zinc-400 hover:text-zinc-100',
            )}
          >
            Normal Mode
          </button>
        </div>
      </div>

      {isClaudeInstalled === false && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-4 items-start">
          <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-red-500">Claude Code Not Detected</h4>
            <p className="text-xs text-zinc-400">
              We couldn't find 'claude' in your system PATH. Please install it using{' '}
              <code>npm install -g @anthropic-ai/claude-code</code> and restart the app.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Website */}
        {activeMode === 'elara' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-3 h-3" /> Website
            </label>
            <input
              type="text"
              value={config.website}
              onChange={(e) => setConfig({ ...config, website: e.target.value })}
              className={cn(
                'w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono',
                isNewConfig ? 'border-red-500/50' : 'border-zinc-800',
              )}
            />
          </div>
        )}

        {/* ANTHROPIC_BASE_URL */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Link className="w-3 h-3" /> ANTHROPIC_BASE_URL
            </span>
          </label>
          <input
            type="text"
            value={config.url}
            onChange={(e) => setConfig({ ...config, url: e.target.value })}
            className={cn(
              'w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono',
              activeMode === 'elara' && isNewConfig ? 'border-red-500/50' : 'border-zinc-800',
            )}
          />
        </div>

        {/* ANTHROPIC_AUTH_TOKEN */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Terminal className="w-3 h-3" /> ANTHROPIC_AUTH_TOKEN
            </span>
          </label>
          <input
            type="text"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            placeholder="sk-ant-..."
            className={cn(
              'w-full bg-zinc-900 border rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono',
              activeMode === 'elara' && isNewConfig ? 'border-red-500/50' : 'border-zinc-800',
            )}
          />
        </div>
      </div>

      {/* Model Section */}
      <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800 space-y-6">
        <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Model Settings
        </h4>

        <div className="grid grid-cols-1 gap-4">
          {renderModelField('Main Model', 'main', 'ANTHROPIC_MODEL', normalModel, setNormalModel)}
          {renderModelField(
            'Opus Model',
            'opus',
            'ANTHROPIC_DEFAULT_OPUS_MODEL',
            normalOpus,
            setNormalOpus,
          )}
          {renderModelField(
            'Sonnet Model',
            'sonnet',
            'ANTHROPIC_DEFAULT_SONNET_MODEL',
            normalSonnet,
            setNormalSonnet,
          )}
          {renderModelField(
            'Haiku Model',
            'haiku',
            'ANTHROPIC_DEFAULT_HAIKU_MODEL',
            normalHaiku,
            setNormalHaiku,
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-zinc-800 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-400">Connection Status</span>
            {isClaudeInstalled ? (
              <div className="flex items-center gap-2 text-green-500 text-xs">
                <ShieldCheck className="w-4 h-4" /> System Ready
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-500 text-xs">
                <ShieldAlert className="w-4 h-4" /> System Offline
              </div>
            )}
          </div>

          {activeMode === 'elara' && (
            <button
              onClick={handleSave}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-[0_4px_20px_rgba(var(--primary),0.3)] active:scale-95"
            >
              Save Configuration
            </button>
          )}
        </div>

        {/* System Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSaveToSystem}
            disabled={savingToSystem}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all',
              'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20',
              savingToSystem && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Download className="w-4 h-4" />
            {savingToSystem ? 'Applying...' : 'Apply to System Shell'}
          </button>
          <button
            onClick={handleRestoreDefaults}
            disabled={restoringDefaults || !systemEnvStatus?.configured}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all',
              'bg-red-600/20 hover:bg-red-600/30 text-red-500 border border-red-500/30',
              (restoringDefaults || !systemEnvStatus?.configured) &&
                'opacity-50 cursor-not-allowed',
            )}
          >
            <Trash2 className="w-4 h-4" />
            {restoringDefaults ? 'Restoring...' : 'Restore Defaults'}
          </button>
        </div>
      </div>
    </div>
  );
};
