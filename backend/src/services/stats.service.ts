import { getDb } from './db';
import { createLogger } from '../utils/logger';

const logger = createLogger('StatsService');

interface DateComponents {
  year: number;
  month: number;
  week: number;
  day: number;
}

function getCurrentGMTComponents(): DateComponents {
  const now = new Date();
  // Get time in GMT
  const gmtNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000);

  return {
    year: gmtNow.getUTCFullYear(),
    month: gmtNow.getUTCMonth() + 1, // 1-12
    // Simple week calculation: days since epoch / 7
    week: Math.floor(gmtNow.getTime() / (1000 * 60 * 60 * 24 * 7)),
    day: Math.floor(gmtNow.getTime() / (1000 * 60 * 60 * 24)),
  };
}

function isStatsEnabled(): boolean {
  const db = getDb();
  try {
    const row = db
      .prepare("SELECT value FROM config WHERE key = 'enable_stats_collection'")
      .get() as any;
    return row?.value === 'true';
  } catch (error) {
    return true; // Default to true if not found or table doesn't exist
  }
}

export async function recordRequest(
  accountId: string,
  providerId: string,
  modelId: string,
  conversationId?: string,
) {
  if (!isStatsEnabled()) {
    console.log('[Stats] Stats collection disabled');
    return;
  }
  console.log('[Stats] Recording request for', accountId, providerId, modelId);
  const db = getDb();
  const now = Date.now();

  try {
    // 1. Update Account Stats
    db.prepare(
      `
      UPDATE accounts SET
        total_requests = total_requests + 1
      WHERE id = ?
    `,
    ).run(accountId);

    // 2. Upsert Provider Model Stats
    db.prepare(
      `
      INSERT INTO provider_models (
        provider_id, model_id, model_name, updated_at, total_requests, successful_requests, max_req_conversation, max_token_conversation
      ) VALUES (?, ?, ?, ?, 1, 0, 0, 0)
      ON CONFLICT(provider_id, model_id) DO UPDATE SET
        total_requests = total_requests + 1,
        updated_at = excluded.updated_at
    `,
    ).run(providerId, modelId, modelId, now);

    // 3. Track Conversation Stats (Max Request Check)
    if (conversationId) {
      // Upsert conversation stats
      db.prepare(
        `
         INSERT INTO conversation_stats (conversation_id, total_requests, total_tokens, updated_at)
         VALUES (?, 1, 0, ?)
         ON CONFLICT(conversation_id) DO UPDATE SET
           total_requests = total_requests + 1,
           updated_at = excluded.updated_at
       `,
      ).run(conversationId, now);

      // Get current total requests for this conversation
      const convStats = db
        .prepare(
          'SELECT total_requests FROM conversation_stats WHERE conversation_id = ?',
        )
        .get(conversationId) as any;

      if (convStats) {
        // Update max_req_conversation for provider_models if current is higher
        db.prepare(
          `
           UPDATE provider_models SET
             max_req_conversation = MAX(max_req_conversation, ?)
           WHERE provider_id = ? AND model_id = ?
         `,
        ).run(convStats.total_requests, providerId, modelId);
      }
    }
  } catch (error) {
    logger.error('Error updating request stats:', error);
  }
}

// Helper to record conversation stats (isolated for late-binding ID)
export function recordConversationRequest(
  conversationId: string,
  providerId: string,
  modelId: string,
) {
  if (!isStatsEnabled() || !conversationId) return;
  const db = getDb();
  const now = Date.now();

  try {
    // Upsert conversation stats
    db.prepare(
      `
       INSERT INTO conversation_stats (conversation_id, total_requests, total_tokens, updated_at)
       VALUES (?, 1, 0, ?)
       ON CONFLICT(conversation_id) DO UPDATE SET
         total_requests = total_requests + 1,
         updated_at = excluded.updated_at
     `,
    ).run(conversationId, now);

    // Get current total requests for this conversation
    const convStats = db
      .prepare(
        'SELECT total_requests FROM conversation_stats WHERE conversation_id = ?',
      )
      .get(conversationId) as any;

    if (convStats) {
      // Update max_req_conversation for provider_models if current is higher
      db.prepare(
        `
         UPDATE provider_models SET
           max_req_conversation = MAX(max_req_conversation, ?)
         WHERE provider_id = ? AND model_id = ?
       `,
      ).run(convStats.total_requests, providerId, modelId);
    }
  } catch (error) {
    logger.error('Error updating conversation request stats:', error);
  }
}

export async function recordSuccess(
  accountId: string,
  providerId: string,
  modelId: string,
  tokens: number,
  conversationId?: string,
) {
  if (!isStatsEnabled()) return;
  console.log('[Stats] Recording success for', accountId, tokens);
  const db = getDb();
  const now = Date.now();

  try {
    // 1. Update Account Success Stats
    db.prepare(
      `
      UPDATE accounts SET
        successful_requests = successful_requests + 1
      WHERE id = ?
    `,
    ).run(accountId);

    // 2. Upsert Provider Models Success Stats
    db.prepare(
      `
      INSERT INTO provider_models (
        provider_id, model_id, model_name, updated_at, total_requests, successful_requests, max_req_conversation, max_token_conversation
      ) VALUES (?, ?, ?, ?, 0, 1, 0, 0)
      ON CONFLICT(provider_id, model_id) DO UPDATE SET
        successful_requests = successful_requests + 1,
        updated_at = excluded.updated_at
    `,
    ).run(providerId, modelId, modelId, now);

    // 3. Track Conversation Stats (Max Token Check)
    if (conversationId) {
      // Upsert conversation stats
      db.prepare(
        `
         INSERT INTO conversation_stats (conversation_id, total_requests, total_tokens, updated_at)
         VALUES (?, 0, ?, ?)
         ON CONFLICT(conversation_id) DO UPDATE SET
           total_tokens = total_tokens + ?,
           updated_at = excluded.updated_at
       `,
      ).run(conversationId, tokens, now, tokens);

      // Get current total tokens for this conversation
      const convStats = db
        .prepare(
          'SELECT total_tokens FROM conversation_stats WHERE conversation_id = ?',
        )
        .get(conversationId) as any;

      if (convStats) {
        // Update max_token_conversation for provider_models if current is higher
        db.prepare(
          `
           UPDATE provider_models SET
             max_token_conversation = MAX(max_token_conversation, ?)
           WHERE provider_id = ? AND model_id = ?
         `,
        ).run(convStats.total_tokens, providerId, modelId);
      }
    }
  } catch (error) {
    logger.error('Error updating success stats:', error);
  }
}

export function getAllAccountStats() {
  const db = getDb();
  return db.prepare('SELECT * FROM accounts').all();
}

export function getAllProviderModelStats() {
  const db = getDb();
  return db.prepare('SELECT * FROM provider_models').all();
}
