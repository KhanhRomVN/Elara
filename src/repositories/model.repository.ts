/**
 * ------------------------------------------------------------------
 * Model Repository
 * ------------------------------------------------------------------
 * Repository layer cho bảng models. Quản lý thông tin model
 * của các provider.
 *
 * Main functions:
 * - findAllModels()          : Lấy tất cả models
 * - findModelsByProvider()   : Lấy models theo provider
 * - upsertModel()            : Thêm mới hoặc cập nhật model
 * - updateModelSuccessRate() : Cập nhật success rate
 * - deleteModelsByProvider() : Xóa models theo provider
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Database ──
import { getDb } from '../database';

// ─── Types ──────────────────────────────────────────────────────────────

export interface ModelRow {
  id?: number;
  provider_id: string;
  model_id: string;
  model_name: string;
  is_thinking: number;
  max_context_length?: number | null;
  is_image_upload?: number;
  is_video_upload?: number;
  updated_at: number;
  success_rate?: number | null;
  description?: string | null;
}

// ─── Queries ────────────────────────────────────────────────────────────

export const findAllModels = (): ModelRow[] => {
  const db = getDb();
  return db.prepare('SELECT * FROM models').all() as ModelRow[];
};

export const findModelsByProvider = (providerId: string): ModelRow[] => {
  const db = getDb();
  return db
    .prepare('SELECT * FROM models WHERE provider_id = ?')
    .all(providerId) as ModelRow[];
};

// ─── Upserts ────────────────────────────────────────────────────────────

export const upsertModel = (
  providerId: string,
  modelId: string,
  modelName: string,
  isThinking: boolean,
  maxContextLength: number | null,
  updatedAt: number,
  isImageUpload?: boolean,
  isVideoUpload?: boolean,
  description?: string | null,
): void => {
  const db = getDb();
  db.prepare(
    `INSERT INTO models (
       provider_id, model_id, model_name, is_thinking,
       max_context_length, is_image_upload, is_video_upload, updated_at, description
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider_id, model_id) DO UPDATE SET
       model_name = excluded.model_name,
       is_thinking = excluded.is_thinking,
       max_context_length = excluded.max_context_length,
       is_image_upload = excluded.is_image_upload,
       is_video_upload = excluded.is_video_upload,
       updated_at = excluded.updated_at,
       description = excluded.description`,
  ).run(
    providerId,
    modelId,
    modelName,
    isThinking ? 1 : 0,
    maxContextLength ?? null,
    isImageUpload ? 1 : 0,
    isVideoUpload ? 1 : 0,
    updatedAt,
    description ?? null,
  );
};

// ─── Updates ────────────────────────────────────────────────────────────

export const updateModelSuccessRate = (
  providerId: string,
  modelId: string,
  successRate: number | null,
): void => {
  const db = getDb();
  db.prepare(
    `UPDATE models SET success_rate = ? WHERE provider_id = ? AND model_id = ?`,
  ).run(successRate, providerId, modelId);
};

// ─── Deletes ──���─────────────────────────────────────────────────────────

export const deleteModelsByProvider = (providerId: string): void => {
  const db = getDb();
  db.prepare('DELETE FROM models WHERE provider_id = ?').run(providerId);
};