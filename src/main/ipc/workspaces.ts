import { ipcMain } from 'electron';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { ScannerService } from '../services/scanner';
import { gitService } from '../services/git';
import { watcherService } from '../services/watcher';
import { windowManager } from '../core/window';

export interface WorkspaceInfo {
  id: string;
  path: string;
  name: string;
}

export interface RootConfig {
  workspaces: WorkspaceInfo[];
}

class WorkspaceContextService {
  private readonly rootDir = path.join(os.homedir(), '.context_tool_data');
  private readonly rootJson = path.join(this.rootDir, 'root.json');

  private async ensureRootDir() {
    await fs.ensureDir(this.rootDir);
    if (!(await fs.pathExists(this.rootJson))) {
      await fs.writeJson(this.rootJson, { workspaces: [] });
    }
  }

  private async getConfig(): Promise<RootConfig> {
    await this.ensureRootDir();
    try {
      const config = await fs.readJson(this.rootJson);
      if (!config || !Array.isArray(config.workspaces)) {
        throw new Error('Invalid config format');
      }
      return config;
    } catch (err) {
      console.error('[WorkspaceService] Error reading root.json, resetting:', err);
      const defaultConfig: RootConfig = { workspaces: [] };
      await fs.writeJson(this.rootJson, defaultConfig, { spaces: 2 });
      return defaultConfig;
    }
  }

  async listWorkspaces(): Promise<WorkspaceInfo[]> {
    const config = await this.getConfig();
    return config.workspaces;
  }

  async findOrCreateWorkspace(folderPath: string): Promise<WorkspaceInfo> {
    const absolutePath = path.resolve(folderPath);
    const config = await this.getConfig();

    let workspace = config.workspaces.find((w) => w.path === absolutePath);
    if (!workspace) {
      const id = crypto.createHash('md5').update(absolutePath).digest('hex');
      const name = path.basename(absolutePath);
      workspace = { id, path: absolutePath, name };
      config.workspaces.push(workspace);
      await fs.writeJson(this.rootJson, config, { spaces: 2 });
    }

    const contextDir = path.join(this.rootDir, 'projects', workspace.id);
    await fs.ensureDir(contextDir);

    const workspaceMd = path.join(contextDir, 'workspace.md');
    const rulesMd = path.join(contextDir, 'workspace_rules.md');

    if (!(await fs.pathExists(workspaceMd))) {
      const template = `# ${workspace.name}\n\n## ℹ️ Information\n- **Project Name:** ${workspace.name}\n- **Main Language:** \n- **Tools:** \n- **Packages:** \n- **Services:** \n- **Goals:** \n- **Key Features:** \n\n## 📂 Directory Structure\nNULL\n`;
      await fs.writeFile(workspaceMd, template);
    }
    if (!(await fs.pathExists(rulesMd))) {
      await fs.writeFile(rulesMd, '');
    }

    return workspace;
  }

  async getContextFiles(id: string): Promise<{ workspace: string; rules: string }> {
    const contextDir = path.join(this.rootDir, 'projects', id);
    const workspaceMd = path.join(contextDir, 'workspace.md');
    const rulesMd = path.join(contextDir, 'workspace_rules.md');

    const workspace = (await fs.pathExists(workspaceMd))
      ? await fs.readFile(workspaceMd, 'utf8')
      : '';
    const rules = (await fs.pathExists(rulesMd)) ? await fs.readFile(rulesMd, 'utf8') : '';

    return { workspace, rules };
  }

  async getConversationSummary(workspaceId: string, conversationId: string): Promise<string> {
    const summaryPath = path.join(this.rootDir, workspaceId, `summary_${conversationId}.md`);
    if (await fs.pathExists(summaryPath)) {
      return await fs.readFile(summaryPath, 'utf8');
    }
    return '';
  }

