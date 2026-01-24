import { Terminal, Save, Link, Key, ShieldAlert } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { useOpenCode } from '../hooks/useOpenCode';

export const OpenCodePanel = () => {
  const {
    isOpenCodeInstalled,
    loading,
    saving,
    baseUrl,
    setBaseUrl,
    apiKey,
    setApiKey,
    saveConfiguration,
    configPath,
  } = useOpenCode();

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xl font-semibold text-zinc-100">
          <span>OpenCode Configuration</span>
        </div>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Configure connection settings for OpenCode CLI. This updates your{' '}
          <code>opencode.json</code> file.
        </p>
      </div>

      {isOpenCodeInstalled === false && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-4 items-start">
          <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-red-500">OpenCode Not Detected</h4>
            <p className="text-xs text-zinc-400">
              We couldn't find 'opencode' in your system PATH. Please install it and restart the
              app.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Base URL */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Link className="w-3 h-3" /> Base URL
            </span>
            <span className="text-[10px] text-zinc-600 font-normal normal-case">
              {configPath ? configPath : 'Loading path...'}
            </span>
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.orbit-provider.com/..."
            disabled={loading}
            className={cn(
              'w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono',
              loading && 'opacity-50 cursor-not-allowed',
            )}
          />
          <p className="text-[11px] text-zinc-500">
            For Orbit Provider or custom endpoints. Maps to <code>provider.anthropic.baseURL</code>.
          </p>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Key className="w-3 h-3" /> API Key
            </span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            disabled={loading}
            className={cn(
              'w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono',
              loading && 'opacity-50 cursor-not-allowed',
            )}
          />
        </div>
      </div>

      <div className="pt-6 border-t border-zinc-800 flex flex-col gap-4">
        <div className="flex gap-3">
          <button
            onClick={saveConfiguration}
            disabled={saving || loading}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all',
              'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20',
              (saving || loading) && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
};
