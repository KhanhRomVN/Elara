import { ipcMain } from 'electron';
import { startServer, stopServer } from '../server';

export const setupServerHandlers = () => {
  ipcMain.handle('server:start', async () => {
    return await startServer();
  });

  ipcMain.handle('server:stop', async () => {
    return stopServer();
  });
};
