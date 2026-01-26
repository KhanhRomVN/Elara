export const getApiBaseUrl = (port: number | string = 11434): string => {
  // 1. Check for configured URL (Persistent user setting)
  const configuredUrl = localStorage.getItem('ELARA_API_URL');
  if (configuredUrl && configuredUrl.trim()) {
    return configuredUrl.trim().replace(/\/+$/, '');
  }

  // 2. Default to localhost
  return `http://localhost:${port}`;
};
