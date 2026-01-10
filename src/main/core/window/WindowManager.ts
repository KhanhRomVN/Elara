import { BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { windowConfig } from '../config';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  constructor() {}

  createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: windowConfig.defaultWidth,
      height: windowConfig.defaultHeight,
      minWidth: windowConfig.minWidth,
      minHeight: windowConfig.minHeight,
      show: false,
      autoHideMenuBar: true, // Use custom titlebar
      titleBarStyle: 'hidden', // Hide native titlebar
      trafficLightPosition: { x: 20, y: 20 }, // Adjust traffic light position for macOS
      title: windowConfig.title,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    this.mainWindow.on('ready-to-show', () => {
      this.mainWindow?.show();
      if (is.dev) {
        // keep window maximized in dev
      }
    });

    this.mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: 'deny' };
    });

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}

export const windowManager = new WindowManager();
