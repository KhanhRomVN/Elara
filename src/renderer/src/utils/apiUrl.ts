export const getApiBaseUrl = (
  port: number | string = import.meta.env.VITE_BACKEND_PORT || 8888,
): string => {
  // 1. Check for configured URL (Persistent user setting)
  const configuredUrl = localStorage.getItem('ELARA_API_URL');
  if (configuredUrl && configuredUrl.trim()) {
    return configuredUrl.trim().replace(/\/+$/, '');
  }

  // 2. Default to localhost
  return `http://localhost:${port}`;
};
