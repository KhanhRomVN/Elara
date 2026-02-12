import { useState, useEffect, useCallback } from 'react';

export interface GitStatus {
  modified: string[];
  staged: string[];
  untracked: string[];
  conflicted: string[];
  ahead: number;
  behind: number;
}

export interface DiffStats {
  files: { [path: string]: { insertions: number; deletions: number; binary: boolean } };
  total: { insertions: number; deletions: number };
}

export const useGitStatus = (workspacePath: string | undefined) => {
  const [gitStatus, setGitStatus] = useState<GitStatus>({
    modified: [],
    staged: [],
    untracked: [],
    conflicted: [],
    ahead: 0,
    behind: 0,
  });
  const [diffStats, setDiffStats] = useState<DiffStats>({
    files: {},
    total: { insertions: 0, deletions: 0 },
  });
  const [isWatching, setIsWatching] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!workspacePath) return;
    try {
      const status = await window.api.git.status(workspacePath);
      // @ts-ignore
      setGitStatus(status);

      const diff = await window.api.git.diffStats(workspacePath);
      // @ts-ignore
      setDiffStats(diff);
    } catch (error) {
      console.error('Failed to fetch git status:', error);
    }
  }, [workspacePath]);

  useEffect(() => {
    if (!workspacePath) return;

    fetchStatus();

    // Start watching
    if (window.api.watcher) {
      window.api.watcher.watch(workspacePath).then(() => setIsWatching(true));
    } else {
      console.warn('Watcher API not available. Restart application required.');
    }

    // Listen for watcher events
    const removeListener = window.api.on('watcher:file-change', () => {
      // Debounce simple refresh
      fetchStatus();
      // Also refresh tree view if needed (handled by parent or another hook)
      // But here we focus on git status
    });

    return () => {
      if (window.api.watcher) {
        window.api.watcher.unwatch();
      }
      removeListener();
      setIsWatching(false);
    };
  }, [workspacePath, fetchStatus]);

  return { gitStatus, diffStats, isWatching, refreshGitStatus: fetchStatus };
};
