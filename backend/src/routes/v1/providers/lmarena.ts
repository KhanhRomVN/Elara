import express from 'express';
import { findAccount } from '../../../utils/account-utils';
import {
  getModels as getLMArenaModels,
  getConversations as getLMArenaConversations,
  getConversationDetail as getLMArenaConversationDetail,
  chatCompletionStream,
} from '../../../lmarena';

const router = express.Router();

router.post('/chat/completions', async (req, res) => {
  try {
    const account = findAccount(req, 'LMArena');
    if (!account) {
      res.status(401).json({ error: 'No valid LMArena account found' });
      return;
    }
    chatCompletionStream(req, res, account);
  } catch (error: any) {
    console.error('[Server] LMArena Chat Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/models', async (req, res) => {
  try {
    const account = findAccount(req, 'LMArena');
    if (!account) {
      res.status(401).json({ error: 'No valid LMArena account found' });
      return;
    }
    const models = await getLMArenaModels(account);
    res.json({ data: models }); // Return wrapped in data to match old API? Or just models?
    // Original code: res.json({ data: models });
  } catch (error: any) {
    console.error('[Server] LMArena Models Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations', async (req, res) => {
  try {
    const account = findAccount(req, 'LMArena');
    if (!account) return res.status(401).json({ error: 'No LMArena account' });

    const conversations = await getLMArenaConversations(account);
    res.json({ conversations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations/:id', async (req, res) => {
  try {
    const account = findAccount(req, 'LMArena');
    if (!account) return res.status(401).json({ error: 'No LMArena account' });

    const messages = await getLMArenaConversationDetail(req.params.id, account);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
