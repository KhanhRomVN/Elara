import express from 'express';

const router = express.Router();

// Backend API URL
const getBackendApiUrl = () => {
  try {
    const { getProxyConfig } = require('../../config');
    const config = getProxyConfig();
    return `http://localhost:${config.port}`;
  } catch (e) {
    return process.env.BACKEND_API_URL || 'http://localhost:11434';
  }
};

// Cache for providers
let cachedProviders: any[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch providers from backend API
 */
async function fetchProvidersFromApi(): Promise<any[]> {
  try {
    const baseUrl = getBackendApiUrl();
    const response = await fetch(`${baseUrl}/v1/providers`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = await response.json();
    const providers = json.data || [];
    return Array.isArray(providers) ? providers : [];
  } catch (error) {
    console.error('[Models] Failed to fetch from backend API:', error);
    throw error;
  }
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
    // Fetch from backend API
    const providers = await fetchProvidersFromApi();
    cachedProviders = providers;
    lastFetchTime = now;
    console.log(`[Models] Loaded ${providers.length} providers from backend API`);
    return providers;
  } catch (error) {
    console.error('[Models] Failed to fetch from backend API:', error);
    // Return empty array if no cache and fetch fails
    if (!cachedProviders) {
      return [];
    }
    // Return stale cache if available
    return cachedProviders;
  }
}

// GET /v1/models/all - List all models from enabled providers only
router.get('/all', async (_req, res) => {
  try {
    const providers = await getProviders();

    // Filter enabled providers and extract their models
    const enabledProviders = providers.filter((p) => p.is_enabled === true);
    const allModels: any[] = [];

    enabledProviders.forEach((provider) => {
      if (provider.models && Array.isArray(provider.models)) {
        provider.models.forEach((model: any) => {
          allModels.push({
            id: model.id,
            name: model.name,
            provider_id: provider.provider_id,
            provider_name: provider.provider_name,
            is_thinking: model.is_thinking || false,
          });
        });
      }
    });

    res.json({
      success: true,
      message: 'Models retrieved successfully',
      data: allModels,
      meta: {
        timestamp: new Date().toISOString(),
        total: allModels.length,
      },
    });
  } catch (error: any) {
    console.error('[Models] Error fetching all models:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch models',
      error: { code: 'INTERNAL_ERROR', details: error.message },
      meta: { timestamp: new Date().toISOString() },
    });
  }
});

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
