import simpleGit, { SimpleGit, StatusResult } from 'simple-git';

export interface GitStatusSummary {
  modified: string[];
  staged: string[];
  untracked: string[];
  conflicted: string[];
  ahead: number;
  behind: number;
  current: string;
  tracking: string;
}

export interface FileDiffStats {
  files: { [path: string]: { insertions: number; deletions: number; binary: boolean } };
  total: { insertions: number; deletions: number };
}

export class GitService {
  private gitInstances: Map<string, SimpleGit> = new Map();

  private getGit(path: string): SimpleGit {
    if (!this.gitInstances.has(path)) {
      this.gitInstances.set(path, simpleGit(path));
    }
    return this.gitInstances.get(path)!;
  }

  async getStatus(repoPath: string): Promise<GitStatusSummary> {
    try {
      const git = this.getGit(repoPath);
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return {
          modified: [],
          staged: [],
          untracked: [],
          conflicted: [],
          ahead: 0,
          behind: 0,
          current: '',
          tracking: '',
        };
      }

      const status: StatusResult = await git.status();
      return {
        modified: status.modified,
        staged: status.staged,
        untracked: status.not_added,
        conflicted: status.conflicted,
        ahead: status.ahead,
        behind: status.behind,
        current: status.current || '',
        tracking: status.tracking || '',
      };
    } catch (error) {
      console.warn(`Failed to get git status for ${repoPath}:`, error);
      return {
        modified: [],
        staged: [],
        untracked: [],
        conflicted: [],
        ahead: 0,
        behind: 0,
        current: '',
        tracking: '',
      };
    }
  }

  async add(repoPath: string, files: string[] = ['.']): Promise<void> {
    const git = this.getGit(repoPath);
    await git.add(files);
  }

  async commit(repoPath: string, message: string): Promise<void> {
    const git = this.getGit(repoPath);
    await git.commit(message);
  }

  async getDiffNumStat(repoPath: string): Promise<FileDiffStats> {
    try {
      const git = this.getGit(repoPath);
      // Get diff of unstaged changes
      const diffSummary = await git.diffSummary();

      const files: FileDiffStats['files'] = {};

      diffSummary.files.forEach((file) => {
        files[file.file] = {
          insertions: file.insertions,
          deletions: file.deletions,
          binary: file.binary,
        };
      });

      return {
        files,
        total: {
          insertions: diffSummary.insertions,
          deletions: diffSummary.deletions,
        },
      };
    } catch (error) {
      console.warn(`Failed to get git diff stats for ${repoPath}:`, error);
      return {
        files: {},
        total: { insertions: 0, deletions: 0 },
      };
    }
  }
}

export const gitService = new GitService();
