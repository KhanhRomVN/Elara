import { app, BrowserWindow } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { windowManager } from './core/window';
import { setupEventHandlers } from './core/events';
import { setupAccountsHandlers } from './ipc/accounts';
import { setupServerHandlers } from './ipc/server';

import { setupCommandsHandlers } from './ipc/commands';
import { setupStatsHandlers } from './ipc/stats';
import { startCLIServer, stopCLIServer } from './core/cli-server';
import { startN8nServer, stopN8nServer } from './core/n8n-manager';
import { setupSecurityHandlers } from './core/security';

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');

  // Default open or close DevTools by F12 in development
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

  // Setup security handlers (strip headers for n8n)
  setupSecurityHandlers();

  // Start CLI server
  startCLIServer();

  // Start n8n server
  startN8nServer();

  // Create main window
  windowManager.createMainWindow();

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
  if (process.platform !== 'darwin') {
    stopCLIServer();
    stopN8nServer();
    app.quit();
  }
});

// Clean up CLI server before quitting
app.on('before-quit', () => {
  stopCLIServer();
  stopN8nServer();
});
