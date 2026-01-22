import '@testing-library/jest-dom';
import { beforeAll, afterAll, vi } from 'vitest';

// Global mocks if needed
beforeAll(() => {
  // Mock electron API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).electron = {
    ipcRenderer: {
      on: vi.fn(),
      send: vi.fn(),
      invoke: vi.fn(),
      removeListener: vi.fn(),
    },
  };
});

afterAll(() => {
  vi.clearAllMocks();
});
