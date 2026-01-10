import { ipcRenderer } from 'electron';

export interface Command {
  id: string;
  trigger: string;
  name: string;
  description: string;
  type: 'ai-completion' | 'shell';
  action: string;
}

export const commandsAPI = {
  getAll: (): Promise<Command[]> => ipcRenderer.invoke('commands:get-all'),
  add: (command: Command): Promise<boolean> => ipcRenderer.invoke('commands:add', command),
  update: (id: string, updates: Partial<Command>): Promise<boolean> =>
    ipcRenderer.invoke('commands:update', { id, updates }),
  delete: (id: string): Promise<boolean> => ipcRenderer.invoke('commands:delete', id),
  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('commands:read-file', filePath),
  writeFile: (filePath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('commands:write-file', { filePath, content }),
  prompt: (message: string): Promise<string> => ipcRenderer.invoke('commands:prompt', message),
};
