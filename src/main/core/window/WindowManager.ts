import { BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { windowConfig } from '../config';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private ideWindows: Map<string, BrowserWindow> = new Map();
  private isQuitting = false;

  constructor() {}

  createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: windowConfig.defaultWidth,
      height: windowConfig.defaultHeight,
      minWidth: windowConfig.minWidth,
      minHeight: windowConfig.minHeight,
      show: false,
      autoHideMenuBar: true,
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 20, y: 20 },
      title: windowConfig.title,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true,
      },
      icon: join(__dirname, '../../resources/icon.png'),
    });

    this.mainWindow.on('ready-to-show', () => {
      this.mainWindow?.maximize();
      this.mainWindow?.show();
    });

    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });

    this.mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: 'deny' };
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    this.loadContent(this.mainWindow);
  }

  createIDEWindow(folderPath: string): void {
    // Check if window for this folder already exists
    if (this.ideWindows.has(folderPath)) {
      const existingWindow = this.ideWindows.get(folderPath);
      existingWindow?.focus();
      return;
    }

    const ideWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      autoHideMenuBar: true,
      titleBarStyle: 'hidden',
      title: `Elara IDE - ${folderPath.split('/').pop()}`,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true,
      },
      icon: join(__dirname, '../../resources/icon.png'),
    });

    ideWindow.on('ready-to-show', () => {
      ideWindow.show();
    });

    ideWindow.on('closed', () => {
      this.ideWindows.delete(folderPath);
    });

    this.ideWindows.set(folderPath, ideWindow);

    // Load with a specific route and folderPath hash/query
    const route = `#/ide/editor?path=${encodeURIComponent(folderPath)}`;
    this.loadContent(ideWindow, route);
  }

  private loadContent(window: BrowserWindow, route = ''): void {
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const url = route
        ? `${process.env['ELECTRON_RENDERER_URL']}${route}`
        : process.env['ELECTRON_RENDERER_URL'];
      window.loadURL(url).catch((err) => {
        console.error('[Main] Error loading URL:', err);
      });
    } else {
      const htmlPath = join(__dirname, '../renderer/index.html');
      // For production with HashRouter, we might need to handle the hash differently if loadFile doesn't support it directly
      // Usually, it's safer to load the file and then let the renderer handle routing,
      // but for deep links in Electron + HashRouter, we often use loadURL with file:// protocol or loadFile + window.webContents.executeJavaScript
      if (route) {
        window.loadURL(`file://${htmlPath}${route}`).catch((err) => {
          console.error('[Main] Error loading file with route:', err);
        });
      } else {
        window.loadFile(htmlPath).catch((err) => {
          console.error('[Main] Error loading file:', err);
        });
      }
    }
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  setQuitting(value: boolean): void {
    this.isQuitting = value;
  }
}

export const windowManager = new WindowManager();
