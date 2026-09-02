/**
 * ------------------------------------------------------------------
 * Account Routes
 * ------------------------------------------------------------------
 * Routes cho API quản lý tài khoản provider.
 *
 * Main routes:
 * - POST   /v1/accounts/import         : Import danh sách tài khoản
 * - POST   /v1/accounts                : Thêm một tài khoản
 * - GET    /v1/accounts                : Lấy danh sách tài khoản
 * - DELETE /v1/accounts/:id            : Xóa tài khoản
 * - GET    /v1/accounts/:id/memory     : Lấy trạng thái memory
 * - PUT    /v1/accounts/:id/memory     : Cập nhật trạng thái memory
 * - GET    /v1/accounts/:id/browser/status : Trạng thái browser
 * - POST   /v1/accounts/:id/browser/start : Khởi động browser
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Router } from 'express';

// ── Controllers ──
import {
  importAccounts,
  addAccount,
  getAccounts,
  deleteAccount,
  getAccountMemory,
  updateAccountMemory,
  getAccountBrowserStatus,
  startAccountBrowser,
} from '../../controllers/account.controller';

// ─── Router ─────────────────────────────────────────────────────────────

const router = Router();

router.post('/import', importAccounts);
router.post('/', addAccount);
router.get('/', getAccounts);
router.delete('/:id', deleteAccount);
router.get('/:id/memory', getAccountMemory);
router.put('/:id/memory', updateAccountMemory);
router.get('/:id/browser/status', getAccountBrowserStatus);
router.post('/:id/browser/start', startAccountBrowser);

export default router;