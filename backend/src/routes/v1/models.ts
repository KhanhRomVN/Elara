import express from 'express';
import https from 'https';
import http from 'http';

const router = express.Router();

// Cache for models
let cachedModels: any[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Default models URL (can be changed via environment variable)
const MODELS_URL =
  process.env.MODELS_URL ||
  'https://raw.githubusercontent.com/KhanhRomVN/Elara/main/models.json';

/**
 * Fetch models from URL
 */
async function fetchModelsFromUrl(url: string): Promise<any[]> {
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
              // If response is array, use it directly
              // If response has 'data' field, use that
              const models = Array.isArray(parsed)
                ? parsed
                : parsed.data ||
                  parsed.models ||
                  Object.values(parsed).flat() ||
                  [];
              resolve(models);
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
 * Get models with caching
 */
async function getModels(): Promise<any[]> {
  const now = Date.now();

  // Return cached if still valid
  if (cachedModels && now - lastFetchTime < CACHE_TTL) {
    return cachedModels;
  }

  try {
    // Fetch from URL
    const models = await fetchModelsFromUrl(MODELS_URL);
    cachedModels = models;
    lastFetchTime = now;
    console.log(`[Models] Loaded ${models.length} models from ${MODELS_URL}`);
    return models;
  } catch (error) {
    console.error('[Models] Failed to fetch from URL:', error);
    // Return empty array if no cache and fetch fails
    if (!cachedModels) {
      return [];
    }
    // Return stale cache if available
    return cachedModels;
  }
}

// GET /v1/models - List all models
router.get('/', async (_req, res) => {
  try {
    const models = await getModels();
    res.json({
      object: 'list',
      data: models,
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
    cachedModels = null;
    lastFetchTime = 0;
    const models = await getModels();
    res.json({
      success: true,
      count: models.length,
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
