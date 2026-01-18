import { Router } from 'express';
import { addAccount, getAccounts, importAccounts } from '@backend/controllers/account.controller';

const router = Router();

// POST /v1/accounts/import
router.post('/import', (req, res) => importAccounts(req as any, res as any));

// GET /v1/accounts
router.get('/', (req, res) => getAccounts(req as any, res as any));

// POST /v1/accounts (Create or Update)
router.post('/', (req, res) => addAccount(req as any, res as any));

export default router;
