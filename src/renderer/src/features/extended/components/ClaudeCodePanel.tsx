import {
  ShieldAlert,
  Link,
  Download,
  Trash2,
  Terminal,
  Zap,
  Settings2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { useClaudeCode } from '../hooks/useClaudeCode';
import { CreatableSelect } from '../../playground/components/CreatableSelect';

export const ClaudeCodePanel = () => {
  const {
    isClaudeInstalled,
    config,
    handleUrlChange,
    handleTokenChange,
    handleModelChange,
    systemEnvStatus,
    authToken,
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
    handleSaveToSystem,
    handleRestoreDefaults,
    urlOptions,
    tokenOptions,
    modelOptions,
    cliStatus,
    isSyncing,
    handleSyncConfig,
    handleRestoreBackup,
  } = useClaudeCode();

  const renderModelField = (
    label: string,
    envKey: string,
    normalValue: string,
    setNormalValue: (v: string) => void,
  ) => {
    return (
      <div className="space-y-2">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Settings2 className="w-3 h-3" /> {label}
          </span>
        </label>

        <CreatableSelect
          value={normalValue}
          onChange={(val) => handleModelChange(val, setNormalValue)}
          options={modelOptions}
          placeholder={`Select or enter model for ${envKey}...`}
          onCreateOption={(val) => handleModelChange(val, setNormalValue)}
        />
      </div>
    );
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="space-y-2">
        <div className="flex items-center gap-3 text-xl font-semibold text-zinc-100">
          <span>Claude Code Configuration</span>
          {cliStatus?.installed && (
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wide transition-all shadow-sm',
                cliStatus.is_synced
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
              )}
            >
              {cliStatus.is_synced ? (
                <>
                  <CheckCircle2 size={12} className="shrink-0" /> Synced
                </>
              ) : (
                <>
                  <AlertCircle size={12} className="shrink-0" /> Not synced
                </>
              )}
            </div>
          )}
        </div>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Configure Claude Code CLI by directly managing its configuration files. This ensures a
          consistent environment across your sessions.
        </p>
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

      <div className="space-y-6">
        {/* ANTHROPIC_BASE_URL */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Link className="w-3 h-3" /> ANTHROPIC_BASE_URL
            </span>
          </label>
          <CreatableSelect
            value={config.url || ''}
            onChange={handleUrlChange}
            options={urlOptions}
            placeholder="Enter or select Base URL..."
            onCreateOption={handleUrlChange}
          />
        </div>

        {/* ANTHROPIC_AUTH_TOKEN */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Terminal className="w-3 h-3" /> ANTHROPIC_AUTH_TOKEN
            </span>
          </label>
          <CreatableSelect
            value={authToken}
            onChange={handleTokenChange}
            options={tokenOptions}
            placeholder="sk-ant-..."
            onCreateOption={handleTokenChange}
          />
        </div>
      </div>

      {/* Model Section */}
      <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800 space-y-6">
        <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Model Settings
        </h4>

        <div className="grid grid-cols-1 gap-6">
          {renderModelField('Main Model', 'ANTHROPIC_MODEL', normalModel, setNormalModel)}
          {renderModelField(
            'Opus Model',
            'ANTHROPIC_DEFAULT_OPUS_MODEL',
            normalOpus,
            setNormalOpus,
          )}
          {renderModelField(
            'Sonnet Model',
            'ANTHROPIC_DEFAULT_SONNET_MODEL',
            normalSonnet,
            setNormalSonnet,
          )}
          {renderModelField(
            'Haiku Model',
            'ANTHROPIC_DEFAULT_HAIKU_MODEL',
            normalHaiku,
            setNormalHaiku,
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-zinc-800 flex flex-col gap-4">
        {/* Sync Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSyncConfig}
            disabled={isSyncing || !cliStatus?.installed}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all',
              'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20',
              (isSyncing || !cliStatus?.installed) && 'opacity-50 cursor-not-allowed',
            )}
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isSyncing ? 'Syncing...' : 'Sync Config Now'}
          </button>

          <button
            onClick={handleRestoreBackup}
            disabled={restoringDefaults || !cliStatus?.has_backup}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all',
              'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700',
              (restoringDefaults || !cliStatus?.has_backup) && 'opacity-50 cursor-not-allowed',
            )}
          >
            <RotateCcw className="w-4 h-4" />
            {restoringDefaults ? 'Restoring...' : 'Restore from Backup'}
          </button>
        </div>

        {/* Legacy System Actions (Hidden or simplified) */}
        <div className="flex gap-3 opacity-50 hover:opacity-100 transition-opacity">
          <button
            onClick={handleSaveToSystem}
            disabled={savingToSystem}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
          >
            <Download className="w-3 h-3" />
            Legacy: Apply to Shell Profile
          </button>
          <button
            onClick={handleRestoreDefaults}
            disabled={restoringDefaults || !systemEnvStatus?.configured}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Legacy: Clean Shell Profile
          </button>
        </div>
      </div>
    </div>
  );
};
