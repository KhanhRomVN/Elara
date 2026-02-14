import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Search, RefreshCw } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { getFileIconPath, getFolderIconPath } from '../../../shared/utils/fileIconMapper';
import { GitStatus, DiffStats } from '../hooks/useGitStatus';

interface TreeEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeEntry[];
}

interface FileTreeViewProps {
  workspacePath: string;
  className?: string;
  gitStatus?: GitStatus;
  diffStats?: DiffStats;
  onFileSelect?: (file: TreeEntry) => void;
}

export const FileTreeView = ({
  workspacePath,
  className,
  gitStatus,
  diffStats,
  onFileSelect,
}: FileTreeViewProps) => {
  const [treeData, setTreeData] = useState<TreeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTree = async () => {
    if (!workspacePath) return;
    setLoading(true);
    try {
      const data = await window.api.workspaces.getTree(workspacePath);
      setTreeData(data);
    } catch (error) {
      console.error('Failed to fetch workspace tree:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, [workspacePath]);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const getStatusColor = (path: string, isDirectory: boolean) => {
    if (!gitStatus) return '';

    const checkPath = (p: string) => {
      if (gitStatus.conflicted.some((f) => f === p || (isDirectory && f.startsWith(p + '/'))))
        return 'text-red-500';
      if (
        gitStatus.modified.some((f) => f === p || (isDirectory && f.startsWith(p + '/'))) ||
        gitStatus.staged.some((f) => f === p || (isDirectory && f.startsWith(p + '/')))
      )
        return 'text-yellow-400';
      if (gitStatus.untracked.some((f) => f === p || (isDirectory && f.startsWith(p + '/'))))
        return 'text-green-400';
      return '';
    };

    return checkPath(path);
  };

  const getFileDiff = (path: string) => {
    if (!diffStats || !diffStats.files) return null;
    return diffStats.files[path];
  };

  const renderEntry = (entry: TreeEntry, depth: number = 0) => {
    const isExpanded = expandedFolders.has(entry.path);
    const isMatch =
      searchQuery === '' ||
      entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.children &&
        entry.children.some((child) =>
          child.name.toLowerCase().includes(searchQuery.toLowerCase()),
        ));

    if (!isMatch && entry.isDirectory && (!entry.children || entry.children.length === 0))
      return null;

    const statusColor = getStatusColor(entry.path, entry.isDirectory);
    const diff = !entry.isDirectory ? getFileDiff(entry.path) : null;

    return (
      <div key={entry.path}>
        <div
          className={cn(
            'flex items-center gap-1.5 py-1 px-2 hover:bg-secondary/40 cursor-pointer rounded-md transition-colors group relative',
            depth > 0 && 'ml-3 border-l border-border/50 pl-2',
          )}
          onClick={() => {
            if (entry.isDirectory) {
              toggleFolder(entry.path);
            } else {
              onFileSelect?.(entry);
            }
          }}
        >
          {entry.isDirectory ? (
            <>
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <img
                src={getFolderIconPath(isExpanded)}
                alt="folder"
                className="w-4 h-4 shrink-0 object-contain"
              />
            </>
          ) : (
            <img
              src={getFileIconPath(entry.name)}
              alt="file"
              className="w-4 h-4 shrink-0 ml-[18px] object-contain"
            />
          )}
          <span
            className={cn(
              'text-[11px] truncate select-none flex-1',
              entry.isDirectory ? 'font-bold' : 'text-muted-foreground',
              statusColor || (entry.isDirectory ? 'text-foreground/80' : ''),
            )}
          >
            {entry.name}
          </span>

          {diff && (
            <span className="text-[9px] font-bold ml-auto flex items-center gap-1 shrink-0 bg-background/50 px-1 rounded border border-border/30">
              {diff.insertions > 0 && <span className="text-green-500/90">+{diff.insertions}</span>}
              {diff.deletions > 0 && <span className="text-red-500/90">-{diff.deletions}</span>}
            </span>
          )}
        </div>

        {entry.isDirectory && isExpanded && entry.children && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            {entry.children.map((child) => renderEntry(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn('flex flex-col h-full bg-card/20 border-r overflow-hidden', className)}>
      <div className="h-12 px-3 border-b border-border/50 bg-secondary/10 flex items-center justify-between shrink-0">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate flex-1">
          {workspacePath.split(/[/\\]/).pop() || 'Explorer'}
        </h3>
        <button
          onClick={fetchTree}
          disabled={loading}
          className="p-1 hover:bg-secondary rounded-md transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3 h-3 text-muted-foreground', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {loading && treeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-20 gap-2 opacity-50">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            <span className="text-[10px] font-medium">Scanning workspace...</span>
          </div>
        ) : treeData.length > 0 ? (
          <div className="space-y-0.5">{treeData.map((entry) => renderEntry(entry))}</div>
        ) : (
          <div className="text-center py-10">
            <p className="text-[10px] text-muted-foreground italic">No files found</p>
          </div>
        )}
      </div>
    </div>
  );
};
