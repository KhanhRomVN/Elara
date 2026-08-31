/**
 * ------------------------------------------------------------------
 * Send Message Controller
 * ------------------------------------------------------------------
 * Xử lý request gửi tin nhắn tới model AI qua provider tương ứng.
 * Hỗ trợ cả streaming và non-streaming, tích hợp search, token counting,
 * và ghi nhận metrics.
 *
 * Main functions:
 * - sendMessage() : Gửi tin nhắn và xử lý response (stream/non-stream)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── External ──
import { Request, Response } from 'express';

// ── Services ──
import { sendMessage as sendMessageService } from '../services/chat';
import { recordRequest, recordError } from '../services/metrics.service';
import { getAllProviders } from '../services/provider.service';

// ── Repositories ──
import { findAccountById } from '../repositories/account.repository';

// ── Providers ──
import { providerRegistry } from '../provider/registry';

// ── Utils ──
import { createLogger } from '../utils/logger';
import { countMessagesTokens, countTokens } from '../utils/tokenizer';

// ─── Constants ──────────────────────────────────────────────────────────
const logger = createLogger('SendMessageController');

// ─── Helper Functions ─────────────────────────────────────────────────
const unescapeHtml = (str: string): string => {
  return str
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/&/g, '&')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/&apos;/g, "'");
};

// ─── Controller ─────────────────────────────────────────────────────────

// ─── POST /v1/accounts/:accountId/messages ──────────────────────────
export const sendMessage = async (
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
      parent_message_id,
      stream,
      is_search,
      search,
      temperature,
      thinking,
      ref_file_ids,
    } = req.body;

    if (messages && messages.length > 1) {
      if (!conversationId || conversationId.trim() === '') {
        if (!parent_message_id) {
          // Auto-generate UUID v4 fallback conversationId for multi-turn tool executions to prevent session disconnect
          const fallbackConvId = crypto.randomUUID();
          logger.info(`[Chat] Auto-assigned fallback conversationId: ${fallbackConvId}`);
          req.body.conversationId = fallbackConvId;
        }
      }
    }

    const accountId = accountIdFromParams || accountIdFromBody;
    const useSearch = is_search === true || search === true;

    if (!accountId) {
      res.status(400).json({
        success: false,
        message:
          'Missing accountId. Please provide a valid accountId in params or body.',
        error: { code: 'BAD_REQUEST' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    const account = findAccountById(accountId);

    if (!account) {
      res.status(404).json({
        success: false,
        message: `Account not found with id: ${accountId}`,
        error: { code: 'NOT_FOUND' },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    if (
      providerId &&
      account.provider_id.toLowerCase() !== providerId.toLowerCase()
    ) {
      res.status(400).json({
        success: false,
        message: `Account Conflict: The provided accountId belongs to provider '${account.provider_id}', but providerId is '${providerId}'.`,
        error: { code: 'BAD_REQUEST' },
      });
      return;
    }

    // Resolve "auto" model - use provider's default model
    let finalModel = modelId;
    if (modelId === 'auto') {
      const provider = providerRegistry.getProvider(account.provider_id);
      if (provider?.defaultModel) {
        finalModel = provider.defaultModel;
        logger.info(
          `"auto" model resolved to ${finalModel} for provider ${account.provider_id}`,
        );
      } else {
        logger.warn(
          `"auto" model requested but no default model for ${account.provider_id}`,
        );
      }
    }

    const model = finalModel;

    // Validate credential before proceeding
    if (!account.credential || account.credential.trim() === '') {
      if (stream !== false) {
        res.writeHead(400, { 'Content-Type': 'text/event-stream' });
        res.write(
          `data: ${JSON.stringify({ error: 'Account credential is missing or empty' })}\n\n`,
        );
        res.end();
      } else {
        res.status(400).json({
          success: false,
          message: 'Account credential is missing or empty',
          error: { code: 'MISSING_CREDENTIAL' },
        });
      }
      return;
    }

    const providers = await getAllProviders();
    const providerConfig = providers.find(
      (p) => p.provider_id.toLowerCase() === account.provider_id.toLowerCase(),
    );
    const websiteUrl = providerConfig?.website;

    // Search capability is now determined at model level, not provider level
    // The actual search support will be checked by the provider implementation

    const initialMeta: any = {
      accountId: account.id,
      providerId: account.provider_id,
      modelId: model,
      email: account.email,
    };
    if (websiteUrl) {
      initialMeta.websiteUrl = websiteUrl;
    }

    if (stream !== false) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      const responseData = { meta: initialMeta };
      res.write(`data: ${JSON.stringify(responseData)}\n\n`);
    }

    let accumulatedContent = '';
    let accumulatedMetadata: any = { ...initialMeta };
    let finalOutputMessage = '';
    let finalError: Error | null = null;

    try {
      recordRequest(account.provider_id, model);

      const lastMsg = messages?.[messages.length - 1];
      const lastMsgSnippet =
        typeof lastMsg?.content === 'string'
          ? lastMsg.content.slice(0, 120).replace(/\n/g, ' ')
          : '';
      const roleBreakdown = messages?.reduce(
        (acc: Record<string, number>, m: any) => {
          acc[m.role] = (acc[m.role] || 0) + 1;
          return acc;
        },
        {},
      );

      let accumulatedResponse = '';

      let firstChunkReceived = false;
      let streamTimeoutId: ReturnType<typeof setTimeout> | null = null;
      if (stream !== false) {
        streamTimeoutId = setTimeout(() => {
          if (!firstChunkReceived && !res.writableEnded) {
            res.write(
              `data: ${JSON.stringify({ error: 'Stream timeout: no response received within 5 minutes' })}\n\n`,
            );
            res.end();
          }
        }, 300000);
      }

      await sendMessageService({
        credential: account.credential,
        provider_id: account.provider_id,
        accountId: account.id,
        model,
        messages,
        conversationId,
        parent_message_id,
        search: useSearch,
        temperature,
        thinking,
        ref_file_ids,
        onContent: (content: string) => {
          accumulatedResponse += content;
          finalOutputMessage = accumulatedResponse;
          if (stream !== false) {
            if (!firstChunkReceived) {
              firstChunkReceived = true;
              if (streamTimeoutId) clearTimeout(streamTimeoutId);
            }
            if (res.writableEnded) return;
            res.write(
              `data: ${JSON.stringify({ content: unescapeHtml(content) })}\n\n`,
            );
          } else {
            accumulatedContent += content;
            finalOutputMessage = accumulatedContent;
          }
        },
        onMetadata: (meta: any) => {
          if (stream !== false) {
            res.write(`data: ${JSON.stringify({ meta })}\n\n`);
          } else {
            accumulatedMetadata = { ...accumulatedMetadata, ...meta };
          }
        },
        onThinking: (content: string) => {
          if (stream !== false) {
            res.write(`data: ${JSON.stringify({ thinking: content })}\n\n`);
          }
        },
        onDone: () => {
          if (streamTimeoutId) clearTimeout(streamTimeoutId);
          if (stream !== false && res.writableEnded) return;

          // Log transaction details
          const MAX_PREVIEW_LENGTH = 200;
          const truncate = (str: string) => {
            if (str.length <= MAX_PREVIEW_LENGTH) return str;
            return str.slice(0, MAX_PREVIEW_LENGTH) + '...';
          };

          const outputPreview = finalOutputMessage
            ? truncate(finalOutputMessage)
            : '';

          // Calculate tokens
          const inputToken = messages ? countMessagesTokens(messages) : 0;
          const outputToken = finalOutputMessage
            ? countTokens(finalOutputMessage)
            : 0;

          logger.info(
            `[Transaction Complete] provider_id=${account.provider_id} model_id=${model} account_id=${account.id} conversation_id=${conversationId || 'none'} input_token=${inputToken} output_token=${outputToken}`,
          );

          if (stream !== false) {
            if (!accumulatedResponse || accumulatedResponse.trim() === '') {
              logger.warn(
                `[Response] Provider ${account.provider_id} returned empty content for model=${model}`,
              );
              res.write(
                `data: ${JSON.stringify({ error: 'Provider returned empty response', code: 'EMPTY_RESPONSE' })}\n\n`,
              );
            }
            res.write('data: [DONE]\n\n');
            res.end();
          } else {
            if (!res.headersSent) {
              if (!accumulatedContent || accumulatedContent.trim() === '') {
                res.status(502).json({
                  success: false,
                  message: 'Provider returned empty response',
                  error: { code: 'EMPTY_RESPONSE' },
                });
                return;
              }
              res.status(200).json({
                success: true,
                message: {
                  role: 'assistant',
                  content: unescapeHtml(accumulatedContent),
                },
                metadata: accumulatedMetadata,
              });
            }
          }
        },
        onSessionCreated: (sessionId: string) => {
          if (stream !== false) {
            res.write(`event: session_created\ndata: ${sessionId}\n\n`);
            res.write(
              `data: ${JSON.stringify({ meta: { conversation_id: sessionId } })}\n\n`,
            );
          } else {
            accumulatedMetadata.conversation_id = sessionId;
          }
        },
        onError: (error: Error) => {
          if (streamTimeoutId) clearTimeout(streamTimeoutId);

          // Log transaction details with error
          const MAX_PREVIEW_LENGTH = 200;
          const truncate = (str: string) => {
            if (str.length <= MAX_PREVIEW_LENGTH) return str;
            return str.slice(0, MAX_PREVIEW_LENGTH) + '...';
          };

          const outputPreview = finalOutputMessage
            ? truncate(finalOutputMessage)
            : '';

          // Calculate tokens
          const inputToken = messages ? countMessagesTokens(messages) : 0;
          const outputToken = finalOutputMessage
            ? countTokens(finalOutputMessage)
            : 0;

          logger.error(
            `[Transaction Error] provider_id=${account.provider_id} model_id=${model} account_id=${account.id} conversation_id=${conversationId || 'none'} input_token=${inputToken} output_token=${outputToken} error=${error.message}`,
            { stack: error.stack, code: (error as any).code },
          );
          // Record error metric so success_rate reflects failures
          recordError(account.id, account.provider_id, model, error.message);

          if (stream !== false) {
            if (!res.writableEnded) {
              const errPayload: any = { error: error.message };
              if ((error as any).code)
                errPayload.error_code = (error as any).code;
              res.write(`data: ${JSON.stringify(errPayload)}\n\n`);
              res.end();
            }
          } else {
            if (!res.headersSent) {
              res.status(500).json({
                error: error.message,
                ...((error as any).code
                  ? { error_code: (error as any).code }
                  : {}),
              });
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
    logger.error('Error in sendMessage', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};