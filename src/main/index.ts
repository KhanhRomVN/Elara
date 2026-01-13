import { app, BrowserWindow, ipcMain } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { windowManager } from './core/window';

ipcMain.on('debug:log', (_, message) => {
  console.log('[Renderer Log]:', message);
});
import { setupEventHandlers } from './core/events';
import { setupAccountsHandlers } from './ipc/accounts';
import { setupServerHandlers } from './ipc/server';
import { startServer } from './server';

import { setupCommandsHandlers } from './ipc/commands';
import { setupStatsHandlers } from './ipc/stats';
import { startCLIServer, stopCLIServer } from './core/cli-server';
import { createSystemTray, destroySystemTray } from './core/tray';

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron.elara');

    // On Linux, setting desktopName helps find the correct .desktop file
    if (process.platform === 'linux') {
      const APP_NAME = 'elara'; // Must match executableName or .desktop filename
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      app.desktopName = `${APP_NAME}.desktop`;
    } // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    // Setup IPC event handlers
    setupEventHandlers();
    setupAccountsHandlers();
    setupServerHandlers();

    setupCommandsHandlers();
    setupStatsHandlers();

    // Start API server
    startServer();

    // Start CLI server
    startCLIServer();

    // Create system tray
    createSystemTray();

    // Create main window
    windowManager.createMainWindow();
    const mainWindow = windowManager.getMainWindow();
    mainWindow?.maximize();

    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.createMainWindow();
      }
    });
  });

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    // Don't quit the app when all windows are closed
    // The app will continue running in the system tray
  });

  // Handle app quit from tray menu
  app.on('before-quit', () => {
    windowManager.setQuitting(true);
    stopCLIServer();
    destroySystemTray();
  });
}
