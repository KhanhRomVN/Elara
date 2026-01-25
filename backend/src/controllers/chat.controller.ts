import { Request, Response } from 'express';
import { getDb } from '../services/db';
import {
  getConversations,
  getConversationDetail,
  sendMessage,
} from '../services/chat.service';
import { createLogger } from '../utils/logger';
import crypto from 'crypto';
import { recordRequest, recordSuccess } from '../services/stats.service';
import { ChatRequest } from '../types';

const logger = createLogger('ChatController');

/**
 * Updates the average response time for a given model.
 */
const updateModelPerformance = async (
  modelId: string,
  providerId: string,
  responseTime: number,
) => {
  try {
    const db = getDb();
    const record = db
      .prepare(
        'SELECT * FROM models_performance WHERE model_id = ? AND provider_id = ?',
      )
      .get(modelId, providerId) as any;

    if (!record) {
      db.prepare(
        'INSERT INTO models_performance (id, model_id, provider_id, avg_response_time, total_samples) VALUES (?, ?, ?, ?, ?)',
      ).run(crypto.randomUUID(), modelId, providerId, responseTime, 1);
    } else {
      const newTotalSamples = record.total_samples + 1;
      const newAvgTime =
        (record.avg_response_time * record.total_samples + responseTime) /
        newTotalSamples;

      db.prepare(
        'UPDATE models_performance SET avg_response_time = ?, total_samples = ? WHERE model_id = ? AND provider_id = ?',
      ).run(newAvgTime, newTotalSamples, modelId, providerId);
    }
  } catch (error) {
    logger.error(
      `Error updating model performance for ${modelId} (${providerId}):`,
      error,
    );
  }
};

