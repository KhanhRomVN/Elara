import { getDb } from './db';
import { providerRegistry } from '../provider/registry';
import { createLogger } from '../utils/logger';

const logger = createLogger('ModelsSyncService');

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// List of providers that have dynamic models (fetched from API)
const DYNAMIC_PROVIDERS = [
  'cohere',
  'huggingchat',
  'antigravity',
  'cerebras',
  'gemini',
  'qwen',
];

/**
 * Calculate milliseconds until next sync time at midnight GMT
 */
export const getMsUntilNextGmtMidnight = (): number => {
  const now = new Date();
  const nextMidnight = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
  return nextMidnight.getTime() - now.getTime();
};

/**
 * Schedule the next sync at GMT midnight
 */
export const scheduleNextGmtSync = (callback: () => Promise<void>): void => {
  const msUntilMidnight = getMsUntilNextGmtMidnight();
  const hoursUntil = (msUntilMidnight / (1000 * 60 * 60)).toFixed(2);

  setTimeout(async () => {
    try {
      await callback();
    } catch (error) {
      logger.error('Scheduled GMT sync failed:', error);
    }
    // Schedule the next one after this completes
    scheduleNextGmtSync(callback);
  }, msUntilMidnight);
};

export interface CachedModel {
  id: string;
  name: string;
  is_thinking: boolean;
  context_length: number | null;
}

export const getCachedModels = (providerId: string): CachedModel[] => {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT model_id, model_name, is_thinking, context_length FROM provider_models WHERE provider_id = ?',
    )
    .all(providerId) as any[];

  return rows.map((r) => ({
    id: r.model_id,
    name: r.model_name,
    is_thinking: r.is_thinking === 1,
    context_length: r.context_length,
  }));
};

export const saveCachedModels = (
  providerId: string,
  models: CachedModel[],
  isDynamic: boolean = false,
): void => {
  const db = getDb();
  const now = Date.now();

  // Clear existing models for this provider
  db.prepare('DELETE FROM provider_models WHERE provider_id = ?').run(
    providerId,
  );

  // Insert new models
  const insertStmt = db.prepare(`
    INSERT INTO provider_models (provider_id, model_id, model_name, is_thinking, context_length, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const model of models) {
    insertStmt.run(
      providerId,
      model.id,
      model.name,
      model.is_thinking ? 1 : 0,
      model.context_length,
      now,
    );
  }

  // Update sync time
  db.prepare(
    `
    INSERT INTO provider_models_sync (provider_id, last_sync_at, is_dynamic)
    VALUES (?, ?, ?)
    ON CONFLICT(provider_id) DO UPDATE SET last_sync_at = ?, is_dynamic = ?
  `,
  ).run(providerId, now, isDynamic ? 1 : 0, now, isDynamic ? 1 : 0);
};

export const shouldSyncProvider = (providerId: string): boolean => {
  const db = getDb();
  const row = db
    .prepare(
      'SELECT last_sync_at, is_dynamic FROM provider_models_sync WHERE provider_id = ?',
    )
    .get(providerId) as any;

  if (!row) return true;

  if (!row.is_dynamic) return false;

  if (providerId.toLowerCase() === 'qwen') return true;

  const elapsed = Date.now() - row.last_sync_at;
  return elapsed > SYNC_INTERVAL_MS;
};

export const syncProviderModels = async (
  providerId: string,
): Promise<CachedModel[]> => {
  const dynamicProvider = providerRegistry.getProvider(providerId);
  if (!dynamicProvider || !dynamicProvider.getModels) {
    return [];
  }

  const db = getDb();
  const account = db
    .prepare('SELECT * FROM accounts WHERE LOWER(provider_id) = ? LIMIT 1')
    .get(providerId.toLowerCase()) as any;

  if (!account) {
    return [];
  }

  try {
    const models = await dynamicProvider.getModels(
      account.credential,
      account.id,
    );
    const cachedModels: CachedModel[] = models.map((m: any) => ({
      id: m.id,
      name: m.name,
      is_thinking: m.is_thinking || false,
      context_length: m.context_length !== undefined ? m.context_length : null,
    }));

    saveCachedModels(providerId, cachedModels, true);
    return cachedModels;
  } catch (error) {
    logger.error(`Failed to sync models for ${providerId}:`, error);
    return getCachedModels(providerId);
  }
};

export const syncAllDynamicProviders = async (): Promise<void> => {
  for (const providerId of DYNAMIC_PROVIDERS) {
    if (shouldSyncProvider(providerId)) {
      try {
        await syncProviderModels(providerId);
      } catch (error) {
        logger.error(`Failed to sync ${providerId}:`, error);
      }
    } else {
      logger.debug(`Provider ${providerId} does not need sync yet`);
    }
  }
};

export const getModelsForProvider = async (
  providerId: string,
): Promise<CachedModel[]> => {
  // Check if we need to sync
  if (
    DYNAMIC_PROVIDERS.includes(providerId.toLowerCase()) &&
    shouldSyncProvider(providerId)
  ) {
    return await syncProviderModels(providerId);
  }

  // Return cached models
  const cached = getCachedModels(providerId);
  if (cached.length > 0) {
    return cached;
  }

  // If no cache and is dynamic, try to sync
  if (DYNAMIC_PROVIDERS.includes(providerId.toLowerCase())) {
    return await syncProviderModels(providerId);
  }

  return [];
};

export const isDynamicProvider = (providerId: string): boolean => {
  return DYNAMIC_PROVIDERS.includes(providerId.toLowerCase());
};

export const getDynamicProvidersList = (): string[] => {
  return [...DYNAMIC_PROVIDERS];
};
