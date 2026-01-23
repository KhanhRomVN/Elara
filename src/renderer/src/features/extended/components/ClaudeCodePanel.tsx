import { Link, Download, Trash2, Terminal, Zap, Settings2, ShieldAlert } from 'lucide-react';
import React from 'react';
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
    syncStatus,
  } = useClaudeCode();

  const isSynced = Object.values(syncStatus).every(Boolean) && Object.keys(syncStatus).length > 0;

  const renderField = (
    label: string,
    icon: React.ReactNode,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    envKey: string,
  ) => (
    <div className="space-y-2">
      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
        <span className="flex items-center gap-2">
          {icon} {label}
        </span>
        <span className="text-[10px] text-zinc-600 font-mono">{envKey}</span>
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
      />
    </div>
  );

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <span>Claude Code Configuration</span>
          </div>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Mọi yêu cầu từ Claude Code sẽ được xử lý qua Gemini (Antigravity). Bạn chỉ cần cấu hình
            URL và các biến môi trường để bắt đầu.
          </p>
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

      <div className="grid grid-cols-1 gap-6">
        {renderField(
          'ANTHROPIC_BASE_URL',
          <Link className="w-3 h-3" />,
          config.url || '',
          (v) => setConfig({ ...config, url: v }),
          'http://localhost:3030/v1/messages',
          'URL',
        )}

        {renderField(
          'ANTHROPIC_AUTH_TOKEN',
          <Terminal className="w-3 h-3" />,
          authToken,
          setAuthToken,
          'Sẽ bị bỏ qua, nhập gì cũng được...',
          'TOKEN',
        )}

        <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800 space-y-6">
          <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Model Environment Variables
          </h4>

          <div className="grid grid-cols-1 gap-4">
            {renderField(
              'Main Model',
              <Settings2 className="w-3 h-3" />,
              normalModel,
              setNormalModel,
              'claude-3-5-sonnet-20241022',
              'ANTHROPIC_MODEL',
            )}
            {renderField(
              'Opus Model',
              <Settings2 className="w-3 h-3" />,
              normalOpus,
              setNormalOpus,
              'claude-3-5-sonnet-20241022',
              'ANTHROPIC_DEFAULT_OPUS_MODEL',
            )}
            {renderField(
              'Sonnet Model',
              <Settings2 className="w-3 h-3" />,
              normalSonnet,
              setNormalSonnet,
              'claude-3-5-sonnet-20241022',
              'ANTHROPIC_DEFAULT_SONNET_MODEL',
            )}
            {renderField(
              'Haiku Model',
              <Settings2 className="w-3 h-3" />,
              normalHaiku,
              setNormalHaiku,
              'claude-3-5-sonnet-20241022',
              'ANTHROPIC_DEFAULT_HAIKU_MODEL',
            )}
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-zinc-800 flex flex-col gap-4">
        <div className="flex gap-3">
          <button
            onClick={handleSaveToSystem}
            disabled={savingToSystem || isSynced}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all',
              'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20',
              (savingToSystem || isSynced) && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Download className="w-4 h-4" />
            {savingToSystem
              ? 'Applying...'
              : isSynced
                ? 'Synced with System'
                : 'Apply to System Shell'}
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
