import { ipcMain } from 'electron';

export function setupExtendedToolsHandlers(): void {
  // Extended tools are now handled via localStorage and system shell env directly.
  // Database storage has been removed as per user request.
}
