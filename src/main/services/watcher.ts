import chokidar from 'chokidar';
import { BrowserWindow } from 'electron';

export class WatcherService {
  private watcher: chokidar.FSWatcher | null = null;
  private currentPath: string | null = null;

  watch(folderPath: string, window: BrowserWindow) {
    if (this.currentPath === folderPath && this.watcher) {
      return; // Already watching
    }

    this.unwatch();

    this.currentPath = folderPath;
    this.watcher = chokidar.watch(folderPath, {
      ignored: [
        /(^|[\/\\])\../, // ignore dotfiles
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/out/**',
        '**/.git/**',
      ],
      persistent: true,
      ignoreInitial: true,
      depth: 5, // Limit depth to avoid performance issues
    });

    this.watcher
      .on('add', (path) => window.webContents.send('watcher:file-change', { type: 'add', path }))
      .on('change', (path) =>
        window.webContents.send('watcher:file-change', { type: 'change', path }),
      )
      .on('unlink', (path) =>
        window.webContents.send('watcher:file-change', { type: 'unlink', path }),
      )
      .on('addDir', (path) =>
        window.webContents.send('watcher:file-change', { type: 'addDir', path }),
      )
      .on('unlinkDir', (path) =>
        window.webContents.send('watcher:file-change', { type: 'unlinkDir', path }),
      );

    console.log(`[Watcher] Started watching ${folderPath}`);
  }

  unwatch() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.currentPath = null;
      console.log('[Watcher] Stopped watching');
    }
  }
}

export const watcherService = new WatcherService();
