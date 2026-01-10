import { ipcMain } from 'electron';
import { statsManager } from '../core/stats';

export const setupStatsHandlers = () => {
  ipcMain.handle('stats:get', () => {
    return statsManager.getStats();
  });
};
