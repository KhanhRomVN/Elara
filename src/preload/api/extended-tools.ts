import { ipcRenderer } from 'electron';

export const extendedToolsAPI = {
  getAll: () => ipcRenderer.invoke('extended-tools:get-all'),
  getByToolId: (toolId: string) => ipcRenderer.invoke('extended-tools:get-by-tool-id', toolId),
  upsert: (tool: any) => ipcRenderer.invoke('extended-tools:upsert', tool),
  delete: (id: string) => ipcRenderer.invoke('extended-tools:delete', id),
};
