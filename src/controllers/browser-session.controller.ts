/**
 * ------------------------------------------------------------------
 * Browser Session Controller
 * ------------------------------------------------------------------
 * Xử lý các request liên quan đến phiên đăng nhập qua browser (CDP).
 * Hỗ trợ đăng nhập qua browser và hoàn tất phiên khi cần nhập email.
 *
 * Main functions:
 * - loginSession()      : Tạo phiên đăng nhập qua browser CDP
 * - completeSession()   : Hoàn tất phiên đăng nhập với email
 * - listSessions()      : [Deprecated] Trả về 410
 * - createSession()     : [Deprecated] Trả về 410
 * - deleteSession()     : [Deprecated] Trả về 410
 * - touchSessionHandler(): [Deprecated] Trả về 410
 * - getActiveSession()  : [Deprecated] Trả về 410
 * - createProfile()     : [Deprecated] Trả về 410
 * - activateSessionHandler(): [Deprecated] Trả về 410
 * - updateSession()     : [Deprecated] Trả về 410
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response } from 'express';

// ── Services ──
import {
  loginViaCDP,
  completePendingSession,
} from '../services/browser-session.service';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('BrowserSessionController');

// ─── Controller ─────────────────────────────────────────────────────────

// POST /v1/browser-sessions/login
export const loginSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider_id, login_url, profile_name } = req.body;

    if (!provider_id) {
      res.status(400).json({
        success: false,
        message: 'Missing provider_id',
      });
      return;
    }

    const defaultLoginUrls: Record<string, string> = {
      'zai-browser': 'https://chat.z.ai/',
    };
    const loginUrl = login_url || defaultLoginUrls[provider_id];

    if (!loginUrl) {
      res.status(400).json({
        success: false,
        message: `Missing login_url for provider ${provider_id}`,
      });
      return;
    }

    const result = await loginViaCDP(provider_id, loginUrl, profile_name);
    
    // If pending, return pending info (client will show email drawer)
    if (result.pending) {
      res.status(200).json({
        success: true,
        pending: true,
        tempSessionId: result.tempSessionId,
        message: 'Browser session pending, email required',
      });
      return;
    }
    
    res.status(201).json({
      success: true,
      message: 'Browser session created',
      data: result,
    });
  } catch (error: any) {
    logger.error('Error during CDP login', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to login via browser',
      error: { code: 'LOGIN_FAILED', details: error.message },
    });
  }
};

// POST /v1/browser-sessions/complete/:tempSessionId
export const completeSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempSessionId } = req.params;
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Missing email',
      });
      return;
    }

    const account = await completePendingSession(tempSessionId, email);

    res.status(200).json({
      success: true,
      message: 'Session completed successfully',
      data: account,
    });
  } catch (error: any) {
    logger.error('Error completing session', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete session',
      error: { code: 'INTERNAL_ERROR', details: error.message },
    });
  }
};

// Deprecated endpoints - keep for compatibility but return 410
export const listSessions = async (_req: Request, res: Response): Promise<void> => {
  res.status(410).json({
    success: false,
    message: 'This endpoint is deprecated. Browser sessions are now stored in accounts table.',
  });
};

export const createSession = async (_req: Request, res: Response): Promise<void> => {
  res.status(410).json({
    success: false,
    message: 'This endpoint is deprecated. Use /login instead.',
  });
};

export const deleteSession = async (_req: Request, res: Response): Promise<void> => {
  res.status(410).json({
    success: false,
    message: 'This endpoint is deprecated.',
  });
};

export const touchSessionHandler = async (_req: Request, res: Response): Promise<void> => {
  res.status(410).json({
    success: false,
    message: 'This endpoint is deprecated.',
  });
};

export const getActiveSession = async (_req: Request, res: Response): Promise<void> => {
  res.status(410).json({
    success: false,
    message: 'This endpoint is deprecated.',
  });
};

export const createProfile = async (_req: Request, res: Response): Promise<void> => {
  res.status(410).json({
    success: false,
    message: 'This endpoint is deprecated.',
  });
};

export const activateSessionHandler = async (_req: Request, res: Response): Promise<void> => {
  res.status(410).json({
    success: false,
    message: 'This endpoint is deprecated.',
  });
};

export const updateSession = async (_req: Request, res: Response): Promise<void> => {
  res.status(410).json({
    success: false,
    message: 'This endpoint is deprecated.',
  });
};