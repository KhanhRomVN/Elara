import { Router } from 'express';
import {
  importAccounts,
  addAccount,
  getAccounts,
} from '../../controllers/account.controller';

const router = Router();

router.post('/import', importAccounts);
router.post('/', addAccount);
router.get('/', getAccounts);

export default router;
