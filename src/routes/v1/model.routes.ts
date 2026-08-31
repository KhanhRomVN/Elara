/**
 * ------------------------------------------------------------------
 * Model Routes
 * ------------------------------------------------------------------
 * Routes cho API lấy danh sách models.
 *
 * Main routes:
 * - GET /v1/models : Lấy tất cả models từ các provider đã bật
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';

// ── Controllers ──
import { getAllModels } from '../../controllers/models.controller';

// ─── Router ─────────────────────────────────────────────────────────────

const router = Router();

router.get('/', getAllModels);

export default router;