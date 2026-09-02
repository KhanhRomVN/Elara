/**
 * ------------------------------------------------------------------
 * Provider Routes
 * ------------------------------------------------------------------
 * Routes cho API quản lý provider.
 *
 * Main routes:
 * - GET /v1/providers                 : Lấy danh sách providers
 * - GET /v1/providers/:providerId/models : Lấy models của provider
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import express from 'express';

// ── Controllers ──
import {
  getProviders,
  getProviderModels,
} from '../../controllers/provider.controller';

// ─── Router ─────────────────────────────────────────────────────────────

const router = express.Router();

router.get('/', getProviders);
router.get('/:providerId/models', getProviderModels);

export default router;