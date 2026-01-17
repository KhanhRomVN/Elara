import express from 'express';
import { findAccount } from '../../../utils/account-utils';
import { getChats as getQwenChats } from '../../../qwen';

const router = express.Router();

router.get('/conversations', async (req, res) => {
  try {
    const account = findAccount(req, 'Qwen');
    if (!account) {
      res.status(401).json({ error: 'No active Qwen account found' });
      return;
    }
    const history = await getQwenChats(account.credential);
    res.json(history);
  } catch (error: any) {
    console.error('[Server] Qwen History Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations/:id', async (_req, res) => {
  res.json({ messages: [] });
});

export default router;
