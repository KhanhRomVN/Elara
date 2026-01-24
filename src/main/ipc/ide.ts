import { ipcMain } from 'electron';
import fs from 'fs-extra';
import path from 'path';
import { windowManager } from '../core/window/WindowManager';

export const setupIDEHandlers = () => {
  // Window Management
  ipcMain.handle('ide:open-window', async (_, folderPath: string) => {
    try {
      const { app } = require('electron');
      const isDev = !app.isPackaged;
      const bundledZedPath = isDev
        ? path.join(process.cwd(), 'resources', 'bin', 'zed')
        : path.join(process.resourcesPath, 'resources', 'bin', 'zed');

      if (fs.existsSync(bundledZedPath)) {
        console.log('[IDE] Using bundled Zed:', bundledZedPath);
        const { exec } = require('child_process');
        exec(`"${bundledZedPath}" "${folderPath}"`, (error) => {
          if (error) {
            console.error('[IDE] Failed to launch bundled Zed:', error);
          }
        });
        return { success: true, method: 'bundled-zed' };
      }

      console.log('[IDE] Bundled Zed not found, using internal window manager.');
      windowManager.createIDEWindow(folderPath);
      return { success: true, method: 'internal' };
    } catch (error: any) {
      console.error('[IDE] Failed to open window:', error);
      return { success: false, error: error.message };
    }
  });

  // File System Operations
  ipcMain.handle('ide:list-files', async (_, dirPath: string) => {
    try {
      const items = await fs.readdir(dirPath);
      const result = await Promise.all(
        items.map(async (item) => {
          const fullPath = path.join(dirPath, item);
          const stats = await fs.stat(fullPath);
          return {
            name: item,
            path: fullPath,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            mtime: stats.mtime,
          };
        }),
      );
      // Sort: Directories first, then alphabetically
      return result.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });
    } catch (error: any) {
      console.error('[IDE] Failed to list files:', error);
      throw error;
    }
  });

  ipcMain.handle('ide:read-file', async (_, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error: any) {
      console.error('[IDE] Failed to read file:', error);
      throw error;
    }
  });

  ipcMain.handle('ide:write-file', async (_, filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error: any) {
      console.error('[IDE] Failed to write file:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    'ide:create-item',
    async (_, parentPath: string, name: string, isDirectory: boolean) => {
      try {
        const fullPath = path.join(parentPath, name);
        if (isDirectory) {
          await fs.ensureDir(fullPath);
        } else {
          await fs.ensureFile(fullPath);
        }
        return { success: true, path: fullPath };
      } catch (error: any) {
        console.error('[IDE] Failed to create item:', error);
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle('ide:delete-item', async (_, itemPath: string) => {
    try {
      await fs.remove(itemPath);
      return { success: true };
    } catch (error: any) {
      console.error('[IDE] Failed to delete item:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('ide:rename-item', async (_, oldPath: string, newName: string) => {
    try {
      const newPath = path.join(path.dirname(oldPath), newName);
      await fs.move(oldPath, newPath);
      return { success: true, path: newPath };
    } catch (error: any) {
      console.error('[IDE] Failed to rename item:', error);
      return { success: false, error: error.message };
    }
  });
};
