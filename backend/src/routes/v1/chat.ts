import express from 'express';
import { getAccountSelector } from '../../services/account-selector';
import {
  sendMessageController,
  getChatHistoryController,
} from '../../controllers/chat.controller';

import { chatCompletionStream as deepseekChat } from '../../services/chat/deepseek.service';
import { chatCompletionStream as claudeChat } from '../../services/chat/claude.service';
import { chatCompletionStream as mistralChat } from '../../services/chat/mistral.service';
// import { sendMessage as kimiChat } from '../../services/chat/kimi.service';
import { sendMessage as qwenChat } from '../../services/chat/qwen.service';
import { chatCompletionStream as perplexityChat } from '../../services/chat/perplexity.service';
import { sendMessage as cohereChat } from '../../services/chat/cohere.service';
import { chatCompletionStream as groqChat } from '../../services/chat/groq.service';
import { chatCompletionStream as antigravityChat } from '../../services/chat/antigravity.service';
import { chatCompletionStream as huggingChatChat } from '../../services/chat/hugging-chat.service';
import { chatCompletionStream as lmArenaChatCompletionStream } from '../../services/chat/lmarena.service';
import { chatCompletionStream as stepFunChat } from '../../services/chat/stepfun.service';
import * as gemini from '../../services/chat/gemini.service';

const router = express.Router();

router.get('/history/:accountId/:conversationId', getChatHistoryController);
router.post('/accounts/:accountId/messages', sendMessageController);

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
      else if (model.includes('mistral')) targetProvider = 'Mistral';
      else if (model.includes('moonshot')) targetProvider = 'Kimi';
      else if (model.includes('qwen')) targetProvider = 'Qwen';
      else if (model.includes('command')) targetProvider = 'Cohere';
      else if (model.includes('perplexity') || model.includes('pplx'))
        targetProvider = 'Perplexity';
      else if (model.startsWith('gemini') && !model.includes('antigravity'))
        targetProvider = 'Gemini';
      else if (
        model.includes('llama') ||
        model.includes('mixtral') ||
        model.includes('gemma') ||
        model.includes('groq')
      )
        targetProvider = 'Groq';
      // Antigravity models usually prefixed or unique? Assuming 'Antigravity' if explicit
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
        : model.includes('gpt') || model === 'auto'
          ? 'ChatGPT'
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
        // const duration = Date.now() - startTime;
        // updateAccountStats(account!.id, {
        //   tokens: requestTokens,
        //   duration,
        //   success: true,
        // });
        res.write('data: [DONE]\n\n');
        res.end();
      },
      onError: (err: Error) => {
        console.error('Stream Error:', err);
        // updateAccountStats(account!.id, {
        //   tokens: requestTokens,
        //   duration: Date.now() - startTime,
        //   success: false,
        // });
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
            // Pass through raw data (events) if needed, format: `data: ...`
            // The deepseek implementation might expect to control the writing or return callbacks
            // Here we are reusing the callbacks pattern.
            // If deepseekChat calls onRaw, we write it locally?
            // Actually deepseek implementation in this codebase seems to write its own logic or use these callbacks.
            // Checking original index.ts: it had `onRaw`, `onSessionCreated` etc.

            // We need to support `onSessionCreated` which was sending `event: session_created ...`?
            // Original:
            /*
                onRaw: (data) => {
                   res.write(data);
                 },
                 onSessionCreated: (sessionId) => {
                   res.write(`event: session_created\ndata: ${sessionId}\n\n`);
                 },
               */
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
    } else if (account.provider === 'Mistral') {
      await mistralChat(
        account.credential,
        {
          model,
          messages,
          chatId: conversation_id,
        },
        {
          onContent: callbacks.onContent,
          onMetadata: callbacks.onMetadata,
          onDone: callbacks.onDone,
          onError: callbacks.onError,
        },
      );
    } else if (account.provider === 'Kimi') {
      // await kimiChat(account.credential, model, messages, callbacks.onContent);
      throw new Error('Kimi chat is not yet fully implemented');
      callbacks.onDone();
    } else if (account.provider === 'Qwen') {
      await qwenChat(account.credential, model, messages, callbacks.onContent);
      callbacks.onDone();
    } else if (account.provider === 'Cohere') {
      await cohereChat(
        account.credential,
        model,
        messages,
        callbacks.onContent,
      );
      callbacks.onDone();
    } else if (account.provider === 'Perplexity') {
      // Check for Perplexity context in previous messages
      let perplexityContext: any = {};
      if (model.includes('perplexity') || model.includes('pplx')) {
        const lastAssistantMessage = [...messages]
          .reverse()
          .find((m) => m.role === 'assistant' && (m as any).backend_uuid);
        if (lastAssistantMessage) {
          perplexityContext = {
            last_backend_uuid: (lastAssistantMessage as any).backend_uuid,
            read_write_token: (lastAssistantMessage as any).read_write_token,
            conversation_uuid: (lastAssistantMessage as any).id,
          };
        }
      }

      await perplexityChat(
        account.credential,
        {
          messages,
          model,
          temperature,
          ...perplexityContext,
        },
        account.userAgent,
        {
          onContent: (content) => {
            res.write(
              `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
            );
          },
          onMetadata: (metadata) => {
            res.write(
              `data: ${JSON.stringify({ choices: [{ delta: { ...metadata } }] })}\n\n`,
            );
          },
          onDone: () => {
            res.write('data: [DONE]\n\n');
            res.end();
          },
          onError: (error) => {
            console.error('Perplexity Chat Error:', error);
            res.write(
              `data: ${JSON.stringify({ error: { message: error.message || 'Unknown error' } })}\n\n`,
            );
            res.end();
          },
        },
      );
    } else if (account.provider === 'Groq') {
      await groqChat(req, res, account);
      return;
    } else if (account.provider === 'Gemini') {
      await gemini.chatCompletionStream(req, res, account);
      return;
    } else if (account.provider === 'Antigravity') {
      await antigravityChat(req, res, account);
      return;
    } else if (account.provider === 'HuggingChat') {
      await huggingChatChat(req, res, account);
      return;
    } else if (account.provider === 'LMArena') {
      await lmArenaChatCompletionStream(req, res, account);
      return;
    } else if (account.provider === 'StepFun') {
      await stepFunChat(req, res, account);
      return;
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
