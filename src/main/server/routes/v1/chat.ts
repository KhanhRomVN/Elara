import express, { Request, Response } from 'express';
import multer from 'multer';
import { getAccounts } from '../../utils/account-utils';
import { statsManager } from '../../../core/stats';
import { getDb } from '@backend/services/db';
import { sendMessage, getConversationDetail } from '@backend/services/chat.service';
import { uploadFileController } from '@backend/controllers/upload.controller';
import { validateProviderCapabilities } from '@backend/utils/chat-validator';
import { ChatRequestSchema } from '@backend/types';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Provider module cache
const providerModuleCache: Map<string, any> = new Map();
// @ts-ignore
const providerModules = import.meta.glob('@backend/provider/*/index.ts', { eager: true });

// Register new backend providers into the shared registry (for Electron bundle)
import { providerRegistry } from '@backend/provider/registry';

// Immediate registration
Object.values(providerModules).forEach((module: any) => {
  if (module.default && module.default.name) {
    providerRegistry.register(module.default);
  }
});

/**
 * Dynamically load a provider module
 */
async function loadProviderModule(providerId: string): Promise<any | null> {
  const normalizedId = providerId.toLowerCase();

  if (providerModuleCache.has(normalizedId)) {
    return providerModuleCache.get(normalizedId);
  }

  const possibleNames = [
    normalizedId,
    normalizedId.replace('-', ''),
    normalizedId === 'huggingchat' ? 'hugging-chat' : normalizedId,
  ];

  for (const name of possibleNames) {
    // Find matching key in glob result
    const match = Object.keys(providerModules).find((key) =>
      key.includes(`/provider/${name}/index.ts`),
    );

    if (match) {
      console.log(`[Chat] Loaded provider module: ${name}`);
      const module: any = providerModules[match];
      const provider = module.default || module;
      providerModuleCache.set(normalizedId, provider);
      return provider;
    }
  }

  console.warn(`[Chat] No module found for provider: ${providerId}`);
  return null;
}

/**
 * Get chat function from provider module
 */
function getChatFunction(provider: any): Function | null {
  // New Providers have handleMessage
  if (typeof provider.handleMessage === 'function') {
    return provider.handleMessage.bind(provider);
  }
  // Fallback for older direct exports
  if (typeof provider.chatCompletionStream === 'function') {
    return provider.chatCompletionStream;
  }
  if (typeof provider.sendMessage === 'function') {
    return provider.sendMessage;
  }
  return null;
}

// GET /v1/chat/history/:account_id/:conversation_id - Get conversation detail
router.get('/history/:account_id/:conversation_id', async (req: Request, res: Response) => {
  try {
    const { account_id, conversation_id } = req.params;

    const db = getDb();
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(account_id) as any;

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
        conversationId: conversation_id,
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
    console.error('Error in getChatHistoryController', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: { code: 'INTERNAL_ERROR' },
      meta: { timestamp: new Date().toISOString() },
    });
  }
});

// POST /v1/chat/accounts/:accountId/uploads - Upload file
router.post('/accounts/:accountId/uploads', upload.single('file'), (req, res) =>
  uploadFileController(req as any, res as any),
);

