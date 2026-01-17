import { Request, Response } from 'express';
import { getDb } from '../services/db';
import {
  getConversations,
  getConversationDetail,
  sendMessage,
} from '../services/chat.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('ChatController');

// GET /v1/accounts/:accountId/conversations
export const getAccountConversations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { accountId } = req.params;
    const limit = parseInt(req.query.limit as string) || 30;
    const page = parseInt(req.query.page as string) || 1;

    // Get account from database
    const db = getDb();
    db.get(
      'SELECT * FROM accounts WHERE id = ?',
      [accountId],
      async (err: any, account: any) => {
        if (err) {
          logger.error('Database error fetching account', err);
          res.status(500).json({
            success: false,
            message: 'Failed to fetch account',
            error: { code: 'DATABASE_ERROR' },
            meta: { timestamp: new Date().toISOString() },
          });
          return;
        }

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
          // Fetch conversations from provider
          const conversations = await getConversations({
            credential: account.credential,
            provider_id: account.provider_id,
            limit,
            page,
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
          logger.error(
            'Error fetching conversations from provider',
            providerError,
          );
          res.status(500).json({
            success: false,
            message: `Failed to fetch conversations: ${providerError.message}`,
            error: { code: 'PROVIDER_ERROR' },
            meta: { timestamp: new Date().toISOString() },
          });
        }
      },
    );
  } catch (error) {
    logger.error('Error in getAccountConversations', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// GET /v1/accounts/:accountId/conversations/:conversationId
export const getAccountConversationDetail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { accountId, conversationId } = req.params;

    // Get account from database
    const db = getDb();
    db.get(
      'SELECT * FROM accounts WHERE id = ?',
      [accountId],
      async (err: any, account: any) => {
        if (err) {
          logger.error('Database error fetching account', err);
          res.status(500).json({
            success: false,
            message: 'Failed to fetch account',
            error: { code: 'DATABASE_ERROR' },
            meta: { timestamp: new Date().toISOString() },
          });
          return;
        }

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
          // Fetch conversation detail from provider
          const conversation = await getConversationDetail({
            credential: account.credential,
            provider_id: account.provider_id,
            conversationId,
          });

          res.status(200).json({
            success: true,
            message: 'Conversation details retrieved successfully',
            data: {
              conversation,
            },
            meta: { timestamp: new Date().toISOString() },
          });
        } catch (providerError: any) {
          logger.error(
            'Error fetching conversation detail from provider',
            providerError,
          );
          res.status(500).json({
            success: false,
            message: `Failed to fetch conversation: ${providerError.message}`,
            error: { code: 'PROVIDER_ERROR' },
            meta: { timestamp: new Date().toISOString() },
          });
        }
      },
    );
  } catch (error) {
    logger.error('Error in getAccountConversationDetail', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};

// POST /v1/accounts/:accountId/messages
export const sendMessageController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { accountId } = req.params;
    const { model, messages, conversationId, stream } = req.body;

    // Get account from database
    const db = getDb();
    db.get(
      'SELECT * FROM accounts WHERE id = ?',
      [accountId],
      async (err: any, account: any) => {
        if (err) {
          logger.error('Database error fetching account', err);
          res.status(500).json({ error: 'Database error' });
          return;
        }

        if (!account) {
          res.status(404).json({ error: 'Account not found' });
          return;
        }

        // Set up SSE headers if streaming (default true)
        if (stream !== false) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });
        }

        let accumulatedContent = '';
        let accumulatedMetadata: any = {};

        try {
          await sendMessage({
            credential: account.credential,
            provider_id: account.provider_id,
            model,
            messages,
            conversationId,
            userAgent: req.headers['user-agent'],
            onContent: (content) => {
              if (stream !== false) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              } else {
                accumulatedContent += content;
              }
            },
            onMetadata: (meta) => {
              if (stream !== false) {
                res.write(`data: ${JSON.stringify({ meta })}\n\n`);
              } else {
                accumulatedMetadata = { ...accumulatedMetadata, ...meta };
              }
            },
            onDone: () => {
              if (stream !== false) {
                res.write('data: [DONE]\n\n');
                res.end();
              } else {
                if (!res.headersSent) {
                  res.status(200).json({
                    success: true,
                    message: {
                      role: 'assistant',
                      content: accumulatedContent,
                    },
                    metadata: accumulatedMetadata,
                  });
                }
              }
            },
            onError: (error) => {
              logger.error('Stream error', error);
              if (stream !== false) {
                res.write(
                  `data: ${JSON.stringify({ error: error.message })}\n\n`,
                );
                res.end();
              } else {
                if (!res.headersSent) {
                  res.status(500).json({ error: error.message });
                }
              }
            },
          });
        } catch (error: any) {
          logger.error('Error in sendMessage service call', error);
          if (!res.headersSent) {
            res.status(500).json({ error: error.message });
          }
        }
      },
    );
  } catch (error) {
    logger.error('Error in sendMessageController', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

const normalizeChatHistory = (provider: string, data: any) => {
  if (!data) return { messages: [] };

  // DeepSeek Normalization
  if (provider.toLowerCase() === 'deepseek') {
    if (
      data.code === 0 &&
      data.data &&
      data.data.biz_data &&
      data.data.biz_data.chat_messages
    ) {
      const messages = data.data.biz_data.chat_messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      }));

      const meta = data.data.biz_data.chat_session || {};

      return {
        conversation_id: meta.id,
        conversation_title: meta.title,
        messages,
      };
    }
    // Fallback
    return { messages: data };
  }

  // Default: return raw
  return { messages: data };
};

// GET /v1/chat/history/:accountId/:conversationId
export const getChatHistoryController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { accountId, conversationId } = req.params;

    if (!accountId || !conversationId) {
      res.status(400).json({
        success: false,
        message: 'Missing required parameters: accountId, conversationId',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    // Get account from database
    const db = getDb();
    db.get(
      'SELECT * FROM accounts WHERE id = ?',
      [accountId],
      async (err: any, account: any) => {
        if (err) {
          logger.error('Database error fetching account', err);
          res.status(500).json({
            success: false,
            message: 'Failed to fetch account',
            error: { code: 'DATABASE_ERROR' },
            meta: { timestamp: new Date().toISOString() },
          });
          return;
        }

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
          // Fetch conversation detail from provider
          const rawConversation = await getConversationDetail({
            credential: account.credential,
            provider_id: account.provider_id,
            conversationId,
          });

          const normalizedData = normalizeChatHistory(
            account.provider_id,
            rawConversation,
          );

          res.status(200).json({
            success: true,
            message: 'Conversation details retrieved successfully',
            data: normalizedData,
            meta: { timestamp: new Date().toISOString() },
          });
        } catch (providerError: any) {
          logger.error(
            'Error fetching conversation detail from provider',
            providerError,
          );
          res.status(500).json({
            success: false,
            message: `Failed to fetch conversation: ${providerError.message}`,
            error: { code: 'PROVIDER_ERROR' },
            meta: { timestamp: new Date().toISOString() },
          });
        }
      },
    );
  } catch (error) {
    logger.error('Error in getChatHistoryController', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
};
