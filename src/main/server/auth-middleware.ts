import { Request, Response, NextFunction } from 'express';
import { Account } from '../ipc/accounts';
import { ProxyConfig } from './config';
import { getAccountSelector } from './account-selector';

// Extend Express Request to include account
declare global {
  namespace Express {
    interface Request {
      account?: Account;
      authenticated?: boolean;
    }
  }
}

/**
 * Extract API key from request headers
 */
const extractAPIKey = (req: Request): string | null => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    // Support "Bearer <key>" format
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    // Support plain API key
    return authHeader;
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'] as string;
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  return null;
};

/**
 * Extract account ID from request
 */
const extractAccountId = (req: Request): string | null => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
};

/**
 * Detect provider from request path or model
 */
const detectProvider = (req: Request): string | undefined => {
  const path = req.path;
  const model = req.body?.model;

  // Detect from path
  if (path.includes('/gemini') || path.startsWith('/v1beta')) {
    return 'Gemini';
  }
  if (path.includes('/claude')) {
    return 'Claude';
  }
  if (path.includes('/groq')) {
    return 'Groq';
  }
  if (path.includes('/antigravity')) {
    return 'Antigravity';
  }

  // Detect from model name
  if (model) {
    if (model.includes('gemini')) return 'Gemini';
    if (model.includes('claude')) return 'Claude';
    if (model.includes('deepseek')) return 'DeepSeek';
    if (model.includes('llama') || model.includes('mixtral')) return 'Groq';
  }

  // Check X-Provider header
  const providerHeader = req.headers['x-provider'] as string;
  if (providerHeader) {
    return providerHeader;
  }

  return undefined;
};

/**
 * Create authentication middleware
 */
export const createAuthMiddleware = (config: ProxyConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const accountSelector = getAccountSelector();

    try {
      // 1. Check if API key authentication is enabled and valid
      const apiKey = extractAPIKey(req);
      if (apiKey && config.apiKeys.includes(apiKey)) {
        req.authenticated = true;
        console.log('[Auth] Authenticated with API key');

        // Still need to select an account for the request
        const provider = detectProvider(req);
        const email = req.headers['x-email'] as string;
        const account = accountSelector.selectAccount(provider, config.routing.strategy, email);

        if (account) {
          req.account = account;
          console.log(`[Auth] Selected account: ${account.email} (${account.provider_id})`);
          return next();
        }

        // No account available for this provider
        res.status(503).json({
          error: 'No active account available for this provider',
          provider,
        });
        return;
      }

      // 2. Check if this is an account-specific Bearer token
      const accountId = extractAccountId(req);
      if (accountId) {
        const account = accountSelector.getAccountById(accountId);
        if (account) {
          req.account = account;
          req.authenticated = true;
          console.log(`[Auth] Authenticated with account token: ${account.email}`);
          return next();
        }
      }

      // 3. Check for provider + email in headers
      const provider = req.headers['x-provider'] as string;
      const email = req.headers['x-email'] as string;

      if (provider && email) {
        const account = accountSelector.selectAccount(provider, 'priority', email);
        if (account) {
          req.account = account;
          console.log(`[Auth] Selected account by provider+email: ${account.email}`);
          return next();
        }
      }

      // 4. Default: Auto-detect provider and select first active account
      const detectedProvider = detectProvider(req);
      const account = accountSelector.selectAccount(detectedProvider, config.routing.strategy);

      if (account) {
        req.account = account;
        console.log(`[Auth] Auto-selected account: ${account.email} (${account.provider_id})`);
        return next();
      }

      // No account found
      res.status(401).json({
        error: 'No active account found',
        hint: 'Add an API key or configure an active account for this provider',
        provider: detectedProvider,
      });
    } catch (error) {
      console.error('[Auth] Middleware error:', error);
      res.status(500).json({ error: 'Internal authentication error' });
    }
  };
};

/**
 * Optional authentication middleware (allows requests without auth)
 */
export const createOptionalAuthMiddleware = (config: ProxyConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const middleware = createAuthMiddleware(config);

    // Call the middleware, but don't fail on 401
    await new Promise<void>((resolve) => {
      middleware(req, res, (err?: any) => {
        if (!err && !res.headersSent) {
          resolve();
        } else if (res.statusCode === 401) {
          // For optional auth, just continue without account
          req.account = undefined;
          req.authenticated = false;
          res.status(200); // Reset status
          resolve();
        }
      });
    });

    next();
  };
};
