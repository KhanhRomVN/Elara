import { ipcMain } from 'electron';
import { getAllAccountStats, getAllProviderModelStats } from '@backend/services/stats.service';

export const setupStatsHandlers = () => {
  ipcMain.handle('stats:get', () => {
    return {
      accounts: getAllAccountStats(),
      models: getAllProviderModelStats(),
    };
  });
};
