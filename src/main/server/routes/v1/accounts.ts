import { Router, Request, Response } from 'express';
import {
  addAccount,
  getAccounts,
  importAccounts,
  deleteAccount,
} from '@backend/controllers/account.controller';
import { getDb } from '@backend/services/db';
import { getConversations, getConversationDetail } from '@backend/services/chat.service';

const router = Router();

// POST /v1/accounts/import
router.post('/import', (req, res) => importAccounts(req as any, res as any));

// GET /v1/accounts
router.get('/', (req, res) => getAccounts(req as any, res as any));

// POST /v1/accounts (Create or Update)
router.post('/', (req, res) => addAccount(req as any, res as any));

// DELETE /v1/accounts/:id
router.delete('/:id', (req, res) => deleteAccount(req as any, res as any));

// GET /v1/accounts/:accountId/conversations
router.get('/:accountId/conversations', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    const limit = parseInt(req.query.limit as string) || 30;
    const page = parseInt(req.query.page as string) || 1;

    const db = getDb();
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;

    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
        error: { code: 'NOT_FOUND' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    try {
      const rawConversations = await getConversations({
        credential: account.credential,
        provider_id: account.provider_id,
        limit,
        page,
      });

      // Filter and normalize conversation fields
      const conversations = rawConversations.map((conv: any) => {
        const title = conv.title || conv.name || conv.summary || 'Untitled';
        const id = conv.id || conv.uuid || conv.conversationId || conv._id;

        // Normalize updated_at to seconds (number)
        let updatedAt = conv.updated_at || conv.updatedAt || conv.created_at || Date.now();

        // If it's a date string, convert to seconds
        if (typeof updatedAt === 'string') {
          updatedAt = Math.floor(new Date(updatedAt).getTime() / 1000);
        } else if (updatedAt > 1000000000000) {
          // If it's milliseconds (longer than 10^12), convert to seconds
          updatedAt = Math.floor(updatedAt / 1000);
        }

        return {
          id,
          title,
          updated_at: updatedAt,
        };
      });

      res.status(200).json({
        success: true,
        message: 'Conversations retrieved successfully',
        data: {
          conversations,
          account: {
            id: account.id,
            email: account.email,
            provider_id: account.provider_id,
          },
        },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (providerError: any) {
      console.error('Error fetching conversations from provider', providerError);
      res.status(500).json({
        success: false,
        message: `Failed to fetch conversations: ${providerError.message}`,
        error: { code: 'PROVIDER_ERROR' },
        meta: { timestamp: new Date().toISOString() },
      });
    }
  } catch (error) {
    console.error('Error in getAccountConversations', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
});

// GET /v1/accounts/:accountId/conversations/:conversationId
router.get('/:accountId/conversations/:conversationId', async (req: Request, res: Response) => {
  try {
    const { accountId, conversationId } = req.params;

    const db = getDb();
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;

    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
        error: { code: 'NOT_FOUND' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    try {
      const conversation = await getConversationDetail({
        credential: account.credential,
        provider_id: account.provider_id,
        conversationId,
      });

      res.status(200).json({
        success: true,
        message: 'Conversation details retrieved successfully',
        data: conversation,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (providerError: any) {
      console.error('Error fetching conversation detail from provider', providerError);
      res.status(500).json({
        success: false,
        message: `Failed to fetch conversation: ${providerError.message}`,
        error: { code: 'PROVIDER_ERROR' },
        meta: { timestamp: new Date().toISOString() },
      });
    }
  } catch (error) {
    console.error('Error in getAccountConversationDetail', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
});

export default router;
