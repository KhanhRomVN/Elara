import { ipcMain, app } from 'electron';
import * as os from 'os';

export const setupAppHandlers = () => {
  ipcMain.handle('app:get-system-info', () => {
    return {
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      platform: process.platform,
      shell: process.env.SHELL || (process.platform === 'win32' ? process.env.ComSpec : '/bin/sh'),
      homeDir: app.getPath('home'),
      appVersion: app.getVersion(),
      cwd: process.cwd(),
    };
  });

  ipcMain.on('app:quit', () => {
    app.quit();
  });
};
