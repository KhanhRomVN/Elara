import express, { Request, Response } from 'express';
import { getDb } from '@backend/services/db';
import https from 'https';
import http from 'http';

const router = express.Router();

// Cache for provider data
let cachedProviders: any[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
    const providers = await fetchProvidersFromUrl(PROVIDERS_URL);
    cachedProviders = providers;
    lastFetchTime = now;
    console.log(`[Providers] Loaded ${providers.length} providers from ${PROVIDERS_URL}`);
    return providers;
  } catch (error) {
    console.error('[Providers] Failed to fetch from URL:', error);
    // Return stale cache if available
    if (cachedProviders) {
      return cachedProviders;
    }
    return [];
  }
}

/**
 * GET /v1/providers/:providerId/models
 * Unified endpoint to get models for any provider
 */
router.get('/:providerId/models', async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const normalizedProviderId = providerId.toLowerCase();

    // Fetch provider data
    const providers = await getProviders();
    const provider = providers.find((p) => p.provider_id.toLowerCase() === normalizedProviderId);

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: `Unknown provider: ${providerId}`,
      });
    }

    // Check if provider has static models
    if (provider.models && Array.isArray(provider.models)) {
      return res.json({
        success: true,
        data: provider.models,
        source: 'static',
      });
    }

    // For dynamic providers, we need to fetch from their API
    // First, find any account for this provider
    const db = getDb();
    const account = db
      .prepare('SELECT * FROM accounts WHERE LOWER(provider_id) = ? LIMIT 1')
      .get(normalizedProviderId) as any;

    if (!account) {
      return res.status(404).json({
        success: false,
        error: `No account found for provider: ${providerId}. Please add an account first.`,
      });
    }

    // Proxy to provider-specific endpoint
    // Map provider to their specific model endpoint
    const providerEndpointMap: Record<string, string> = {
      groq: '/v1/groq/models',
      antigravity: '/v1/antigravity/models',
      gemini: '/v1/gemini/models',
      'hugging-chat': '/v1/huggingchat/models',
      huggingchat: '/v1/huggingchat/models',
      lmarena: '/v1/lmarena/models',
      stepfun: '/v1/stepfun/models',
    };

    const providerEndpoint = providerEndpointMap[normalizedProviderId];

    if (!providerEndpoint) {
      return res.status(501).json({
        success: false,
        error: `Provider ${providerId} does not support dynamic model fetching`,
      });
    }

    // Make internal request to provider endpoint
    const port = process.env.PORT || 11434;
    const url = `http://localhost:${port}${providerEndpoint}?email=${encodeURIComponent(account.email)}`;

    const response = await fetch(url);
    const data = await response.json();

    return res.json({
      success: true,
      data: data.data || data,
      source: 'dynamic',
    });
  } catch (error: any) {
    console.error('[Providers API] Error fetching models:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /v1/providers
 * Get all providers from source
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const providers = await getProviders();
    return res.json({
      success: true,
      data: providers,
    });
  } catch (error: any) {
    console.error('[Providers API] Error fetching providers:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch providers',
    });
  }
});

export default router;
