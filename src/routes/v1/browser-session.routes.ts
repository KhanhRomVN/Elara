/**
 * ------------------------------------------------------------------
 * Browser Session Routes
 * ------------------------------------------------------------------
 * Routes cho API quản lý phiên đăng nhập qua browser (CDP).
 *
 * Main routes:
 * - GET    /v1/browser-sessions                : List sessions (deprecated)
 * - GET    /v1/browser-sessions/active/:providerId : Get active session
 * - POST   /v1/browser-sessions                : Create session (deprecated)
 * - POST   /v1/browser-sessions/login          : Login via browser CDP
 * - POST   /v1/browser-sessions/profile        : Create profile
 * - POST   /v1/browser-sessions/complete/:tempSessionId : Complete session
 * - PUT    /v1/browser-sessions/:sessionId/activate : Activate session
 * - PATCH  /v1/browser-sessions/:sessionId     : Update session
 * - POST   /v1/browser-sessions/:sessionId/touch : Touch session
 * - DELETE /v1/browser-sessions/:sessionId     : Delete session
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';

// ── Controllers ──
import {
  listSessions,
  getActiveSession,
  createSession,
  loginSession,
  createProfile,
  activateSessionHandler,
  updateSession,
  deleteSession,
  touchSessionHandler,
  completeSession,
} from '../../controllers/browser-session.controller';

// ─── Router ─────────────────────────────────────────────────────────────

const router = Router();

router.get('/', listSessions);
router.get('/active/:providerId', getActiveSession);
router.post('/', createSession);
router.post('/login', loginSession);
router.post('/profile', createProfile);
router.post('/complete/:tempSessionId', completeSession);
router.put('/:sessionId/activate', activateSessionHandler);
router.patch('/:sessionId', updateSession);
router.post('/:sessionId/touch', touchSessionHandler);
router.delete('/:sessionId', deleteSession);

export default router;