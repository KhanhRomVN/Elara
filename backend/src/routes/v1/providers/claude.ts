import express from 'express';
import { getAccounts } from '../../../utils/account-utils';
import {
  getConversations,
  getConversationDetail,
  deleteConversation,
  stopResponse,
} from '../../../claude';

const router = express.Router();

// Get Conversations/History
router.get('/conversations', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const emailQuery = req.query.email as string;
    const limitQuery = parseInt(req.query.limit as string) || 30;

    const accounts = getAccounts();
    let account: any | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      account = accounts.find((a) => a.id === token);
    }

    if (!account && emailQuery) {
      account = accounts.find(
        (a) => a.email.toLowerCase() === emailQuery.toLowerCase() && a.provider === 'Claude',
      );
    }

    if (!account) {
      account = accounts.find((a) => a.provider === 'Claude' && a.status === 'Active');
    }

    if (!account) {
      res.status(401).json({ error: 'No valid Claude account found' });
      return;
    }

    const conversations = await getConversations(account.credential, account.userAgent, limitQuery);
    res.json(conversations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const emailQuery = req.query.email as string;

    const accounts = getAccounts();
    let account: any | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      account = accounts.find((a) => a.id === token);
    }

    if (!account && emailQuery) {
      account = accounts.find(
        (a) => a.email.toLowerCase() === emailQuery.toLowerCase() && a.provider === 'Claude',
      );
    }

    if (!account) {
      account = accounts.find((a) => a.provider === 'Claude' && a.status === 'Active');
    }

    if (!account) {
      res.status(401).json({ error: 'No valid Claude account found' });
      return;
    }

    const conversation = await getConversationDetail(account.credential, id, account.userAgent);
    res.json(conversation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const emailQuery = req.query.email as string;

    const accounts = getAccounts();
    let account: any | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      account = accounts.find((a) => a.id === token);
    }

    if (!account && emailQuery) {
      account = accounts.find(
        (a) => a.email.toLowerCase() === emailQuery.toLowerCase() && a.provider === 'Claude',
      );
    }

    if (!account) {
      account = accounts.find((a) => a.provider === 'Claude' && a.status === 'Active');
    }

    if (!account) {
      res.status(401).json({ error: 'No valid Claude account found' });
      return;
    }

    await deleteConversation(account.credential, id, account.userAgent);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/conversations/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    const emailQuery = req.query.email as string;

    const accounts = getAccounts();
    const account = accounts.find(
      (a) => a.email.toLowerCase() === emailQuery?.toLowerCase() && a.provider === 'Claude',
    );

    if (!account) {
      res.status(401).json({ error: 'No valid Claude account found' });
      return;
    }

    await stopResponse(account.credential, id, account.userAgent);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Server] Stop Claude Response Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
