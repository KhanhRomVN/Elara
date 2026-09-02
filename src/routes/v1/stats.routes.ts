/**
 * ------------------------------------------------------------------
 * Stats Routes
 * ------------------------------------------------------------------
 * Routes cho API thống kê usage.
 *
 * Main routes:
 * - GET  /v1/stats              : Lấy thống kê usage
 * - POST /v1/stats/metrics      : Ghi nhận metric
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';

// ── Controllers ──
import {
  getStats,
  recordMetrics,
} from '../../controllers/stats.controller';

// ─── Router ─────────────────────────────────────────────────────────────

const router = Router();

router.get('/', getStats);
router.post('/metrics', recordMetrics);

export default router;