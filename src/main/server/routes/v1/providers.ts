import express, { Request, Response } from 'express';
import { getDb } from '@backend/services/db';
import { getProviders, getProviderById, Provider } from '../../provider-registry';

const router = express.Router();

// Helper to find account by provider ID (case insensitive)
const findAccount = (req: Request, providerId: string) => {
  const db = getDb();
  // Check for email query param first
  const email = req.query.email as string;
  const normalizedId = providerId.toLowerCase();

  let query = 'SELECT * FROM accounts WHERE LOWER(provider_id) = ?';
  const params: any[] = [normalizedId];

  if (email) {
    query += ' AND email = ?';
    params.push(email);
  } else {
    // If no email, prefer Active status or just first one
  }
  query += ' LIMIT 1';

  return db.prepare(query).get(...params) as any;
};

// Dynamic Provider Module Loader (Reused from accounts.ts logic)
// Use Vite's import.meta.glob to bundle all provider modules
// @ts-ignore
const providerModules = import.meta.glob('../../provider/*/index.ts', { eager: true });
console.log(
  '[ProviderRegistry] Loaded embedded provider modules keys:',
  Object.keys(providerModules),
);

const providerModuleCache: Map<string, any> = new Map();

// List of providers that have dynamic models
const DYNAMIC_PROVIDERS = ['cohere', 'huggingchat', 'antigravity', 'cerebras', 'gemini'];

async function loadProviderModule(providerId: string): Promise<any | null> {
  const normalizedId = providerId.toLowerCase();
  if (providerModuleCache.has(normalizedId)) return providerModuleCache.get(normalizedId);

  const possibleNames = [
    normalizedId,
    normalizedId.replace('-', ''),
    normalizedId.replace('huggingchat', 'hugging-chat'),
  ];

  for (const name of possibleNames) {
    const match = Object.keys(providerModules).find((key) =>
      key.includes(`/provider/${name}/index.ts`),
    );

    if (match) {
      const module: any = providerModules[match];
      // Get the default export which is the provider instance
      const provider = module.default || module;
      providerModuleCache.set(normalizedId, provider);
      return provider;
    }
  }

  console.error(
    `[Providers Router] No module found for ${providerId}. Available keys:`,
    Object.keys(providerModules),
  );
  return null;
}

/**
 * Fetch dynamic models for a provider from its module
 */
async function fetchDynamicModels(providerId: string): Promise<any[] | null> {
  const normalizedId = providerId.toLowerCase();

  // Check if this is a dynamic provider
  if (!DYNAMIC_PROVIDERS.includes(normalizedId)) {
    return null;
  }

  try {
    const module = await loadProviderModule(providerId);
    if (!module || !module.getModels) {
      return null;
    }

    const db = getDb();
    const account = db
      .prepare('SELECT * FROM accounts WHERE LOWER(provider_id) = ? LIMIT 1')
      .get(normalizedId) as any;

    if (!account) {
      console.warn(`[Providers Router] No account found for ${providerId}, cannot fetch models`);
      return null;
    }

    const models = await module.getModels(account.credential, account.id);

    if (!Array.isArray(models)) {
      console.error(
        `[Providers Router] getModels for ${providerId} returned non-array:`,
        typeof models,
      );
      return null;
    }

    return models.map((m: any) => ({
      id: m.id,
      name: m.name,
      is_thinking: m.is_thinking || false,
      context_length: m.context_length !== undefined ? m.context_length : null,
    }));
  } catch (error) {
    console.error(`[Providers Router] Failed to fetch dynamic models for ${providerId}:`, error);
    return null;
  }
}

/**
 * GET /v1/providers
 * Get all providers with enriched data (total_accounts, models)
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const providers = await getProviders();
    const db = getDb();

    // Get account counts from DB
    const dbProviders = db.prepare('SELECT id, total_accounts FROM providers').all() as {
      id: string;
      total_accounts: number;
    }[];

    const countsMap = new Map(dbProviders.map((p) => [p.id.toLowerCase(), p.total_accounts]));

    // Enrich providers with total_accounts and dynamic models
    const enrichedProviders = await Promise.all(
      providers.map(async (p) => {
        let models = p.models;

        // If no static models, try to fetch dynamic models
        if (!models || !Array.isArray(models) || models.length === 0) {
          const dynamicModels = await fetchDynamicModels(p.provider_id);
          if (dynamicModels && dynamicModels.length > 0) {
            models = dynamicModels;
          }
        }

        return {
          ...p,
          total_accounts: countsMap.get(p.provider_id.toLowerCase()) || 0,
          models: models || undefined,
        };
      }),
    );

    return res.json({
      success: true,
      message: 'Providers retrieved successfully',
      data: enrichedProviders,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch providers',
      error: { code: 'INTERNAL_ERROR', details: error.message },
      meta: { timestamp: new Date().toISOString() },
    });
  }
});

/**
 * GET /v1/providers/:providerId
 * Get single provider info
 */
