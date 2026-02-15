import { useState, useEffect } from 'react';
import { History, Clock, ChevronRight, Trash2, FolderOpen } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface AgentSession {
  id: string;
  name: string;
  path: string;
  createdAt: Date;
  lastModified: Date;
  messageCount: number;
  model?: string;
  totalTokens?: number;
  preview?: string;
}

interface AgentHistorySidebarProps {
  width: number;
  onSelectSession?: (session: AgentSession) => void;
  className?: string;
  currentWorkspaceId?: string;
}

export const AgentHistorySidebar = ({
  width,
  onSelectSession,
  className,
  currentWorkspaceId,
}: AgentHistorySidebarProps) => {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Load agent sessions from context_tool_data
  useEffect(() => {
    const loadSessions = async () => {
      if (!currentWorkspaceId) return;

      setLoading(true);
      try {
        // @ts-ignore
        const sessionsData = await window.api.workspaces.getSessions(currentWorkspaceId);
        setSessions(sessionsData);
      } catch (error) {
        console.error('Failed to load agent sessions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [currentWorkspaceId]);

  const handleSessionClick = (session: AgentSession) => {
    setSelectedSessionId(session.id);
    onSelectSession?.(session);
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    // TODO: Implement delete confirmation and actual deletion
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const formatRelativeTime = (date: Date) => {
    try {
      return formatDistanceToNow(date, { addSuffix: true, locale: vi });
    } catch {
      return date.toLocaleDateString('vi-VN');
    }
  };

  return (
    <div className={cn('flex flex-col h-full border-r bg-card/30', className)} style={{ width }}>
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="font-bold text-xs truncate uppercase tracking-widest text-muted-foreground/80">
            Agent History
          </span>
        </div>
        <button
          onClick={() => window.location.reload()} // Simple refresh for now
          className="p-1.5 rounded-lg hover:bg-secondary/40 transition-colors"
          title="Refresh"
        >
          <ChevronRight className="w-4 h-4 rotate-90" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <FolderOpen className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs">No agent sessions found</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-3">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleSessionClick(session)}
                className={cn(
                  'w-full text-left p-3 rounded-lg transition-all border group',
                  selectedSessionId === session.id
                    ? 'bg-primary/10 border-primary/30 shadow-sm'
                    : 'bg-card hover:bg-secondary/20 border-border/50 hover:border-primary/30',
                )}
              >
                {/* Header row with name and delete */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4
                    className={cn(
                      'text-sm font-semibold line-clamp-2 flex-1',
                      selectedSessionId === session.id
                        ? 'text-primary'
                        : 'text-foreground/90 group-hover:text-primary',
                    )}
                  >
                    {session.name}
                  </h4>
                  <button
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Preview text */}
                {session.preview && (
                  <p className="text-xs text-muted-foreground/80 line-clamp-2 mb-2">
                    {session.preview}
                  </p>
                )}

                <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatRelativeTime(session.lastModified)}</span>
                  </div>
                  {session.model && (
                    <div className="flex items-center gap-1 bg-secondary/30 px-1.5 py-0.5 rounded border border-border/50">
                      <span className="uppercase">{session.model}</span>
                    </div>
                  )}
                  {session.totalTokens !== undefined && (
                    <div className="flex items-center gap-1">
                      <span>{session.totalTokens.toLocaleString()} tks</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
