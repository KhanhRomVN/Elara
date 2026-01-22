import { ipcMain, dialog } from 'electron';

export const setupDialogHandlers = () => {
  ipcMain.handle('dialog:open-directory', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory'],
      });
      if (canceled) {
        return { canceled: true, filePaths: [] };
      }
      return { canceled: false, filePaths };
    } catch (error: any) {
      console.error('[Dialog] Failed to open directory:', error);
      return { canceled: true, error: error.message };
    }
  });
};
