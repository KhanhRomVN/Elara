/**
 * ------------------------------------------------------------------
 * Login Controller
 * ------------------------------------------------------------------
 * Xử lý đăng nhập qua browser cho provider.
 *
 * Main functions:
 * - login() : Đăng nhập qua browser cho provider
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response } from 'express';

// ── Services ──
import { loginWithProvider } from '../services/login.service';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('LoginController');

// ─── Controller ─────────────────────────────────────────────────────────

// POST /v1/accounts/login/:provider
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider: providerId } = req.params;
    const { method } = req.body;

    try {
      const result = await loginWithProvider(providerId, {
        method: method === 'google' ? 'google' : 'basic',
      });

      const accountResponse: any = {
        provider_id: providerId,
        email: result.email || '',
        credential: result.cookies,
        headers: result.headers,
      };

      if (result.user_data_dir) {
        accountResponse.user_data_dir = result.user_data_dir;
      }

      // Include pending info for browser providers
      if (result.pending) {
        accountResponse.pending = result.pending;
        accountResponse.tempSessionId = result.tempSessionId;
      }

      res.status(200).json({
        success: true,
        account: accountResponse,
      });
    } catch (providerError: any) {
      const errorMessage = providerError?.message || String(providerError) || 'Unknown error';
      logger.warn(`[Login] Provider error: ${errorMessage}`);

      if (errorMessage.includes('not found')) {
        res.status(404).json({
          success: false,
          message: 'Provider not found',
        });
      } else if (errorMessage.includes('not support')) {
        res.status(400).json({
          success: false,
          message: errorMessage,
        });
      } else {
        throw providerError;
      }
      return;
    }
  } catch (error: any) {
    logger.error('[Login] Login failed with error:', error);
    logger.error(`[Login] Error message: ${error.message}`);
    logger.error(`[Login] Error stack: ${error.stack}`);
    res
      .status(500)
      .json({ success: false, message: error.message || 'Login failed' });
  }
};