// GET /v1/accounts/:accountId/conversations
export const getAccountConversations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { accountId } = req.params;
    const limit = parseInt(req.query.limit as string) || 30;
    const page = parseInt(req.query.page as string) || 1;

    // Get account from database (synchronous)
    const db = getDb();
    const account = db
      .prepare('SELECT * FROM accounts WHERE id = ?')
      .get(accountId) as any;

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
        let updatedAt =
          conv.updated_at || conv.updatedAt || conv.created_at || Date.now();

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
      logger.error('Error fetching conversations from provider', providerError);
      res.status(500).json({
        success: false,
        message: `Failed to fetch conversations: ${providerError.message}`,
        error: { code: 'PROVIDER_ERROR' },
        meta: { timestamp: new Date().toISOString() },
      });
    }
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

    // Get account from database (synchronous)
    const db = getDb();
    const account = db
      .prepare('SELECT * FROM accounts WHERE id = ?')
      .get(accountId) as any;

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
        conversationId: conversationId,
      });

      res.status(200).json({
        success: true,
        message: 'Conversation details retrieved successfully',
        data: conversation,
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

import {
  getAllProviders,
  getProviderModels,
} from '../services/provider.service';
import { providerRegistry } from '../provider/registry';
import { getAccountSelector } from '../services/account-selector';

// POST /v1/chat/completions (Legacy/Generic endpoint)
export const completionController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      model,
      messages,
      thinking,
      search,
      conversation_id,
      ref_file_ids,
      temperature,
    } = req.body;

    const authHeader = req.headers.authorization;
    const emailQuery = req.query.email as string;
    const providerQuery = req.query.provider as string;

    const selector = getAccountSelector();
    const accounts = selector.getActiveAccounts();
    let account: any | undefined;

    // Strategy 1: Find by Token (ID)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      account = accounts.find((a) => a.id === token);
    }

    // Strategy 2: Find by explicit Provider + Email
    if (!account && providerQuery && emailQuery) {
      account = accounts.find(
        (a) =>
          a.email.toLowerCase() === emailQuery.toLowerCase() &&
          a.provider_id.toLowerCase() === providerQuery.toLowerCase(),
      );
    }

    // Strategy 3: Dynamic Inference via Registry
    if (!account) {
      let targetProviderId = providerQuery;

      // Try to infer from model if no specific provider requested
      if (!targetProviderId && model) {
        const provider = providerRegistry.getProviderForModel(model);
        if (provider) {
          targetProviderId = provider.name;
        }
      }

      if (targetProviderId) {
        // Find account for this provider
        account = accounts.find(
          (a) =>
            a.provider_id.toLowerCase() === targetProviderId!.toLowerCase(),
        );

        // If explicit email provided, refine search
        if (account && emailQuery) {
          const strictAccount = accounts.find(
            (a) =>
              a.provider_id.toLowerCase() === targetProviderId!.toLowerCase() &&
              a.email.toLowerCase() === emailQuery.toLowerCase(),
          );
          if (strictAccount) account = strictAccount;
        }
      }
    }

    if (!account) {
      res
        .status(401)
        .json({ error: 'No valid account found for this request' });
      return;
    }

    // Record request start
    recordRequest(account.id, account.provider_id);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let accumulatedMetadata: any = {};

    await sendMessage({
      credential: account.credential,
      provider_id: account.provider_id,
      model:
        model ||
        providerRegistry.getProvider(account.provider_id)?.defaultModel,
      messages,
      stream: true,
      thinking,
      search,
      conversationId: conversation_id,
      ref_file_ids,
      temperature,
      onContent: (content) => {
        res.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
        );
      },
      onMetadata: (metadata) => {
        accumulatedMetadata = { ...accumulatedMetadata, ...metadata };
        res.write(
          `data: ${JSON.stringify({ choices: [{ delta: metadata }] })}\n\n`,
        );
      },
      onThinking: (content) => {
        res.write(`data: ${JSON.stringify({ thinking: content })}\n\n`);
      },
      onDone: () => {
        // Record success
        const tokens = accumulatedMetadata.total_token || 0;
        recordSuccess(account.id, account.provider_id, tokens);

        res.write('data: [DONE]\n\n');
        res.end();
      },
      onError: (err) => {
        if (!res.headersSent) {
          res.write(
            `data: ${JSON.stringify({ error: { message: err.message } })}\n\n`,
          );
          res.end();
        }
      },
      onSessionCreated: (sessionId) => {
        res.write(`event: session_created\ndata: ${sessionId}\n\n`);
      },
    });
  } catch (error: any) {
    logger.error('Error in completionController', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
};

// POST /v1/accounts/:accountId/messages
export const sendMessageController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const accountIdFromParams = req.params.accountId;
    const {
      accountId: accountIdFromBody,
      providerId,
      modelId,
      messages,
      conversationId,
      stream,
      is_search,
      search,
      temperature,
      thinking,
      ref_file_ids,
    } = req.body;

    let accountId = accountIdFromParams || accountIdFromBody;
    const useSearch = is_search === true || search === true;

    const db = getDb();
    let account: any | undefined;

    if (accountId) {
      account = db
        .prepare('SELECT * FROM accounts WHERE id = ?')
        .get(accountId) as any;

      if (account && providerId) {
        // Kiểm tra tính nhất quán giữa accountId và providerId
        if (account.provider_id.toLowerCase() !== providerId.toLowerCase()) {
          res.status(400).json({
            success: false,
            message: `Account Conflict: The provided accountId belongs to provider '${account.provider_id}', but providerId is '${providerId}'.`,
            error: { code: 'BAD_REQUEST' },
          });
          return;
        }
      }
    } else if (providerId) {
      // Tự tìm account khi chỉ có providerId
      account = getAccountSelector().selectAccount(providerId);
    } else if (modelId) {
      if (modelId === 'auto') {
        // Find provider with highest priority sequence
        const bestSequence = db
          .prepare(
            'SELECT provider_id FROM model_sequences ORDER BY sequence ASC LIMIT 1',
          )
          .get() as { provider_id: string } | undefined;

        if (bestSequence) {
          // Use provider from sequence
          account = getAccountSelector().selectAccount(
            bestSequence.provider_id,
          );
        } else {
          // Fallback to random/default
          account = getAccountSelector().selectAccount();
        }
      } else {
        // Tự tìm account dựa trên modelId cụ thể
        const inferredProvider = providerRegistry.getProviderForModel(modelId);
        if (inferredProvider) {
          account = getAccountSelector().selectAccount(inferredProvider.name);
        }
      }
    }

    if (!account) {
      res.status(401).json({
        success: false,
        message:
          'No valid account found for this request. Please provide a valid accountId, providerId, or modelId.',
        error: { code: 'UNAUTHORIZED' },
      });
      return;
    }

    // Resolve "auto" model
    let finalModel = modelId;
    if (modelId === 'auto') {
      const bestModel = db
        .prepare(
          'SELECT model_id FROM model_sequences WHERE provider_id = ? ORDER BY sequence ASC LIMIT 1',
        )
        .get(account.provider_id) as { model_id: string } | undefined;

      if (bestModel) {
        finalModel = bestModel.model_id;
        console.log(
          `[Chat] Auto-selected model for ${account.provider_id}: ${finalModel}`,
        );
      } else {
        console.warn(
          `[Chat] "auto" model requested but no sequence found for ${account.provider_id}`,
        );
        // Fallback: try to get default model from provider registry or let it fail
        const provider = providerRegistry.getProvider(account.provider_id);
        if (provider?.defaultModel) {
          finalModel = provider.defaultModel;
        }
      }
    }

    const model = finalModel;

    // Validate search capability
    if (useSearch) {
      const providers = await getAllProviders();
      const providerConfig = providers.find(
        (p) =>
          p.provider_id.toLowerCase() === account.provider_id.toLowerCase(),
      );

      if (!providerConfig?.is_search) {
        res.status(400).json({
          error: `Provider ${account.provider_id} does not support search`,
        });
        return;
      }
    }

    // Set up SSE headers if streaming (default true)
    if (stream !== false) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(
        `data: ${JSON.stringify({ meta: { accountId: account.id } })}\n\n`,
      );
    }

    let accumulatedContent = '';
    let accumulatedMetadata: any = { accountId: account.id };

    try {
      const startTime = Date.now();
      let firstResponseCaptured = false;

      const captureFirstResponse = () => {
        if (!firstResponseCaptured) {
          firstResponseCaptured = true;
          const duration = Date.now() - startTime;
          updateModelPerformance(model, account.provider_id, duration);
        }
      };

      await sendMessage({
        credential: account.credential,
        provider_id: account.provider_id,
        accountId: account.id,
        model,
        messages,
        conversationId,
        search: useSearch,
        temperature,
        thinking,
        ref_file_ids,
        onContent: (content) => {
          captureFirstResponse();
          if (stream !== false) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          } else {
            accumulatedContent += content;
          }
        },
        onMetadata: (meta) => {
          captureFirstResponse();
          if (stream !== false) {
            res.write(`data: ${JSON.stringify({ meta })}\n\n`);
          } else {
            accumulatedMetadata = { ...accumulatedMetadata, ...meta };
          }
        },
        onThinking: (content) => {
          captureFirstResponse();
          if (stream !== false) {
            res.write(`data: ${JSON.stringify({ thinking: content })}\n\n`);
          }
          // Note: added thinking handling for consistency if needed
        },
        onDone: () => {
          // Record success
          const tokens = (accumulatedMetadata as any).total_token || 0;
          recordSuccess(account.id, account.provider_id, tokens);

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
        onSessionCreated: (sessionId) => {
          if (stream !== false) {
            res.write(`event: session_created\ndata: ${sessionId}\n\n`);
          } else {
            accumulatedMetadata.conversation_id = sessionId;
          }
        },
        onError: (error) => {
          logger.error('Stream error', error);
          if (stream !== false) {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
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
  } catch (error) {
    logger.error('Error in sendMessageController', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

// GET /v1/chat/history/:accountId/:conversationId
export const getChatHistoryController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { account_id, conversation_id } = req.params;

    if (!account_id || !conversation_id) {
      res.status(400).json({
        success: false,
        message: 'Missing required parameters: account_id, conversation_id',
        error: { code: 'INVALID_INPUT' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    // Get account from database (synchronous)
    const db = getDb();
    const account = db
      .prepare('SELECT * FROM accounts WHERE id = ?')
      .get(account_id) as any;

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
        conversationId: conversation_id,
      });

      res.status(200).json({
        success: true,
        message: 'Conversation details retrieved successfully',
        data: conversation,

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

// POST /v1/chat/messages (Anthropic Mock API using Gemini-3-Flash)
export const claudeMessagesController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { model, messages, stream, max_tokens, temperature } = req.body;

    // We only support gemini-3-flash as requested
    const targetModel = 'gemini-3-flash';

    // Find any antigravity account
    const selector = getAccountSelector();
    const accounts = selector.getActiveAccounts();
    const account = accounts.find((a) => a.provider_id === 'antigravity');

    if (!account) {
      res.status(500).json({
        error: {
          type: 'not_found_error',
          message: 'Antigravity account (Gemini) not found in Elara.',
        },
      });
      return;
    }

    // Convert Anthropic messages to Elara format
    const elaraMessages = messages.map((m: any) => ({
      role: m.role,
      content: Array.isArray(m.content)
        ? m.content
            .map((c: any) => (c.type === 'text' ? c.text : ''))
            .join('\n')
        : m.content,
    }));

    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      // Anthropic format: message_start
      res.write(
        `data: ${JSON.stringify({
          type: 'message_start',
          message: {
            id: `msg_${crypto.randomUUID()}`,
            type: 'message',
            role: 'assistant',
            content: [],
            model: targetModel,
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 },
          },
        })}\n\n`,
      );

      await sendMessage({
        credential: account.credential,
        provider_id: account.provider_id,
        accountId: account.id,
        model: targetModel,
        messages: elaraMessages,
        temperature,
        onContent: (content) => {
          res.write(
            `data: ${JSON.stringify({
              type: 'content_block_delta',
              index: 0,
              delta: { type: 'text_delta', text: content },
            })}\n\n`,
          );
        },
        onDone: () => {
          res.write(
            `data: ${JSON.stringify({
              type: 'message_delta',
              delta: { stop_reason: 'end_turn', stop_sequence: null },
              usage: { output_tokens: 0 },
            })}\n\n`,
          );
          res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
          res.end();
        },
        onError: (err) => {
          res.write(
            `data: ${JSON.stringify({
              type: 'error',
              error: { type: 'api_error', message: err.message },
            })}\n\n`,
          );
          res.end();
        },
      });
    } else {
      let accumulatedContent = '';
      await sendMessage({
        credential: account.credential,
        provider_id: account.provider_id,
        accountId: account.id,
        model: targetModel,
        messages: elaraMessages,
        temperature,
        onContent: (content) => {
          accumulatedContent += content;
        },
        onDone: () => {
          res.status(200).json({
            id: `msg_${crypto.randomUUID()}`,
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: accumulatedContent }],
            model: targetModel,
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 },
          });
        },
        onError: (err) => {
          res
            .status(500)
            .json({ error: { type: 'api_error', message: err.message } });
        },
      });
    }
  } catch (error: any) {
    logger.error('Error in claudeMessagesController', error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: { type: 'api_error', message: error.message } });
    }
  }
};