  async updateConversationSummary(
    workspaceId: string,
    conversationId: string,
    content: string,
  ): Promise<void> {
    const contextDir = path.join(this.rootDir, workspaceId);
    await fs.ensureDir(contextDir);
    const summaryPath = path.join(contextDir, `summary_${conversationId}.md`);
    await fs.writeFile(summaryPath, content, 'utf8');
  }

  async createSessionFile(
    workspaceId: string,
    conversationId: string,
    data: any,
  ): Promise<{ sessionPath: string }> {
    const timestamp = Date.now();
    const contextDir = path.join(this.rootDir, 'projects', workspaceId);
    await fs.ensureDir(contextDir);

    const sessionFileName = `${workspaceId}_${conversationId}_${timestamp}.json`;
    const sessionPath = path.join(contextDir, sessionFileName);

    await fs.writeJson(sessionPath, data, { spaces: 2 });

    return { sessionPath };
  }

  async updateContextFile(id: string, type: 'workspace' | 'rules', content: string): Promise<void> {
    const contextDir = path.join(this.rootDir, 'projects', id);
    const fileName = type === 'workspace' ? 'workspace.md' : 'workspace_rules.md';
    const filePath = path.join(contextDir, fileName);

    await fs.ensureDir(contextDir);
    await fs.writeFile(filePath, content, 'utf8');
  }
  async getSessions(workspaceId: string): Promise<any[]> {
    const contextDir = path.join(this.rootDir, 'projects', workspaceId);
    if (!(await fs.pathExists(contextDir))) {
      return [];
    }

    const files = await fs.readdir(contextDir);
    // Filter for session JSON files: <hash>_<conv_id>_<ts>.json
    // Regex: ^[a-f0-9]+_[a-f0-9\-]+_\d+\.json$ (approximate, based on creation logic)
    // Actually creation logic: `${workspaceId}_${conversationId}_${timestamp}.json`
    // So we look for files ending in .json that have 3 parts separated by underscores
    const sessionFiles = files.filter((f) => f.endsWith('.json') && f.split('_').length >= 3);

    const sessions = await Promise.all(
      sessionFiles.map(async (file) => {
        try {
          const filePath = path.join(contextDir, file);
          const stats = await fs.stat(filePath);

          // Parse parts from filename: workspaceId_conversationId_timestamp.json
          const parts = file.replace('.json', '').split('_');
          const timestampStr = parts[parts.length - 1]; // Last part is timestamp
          const conversationId = parts[parts.length - 2]; // Second to last is convID
          // Workspace ID might contain underscores? No, MD5 hex usually doesn't.
          // But wait, workspaceId is first part.
          // Let's assume standard format from createSessionFile.

          const createdAt = new Date(parseInt(timestampStr));

          // Try to read summary file
          const summaryFile = file.replace('.json', '_summary.md');
          const summaryPath = path.join(contextDir, summaryFile);
          let preview = '';
          let name = `Session ${new Date(parseInt(timestampStr)).toLocaleString()}`;

          if (await fs.pathExists(summaryPath)) {
            const summaryContent = await fs.readFile(summaryPath, 'utf8');
            preview = summaryContent.slice(0, 200); // First 200 chars
            // Extract title from summary if possible (e.g. first line # Title)
            const firstLine = summaryContent.split('\n')[0];
            if (firstLine && firstLine.startsWith('# ')) {
              name = firstLine.replace('# ', '').trim();
            }
          }

          // Read JSON content to get metadata
          let messageCount = 0;
          let model = 'Unknown';
          let totalTokens = 0;
          let taskName = name; // Default from timestamp if not found

          try {
            const sessionData = await fs.readJson(filePath);
            if (sessionData) {
              // Parse token usage
              totalTokens = sessionData.tokenUsage || 0;
              model = sessionData.model || 'Unknown';

              // Count user requests
              if (Array.isArray(sessionData.messages)) {
                messageCount = sessionData.messages.filter((m: any) => m.role === 'user').length;
              }

              // Extract Task Name from Task Progress (last one) or explicit field
              if (sessionData.taskName) {
                taskName = sessionData.taskName;
              } else if (sessionData.taskProgress && sessionData.taskProgress.current) {
                taskName = sessionData.taskProgress.current.taskName;
              } else if (
                sessionData.taskProgress &&
                Array.isArray(sessionData.taskProgress.history) &&
                sessionData.taskProgress.history.length > 0
              ) {
                const history = sessionData.taskProgress.history;
                taskName = history[history.length - 1].taskName;
              }
            }
          } catch (err) {
            console.warn(`Failed to read session JSON ${file}:`, err);
          }

          return {
            id: file.replace('.json', ''), // Use filename as unique ID to prevent duplicates
            sessionId: file.replace('.json', ''),
            conversationId,
            name: taskName,
            path: filePath,
            createdAt: createdAt,
            lastModified: stats.mtime,
            messageCount,
            preview: model, // Using preview field to store model info for now, or add specific field
            model,
            totalTokens,
          };
        } catch (e) {
          console.error(`Error parsing session file ${file}:`, e);
          return null;
        }
      }),
    );

    return sessions
      .filter((session): session is NonNullable<typeof session> => session !== null)
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }
}

