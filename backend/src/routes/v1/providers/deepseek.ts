import express from 'express';
import { getAccounts, findAccount } from '../../../utils/account-utils';
import { getChatSessions, getChatHistory, stopStream, uploadFile } from '../../../deepseek';

const router = express.Router();

router.get('/sessions', async (req, res) => {
  try {
    const pinnedOnly = req.query.pinned === 'true';
    const account = findAccount(req, 'DeepSeek');

    if (!account) {
      res.status(401).json({ error: 'No valid DeepSeek account found' });
      return;
    }

    const sessions = await getChatSessions(account.credential, account.userAgent, pinnedOnly);
    res.json(sessions);
  } catch (error: any) {
    console.error('[Server] Get DeepSeek Sessions Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sessions/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const account = findAccount(req, 'DeepSeek');

    if (!account) {
      res.status(401).json({ error: 'No valid DeepSeek account found' });
      return;
    }

    const history = await getChatHistory(account.credential, id, account.userAgent);
    res.json(history);
  } catch (error: any) {
    console.error('[Server] Get DeepSeek Chat History Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/sessions/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    const { messageId, email } = req.body;

    const accounts = getAccounts();
    const account = accounts.find(
      (a) => a.email.toLowerCase() === email.toLowerCase() && a.provider === 'DeepSeek',
    );

    if (!account) {
      res.status(401).json({ error: 'No valid DeepSeek account found' });
      return;
    }

    await stopStream(account.credential, id, messageId, account.userAgent);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Server] Stop DeepSeek Stream Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/files', async (req, res) => {
  try {
    const { file, fileName, email } = req.body;

    const accounts = getAccounts();
    const account = accounts.find(
      (a) => a.email.toLowerCase() === email.toLowerCase() && a.provider === 'DeepSeek',
    );

    if (!account) {
      res.status(401).json({ error: 'No valid DeepSeek account found' });
      return;
    }

    const fileId = await uploadFile(account.credential, file, fileName, account.userAgent);
    res.json({ id: fileId });
  } catch (error: any) {
    console.error('[Server] Upload DeepSeek File Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
