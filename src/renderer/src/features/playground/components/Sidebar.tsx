import { Plus, User, Check, LayoutList, Target, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Account, HistoryItem, Provider } from '../types';
import { getFaviconUrl } from '../../../config/providers';
import { GroqSidebarSettings } from './GroqSidebarSettings';
import { AccountAvatar } from '../../accounts/components/AccountAvatar';
import { cn } from '../../../shared/lib/utils';

interface SidebarProps {
  sidebarWidth: number;
  selectedProvider: Provider | string;
  providersList?: any[];
  startNewChat: () => void;
  history: HistoryItem[];
  activeChatId: string | null;
  loadConversation: (id: string) => void;
  account: Account | null | undefined;
  groqSettings: any;
  setGroqSettings: (settings: any) => void;
  taskProgress: {
    current: {
      taskName: string;
      tasks: { text: string; status: 'todo' | 'done' }[];
    } | null;
    history: {
      taskName: string;
      tasks: { text: string; status: 'todo' | 'done' }[];
    }[];
  };
}

export const Sidebar = ({
  sidebarWidth,
  selectedProvider,
  providersList = [],
  startNewChat: _startNewChat,
  history: _history,
  activeChatId: _activeChatId,
  loadConversation: _loadConversation,
  account: _account,
  groqSettings: _groqSettings,
  setGroqSettings: _setGroqSettings,
  taskProgress,
}: SidebarProps) => {
  const [activeView, setActiveView] = useState<'current' | 'history'>('current');
  const [selectedHistoryTask, setSelectedHistoryTask] = useState<number | null>(null);

  const currentTask =
    selectedHistoryTask !== null && activeView === 'history'
      ? taskProgress.history[selectedHistoryTask]
      : taskProgress.current;

  return (
    <div
      className="flex flex-col h-full shrink-0 border-r bg-card/30"
      style={{ width: sidebarWidth }}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Navigation Header - Aligned with ChatArea Headers (h-20 = TabBar h-10 + Title h-10) */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-bold text-[10px] truncate uppercase tracking-widest text-muted-foreground/80">
              Task
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setActiveView('current');
                setSelectedHistoryTask(null);
              }}
              className={cn(
                'p-2 rounded-lg transition-all border shrink-0',
                activeView === 'current'
                  ? 'bg-primary/10 border-primary/30 text-primary shadow-sm'
                  : 'bg-transparent border-transparent text-muted-foreground hover:bg-secondary/40',
              )}
              title="Current Task"
            >
              <Target className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={cn(
                'p-2 rounded-lg transition-all border shrink-0',
                activeView === 'history'
                  ? 'bg-primary/10 border-primary/30 text-primary shadow-sm'
                  : 'bg-transparent border-transparent text-muted-foreground hover:bg-secondary/40',
              )}
              title="Task History"
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar">
          {activeView === 'current' ||
          (activeView === 'history' && selectedHistoryTask !== null) ? (
            <div className="animate-in fade-in slide-in-from-right-2 duration-200">
              {activeView === 'history' && (
                <button
                  onClick={() => setSelectedHistoryTask(null)}
                  className="mb-4 text-[10px] font-bold text-primary flex items-center gap-1 hover:underline uppercase tracking-widest"
                >
                  <ChevronRight className="w-3 h-3 rotate-180" /> Back to History
                </button>
              )}

              <div className="mb-4">
                <p className="text-[10px] font-bold text-muted-foreground px-1 mb-2 uppercase tracking-widest">
                  {activeView === 'history' ? 'Viewed Task' : 'Progress'}
                </p>
                {currentTask ? (
                  <div className="p-3 bg-secondary/30 rounded-xl border border-border shadow-sm mb-4">
                    <h3 className="text-sm font-bold text-foreground leading-tight">
                      {currentTask.taskName}
                    </h3>
                  </div>
                ) : (
                  <p className="px-1 text-xs text-muted-foreground italic">No active task</p>
                )}

                <div className="space-y-2.5">
                  {currentTask?.tasks.map((task, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-xl transition-all border',
                        task.status === 'done'
                          ? 'bg-green-500/5 border-green-500/10 opacity-70'
                          : 'bg-secondary/20 border-border/50 shadow-sm',
                      )}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {task.status === 'done' ? (
                          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-primary/30 animate-pulse bg-primary/20 shadow-sm" />
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-xs leading-relaxed',
                          task.status === 'done'
                            ? 'text-muted-foreground line-through'
                            : 'text-foreground font-semibold',
                        )}
                      >
                        {task.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-left-2 duration-200">
              <p className="text-[10px] font-bold text-muted-foreground px-1 mb-4 uppercase tracking-widest">
                Task Sessions ({taskProgress.history.length})
              </p>
              <div className="space-y-3">
                {[...taskProgress.history].reverse().map((task, idx) => {
                  const originalIdx = taskProgress.history.length - 1 - idx;
                  const isCurrent = originalIdx === taskProgress.history.length - 1;
                  const completedCount = task.tasks.filter((t) => t.status === 'done').length;
                  const totalCount = task.tasks.length;

                  return (
                    <button
                      key={originalIdx}
                      onClick={() => setSelectedHistoryTask(originalIdx)}
                      className={cn(
                        'w-full flex flex-col items-start gap-2 p-3 rounded-xl border transition-all text-left shadow-sm group',
                        isCurrent
                          ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20'
                          : 'bg-secondary/20 border-border hover:border-primary/40 hover:bg-secondary/40',
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-tighter">
                          Session #{originalIdx + 1} {isCurrent && '• Active'}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="h-1 w-12 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${(completedCount / totalCount) * 100}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-muted-foreground">
                            {completedCount}/{totalCount}
                          </span>
                        </div>
                      </div>
                      <h4 className="text-xs font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                        {task.taskName}
                      </h4>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
