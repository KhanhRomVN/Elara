import express from 'express';
import { getAccounts, findAccount } from '../../../utils/account-utils';
import {
  getModels as getHuggingChatModels,
  getConversations as getHuggingChatConversations,
  getConversation as getHuggingChatConversation,
  summarizeConversation as summarizeHuggingChatConversation,
} from '../../../hugging-chat';

const router = express.Router();

router.get('/models', async (req, res) => {
  try {
    const emailQuery = req.query.email as string;
    const accounts = getAccounts();
    let account = accounts.find((a) => a.email === emailQuery && a.provider === 'HuggingChat');

    if (!account) {
      account = accounts.find((a) => a.provider === 'HuggingChat' && a.status === 'Active');
    }

    if (!account) {
      res.status(401).json({ error: 'No valid HuggingChat account found' });
      return;
    }

    const models = await getHuggingChatModels(account.credential);
    res.json(models);
  } catch (error: any) {
    console.error('[Server] Get HuggingChat Models Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations', async (req, res) => {
  try {
    const pageQuery = parseInt(req.query.page as string) || 0;
    const account = findAccount(req, 'HuggingChat');

    if (!account) {
      res.status(401).json({ error: 'No valid HuggingChat account found' });
      return;
    }

    const conversations = await getHuggingChatConversations(account.credential, pageQuery);
    res.json(conversations);
  } catch (error: any) {
    console.error('[Server] Get HuggingChat Conversations Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const account = findAccount(req, 'HuggingChat');

    if (!account) {
      res.status(401).json({ error: 'No valid HuggingChat account found' });
      return;
    }

    const conversation = await getHuggingChatConversation(account.credential, id);
    res.json(conversation);
  } catch (error: any) {
    console.error('[Server] Get HuggingChat Conversation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/conversations/:id/summarize', async (req, res) => {
  try {
    const { id } = req.params;
    const emailQuery = req.query.email as string;
    const accounts = getAccounts();
    let account = accounts.find((a) => a.email === emailQuery && a.provider === 'HuggingChat');

    if (!account) {
      account = accounts.find((a) => a.provider === 'HuggingChat' && a.status === 'Active');
    }

    if (!account) {
      res.status(401).json({ error: 'No valid HuggingChat account found' });
      return;
    }

    const title = await summarizeHuggingChatConversation(account.credential, id);
    res.json({ title });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
