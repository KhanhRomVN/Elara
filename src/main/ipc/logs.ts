import { ipcMain } from 'electron';
import { logsStorage } from '../core/storage/logs';

export const setupLogsHandlers = () => {
  // Create a new log entry
  ipcMain.handle('logs:create', async (_, log) => {
    try {
      const newLog = logsStorage.create(log);
      return { success: true, log: newLog };
    } catch (error) {
      console.error('Failed to create log:', error);
      return { success: false, error: 'Failed to create log' };
    }
  });

  // Get logs for a specific account with pagination and filters
  ipcMain.handle('logs:get-by-account', async (_, { accountId, options }) => {
    try {
      const result = logsStorage.getByAccount(accountId, options);
      return { success: true, ...result };
    } catch (error) {
      console.error('Failed to get logs:', error);
      return { success: false, error: 'Failed to get logs' };
    }
  });

  // Get usage statistics for an account
  ipcMain.handle('logs:get-statistics', async (_, accountId: string) => {
    try {
      const statistics = logsStorage.getStatistics(accountId);
      return { success: true, statistics };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return { success: false, error: 'Failed to get statistics' };
    }
  });

  // Get timeline data for an account
  ipcMain.handle('logs:get-timeline', async (_, { accountId, days }) => {
    try {
      const timeline = logsStorage.getTimeline(accountId, days);
      return { success: true, timeline };
    } catch (error) {
      console.error('Failed to get timeline:', error);
      return { success: false, error: 'Failed to get timeline' };
    }
  });

  // Manually trigger cleanup
  ipcMain.handle('logs:cleanup', async () => {
    try {
      const result = logsStorage.cleanup();
      return { success: true, ...result };
    } catch (error) {
      console.error('Failed to cleanup logs:', error);
      return { success: false, error: 'Failed to cleanup logs' };
    }
  });

  // Delete all logs for a specific account
  ipcMain.handle('logs:delete-by-account', async (_, accountId: string) => {
    try {
      const result = logsStorage.deleteByAccount(accountId);
      return { success: true, ...result };
    } catch (error) {
      console.error('Failed to delete logs:', error);
      return { success: false, error: 'Failed to delete logs' };
    }
  });
};
