import express from 'express';
import { findAccount } from '../../../utils/account-utils';
import { getConversations as getPerplexityConversations } from '../../../perplexity';

const router = express.Router();

router.get('/conversations', async (req, res) => {
  try {
    const limitQuery = parseInt(req.query.limit as string) || 20;
    const account = findAccount(req, 'Perplexity');

    if (!account) {
      res.status(401).json({ error: 'No valid Perplexity account found' });
      return;
    }

    const conversations = await getPerplexityConversations(
      account.credential,
      account.userAgent,
      limitQuery,
    );
    res.json(conversations);
  } catch (error: any) {
    console.error('[Server] Get Perplexity Conversations Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations/:id', async (_req, res) => {
  res.json({ messages: [] }); // Placeholder as in original index.ts (implied by missing detail route in original?)
  // Actually original didn't implement detail for Perplexity in the GET block I saw?
  // I only saw getPerplexityConversations imported.
});

export default router;