// POST /v1/chat/accounts/:accountId/messages - Send message via unified API
router.post('/accounts/:accountId/messages', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    let validatedBody;
    try {
      // @ts-ignore
      validatedBody = ChatRequestSchema.parse(req.body);
    } catch (error: any) {
      res.status(400).json({ error: 'Invalid request body', details: error.errors });
      return;
    }

    const {
      model,
      messages,
      conversation_id,
      conversationId,
      stream,
      search,
      ref_file_ids,
      thinking,
      temperature,
    } = validatedBody;
    const finalConversationId = conversationId || conversation_id;

    // Support legacy conversationId field if conversation_id is missing, or unify handling.
    // The schema defines conversation_id. Only conversation_id is in the new schema.
    // If frontend sends conversationId, we might need to handle it or update frontend to send conversation_id.
    // However, looking at previous code: "conversationId" was destructured.
    // Let's ensure the schema supports what frontend sends.

    console.log('[API] POST /messages body:', JSON.stringify(req.body, null, 2));

    const db = getDb();
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;

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
    let accumulatedThinking = '';
    let accumulatedMetadata: any = {};

    try {
      await sendMessage({
        credential: account.credential,
        provider_id: account.provider_id,
        accountId, // Pass accountId here
        model,
        messages,
        conversationId: finalConversationId,
        stream: stream !== false,
        search: ref_file_ids && ref_file_ids.length > 0 ? false : search,
        ref_file_ids,
        thinking,
        temperature,
        onContent: (content) => {
          if (stream !== false) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          } else {
            accumulatedContent += content;
          }
        },
        onThinking: (chunk) => {
          if (stream !== false) {
            res.write(`data: ${JSON.stringify({ thinking: chunk })}\n\n`);
          } else {
            accumulatedThinking += chunk;
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
              let finalContent = accumulatedContent;
              if (accumulatedThinking) {
                finalContent = `<thinking>${accumulatedThinking}</thinking>\n\n${accumulatedContent}`;
              }

              res.status(200).json({
                success: true,
                message: {
                  role: 'assistant',
                  content: finalContent,
                },
                metadata: accumulatedMetadata,
              });
            }
          }
        },
        onError: (error) => {
          console.error('Stream error', error);
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
      console.error('Error in sendMessage service call', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  } catch (error) {
    console.error('Error in sendMessageController', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

router.post('/completions', async (req, res) => {
  try {
    const { model, messages, search, conversation_id, ref_file_ids } = req.body;

    const authHeader = req.headers.authorization;
    const emailQuery = req.query.email as string;
    const providerQuery = req.query.provider as string;

    const accounts = getAccounts();
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

    // Strategy 3: Dynamic inference using provider keywords (REMOVED)
    // Removed logic relies on model_keywords which is gone.

    if (!account && providerQuery && emailQuery) {
      // This logic was partly duplicated in strategy 2, but Strategy 2 uses explicit providerQuery.
      // The original Strategy 2 code:
      // if (!account && providerQuery && emailQuery) { ... }
      // This block seems redundant if Strategy 2 covers it, or it was meant to be fallback for targetProvider.
      // Since targetProvider is providerQuery here, we can ignore this separate block if Strategy 2 covers it.
    }

    // Strategy 4: Default to first active account of inferred provider
    const targetProvider = providerQuery;
    if (!account && targetProvider) {
      account = accounts.find((a) => a.provider_id.toLowerCase() === targetProvider!.toLowerCase());
    }

    if (!account) {
      res.status(401).json({ error: 'No valid account found for this request' });
      return;
    }

    // Validate capabilities
    const validationError = await validateProviderCapabilities(account.provider_id, { search });
    if (validationError) {
      res.status(403).json({ error: validationError });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    statsManager.trackRequest();

    // Load provider module dynamically
    const providerModule = await loadProviderModule(account.provider_id);

    if (!providerModule) {
      res.write(`data: {"error": "Provider module not found: ${account.provider_id}"}\n\n`);
      res.end();
      return;
    }

    const chatFn = getChatFunction(providerModule);

    if (!chatFn) {
      res.write(`data: {"error": "Chat function not found for: ${account.provider_id}"}\n\n`);
      res.end();
      return;
    }

    // Standard callbacks
    const callbacks = {
      onContent: (content: string) => {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
      },
      onMetadata: (metadata: any) => {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: metadata }] })}\n\n`);
      },
      onDone: () => {
        res.write('data: [DONE]\n\n');
        res.end();
      },
      onError: (err: Error) => {
        console.error('Stream Error:', err);
        res.write(`data: ${JSON.stringify({ error: { message: err.message } })}\n\n`);
        res.end();
      },
      onRaw: (data: string) => {
        res.write(`data: ${data}\n\n`);
      },
      onSessionCreated: (sessionId: string) => {
        res.write(`event: session_created\ndata: ${sessionId}\n\n`);
      },
      onThinking: (content: string) => {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { thinking: content } }] })}\n\n`);
      },
    };

    const userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    // Call chat function with various signatures
    // Different providers have different signatures, we try common ones
    try {
      // Check if it's a special provider that takes (req, res, account)
      if (chatFn.length === 3) {
        await chatFn(req, res, account);
        return;
      }

      // Most providers: chatCompletionStream(credential, payload, userAgent, callbacks)
      await chatFn(
        account.credential,
        {
          model,
          messages,
          stream: true,
          search,
          conversation_id,
          ref_file_ids,
          chatId: conversation_id,
        },
        userAgent,
        callbacks,
      );
    } catch (error: any) {
      console.error(`[Chat] Error calling chat function for ${account.provider_id}:`, error);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: { message: error.message } })}\n\n`);
        res.end();
      }
    }
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

export default router;
