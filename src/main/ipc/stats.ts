import { ipcMain } from 'electron';
import {
  getAccountStatsByPeriod,
  getModelStatsByPeriod,
  getUsageHistory,
} from '../../../backend/src/services/stats.service';
import { getAllProviders } from '../../../backend/src/services/provider.service';

export const setupStatsHandlers = () => {
  ipcMain.handle(
    'stats:get',
    async (_event, period?: any, offset: number = 0, type?: 'history' | 'accounts' | 'models') => {
      const providers = await getAllProviders();

      if (type === 'accounts') {
        return { accounts: getAccountStatsByPeriod(period, offset), providers };
      }

      if (type === 'models') {
        return { models: getModelStatsByPeriod(period, offset), providers };
      }

      // Default/Bulk Logic
      const baseStats = {
        accounts: getAccountStatsByPeriod('day', 0), // Default for summary
        models: getModelStatsByPeriod('day', 0), // Default for summary
        providers,
      };

      if (!period && offset === 0 && !type) {
        return {
          ...baseStats,
          history: {
            day: getUsageHistory('day', 0),
            week: getUsageHistory('week', 0),
            month: getUsageHistory('month', 0),
            year: getUsageHistory('year', 0),
          },
          isBulk: true,
        };
      }

      return {
        ...baseStats,
        history: getUsageHistory(period, offset),
      };
    },
  );
};
