/**
 * Configuration constants for version management and provider sync
 */

export const VERSION_CHECK_URL =
  'https://elara-version.khanhromvn.workers.dev/version';

// Check version every hour by default
export const VERSION_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

// GitHub URLs for provider data
export const PROVIDER_JSON_URL =
  'https://raw.githubusercontent.com/KhanhRomVN/Elara/main/provider.json';
export const PROVIDER_GITHUB_BASE =
  'https://raw.githubusercontent.com/KhanhRomVN/Elara/main/backend/src/provider';

// Temp storage directory name
export const TEMP_STORAGE_DIR = 'temp/providers';
