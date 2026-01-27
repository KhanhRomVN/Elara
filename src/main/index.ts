import { app, BrowserWindow, ipcMain } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { windowManager } from './core/window';
import * as net from 'net';
import * as readline from 'readline';

ipcMain.on('debug:log', (_, message) => {
  console.log('[Renderer Log]:', message);
});
import { setupEventHandlers } from './core/events';
import { setupAccountsHandlers } from './ipc/accounts';
import { setupServerHandlers } from './ipc/server';
import { setupVersionHandlers } from './ipc/version';
import { setupAppHandlers } from './ipc/app';
import { startServer } from './server';
import type { ServerStartResult } from './server';

import { setupCommandsHandlers } from './ipc/commands';
import { setupStatsHandlers } from './ipc/stats';
import { setupDialogHandlers } from './ipc/dialog';
import { setupExtendedToolsHandlers } from './ipc/extended-tools';
import { startCLIServer, stopCLIServer } from './core/cli-server';
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

console.log('[Main] Requesting single instance lock...');
const gotTheLock = app.requestSingleInstanceLock();
console.log('[Main] Got lock:', gotTheLock);

if (!gotTheLock) {
  const args = process.argv
    .slice(process.env.NODE_ENV === 'development' ? 2 : 1)
    .filter((arg) => !arg.startsWith('--'));

  if (args.length > 0) {
    console.log('[Main] Secondary instance with arguments, acting as CLI client...');
    const SOCKET_PATH = process.platform === 'win32' ? '\\\\.\\pipe\\elara-cli' : '/tmp/elara.sock';
    const client = new net.Socket();
    let buffer = '';

    const command = args[0];
    const commandArgs = args.slice(1);
    const cwd = process.cwd();

    client.connect(SOCKET_PATH, () => {
      client.write(
        JSON.stringify({
          type: 'execute',
          trigger: command,
          args: commandArgs,
          cwd,
        }) + '\n',
      );
    });

    client.on('data', (data) => {
      buffer += data.toString();
      let boundary = buffer.indexOf('\n');
      while (boundary !== -1) {
        const message = buffer.substring(0, boundary).trim();
        buffer = buffer.substring(boundary + 1);
        if (message) {
          try {
            const info = JSON.parse(message);
            if (info.error) {
              process.stderr.write(`\x1b[31mError: ${info.error}\x1b[0m\n`);
            } else if (info.type === 'execution-result') {
              process.stdout.write(info.output);
            } else if (info.type === 'prompt') {
              const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
              rl.question(`\x1b[33m${info.query} (y/n):\x1b[0m `, (answer) => {
                rl.close();
                client.write(JSON.stringify({ type: 'input', content: answer.trim() }) + '\n');
              });
            }
          } catch (e) {
            if (message.trim()) console.log(message);
          }
        }
        boundary = buffer.indexOf('\n');
      }
    });

    client.on('end', () => {
      app.quit();
    });
    client.on('error', (err) => {
      console.error(`[CLI Forward] Connection error: ${err.message}`);
      app.quit();
    });

    // Safety timeout
    setTimeout(() => {
      console.log('[CLI Forward] Timeout waiting for server response');
      app.quit();
    }, 600000); // 10 minutes
  } else {
    console.log('[Main] Another instance is already running - quitting!');
    app.quit();
  }
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
      setupServerHandlers();
      setupVersionHandlers();
      setupAppHandlers();
      setupCommandsHandlers();
      setupStatsHandlers();
      setupDialogHandlers();
      setupExtendedToolsHandlers();

      import('./ipc/ide').then(({ setupIDEHandlers }) => {
        try {
          setupIDEHandlers();
        } catch (err) {
          console.error('[Main] Failed to setup IDE handlers:', err);
        }
      });

      // Import and register proxy handlers
      import('./ipc/proxy').then(({ registerProxyIpcHandlers }) => {
        try {
          console.log('[Main] Registering proxy handlers...');
          registerProxyIpcHandlers();
          console.log('[Main] Proxy handlers registered.');
        } catch (err) {
          console.error('[Main] Failed to setup proxy handlers:', err);
        }
      });
    } catch (err) {
      console.error('[Main] Error setting up IPC handlers:', err);
    }

    // Start API server with embedded database
    console.log('[Main] Starting API server...');
    try {
      startServer()
        .then((result: ServerStartResult) => {
          if (result.success) {
            console.log(`[Main] Server started successfully on port ${result.port}`);
          } else {
            console.error('[Main] Server failed to start:', result.error);
          }
        })
        .catch((err) => {
          console.error('[Main] Unexpected error starting server:', err);
        });
    } catch (err) {
      console.error('[Main] Failed to initiate server start:', err);
    }

    // Start CLI server
    try {
      startCLIServer();
    } catch (err) {
      console.error('[Main] Failed to start CLI server:', err);
    }

    // Create system tray
    createSystemTray();

    // Check for provider updates in the background
    import('./server/dynamic-provider').then(({ DynamicProviderManager }) => {
      DynamicProviderManager.getInstance()
        .updateAllProviders()
        .catch((err) => {
          console.error('[Main] Failed to update providers:', err);
        });
    });

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
  });

  // Handle app quit from tray menu
  app.on('before-quit', () => {
    windowManager.setQuitting(true);
    stopCLIServer();
    destroySystemTray();
  });
}
