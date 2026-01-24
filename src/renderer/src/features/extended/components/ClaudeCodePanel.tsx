import { ShieldAlert, Link, Download, Trash2, Terminal, Zap, Settings2 } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { useClaudeCode } from '../hooks/useClaudeCode';

export const ClaudeCodePanel = () => {
  const {
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
    handleSaveToSystem,
    handleRestoreDefaults,
    isNewConfig,
  } = useClaudeCode();

  const renderModelField = (
    label: string,
    type: 'main' | 'opus' | 'sonnet' | 'haiku',
    envKey: string,
    normalValue: string,
    setNormalValue: (v: string) => void,
  ) => {
    return (
      <div className="space-y-3">
        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Settings2 className="w-3 h-3" /> {label}
          </span>
        </label>

        <input
          type="text"
          value={normalValue}
          onChange={(e) => setNormalValue(e.target.value)}
          placeholder={`Enter ${envKey}...`}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
        />
      </div>
    );
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
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
          Configure system environment variables for Claude Code. These settings will be applied to
          your shell profile.
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

      <div className="space-y-4">
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
              isNewConfig ? 'border-zinc-800' : 'border-zinc-800',
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
              'w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono',
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
