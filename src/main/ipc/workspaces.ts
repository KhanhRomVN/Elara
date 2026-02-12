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

    const contextDir = path.join(this.rootDir, workspace.id);
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
    const contextDir = path.join(this.rootDir, id);
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
  ): Promise<{ sessionPath: string; summaryPath: string }> {
    const timestamp = Date.now();
    const contextDir = path.join(this.rootDir, workspaceId);
    await fs.ensureDir(contextDir);

    const sessionFileName = `${workspaceId}_${conversationId}_${timestamp}.json`;
    const summaryFileName = `${workspaceId}_${conversationId}_${timestamp}_summary.md`;

    const sessionPath = path.join(contextDir, sessionFileName);
    const summaryPath = path.join(contextDir, summaryFileName);

    await fs.writeJson(sessionPath, data, { spaces: 2 });
    await fs.writeFile(summaryPath, '', 'utf8');

    return { sessionPath, summaryPath };
  }

  async updateContextFile(id: string, type: 'workspace' | 'rules', content: string): Promise<void> {
    const contextDir = path.join(this.rootDir, id);
    const fileName = type === 'workspace' ? 'workspace.md' : 'workspace_rules.md';
    const filePath = path.join(contextDir, fileName);

    await fs.ensureDir(contextDir);
    await fs.writeFile(filePath, content, 'utf8');
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

  ipcMain.handle('git:add', async (_, repoPath: string, files: string[]) => {
    return await gitService.add(repoPath, files);
  });

  ipcMain.handle('git:commit', async (_, repoPath: string, message: string) => {
    return await gitService.commit(repoPath, message);
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
