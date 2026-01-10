import { ipcMain } from 'electron';
import { statsManager } from '../core/stats';

export const setupStatsHandlers = () => {
  ipcMain.handle('get-stats', () => {
    return statsManager.getStats();
  });
};
