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
import { setBackendPort } from './ipc/server';
import { findAvailablePort } from './utils/port-finder';
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

if (!gotTheLock && app.isPackaged) {
  console.log('[Main] Another instance is already running - quitting!');
  app.quit();
} else {
  if (!gotTheLock) {
    console.log('[Main] Another instance is running, but in DEV mode. Allowing multi-instance.');
  }

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

    const startBackend = async () => {
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

          // Find available port
          const availablePort = await findAvailablePort(11434);
          console.log(`[Main] Found available port for backend: ${availablePort}`);
          setBackendPort(availablePort);

          // Use spawn directly on the binary
          backendProcess = spawn(backendPath, [], {
            cwd: backendCwd,
            env: {
              ...process.env,
              // Pass any strictly necessary env vars here
              DATABASE_PATH: dbPath,
              // If your backend reads port from env
              PORT: String(availablePort),
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
        // In dev mode, we might want to check what port the separate backend is running on,
        // but typically it's fixed at 11434 or configured via env.
        // For multi-instance dev, we'd need the external backend to also support dynamic ports,
        // which is complex.
        // However, if the USER implies 'npm run dev' runs everything, then we rely near the top
        // scripts/dev-setup.js to handle things.
        // BUT, looking at package.json: "dev": "node scripts/dev-setup.js && electron-vite dev"
        // And "dev:server": "cd backend && npm run dev"
        // It seems the backend is NOT started by main in dev mode.
        // If we want multi-count in dev, we should actually be using port finding here too IF we were spawning it.
        // Since we are NOT spawning it in dev (it's likely separate), we can just set the port to 11434 default,
        // OR we can try to find where the dev backend is.
        // ACTUALLY, the request says "npm run dev ... start electron app ... Another instance is already running".
        // This implies the Electron app itself is conflicting on the single-instance lock.
        // The backend conflict is a secondary issue if they run "npm run dev:server" separately or if "npm run dev" starts it.
        // Wait, "npm run dev" -> "electron-vite dev".
        // "electron-vite dev" usually starts the renderer and main.
        // Does it start the backend? The logs say "dev server running for the electron renderer process".
        // The logs do NOT show backend starting in the "npm run dev" output provided in the prompt.
        // It seems the user might be running backend separately or expecting it to work.
        // IF the backend is hardcoded to 11434 in dev, multi-instance will clash on backend port if they try to run multiple backends.
        // But if they just run multiple Electrons connecting to ONE backend, that's fine.
        // The prompt says "thêm cơ chế trùng port sẽ nhảy sang port + 1".
        // This likely refers to the ELECTRON APP preventing multiple instances due to the lock,
        // AND potentially the backend port if it WAS spawned.
        // Since `startBackend` has an `if (app.isPackaged)` block, it does NOTHING in dev.
        // So in dev, we just need to bypass the lock (which we did).

        // HOWEVER, if the user WANTS separate backends in dev, they'd need to run separate backend processes.
        // If they just want multiple windows, bypassing the lock is enough.
        // Let's assume the user just wants to run the APP multiple times.

        // One detail: The `window.api.server.start` in the renderer (usePlaygroundLogic) calls `ipcMain.handle('server:start')`.
        // That handler checks `BACKEND_URL`.
        // In dev, `BACKEND_URL` is 11434.
        // If we want to support dynamic backend ports in dev (e.g. if the user runs `PORT=11435 npm run dev:server`),
        // we might need a way to tell the main process which port to use.
        // For now, let's Stick to the requested task: Multi-instance support.
        // We've already handled the lock bypass.
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