router.get('/:providerId', async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const provider = await getProviderById(providerId);
    if (!provider) {
      return res.status(404).json({ success: false, error: `Unknown provider: ${providerId}` });
    }
    return res.json({
      success: true,
      data: { ...provider, id: provider.provider_id, name: provider.provider_name },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.all(/^\/([^/]+)(?:\/(.*))?$/, async (req: Request, res: Response) => {
  try {
    const providerId = (req.params as any)[0];
    const fullPath = (req.params as any)[1] || '';

    // Parse action and subPath manually
    const parts = fullPath.split('/');
    const action = parts[0];
    const subPath = parts.length > 1 ? '/' + parts.slice(1).join('/') : '';

    // Load Provider Module
    const module = await loadProviderModule(providerId);
    if (!module) {
      console.error(`[Providers Router] Module load failed for: ${providerId}`);
      return res.status(404).json({ error: `Provider module not found: ${providerId}` });
    }

    // Get Account
    const account = findAccount(req, providerId);
    if (!account) {
      return res.status(401).json({ error: `No valid account found for ${providerId}` });
    }

    // MAP ACTIONS TO FUNCTIONS

    // 1. Models (GET /models)
    if (action === 'models' && req.method === 'GET') {
      const providerInfo = await getProviderById(providerId);
      if (providerInfo?.models && Array.isArray(providerInfo.models)) {
        return res.json({ success: true, data: providerInfo.models, source: 'static' });
      }

      if (module.getModels) {
        let result;
        if (providerId.toLowerCase() === 'lmarena') {
          result = await module.getModels(account);
        } else {
          // Default assume credential/cookies
          result = await module.getModels(account.credential);
        }
        return res.json({ success: true, data: result, source: 'dynamic' });
      }
      return res.status(404).json({ error: 'Models not supported' });
    }

    // 2. Chat Sessions / Conversations (GET /sessions or /conversations)
    if ((action === 'sessions' || action === 'conversations') && req.method === 'GET') {
      if (!subPath || subPath === '/') {
        // List
        const page = parseInt(req.query.page as string) || 0;
        const pinned = req.query.pinned === 'true';
        const limit = parseInt(req.query.limit as string) || 30; // for Claude

        let result;
        if (module.getChatSessions) {
          result = await module.getChatSessions(account.credential, account.userAgent, pinned);
        } else if (module.getConversations) {
          if (providerId.toLowerCase() === 'lmarena') {
            result = await module.getConversations(account);
          } else if (module.getConversations.length === 3) {
            // Check signature? Or just pass extra args.
            // Claude: (credential, userAgent, limit)
            result = await module.getConversations(account.credential, account.userAgent, limit);
          } else {
            // HuggingChat: (cookies, page)
            result = await module.getConversations(account.credential, page);
          }
        } else {
          return res.status(501).json({ error: 'Not implemented' });
        }
        return res.json(result);
      }

      // Detail: /conversations/:id
      const id = subPath.replace('/', '');

      // Special case: /conversations/:id/messages
      if (id.endsWith('/messages')) {
        const realId = id.replace('/messages', '');
        if (module.getChatHistory) {
          const result = await module.getChatHistory(account.credential, realId, account.userAgent);
          return res.json(result);
        }
      }

      // Detail Lookup Priority
      if (module.getConversation) {
        const result = await module.getConversation(account.credential, id);
        return res.json(result);
      } else if (module.getConversationDetail) {
        // LMArena: (id, account)
        // Claude: (credential, id, userAgent)
        if (providerId.toLowerCase() === 'lmarena') {
          const result = await module.getConversationDetail(id, account);
          return res.json(result);
        } else {
          const result = await module.getConversationDetail(
            account.credential,
            id,
            account.userAgent,
          );
          return res.json(result);
        }
      } else if (module.getChatHistory) {
        const result = await module.getChatHistory(account.credential, id, account.userAgent);
        return res.json(result);
      }

      return res.status(404).json({ error: 'Conversation detail not supported' });
    }

    // 3. Files (POST /files)
    if (action === 'files' && req.method === 'POST') {
      if (module.uploadFile) {
        const { file, fileName } = req.body;
        const result = await module.uploadFile(
          account.credential,
          file,
          fileName,
          account.userAgent,
        );
        return res.json({ id: result });
      }
      return res.status(501).json({ error: 'Upload not supported' });
    }

    // 4. Summarize (POST /conversations/:id/summarize)
    if ((action === 'sessions' || action === 'conversations') && req.method === 'POST') {
      // subPath: /:id/summarize
      if (subPath.endsWith('/summarize')) {
        const id = subPath.split('/')[1];
        if (module.summarizeConversation) {
          const title = await module.summarizeConversation(account.credential, id);
          return res.json({ title });
        }
      }
    }

    // 5. Stop Stream (POST /sessions/:id/stop)
    if ((action === 'sessions' || action === 'conversations') && req.method === 'POST') {
      if (subPath.endsWith('/stop')) {
        const id = subPath.split('/')[1];
        const { messageId } = req.body;

        if (module.stopStream) {
          await module.stopStream(account.credential, id, messageId, account.userAgent);
          return res.json({ success: true });
        } else if (module.stopResponse) {
          await module.stopResponse(account.credential, id, account.userAgent);
          return res.json({ success: true });
        }
      }
    }

    // 6. Delete Conversation (DELETE /conversations/:id)
    if ((action === 'sessions' || action === 'conversations') && req.method === 'DELETE') {
      const id = subPath.replace('/', '');
      if (module.deleteConversation) {
        await module.deleteConversation(account.credential, id, account.userAgent);
        return res.json({ success: true });
      }
    }

    // 7. Chat Completions
    if (action === 'chat' && subPath === '/completions' && req.method === 'POST') {
      if (module.chatCompletionStream) {
        if (providerId.toLowerCase() === 'lmarena') {
          return module.chatCompletionStream(req, res, account);
        }
      }
    }

    return res.status(404).json({ error: 'Unknown action' });
  } catch (error: any) {
    console.error(`[Providers API] Error handling ${req.method} ${req.url}:`, error);
    return res.status(500).json({ error: error.message || 'Internal logic error' });
  }
});

export default router;
