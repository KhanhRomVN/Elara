// This file is deprecated as history functionality has been removed.
export const getApiBaseUrl = (port: number | string) => {
  return typeof port === 'string' && port.startsWith('http') ? port : `http://localhost:${port}`;
};
