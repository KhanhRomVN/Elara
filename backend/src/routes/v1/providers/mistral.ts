import express from 'express';
import { findAccount } from '../../../utils/account-utils';
import {
  getConversations as getMistralConversations,
  getConversationDetail as getMistralConversationDetail,
} from '../../../mistral';

const router = express.Router();

router.get('/conversations', async (req, res) => {
  try {
    const account = findAccount(req, 'Mistral');
    if (!account) {
      res.status(401).json({ error: 'No valid Mistral account found' });
      return;
    }
    const conversations = await getMistralConversations(account.credential);
    res.json(conversations);
  } catch (error: any) {
    console.error('[Server] Get Mistral Conversations Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const account = findAccount(req, 'Mistral');
    if (!account) {
      res.status(401).json({ error: 'No valid Mistral account found' });
      return;
    }
    const messages = await getMistralConversationDetail(account.credential, id);
    res.json({ messages });
  } catch (error: any) {
    console.error('[Server] Get Mistral Conversation Detail Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
