/**
 * ------------------------------------------------------------------
 * Chat Routes
 * ------------------------------------------------------------------
 * Routes cho API gửi tin nhắn chat.
 *
 * Main routes:
 * - POST /v1/accounts/messages              : Gửi tin nhắn (accountId trong body)
 * - POST /v1/accounts/:accountId/messages   : Gửi tin nhắn (accountId trong params)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import express from 'express';

// ── Controllers ──
import { sendMessage } from '../../controllers/chat.controller';

// ─── Router ─────────────────────────────────────────────────────────────

const router = express.Router();

router.post('/accounts/messages', sendMessage);
router.post('/accounts/:accountId/messages', sendMessage);

export default router;
