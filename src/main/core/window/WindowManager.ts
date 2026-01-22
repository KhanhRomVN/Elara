import { BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { windowConfig } from '../config';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private isQuitting = false;

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
      icon: join(__dirname, '../../resources/icon.png'),
    });

    this.mainWindow.on('ready-to-show', () => {
      console.log('[Main] Window ready to show');
      this.mainWindow?.maximize();
      this.mainWindow?.show();
    });

    // Handle window close - minimize to tray instead
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

    // Add error handlers and lifecycle tracking
    this.mainWindow.webContents.on('did-start-loading', () => {
      console.log('[Main] Window loading started');
    });

    this.mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      console.error('[Main] Failed to load renderer:', errorCode, errorDescription);
    });

    this.mainWindow.webContents.on('dom-ready', () => {
      console.log('[Main] DOM ready');
    });

    this.mainWindow.webContents.on('did-finish-load', () => {
      console.log('[Main] Renderer loaded successfully');
    });

    // Capture console messages from renderer
    this.mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      const levels = ['verbose', 'info', 'warning', 'error'];
      console.log(`[Renderer ${levels[level]}] ${message} (${sourceId}:${line})`);
    });

    this.mainWindow.on('closed', () => {
      console.log('[Main] Window closed');
      this.mainWindow = null;
    });

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      console.log('[Main] Loading renderer URL:', process.env['ELECTRON_RENDERER_URL']);
      this.mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']).catch((err) => {
        console.error('[Main] Error loading renderer URL:', err);
      });
    } else {
      const htmlPath = join(__dirname, '../renderer/index.html');
      console.log('[Main] Loading renderer file:', htmlPath);
      this.mainWindow.loadFile(htmlPath).catch((err) => {
        console.error('[Main] Error loading renderer file:', err);
      });
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
