import express from 'express';
import multer from 'multer';
import { getAccountSelector } from '../../services/account-selector';
import {
  sendMessageController,
  getChatHistoryController,
} from '../../controllers/chat.controller';
import { uploadFileController } from '../../controllers/upload.controller';

import { chatCompletionStream as deepseekChat } from '../../services/chat/deepseek.service';
import { chatCompletionStream as claudeChat } from '../../services/chat/claude.service';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/history/:accountId/:conversationId', getChatHistoryController);
router.post('/accounts/:accountId/messages', sendMessageController);
router.post(
  '/accounts/:accountId/uploads',
  upload.single('file'),
  uploadFileController,
);

router.post('/completions', async (req, res) => {
  try {
    const {
      model,
      messages,
      thinking,
      search,
      conversation_id,
      parent_message_id,
      temperature,
      ref_file_ids,
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

    // Strategy 2: Find by explicit Provider + Email (Recommended)
    if (!account && providerQuery && emailQuery) {
      account = accounts.find(
        (a) =>
          a.email.toLowerCase() === emailQuery.toLowerCase() &&
          a.provider.toLowerCase() === providerQuery.toLowerCase(),
      );
    }

    // Strategy 2b: Find by Email + Model-inferred provider (Legacy/Fallback)
    // Determine provider from model name if not explicitly passed
    let targetProvider = providerQuery;
    if (!targetProvider) {
      if (model.includes('claude')) targetProvider = 'Claude';
      else if (model.includes('deepseek')) targetProvider = 'DeepSeek';
    }

    const targetEmail = emailQuery;

    if (!account && targetProvider && targetEmail) {
      account = accounts.find(
        (a) =>
          a.provider.toLowerCase() === targetProvider.toLowerCase() &&
          a.email.toLowerCase() === targetEmail.toLowerCase(),
      );
    }

    // Strategy 3: Default to first active account of requested model's provider
    if (!account) {
      const inferredProvider = model.includes('claude')
        ? 'Claude'
        : model.includes('deepseek')
          ? 'DeepSeek'
          : model.includes('mistral')
            ? 'Mistral'
            : model.includes('moonshot')
              ? 'Kimi'
              : model.includes('qwen')
                ? 'Qwen'
                : model.includes('command')
                  ? 'Cohere'
                  : model.includes('perplexity') || model.includes('pplx')
                    ? 'Perplexity'
                    : model.includes('llama') ||
                        model.includes('mixtral') ||
                        model.includes('gemma') ||
                        model.includes('groq')
                      ? 'Groq'
                      : model.includes('gemini') &&
                          !model.includes('antigravity')
                        ? 'Gemini'
                        : model.includes('step')
                          ? 'StepFun'
                          : null;

      if (inferredProvider) {
        account = accounts.find(
          (a) => a.provider === inferredProvider && a.status === 'Active',
        );
      }
    }

    // Strategy 4: Fallback for generic models if no provider found yet? (Usually won't match)

    if (!account) {
      res
        .status(401)
        .json({ error: 'No valid account found for this request' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const callbacks = {
      onContent: (content: string) => {
        // requestTokens += 1; // Estimation
        res.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
        );
      },
      onMetadata: (metadata: any) => {
        // Write metadata directly to stream
        res.write(
          `data: ${JSON.stringify({ choices: [{ delta: metadata }] })}\n\n`,
        );
      },
      onDone: () => {
        res.write('data: [DONE]\n\n');
        res.end();
      },
      onError: (err: Error) => {
        res.write(
          `data: ${JSON.stringify({ error: { message: err.message } })}\n\n`,
        );
        res.end();
      },
    };

    if (account.provider === 'DeepSeek') {
      await deepseekChat(
        account.credential,
        {
          model,
          messages,
          stream: true,
          thinking,
          search,
          conversation_id,
          parent_message_id,
          ref_file_ids,
        },
        account.userAgent,
        {
          ...callbacks,
          onRaw: (data) => {
            res.write(`data: ${data}\n\n`);
          },
          onSessionCreated: (sessionId) => {
            res.write(`event: session_created\ndata: ${sessionId}\n\n`);
          },
        },
      );
    } else if (account.provider === 'Claude') {
      await claudeChat(
        account.credential,
        {
          model,
          messages,
          stream: true,
          conversation_id,
          parent_message_id,
        },
        account.userAgent,
        callbacks,
      );
    } else {
      res.write(`data: {"error": "Provider not supported"}\n\n`);
      res.end();
    }
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

export default router;
