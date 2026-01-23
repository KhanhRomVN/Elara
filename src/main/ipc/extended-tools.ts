import { ipcMain } from 'electron';
import { extendedToolService, ExtendedTool } from '@backend/services/extended-tool.service';

export function setupExtendedToolsHandlers(): void {
  ipcMain.handle('extended-tools:get-all', () => {
    return extendedToolService.getAll();
  });

  ipcMain.handle('extended-tools:get-by-tool-id', (_, toolId: string) => {
    return extendedToolService.getByToolId(toolId);
  });

  ipcMain.handle(
    'extended-tools:upsert',
    (_, tool: Partial<ExtendedTool> & { tool_id: string }) => {
      return extendedToolService.upsert(tool);
    },
  );

  ipcMain.handle('extended-tools:delete', (_, id: string) => {
    extendedToolService.delete(id);
    return true;
  });
}
