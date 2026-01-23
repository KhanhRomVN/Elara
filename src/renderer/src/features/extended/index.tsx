import { useState, useEffect } from 'react';
import { Layers } from 'lucide-react';
import { cn } from '../../shared/lib/utils';
import { ClaudeCodePanel } from './components/ClaudeCodePanel';

const ExtendedPage = () => {
  const [activeTool, setActiveTool] = useState('claude_code');
  const [isClaudeInstalled, setIsClaudeInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    const checkClaude = async () => {
      try {
        await window.api.shell.execute('claude --version');
        setIsClaudeInstalled(true);
      } catch (e) {
        setIsClaudeInstalled(false);
      }
    };
    checkClaude();
  }, []);

  return (
    <div className="h-full flex flex-col p-6 gap-6 bg-zinc-950">
      <div className="flex items-center gap-3">
        <Layers className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Extended Tools</h1>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden border border-zinc-800 rounded-xl bg-zinc-900/50 p-1">
        {/* Sub Sidebar */}
        <div className="w-64 border-r border-zinc-800 flex flex-col gap-2 p-3">
          <button
            onClick={() => setActiveTool('claude_code')}
            disabled={isClaudeInstalled === false}
            className={cn(
              'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
              activeTool === 'claude_code'
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
              isClaudeInstalled === false && 'opacity-50 cursor-not-allowed grayscale',
            )}
          >
            <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
            Claude Code
            {isClaudeInstalled === false && (
              <span className="ml-auto text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20">
                Offline
              </span>
            )}
            {isClaudeInstalled === true && (
              <span className="ml-auto text-[10px] bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded border border-green-500/20">
                Ready
              </span>
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-y-auto p-6 bg-zinc-950/30">
          {activeTool === 'claude_code' && <ClaudeCodePanel />}
        </div>
      </div>
    </div>
  );
};

export default ExtendedPage;
