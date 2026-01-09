import { ElectronAPI } from '@electron-toolkit/preload';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface API {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ElectronIpcRenderer {}

declare global {
  interface Window {
    electron: ElectronAPI & {
      ipcRenderer: ElectronIpcRenderer;
    };
    api: API;
    electronAPI: API;
  }
}
