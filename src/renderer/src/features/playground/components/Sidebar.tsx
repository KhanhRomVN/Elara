import { Check, LayoutList, Target, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Account, Provider } from '../types';
import { getFileIconPath } from '../../../shared/utils/fileIconMapper';
import { cn } from '../../../shared/lib/utils';

interface SidebarProps {
  sidebarWidth: number;
  selectedProvider: Provider | string;
  providersList?: any[];
  startNewChat: () => void;
  activeChatId: string | null;
  account: Account | null | undefined;
  groqSettings: any;
  setGroqSettings: (settings: any) => void;
  taskProgress: {
    current: {
      taskName: string;
      tasks: { text: string; status: 'todo' | 'done' }[];
      files: string[];
    } | null;
    history: {
      taskName: string;
      tasks: { text: string; status: 'todo' | 'done' }[];
      files: string[];
    }[];
  };
}

export const Sidebar = ({
  sidebarWidth,
  selectedProvider: _selectedProvider,
  providersList: _providersList = [],
  startNewChat: _startNewChat,
  activeChatId: _activeChatId,
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
        <div className="h-12 flex items-center justify-between px-3 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-bold text-xs truncate uppercase tracking-widest text-muted-foreground/80">
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
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {activeView === 'current' ||
          (activeView === 'history' && selectedHistoryTask !== null) ? (
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-2 duration-200">
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeView === 'history' && (
                  <button
                    onClick={() => setSelectedHistoryTask(null)}
                    className="mb-4 text-[10px] font-bold text-primary flex items-center gap-1 hover:underline uppercase tracking-widest px-4 pt-4"
                  >
                    <ChevronRight className="w-3 h-3 rotate-180" /> Back to History
                  </button>
                )}

                <div className="flex flex-col">
                  {currentTask && (
                    <div className="px-4 py-3 border-b border-border/50 bg-secondary/10">
                      <h3 className="text-xs font-bold text-foreground leading-tight uppercase tracking-wide">
                        {currentTask.taskName}
                      </h3>
                    </div>
                  )}

                  <div className="flex flex-col">
                    {currentTask?.tasks.map((task, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex items-start gap-3 px-4 py-3 transition-all border-b border-border/40 hover:bg-secondary/10',
                          task.status === 'done' ? 'opacity-60 bg-secondary/5' : '',
                        )}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {task.status === 'done' ? (
                            <div className="w-3.5 h-3.5 rounded-full bg-green-500/80 flex items-center justify-center">
                              <Check className="w-2 h-2 text-white" />
                            </div>
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-primary/40 bg-primary/10" />
                          )}
                        </div>
                        <span
                          className={cn(
                            'text-xs leading-relaxed',
                            task.status === 'done'
                              ? 'text-muted-foreground line-through'
                              : 'text-foreground/90 font-medium',
                          )}
                        >
                          {task.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {currentTask?.files && currentTask.files.length > 0 && (
                <div className="shrink-0 max-h-[25%] overflow-y-auto custom-scrollbar border-t border-border/40 bg-secondary/5">
                  <div className="px-4 py-2 sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border/20">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Related Files ({currentTask.files.length})
                    </span>
                  </div>
                  {currentTask.files.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-secondary/10 transition-colors cursor-default border-b border-border/30 last:border-0"
                    >
                      <img
                        src={getFileIconPath(file)}
                        alt=""
                        className="w-3.5 h-3.5 object-contain opacity-70"
                      />
                      <span className="text-xs text-foreground/80 font-mono truncate">{file}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="px-4 py-3 border-b border-border/30 bg-secondary/5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Task Sessions ({taskProgress.history.length})
                </p>
              </div>
              <div className="flex flex-col">
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
                        'w-full flex flex-col items-start gap-1.5 px-4 py-3 border-b border-border/40 transition-all text-left group relative',
                        isCurrent ? 'bg-primary/10' : 'hover:bg-secondary/20',
                      )}
                    >
                      {isCurrent && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-l-lg" />
                      )}

                      <div className="flex items-center justify-between w-full mb-0.5">
                        <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tight">
                          Session #{originalIdx + 1} {isCurrent && '• Active'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1 w-10 bg-secondary/40 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary/70"
                              style={{ width: `${(completedCount / totalCount) * 100}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-muted-foreground/80">
                            {completedCount}/{totalCount}
                          </span>
                        </div>
                      </div>
                      <h4
                        className={cn(
                          'text-xs font-bold line-clamp-2 leading-snug transition-colors',
                          isCurrent
                            ? 'text-primary'
                            : 'text-foreground/90 group-hover:text-primary',
                        )}
                      >
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
