import { app, BrowserWindow, ipcMain } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { windowManager } from './core/window';

ipcMain.on('debug:log', (_, message) => {
  console.log('[Renderer Log]:', message);
});
import { setupEventHandlers } from './core/events';
import { setupAccountsHandlers } from './ipc/accounts';
import { setupServerHandlers } from './ipc/server';
import { setupAppHandlers } from './ipc/app';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

import { setupCommandsHandlers } from './ipc/commands';
import { setupStatsHandlers } from './ipc/stats';
import { setupDialogHandlers } from './ipc/dialog';
import { setupExtendedToolsHandlers } from './ipc/extended-tools';
import { setupVersionHandlers } from './ipc/version';
import { setupWorkspaceHandlers } from './ipc/workspaces';
import { createSystemTray, destroySystemTray } from './core/tray';

process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled Rejection:', reason);
});

process.on('exit', (code) => {
  console.log(`[Main] Process exiting with code: ${code}`);
});

// Backend process reference
let backendProcess: ChildProcess | null = null;

console.log('[Main] Requesting single instance lock...');
const gotTheLock = app.requestSingleInstanceLock();
console.log('[Main] Got lock:', gotTheLock);

if (!gotTheLock) {
  console.log('[Main] Another instance is already running - quitting!');
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
    try {
      setupEventHandlers();
      setupAccountsHandlers();
      // setupServerHandlers(); // Server handlers now use HTTP
      setupServerHandlers();
      setupAppHandlers();
      setupVersionHandlers();
      setupCommandsHandlers();
      setupStatsHandlers();
      setupDialogHandlers();
      setupExtendedToolsHandlers();
      setupWorkspaceHandlers();

      import('./ipc/ide').then(({ setupIDEHandlers }) => {
        try {
          setupIDEHandlers();
        } catch (err) {
          console.error('[Main] Failed to setup IDE handlers:', err);
        }
      });

      // Import and register proxy handlers
      // REMOVED: Proxy handlers depend on embedded server which has been removed
      // If proxy functionality is needed, it should be refactored to use the backend API
      // import('./ipc/proxy').then(({ registerProxyIpcHandlers }) => {
      //   try {
      //     console.log('[Main] Registering proxy handlers...');
      //     registerProxyIpcHandlers();
      //     console.log('[Main] Proxy handlers registered.');
      //   } catch (err) {
      //     console.error('[Main] Failed to setup proxy handlers:', err);
      //   }
      // });
    } catch (err) {
      console.error('[Main] Error setting up IPC handlers:', err);
    }

    // Start Backend Server

    const startBackend = () => {
      if (app.isPackaged) {
        // Platform specific binary name
        let backendExecutable = 'server';
        if (process.platform === 'win32') {
          backendExecutable = 'server.exe';
        }

        const backendPath = path.join(process.resourcesPath, 'backend', backendExecutable);

        console.log('[Main] Starting backend binary from:', backendPath);

        try {
          const userDataPath = app.getPath('userData');
          const dbPath = path.join(userDataPath, 'database.sqlite');

          // Set cwd to the folder containing the binary so it can find adjacent .node files if needed,
          // though pkg usually handles this if configured correctly or if we copy them there.
          const backendCwd = path.join(process.resourcesPath, 'backend');

          console.log('[Main] Starting backend with DB path:', dbPath);
          console.log('[Main] Backend CWD:', backendCwd);

          // Use spawn directly on the binary
          backendProcess = spawn(backendPath, [], {
            cwd: backendCwd,
            env: {
              ...process.env,
              // Pass any strictly necessary env vars here
              DATABASE_PATH: dbPath,
              // If your backend reads port from env
              PORT: '11434',
            },
            stdio: 'pipe',
          });

          if (backendProcess.stdout) {
            backendProcess.stdout.on('data', (data) => {
              console.log(`[Backend STDOUT]: ${data}`);
            });
          }

          if (backendProcess.stderr) {
            backendProcess.stderr.on('data', (data) => {
              console.error(`[Backend STDERR]: ${data}`);
            });
          }

          console.log('[Main] Backend process spawned with PID:', backendProcess.pid);

          backendProcess.on('error', (err) => {
            console.error('[Main] Backend process error:', err);
          });

          backendProcess.on('exit', (code, signal) => {
            console.log(`[Main] Backend process exited with code ${code} and signal ${signal}`);
          });
        } catch (e) {
          console.error('[Main] Failed to spawn backend:', e);
        }
      } else {
        console.log('[Main] Development mode: Backend should be running in a separate terminal.');
      }
    };

    startBackend();

    // Create system tray
    createSystemTray();

    // Check for provider updates in the background - REMOVED (Relies on Backend)
    // DynamicProviderManager functionality moved to backend or deprecated in main process

    // Create main window
    console.log('[Main] Creating main window...');
    try {
      windowManager.createMainWindow();
      console.log('[Main] createMainWindow called.');
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow) {
        mainWindow.maximize();
        console.log('[Main] Main window maximized.');
      } else {
        console.error('[Main] Main window is NULL after creation!');
      }
    } catch (err) {
      console.error('[Main] Error creating main window:', err);
    }

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
    console.log('[Main] All windows closed - keeping app running in tray');
    // Don't quit the app when all windows are closed
    // The app will continue running in the system tray
  });

  // Track when app is about to quit
  app.on('will-quit', () => {
    console.log('[Main] App will quit');
    if (backendProcess) {
      console.log('[Main] Killing backend process...');
      backendProcess.kill();
    }
  });

  // Handle app quit from tray menu
  app.on('before-quit', () => {
    windowManager.setQuitting(true);
    destroySystemTray();
  });
}
