import express from 'express';
import { findAccount } from '../../../utils/account-utils';
import * as gemini from '../../../gemini';

const router = express.Router();

router.get('/models', async (req, res) => {
  try {
    const account = findAccount(req, 'Gemini');
    if (!account) {
      res.status(401).json({ error: 'No valid Gemini account found' });
      return;
    }
    await gemini.getModels(req, res, account);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
