import fs from 'fs-extra';
import path from 'path';
import ignore from 'ignore';

export interface ScanOptions {
  maxSize?: number;
  minifiedThreshold?: number;
}

export interface TreeEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeEntry[];
}

export class ScannerService {
  private static readonly EXCLUDED_EXTENSIONS = new Set([
    '.pdf',
    '.doc',
    '.docx',
    '.ppt',
    '.pptx',
    '.xls',
    '.xlsx',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.svg',
    '.ico',
    '.mp4',
    '.mp3',
    '.wav',
    '.exe',
    '.dll',
    '.so',
    '.bin',
    '.zip',
    '.tar',
    '.gz',
    '.7z',
    '.rar',
  ]);

  private static readonly EXCLUDED_FOLDERS = new Set([
    'node_modules',
    '.git',
    '.svn',
    'dist',
    'build',
    'out',
    'coverage',
  ]);

  async generateTreeView(rootPath: string, options: ScanOptions = {}): Promise<string> {
    const { maxSize = 1024 * 1024, minifiedThreshold = 3000 } = options;
    if (!(await fs.pathExists(rootPath))) throw new Error('Root path does not exist');
    const ig = await this.getIgnore(rootPath);
    const treeLines: string[] = [];
    await this.scanDir(rootPath, rootPath, ig, 0, treeLines, maxSize, minifiedThreshold);
    return treeLines.join('\n');
  }

  async getStructuredTree(rootPath: string, options: ScanOptions = {}): Promise<TreeEntry[]> {
    const { maxSize = 1024 * 1024, minifiedThreshold = 3000 } = options;
    if (!(await fs.pathExists(rootPath))) throw new Error('Root path does not exist');
    const ig = await this.getIgnore(rootPath);
    return await this.scanStructured(rootPath, rootPath, ig, maxSize, minifiedThreshold);
  }

  private async scanStructured(
    currentPath: string,
    rootPath: string,
    ig: any,
    maxSize: number,
    minifiedThreshold: number,
  ): Promise<TreeEntry[]> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    const result: TreeEntry[] = [];

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relPath = path.relative(rootPath, fullPath);
      if (entry.isDirectory() && ScannerService.EXCLUDED_FOLDERS.has(entry.name)) continue;
      if (ig && ig.ignores(relPath)) continue;

      if (entry.isDirectory()) {
        result.push({
          name: entry.name,
          path: relPath,
          isDirectory: true,
          children: await this.scanStructured(fullPath, rootPath, ig, maxSize, minifiedThreshold),
        });
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (ScannerService.EXCLUDED_EXTENSIONS.has(ext)) continue;
        if (await this.shouldIncludeFile(fullPath, maxSize, minifiedThreshold)) {
          result.push({
            name: entry.name,
            path: relPath,
            isDirectory: false,
          });
        }
      }
    }
    return result;
  }

  private async scanDir(
    currentPath: string,
    rootPath: string,
    ig: any,
    depth: number,
    treeLines: string[],
    maxSize: number,
    minifiedThreshold: number,
  ): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relPath = path.relative(rootPath, fullPath);
      if (entry.isDirectory() && ScannerService.EXCLUDED_FOLDERS.has(entry.name)) continue;
      if (ig && ig.ignores(relPath)) continue;

      if (entry.isDirectory()) {
        treeLines.push(`${'  '.repeat(depth)}${entry.name}/`);
        await this.scanDir(
          fullPath,
          rootPath,
          ig,
          depth + 1,
          treeLines,
          maxSize,
          minifiedThreshold,
        );
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (ScannerService.EXCLUDED_EXTENSIONS.has(ext)) continue;
        if (await this.shouldIncludeFile(fullPath, maxSize, minifiedThreshold)) {
          treeLines.push(`${'  '.repeat(depth)}${entry.name}`);
        }
      }
    }
  }

  private async shouldIncludeFile(
    filePath: string,
    maxSize: number,
    minifiedThreshold: number,
  ): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > maxSize) return false;
      const buffer = Buffer.alloc(1024);
      const fd = await fs.open(filePath, 'r');
      const { bytesRead } = await fs.read(fd, buffer, 0, 1024, 0);
      await fs.close(fd);
      for (let i = 0; i < bytesRead; i++) if (buffer[i] === 0) return false;
      const content = buffer.toString('utf8', 0, bytesRead);
      const lines = content.split('\n');
      for (const line of lines) if (line.length > minifiedThreshold) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  private async getIgnore(rootPath: string) {
    const gitignorePath = path.join(rootPath, '.gitignore');
    if (await fs.pathExists(gitignorePath)) {
      const content = await fs.readFile(gitignorePath, 'utf8');
      return ignore().add(content);
    }
    return null;
  }
}
