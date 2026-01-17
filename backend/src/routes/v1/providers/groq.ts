import express from 'express';
import { getAccounts, findAccount } from '../../../utils/account-utils';
import { getModels as getGroqModels } from '../../../groq';

const router = express.Router();

router.get('/models', async (req, res) => {
  try {
    const account = findAccount(req, 'Groq');
    if (!account) {
      res.status(401).json({ error: 'No valid Groq account found' });
      return;
    }
    const models = await getGroqModels(account);
    res.json(models);
  } catch (error: any) {
    console.error('[Server] Get Groq Models Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations', async (_req, res) => {
  res.json([]);
});

router.get('/conversations/:id', async (_req, res) => {
  res.json({ messages: [] });
});

export default router;
