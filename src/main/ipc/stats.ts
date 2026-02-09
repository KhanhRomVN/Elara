import { ipcMain } from 'electron';

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:11434';

export const setupStatsHandlers = () => {
  ipcMain.handle(
    'stats:get',
    async (
      _event,
      period: string = 'day',
      offset: number = 0,
      type?: 'history' | 'accounts' | 'models',
    ) => {
      try {
        const url = new URL(`${BACKEND_URL}/v1/stats`);
        url.searchParams.append('period', period);
        url.searchParams.append('offset', offset.toString());
        if (type) {
          url.searchParams.append('type', type);
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`Backend responded with ${response.status}`);
        }

        const json = await response.json();
        if (json.success && json.data) {
          // Flatten data to match expected renderer format
          const { accounts, models, history, providers } = json.data;

          if (type === 'accounts') return { accounts, providers };
          if (type === 'models') return { models, providers };

          if (!type && period === 'day' && offset === 0) {
            return {
              accounts,
              models,
              providers,
              history: Array.isArray(history)
                ? history
                : {
                    day: history,
                    week: history, // Backend controller might need adjustment for bulk, or main emulates it
                    month: history,
                    year: history,
                  },
              isBulk: true,
            };
          }

          return {
            accounts,
            models,
            providers,
            history,
          };
        }

        throw new Error(json.message || 'Failed to fetch stats');
      } catch (error: any) {
        console.error('[IPC] Failed to fetch stats from backend:', error.message);
        return {
          success: false,
          error: error.message,
          accounts: [],
          models: [],
          providers: [],
          history: [],
        };
      }
    },
  );
};
