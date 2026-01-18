import express from 'express';
import https from 'https';
import http from 'http';

const router = express.Router();

// Cache for providers
let cachedProviders: any[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Default providers URL (can be changed via environment variable)
const PROVIDERS_URL =
  process.env.PROVIDERS_URL ||
  'https://raw.githubusercontent.com/KhanhRomVN/Elara/main/provider.json';

/**
 * Fetch providers from URL
 */
async function fetchProvidersFromUrl(url: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    protocol
      .get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const parsed = JSON.parse(data);
              const providers = Array.isArray(parsed) ? parsed : [];
              resolve(providers);
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

/**
 * Get providers with caching
 */
async function getProviders(): Promise<any[]> {
  const now = Date.now();

  // Return cached if still valid
  if (cachedProviders && now - lastFetchTime < CACHE_TTL) {
    return cachedProviders;
  }

  try {
    // Fetch from URL
    const providers = await fetchProvidersFromUrl(PROVIDERS_URL);
    cachedProviders = providers;
    lastFetchTime = now;
    console.log(`[Models] Loaded ${providers.length} providers from ${PROVIDERS_URL}`);
    return providers;
  } catch (error) {
    console.error('[Models] Failed to fetch from URL:', error);
    // Return empty array if no cache and fetch fails
    if (!cachedProviders) {
      return [];
    }
    // Return stale cache if available
    return cachedProviders;
  }
}

// GET /v1/models - List all models from all providers
router.get('/', async (_req, res) => {
  try {
    const providers = await getProviders();

    // Extract all models from all providers
    const allModels: any[] = [];

    providers.forEach((provider) => {
      if (provider.models && Array.isArray(provider.models)) {
        provider.models.forEach((model: any) => {
          allModels.push({
            ...model,
            provider_id: provider.provider_id,
            provider_name: provider.provider_name,
          });
        });
      }
    });

    res.json({
      object: 'list',
      data: allModels,
    });
  } catch (error: any) {
    console.error('[Models] Error:', error);
    res.status(500).json({
      error: {
        message: error.message || 'Failed to load models',
        type: 'internal_error',
      },
    });
  }
});

// POST /v1/models/refresh - Force refresh cache
router.post('/refresh', async (_req, res) => {
  try {
    cachedProviders = null;
    lastFetchTime = 0;
    const providers = await getProviders();

    // Count total models
    let totalModels = 0;
    providers.forEach((provider) => {
      if (provider.models && Array.isArray(provider.models)) {
        totalModels += provider.models.length;
      }
    });

    res.json({
      success: true,
      count: totalModels,
      message: 'Models cache refreshed',
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        message: error.message || 'Failed to refresh models',
        type: 'internal_error',
      },
    });
  }
});

export default router;
