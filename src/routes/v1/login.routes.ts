/**
 * ------------------------------------------------------------------
 * Login Routes
 * ------------------------------------------------------------------
 * Routes cho API đăng nhập qua browser.
 *
 * Route chính:
 * - POST   /v1/accounts/login/:provider : Đăng nhập qua browser
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';

// ── Controllers ──
import { login } from '../../controllers/login.controller';

// ─── Router ─────────────────────────────────────────────────────────────

const router = Router();

router.post('/:provider', login);

export default router;
