/**
 * ------------------------------------------------------------------
 * Account Controller
 * ------------------------------------------------------------------
 * Xử lý các request liên quan đến tài khoản: import, thêm mới, xóa,
 * cập nhật trạng thái memory, đăng nhập qua browser,
 * và quản lý browser instance cho tài khoản.
 *
 * Main functions:
 * - importAccounts()           : Import danh sách tài khoản từ file/bulk
 * - addAccount()               : Thêm một tài khoản mới hoặc cập nhật credential
 * - getAccounts()              : Lấy danh sách tài khoản với phân trang và filter
 * - deleteAccount()            : Xóa tài khoản theo id
 * - getAccountMemory()         : Lấy trạng thái memory của tài khoản
 * - updateAccountMemory()      : Cập nhật trạng thái memory
 * - getAccountBrowserStatus()  : Kiểm tra trạng thái browser của tài khoản
 * - startAccountBrowser()      : Khởi động browser cho tài khoản
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response } from 'express';
import * as path from 'path';

// ── Services ──
import {
  getBrowserStatus,
  startBrowserForAccount,
} from '../services/browser-instance-manager';
import {
  getAccountById,
  getAccountByEmailAndProvider,
  getAccountByIdOrEmailProvider,
  getAccounts as getAccountsService,
  createAccount,
  updateAccount,
  updateAccountUserDataDir,
  updateMemoryState,
  removeAccount,
  importAccounts as importAccountsService,
  getProviderConfig,
  type AccountInput,
} from '../services/account.service';

// ── Utils ──
import { createLogger } from '../utils/logger';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('AccountController');

// ─── Controller ─────────────────────────────────────────────────────────

// ─── POST /v1/accounts/import ──────────────────────────────────────
export const importAccounts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const accounts: AccountInput[] = req.body;

    if (!Array.isArray(accounts)) {
      res.status(400).json({
        success: false,
        message: 'Request body must be an array of accounts',
        error: {
          code: 'INVALID_INPUT',
          details: { expected: 'array', received: typeof req.body },
        },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    if (accounts.length === 0) {
      res.status(200).json({
        success: true,
        message: 'No accounts to import',
        data: { imported: 0, skipped: 0, duplicates: [] },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    try {
      const result = importAccountsService(accounts);

      res.status(200).json({
        success: true,
        message: `Successfully imported ${result.imported} account(s)`,
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      logger.error('Error importing accounts', err);
      res.status(500).json({
        success: false,
        message: 'Failed to import accounts',
        error: { code: 'DATABASE_ERROR' },
        meta: { timestamp: new Date().toISOString() },
      });
    }
  } catch (error) {
    logger.error('Error in importAccounts', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// GET /v1/accounts/:id/memory
export const getAccountMemory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const account = getAccountById(id);

    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
        error: { code: 'NOT_FOUND' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        account_id: account.id,
        is_memory_enabled: account.is_memory_enabled === 1,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    logger.error('Error in getAccountMemory', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// PUT /v1/accounts/:id/memory
export const updateAccountMemory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { is_memory_enabled } = req.body;

    if (typeof is_memory_enabled !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'is_memory_enabled must be a boolean',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const account = getAccountById(id);
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
        error: { code: 'NOT_FOUND' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    updateMemoryState(id, is_memory_enabled);

    res.status(200).json({
      success: true,
      data: {
        account_id: id,
        is_memory_enabled,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    logger.error('Error in updateAccountMemory', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// POST /v1/accounts
export const addAccount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const account: AccountInput = req.body;

    if (!account || typeof account !== 'object' || Array.isArray(account)) {
      res.status(400).json({
        success: false,
        message: 'Request body must be a single account object',
        error: {
          code: 'INVALID_INPUT',
          details: { expected: 'object', received: typeof req.body },
        },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    if (
      !account.provider_id ||
      !account.email ||
      (!account.credential && !account.user_data_dir)
    ) {
      res.status(400).json({
        success: false,
        message:
          'Missing required fields: provider_id, email, and either credential or user_data_dir',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const existing = getAccountByIdOrEmailProvider(
      account.id,
      account.email,
      account.provider_id,
    );

    if (existing) {
      try {
        if (account.credential) {
          updateAccount(existing.id, account.credential);
        }
        if (account.user_data_dir) {
          updateAccountUserDataDir(existing.id, account.user_data_dir);
        }
        res.status(200).json({
          success: true,
          message: 'Account credential updated successfully',
          data: {
            id: existing.id,
            email: existing.email,
            provider_id: existing.provider_id,
            action: 'updated',
          },
          meta: { timestamp: new Date().toISOString() },
        });
      } catch (updateErr) {
        logger.error('Error updating account credential', updateErr);
        res.status(500).json({
          success: false,
          message: 'Failed to update account credential',
          error: { code: 'DATABASE_ERROR' },
        });
      }
      return;
    }

    try {
      const id = createAccount(account);

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: {
          id,
          email: account.email,
          provider_id: account.provider_id,
          action: 'created',
        },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (insertErr) {
      logger.error('Error inserting account', insertErr);
      res.status(500).json({
        success: false,
        message: 'Failed to create account',
        error: { code: 'DATABASE_ERROR' },
      });
    }
  } catch (error) {
    logger.error('Error in addAccount', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// GET /v1/accounts
export const getAccounts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const email = req.query.email as string;
    const provider_id = req.query.provider_id as string;
    const sort_by = (req.query.sort_by as string) || 'email';
    const order =
      (req.query.order as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const { rows, total } = getAccountsService({
      page,
      limit,
      email,
      provider_id,
      sort_by,
      order: order as 'ASC' | 'DESC',
    });

    const accountsWithStatus = rows.map((row) => {
      return { ...row };
    });

    res.status(200).json({
      success: true,
      message: 'Accounts retrieved successfully',
      data: {
        accounts: accountsWithStatus,
        pagination: {
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    logger.error('Error in getAccounts', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

export const deleteAccount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Account ID is required',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const account = getAccountById(id);
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
        error: { code: 'NOT_FOUND' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    try {
      removeAccount(id, account.provider_id);

      res.status(200).json({
        success: true,
        message: 'Account deleted successfully',
        data: { id, action: 'deleted' },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (dbError) {
      logger.error('Error deleting account from DB', dbError);
      res.status(500).json({
        success: false,
        message: 'Failed to delete account',
        error: { code: 'DATABASE_ERROR' },
        meta: { timestamp: new Date().toISOString() },
      });
    }
  } catch (error) {
    logger.error('Error in deleteAccount', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// GET /v1/accounts/:id/browser/status
export const getAccountBrowserStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const account = getAccountById(id);

    if (!account) {
      res.status(404).json({ success: false, message: 'Account not found' });
      return;
    }

    // Check if this is a browser provider (has user_data_dir)
    if (!account.user_data_dir) {
      res.status(200).json({
        success: true,
        data: {
          has_profile: false,
          is_running: false,
          message: 'No browser profile associated with this account',
        },
      });
      return;
    }

    const status = await getBrowserStatus(account.user_data_dir);
    res.status(200).json({
      success: true,
      data: {
        has_profile: true,
        is_running: status.isRunning,
        user_data_dir: account.user_data_dir,
        message: status.isRunning
          ? 'Browser is running'
          : 'Browser is not running',
      },
    });
  } catch (error: any) {
    logger.error('Error getting browser status', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get browser status',
    });
  }
};

// POST /v1/accounts/:id/browser/start
export const startAccountBrowser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const account = getAccountById(id);

    if (!account) {
      res.status(404).json({ success: false, message: 'Account not found' });
      return;
    }

    if (!account.user_data_dir) {
      res.status(400).json({
        success: false,
        message:
          'No browser profile associated with this account. Please complete login first.',
      });
      return;
    }

    // Get provider config to find extension folder
    const provider = getProviderConfig(account.provider_id);
    let extensionPath: string | null = null;

    if (provider?.browser_extension_folder) {
      extensionPath = path.join(
        __dirname,
        '../../extensions',
        provider.browser_extension_folder,
      );
    }

    const result = await startBrowserForAccount(
      account.user_data_dir,
      account.provider_id,
      undefined, // loginUrl will use default
      extensionPath || undefined,
    );

    res.status(200).json({
      success: true,
      data: result,
      message: 'Browser started successfully',
    });
  } catch (error: any) {
    logger.error('Error starting browser', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start browser',
    });
  }
};
