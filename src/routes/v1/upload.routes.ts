/**
 * ------------------------------------------------------------------
 * Upload Routes
 * ------------------------------------------------------------------
 * Routes cho API upload file lên provider.
 *
 * Main routes:
 * - POST /v1/accounts/:accountId/uploads : Upload file
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import express from 'express';
import multer from 'multer';

// ── Controllers ──
import { uploadFile } from '../../controllers/upload.controller';

// ─── Router ────────────��────────────────────────────────────────────────

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/accounts/:accountId/uploads', upload.single('file'), uploadFile);

export default router;