const service = new WorkspaceContextService();
const scanner = new ScannerService();

export function setupWorkspaceHandlers() {
  ipcMain.handle('workspaces:list', async () => {
    return await service.listWorkspaces();
  });

  ipcMain.handle('workspaces:link', async (_, folderPath: string) => {
    return await service.findOrCreateWorkspace(folderPath);
  });
  ipcMain.handle('workspaces:get-context', async (_, id: string) => {
    return await service.getContextFiles(id);
  });

  ipcMain.handle(
    'workspaces:update-context',
    async (_, id: string, type: 'workspace' | 'rules', content: string) => {
      return await service.updateContextFile(id, type, content);
    },
  );

  ipcMain.handle(
    'workspaces:get-summary',
    async (_, workspaceId: string, conversationId: string) => {
      return await service.getConversationSummary(workspaceId, conversationId);
    },
  );

  ipcMain.handle(
    'workspaces:update-summary',
    async (_, workspaceId: string, conversationId: string, content: string) => {
      return await service.updateConversationSummary(workspaceId, conversationId, content);
    },
  );

  ipcMain.handle(
    'workspaces:create-session',
    async (_, workspaceId: string, conversationId: string, data: any) => {
      return await service.createSessionFile(workspaceId, conversationId, data);
    },
  );

  ipcMain.handle('workspaces:get-sessions', async (_, workspaceId: string) => {
    return await service.getSessions(workspaceId);
  });

  ipcMain.handle('workspaces:scan', async (_, folderPath: string) => {
    return await scanner.generateTreeView(folderPath);
  });

  ipcMain.handle('workspaces:get-tree', async (_, folderPath: string) => {
    return await scanner.getStructuredTree(folderPath);
  });

  // Git Handlers
  ipcMain.handle('git:status', async (_, repoPath: string) => {
    return await gitService.getStatus(repoPath);
  });

  ipcMain.handle('git:diff-stats', async (_, repoPath: string) => {
    return await gitService.getDiffNumStat(repoPath);
  });

  ipcMain.handle('git:diff', async (_, repoPath: string, staged: boolean = false) => {
    return await gitService.getDiff(repoPath, staged);
  });

  ipcMain.handle('git:add', async (_, repoPath: string, files: string[]) => {
    return await gitService.add(repoPath, files);
  });

  ipcMain.handle('git:commit', async (_, repoPath: string, message: string) => {
    return await gitService.commit(repoPath, message);
  });

  ipcMain.handle('git:push', async (_, repoPath: string) => {
    return await gitService.push(repoPath);
  });

  // Watcher Handlers
  ipcMain.handle('watcher:watch', (_, folderPath: string) => {
    const win = windowManager.getMainWindow();
    if (win) {
      watcherService.watch(folderPath, win);
    }
  });

  ipcMain.handle('watcher:unwatch', () => {
    watcherService.unwatch();
  });
}
