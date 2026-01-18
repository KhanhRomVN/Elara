import express, { Request, Response } from 'express';
import { getAccounts } from '../../utils/account-utils';
import { statsManager } from '../../../core/stats';
import { getDb } from '@backend/services/db';
import { sendMessage } from '@backend/services/chat.service';

import { chatCompletionStream as deepseekChat } from '../../deepseek';
import { chatCompletionStream as claudeChat } from '../../claude';
import { chatCompletionStream as mistralChat } from '../../mistral';
// import { sendMessage as kimiChat } from '../../kimi';
import { sendMessage as qwenChat } from '../../qwen';
import { chatCompletionStream as perplexityChat } from '../../perplexity';
import { sendMessage as cohereChat } from '../../cohere';
import { chatCompletionStream as groqChat } from '../../groq';
import { chatCompletionStream as antigravityChat } from '../../antigravity';
import { chatCompletionStream as huggingChatChat } from '../../hugging-chat';
import { chatCompletionStream as lmArenaChatCompletionStream } from '../../lmarena';
import { chatCompletionStream as stepFunChat } from '../../stepfun';
import * as gemini from '../../gemini';

const router = express.Router();

// POST /v1/chat/accounts/:accountId/messages - Send message via unified API
router.post('/accounts/:accountId/messages', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    const { model, messages, conversationId, stream } = req.body;

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

    const accounts = getAccounts();
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
          a.provider_id.toLowerCase() === providerQuery.toLowerCase(),
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
          a.provider_id.toLowerCase() === targetProvider.toLowerCase() &&
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
                        : model.includes('gemini') && !model.includes('antigravity')
                          ? 'Gemini'
                          : model.includes('step')
                            ? 'StepFun'
                            : null;

      if (inferredProvider) {
        account = accounts.find((a) => a.provider_id === inferredProvider);
      }
    }

    // Strategy 4: Fallback for generic models if no provider found yet? (Usually won't match)

    if (!account) {
      res.status(401).json({ error: 'No valid account found for this request' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    statsManager.trackRequest();

    const callbacks = {
      onContent: (content: string) => {
        // requestTokens += 1; // Estimation
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
      },
      onMetadata: (metadata: any) => {
        // Write metadata directly to stream
        res.write(`data: ${JSON.stringify({ choices: [{ delta: metadata }] })}\n\n`);
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
        res.write(`data: ${JSON.stringify({ error: { message: err.message } })}\n\n`);
        res.end();
      },
    };

    if (account.provider_id === 'DeepSeek') {
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
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
    } else if (account.provider_id === 'Claude') {
      await claudeChat(
        account.credential,
        {
          model,
          messages,
          stream: true,
          conversation_id,
          parent_message_id,
        },
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        callbacks,
      );
    } else if (account.provider_id === 'Mistral') {
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
    } else if (account.provider_id === 'Kimi') {
      // await kimiChat(account.credential, model, messages, callbacks.onContent);
      throw new Error('Kimi chat is not yet fully implemented');
      callbacks.onDone();
    } else if (account.provider_id === 'Qwen') {
      await qwenChat(account.credential, model, messages, callbacks.onContent);
      callbacks.onDone();
    } else if (account.provider_id === 'Cohere') {
      await cohereChat(account.credential, model, messages, callbacks.onContent);
      callbacks.onDone();
    } else if (account.provider_id === 'Perplexity') {
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
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        {
          onContent: (content) => {
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
          },
          onMetadata: (metadata) => {
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { ...metadata } }] })}\n\n`);
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
    } else if (account.provider_id === 'Groq') {
      await groqChat(req, res, account);
      return;
    } else if (account.provider_id === 'Gemini') {
      await gemini.chatCompletionStream(req, res, account);
      return;
    } else if (account.provider_id === 'Antigravity') {
      await antigravityChat(req, res, account);
      return;
    } else if (account.provider_id === 'HuggingChat') {
      await huggingChatChat(req, res, account);
      return;
    } else if (account.provider_id === 'LMArena') {
      await lmArenaChatCompletionStream(req, res, account);
      return;
    } else if (account.provider_id === 'StepFun') {
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
