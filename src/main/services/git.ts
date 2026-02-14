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
  isRepo: boolean;
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
          isRepo: false,
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
        isRepo: true,
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
        isRepo: false,
      };
    }
  }

  async add(repoPath: string, files: string[] = ['.']): Promise<void> {
    const git = this.getGit(repoPath);
    if (!(await git.checkIsRepo())) return;
    await git.add(files);
  }

  async commit(repoPath: string, message: string): Promise<void> {
    const git = this.getGit(repoPath);
    if (!(await git.checkIsRepo())) return;
    await git.commit(message);
  }

  async getDiffNumStat(repoPath: string): Promise<FileDiffStats> {
    try {
      const git = this.getGit(repoPath);
      if (!(await git.checkIsRepo())) {
        return { files: {}, total: { insertions: 0, deletions: 0 } };
      }

      // Try to get diff against HEAD to include both staged and unstaged
      // Fallback to plain diffSummary if HEAD doesn't exist (new repo)
      let diffSummary;
      try {
        diffSummary = await git.diffSummary(['HEAD']);
      } catch {
        diffSummary = await git.diffSummary();
      }

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
      return { files: {}, total: { insertions: 0, deletions: 0 } };
    }
  }

  async getDiff(repoPath: string, staged: boolean = false): Promise<string> {
    try {
      const git = this.getGit(repoPath);
      if (!(await git.checkIsRepo())) return '';
      const options = staged ? ['--cached'] : [];
      return await git.diff(options);
    } catch (error) {
      console.warn(`Failed to get git diff for ${repoPath}:`, error);
      return '';
    }
  }

  async push(repoPath: string): Promise<void> {
    const git = this.getGit(repoPath);
    if (!(await git.checkIsRepo())) return;
    await git.push();
  }
}

export const gitService = new GitService();
