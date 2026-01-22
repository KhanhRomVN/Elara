import { app, Menu, Tray, nativeImage } from 'electron';
import { join } from 'path';
import { windowManager } from './window';

let tray: Tray | null = null;

export function createSystemTray(): void {
  // Load icon from assets
  const iconPath = join(__dirname, '../../resources/icon.png');
  const icon = nativeImage.createFromPath(iconPath);

  // Create tray with icon
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  // Set tooltip
  tray.setToolTip('Elara');

  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Window',
      click: () => {
        const mainWindow = windowManager.getMainWindow();
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.show();
          mainWindow.focus();
        } else {
          windowManager.createMainWindow();
        }
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Quit App',
      click: () => {
        app.quit();
      },
    },
  ]);

  // Set context menu
  tray.setContextMenu(contextMenu);

  // Double click to show window
  tray.on('double-click', () => {
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    } else {
      windowManager.createMainWindow();
    }
  });
}

export function destroySystemTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

export function getTray(): Tray | null {
  return tray;
}
