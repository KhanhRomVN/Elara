export const getApiBaseUrl = (port: number | string = 11434): string => {
  const configuredUrl = localStorage.getItem('ELARA_API_URL');
  if (configuredUrl && configuredUrl.trim()) {
    return configuredUrl.trim().replace(/\/+$/, '');
  }
  return `http://localhost:${port}`;
};
