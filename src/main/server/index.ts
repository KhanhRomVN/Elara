import express from 'express';
import cors from 'cors';
import https from 'https';
import http from 'http';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { Account } from '../ipc/accounts';
import { getProxyConfig } from './config';

import {
  chatCompletionStream as deepseekChat,
  getChatSessions,
  getChatHistory,
  stopStream,
} from './deepseek';
import {
  chatCompletionStream as claudeChat,
  getConversations,
  getConversationDetail,
  deleteConversation,
  stopResponse,
} from './claude';
import {
  chatCompletionStream as mistralChat,
  getConversations as getMistralConversations,
  getConversationDetail as getMistralConversationDetail,
} from './mistral';
import { sendMessage as kimiChat } from './kimi';
import { sendMessage as qwenChat, getChats as getQwenChats } from './qwen';
import {
  chatCompletionStream as perplexityChat,
  getConversations as getPerplexityConversations,
  getConversationDetail as getPerplexityConversationDetail,
} from './perplexity';
import { sendMessage as cohereChat } from './cohere';
import { chatCompletionStream as groqChat, getModels as getGroqModels } from './groq';
import {
  chatCompletionStream as antigravityChat,
  getModels as getAntigravityModels,
} from './antigravity';
import * as gemini from './gemini';

import { statsManager } from '../core/stats';

const DATA_FILE = path.join(app.getPath('userData'), 'accounts.json');

let server: https.Server | http.Server | null = null;
let isHttpsMode = false;
const updateAccountStats = (
  accountId: string,
  stats: { tokens: number; duration: number; success: boolean },
) => {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const index = accounts.findIndex((a) => a.id === accountId);
    if (index === -1) return;

    const account = accounts[index];
    const today = new Date().toISOString().split('T')[0];

    // Initialize if missing
    if (account.totalRequests === undefined) account.totalRequests = 0;
    if (account.successfulRequests === undefined) account.successfulRequests = 0;
    if (account.totalDuration === undefined) account.totalDuration = 0;
    if (account.tokensToday === undefined) account.tokensToday = 0;
    if (account.statsDate === undefined) account.statsDate = today;

    // Reset daily
    if (account.statsDate !== today) {
      account.tokensToday = 0;
      account.statsDate = today;
    }

    account.totalRequests++;
    if (stats.success) account.successfulRequests++;
    account.totalDuration += stats.duration;
    account.tokensToday += stats.tokens;
    account.lastActive = new Date().toISOString();

    accounts[index] = account;
    fs.writeFileSync(DATA_FILE, JSON.stringify(accounts, null, 2));
  } catch (e) {}
};

const getAccount = async (req: express.Request): Promise<Account | undefined> => {
  const authHeader = req.headers.authorization;
  const emailQuery = req.query.email as string;
  // If provider header is present we might use it, but for now generic lookup
  // In specific routes, we usually want specific provider.
  // This helper is used by Gemini routes which implies Gemini provider.
  // Actually, let's look at how it's used.
  // expressApp.get('/v1/gemini/conversations', ... const account = await getAccount(req);
  // It expects to find an account.

  if (!fs.existsSync(DATA_FILE)) return undefined;
  const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  let account: Account | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    account = accounts.find((a) => a.id === token);
  }

  if (!account && emailQuery) {
    account = accounts.find((a) => a.email.toLowerCase() === emailQuery.toLowerCase());
  }

  // If not found, and we are in a /v1/gemini route, we might default to Gemini active account
  if (!account && req.path.includes('/gemini')) {
    account = accounts.find((a) => a.provider === 'Gemini' && a.status === 'Active');
  }

  return account;
};

const expressApp = express();
expressApp.use(cors());
expressApp.use(express.json());

// Import management routes
import ManagementRouter from './routes/management';
import { getCertificateManager } from './utils/cert-manager';

// Register management routes (no auth required for localhost)
expressApp.use('/v0/management', ManagementRouter);

expressApp.get('/v1/models', (_req, res) => {
  res.json({
    object: 'list',
    data: [
      { id: 'deepseek-chat', object: 'model', created: 1677610602, owned_by: 'deepseek' },
      { id: 'deepseek-reasoner', object: 'model', created: 1677610602, owned_by: 'deepseek' },
      { id: 'claude-3-opus-20240229', object: 'model', created: 1677610602, owned_by: 'anthropic' },
      {
        id: 'claude-3-sonnet-20240229',
        object: 'model',
        created: 1677610602,
        owned_by: 'anthropic',
      },
      {
        id: 'claude-3-haiku-20240307',
        object: 'model',
        created: 1677610602,
        owned_by: 'anthropic',
      },
      {
        id: 'claude-3-haiku-20240307',
        object: 'model',
        created: 1677610602,
        owned_by: 'anthropic',
      },
      { id: 'mistral-large-latest', object: 'model', created: 1677610602, owned_by: 'mistral' },
      { id: 'moonshot-v1-8k', object: 'model', created: 1677610602, owned_by: 'moonshot' },
      { id: 'moonshot-v1-32k', object: 'model', created: 1677610602, owned_by: 'moonshot' },
      { id: 'moonshot-v1-128k', object: 'model', created: 1677610602, owned_by: 'moonshot' },
      { id: 'moonshot-v1-128k', object: 'model', created: 1677610602, owned_by: 'moonshot' },
      { id: 'qwen-max', object: 'model', created: 1677610602, owned_by: 'qwen' },
      { id: 'qwen3-max-2025-09-23', object: 'model', created: 1677610602, owned_by: 'qwen' },
      // Cohere
      { id: 'command-r7b-12-2024', object: 'model', created: 1677610602, owned_by: 'cohere' },
      // Groq
      { id: 'llama3-70b-8192', object: 'model', created: 1677610602, owned_by: 'groq' },
      { id: 'llama3-8b-8192', object: 'model', created: 1677610602, owned_by: 'groq' },
      { id: 'mixtral-8x7b-32768', object: 'model', created: 1677610602, owned_by: 'groq' },
      { id: 'gemma-7b-it', object: 'model', created: 1677610602, owned_by: 'groq' },
      // Gemini
      { id: 'gemini-pro', object: 'model', created: 1677610602, owned_by: 'google' },
      { id: 'gemini-ultra', object: 'model', created: 1677610602, owned_by: 'google' },
    ],
  });
});

expressApp.post('/v1/chat/completions', async (req, res) => {
  try {
    const { model, messages, thinking, search, conversation_id, parent_message_id, temperature } =
      req.body;

    // Priority: Headers -> Query Params
    const authHeader = req.headers.authorization;
    const providerHeader = req.headers['x-provider'] as string;
    const emailHeader = req.headers['x-email'] as string;

    // Read from query params
    const providerQuery = req.query.provider as string;
    const emailQuery = req.query.email as string;

    const targetProvider = providerHeader || providerQuery;
    const targetEmail = emailHeader || emailQuery;

    if (!fs.existsSync(DATA_FILE)) {
      res.status(500).json({ error: 'Accounts database not found' });
      return;
    }

    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

    let account: Account | undefined;

    // Strategy 1: Look up by Account ID in Bearer Token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      account = accounts.find((a) => a.id === token);
    }

    // Strategy 2: Look up by Provider + Email
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
          : model.includes('mistral')
            ? 'Mistral'
            : model.includes('moonshot')
              ? 'Kimi'
              : model.includes('qwen')
                ? 'Qwen'
                : model.includes('command')
                  ? 'Cohere'
                  : model.includes('llama') || model.includes('mixtral') || model.includes('gemma')
                    ? 'Groq'
                    : model.includes('perplexity') || model.includes('turbo')
                      ? 'Perplexity'
                      : model.includes('gemini')
                        ? 'Gemini'
                        : 'DeepSeek';
      const finalProvider = targetProvider || inferredProvider;
      account = accounts.find((a) => a.provider === finalProvider && a.status === 'Active');
    }

    if (!account) {
      res.status(401).json({ error: 'No valid account found for this request' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    statsManager.trackRequest();

    const startTime = Date.now();
    let requestTokens = 0;

    const callbacks = {
      onContent: (content: string) => {
        const estimatedTokens = Math.ceil(content.length / 4);
        statsManager.trackTokens(estimatedTokens);
        requestTokens += estimatedTokens;

        const response = {
          id: 'chatcmpl-' + Math.random().toString(36).substr(2, 9),
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: model,
          choices: [{ delta: { content }, index: 0, finish_reason: null }],
        };
        res.write(`data: ${JSON.stringify(response)}\n\n`);
      },
      onDone: () => {
        const response = {
          id: 'chatcmpl-' + Math.random().toString(36).substr(2, 9),
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: model,
          choices: [{ delta: {}, index: 0, finish_reason: 'stop' }],
        };
        res.write(`data: ${JSON.stringify(response)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        const duration = Date.now() - startTime;
        if (account)
          updateAccountStats(account.id, { tokens: requestTokens, duration, success: true });
      },
      onError: (err: Error) => {
        const errorResponse = { error: err.message };
        res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
        res.end();
        const duration = Date.now() - startTime;
        if (account)
          updateAccountStats(account.id, { tokens: requestTokens, duration, success: false });
      },
    };

    if (account.provider === 'DeepSeek') {
      await deepseekChat(
        account.credential,
        { model, messages, stream: true, thinking, search, conversation_id, parent_message_id },
        account.userAgent,
        {
          ...callbacks,
          onRaw: (data: string) => {
            // Forward raw data chunks directly
            res.write(`data: ${data}\n\n`);
          },
        },
      );
    } else if (account.provider === 'Claude') {
      await claudeChat(
        account.credential,
        { model, messages, stream: true },
        account.userAgent,
        callbacks,
      );
    } else if (account.provider === 'Mistral') {
      await mistralChat(
        account.credential,
        { model, messages, temperature: 0.7 }, // Add temperature if needed
        callbacks,
      );
    } else if (account.provider === 'Kimi') {
      await kimiChat();
    } else if (account.provider === 'Qwen') {
      await qwenChat(account.credential, model, messages, callbacks.onContent);
      callbacks.onDone();
    } else if (account.provider === 'Cohere') {
      await cohereChat(account.credential, model, messages, callbacks.onContent);
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
            conversation_uuid: (lastAssistantMessage as any).id, // Is this thread ID? API expects conversation_uuid?
            // Actually API response doesn't explicitly return conversation_uuid in entries, but getConversations returns uuid.
            // When getting details, we might need to store the conversation ID in the messages too?
            // For now, let's assume if we have backend_uuid we are good for follow up.
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
    } else if (account.provider === 'Groq') {
      await groqChat(req, res, account);
      return;
    } else if (account.provider === 'Gemini') {
      await gemini.chatCompletionStream(req, res, account);
      return;
    } else if (account.provider === 'Antigravity') {
      await antigravityChat(req, res, account);
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

// Get Claude conversation history
expressApp.get('/v1/claude/conversations', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const emailQuery = req.query.email as string;
    const limitQuery = parseInt(req.query.limit as string) || 30;

    if (!fs.existsSync(DATA_FILE)) {
      res.status(500).json({ error: 'Accounts database not found' });
      return;
    }

    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    let account: Account | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      account = accounts.find((a) => a.id === token);
    }

    if (!account && emailQuery) {
      account = accounts.find(
        (a) => a.email.toLowerCase() === emailQuery.toLowerCase() && a.provider === 'Claude',
      );
    }

    if (!account) {
      account = accounts.find((a) => a.provider === 'Claude' && a.status === 'Active');
    }

    if (!account) {
      res.status(401).json({ error: 'No valid Claude account found' });
      return;
    }

    const conversations = await getConversations(account.credential, account.userAgent, limitQuery);
    res.json(conversations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Claude conversation detail
expressApp.get('/v1/claude/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const emailQuery = req.query.email as string;

    if (!fs.existsSync(DATA_FILE)) {
      res.status(500).json({ error: 'Accounts database not found' });
      return;
    }

    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    let account: Account | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      account = accounts.find((a) => a.id === token);
    }

    if (!account && emailQuery) {
      account = accounts.find(
        (a) => a.email.toLowerCase() === emailQuery.toLowerCase() && a.provider === 'Claude',
      );
    }

    if (!account) {
      account = accounts.find((a) => a.provider === 'Claude' && a.status === 'Active');
    }

    if (!account) {
      res.status(401).json({ error: 'No valid Claude account found' });
      return;
    }

    const conversation = await getConversationDetail(account.credential, id, account.userAgent);
    res.json(conversation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Claude conversation
expressApp.delete('/v1/claude/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const emailQuery = req.query.email as string;

    if (!fs.existsSync(DATA_FILE)) {
      res.status(500).json({ error: 'Accounts database not found' });
      return;
    }

    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    let account: Account | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      account = accounts.find((a) => a.id === token);
    }

    if (!account && emailQuery) {
      account = accounts.find(
        (a) => a.email.toLowerCase() === emailQuery.toLowerCase() && a.provider === 'Claude',
      );
    }

    if (!account) {
      account = accounts.find((a) => a.provider === 'Claude' && a.status === 'Active');
    }

    if (!account) {
      res.status(401).json({ error: 'No valid Claude account found' });
      return;
    }

    await deleteConversation(account.credential, id, account.userAgent);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Qwen conversation history
expressApp.get('/v1/qwen/conversations', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const emailQuery = req.query.email as string;

    if (!fs.existsSync(DATA_FILE)) {
      res.status(500).json({ error: 'Accounts database not found' });
      return;
    }

    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    let account: Account | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      account = accounts.find((a) => a.id === token);
    }

    if (!account && emailQuery) {
      account = accounts.find(
        (a) => a.provider === 'Qwen' && a.email.toLowerCase() === emailQuery.toLowerCase(),
      );
    }

    if (!account) {
      account = accounts.find((a) => a.provider === 'Qwen' && a.status === 'Active');
    }

    if (!account) {
      res.status(401).json({ error: 'No active Qwen account found' });
      return;
    }

    const history = await getQwenChats(account.credential);
    res.json(history);
  } catch (error: any) {
    console.error('[Server] Qwen History Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get DeepSeek chat sessions history
expressApp.get('/v1/deepseek/sessions', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const emailQuery = req.query.email as string;
    const pinnedOnly = req.query.pinned === 'true';

    if (!fs.existsSync(DATA_FILE)) {
      res.status(500).json({ error: 'Accounts database not found' });
      return;
    }

    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    let account: Account | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      account = accounts.find((a) => a.id === token);
    }

    if (!account && emailQuery) {
      account = accounts.find(
        (a) => a.email.toLowerCase() === emailQuery.toLowerCase() && a.provider === 'DeepSeek',
      );
    }

    if (!account) {
      account = accounts.find((a) => a.provider === 'DeepSeek' && a.status === 'Active');
    }

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

// Get DeepSeek chat history messages
expressApp.get('/v1/deepseek/sessions/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const emailQuery = req.query.email as string;

    if (!fs.existsSync(DATA_FILE)) {
      res.status(500).json({ error: 'Accounts database not found' });
      return;
    }

    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    let account: Account | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      account = accounts.find((a) => a.id === token);
    }

    if (!account && emailQuery) {
      account = accounts.find(
        (a) => a.email.toLowerCase() === emailQuery.toLowerCase() && a.provider === 'DeepSeek',
      );
    }

    if (!account) {
      account = accounts.find((a) => a.provider === 'DeepSeek' && a.status === 'Active');
    }

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

// Get Groq models
expressApp.get('/v1/groq/models', async (req, res) => {
  try {
    const emailQuery = req.query.email as string;

    if (!fs.existsSync(DATA_FILE)) {
      res.status(500).json({ error: 'Accounts database not found' });
      return;
    }

    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    let account = accounts.find((a) => a.email === emailQuery && a.provider === 'Groq');

    if (!account) {
      account = accounts.find((a) => a.provider === 'Groq' && a.status === 'Active');
    }

    if (!account) {
      res.status(401).json({ error: 'No valid Groq account found' });
      return;
    }

    const models = await getGroqModels(account);
    res.json(models);
  } catch (error: any) {
    console.error('[Server] Get Groq Models Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Antigravity models
expressApp.get('/v1/antigravity/models', async (req, res) => {
  try {
    const emailQuery = req.query.email as string;

    if (!fs.existsSync(DATA_FILE)) {
      res.status(500).json({ error: 'Accounts database not found' });
      return;
    }

    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    let account = accounts.find((a) => a.email === emailQuery && a.provider === 'Antigravity');

    if (!account) {
      account = accounts.find((a) => a.provider === 'Antigravity' && a.status === 'Active');
    }

    if (!account) {
      res.status(401).json({ error: 'No valid Antigravity account found' });
      return;
    }

    const models = await getAntigravityModels(account);
    res.json(models);
  } catch (error: any) {
    console.error('[Server] Get Antigravity Models Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Gemini models
expressApp.get('/v1/gemini/models', async (req, res) => {
  try {
    const emailQuery = req.query.email as string;

    if (!fs.existsSync(DATA_FILE)) {
      res.status(500).json({ error: 'Accounts database not found' });
      return;
    }

    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    let account = accounts.find((a) => a.email === emailQuery && a.provider === 'Gemini');

    if (!account) {
      account = accounts.find((a) => a.provider === 'Gemini' && a.status === 'Active');
    }

    if (!account) {
      res.status(401).json({ error: 'No valid Gemini account found' });
      return;
    }

    await gemini.getModels(req, res, account);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Stop DeepSeek stream
expressApp.post('/v1/deepseek/sessions/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    const { messageId, email } = req.body;

    if (!fs.existsSync(DATA_FILE)) {
      res.status(500).json({ error: 'Accounts database not found' });
      return;
    }

    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
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

// Stop Claude response
expressApp.post('/v1/claude/conversations/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;
    const emailQuery = req.query.email as string;

    if (!fs.existsSync(DATA_FILE)) {
      res.status(500).json({ error: 'Accounts database not found' });
      return;
    }

    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const account = accounts.find(
      (a) => a.email.toLowerCase() === emailQuery?.toLowerCase() && a.provider === 'Claude',
    );

    if (!account) {
      res.status(401).json({ error: 'No valid Claude account found' });
      return;
    }

    await stopResponse(account.credential, id, account.userAgent);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Server] Stop Claude Response Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Mistral conversations
expressApp.get('/v1/mistral/conversations', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const emailQuery = req.query.email as string;

    if (!fs.existsSync(DATA_FILE)) {
      res.status(500).json({ error: 'Accounts database not found' });
      return;
    }

    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    let account: Account | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      account = accounts.find((a) => a.id === token);
    }

    if (!account && emailQuery) {
      account = accounts.find(
        (a) => a.email.toLowerCase() === emailQuery.toLowerCase() && a.provider === 'Mistral',
      );
    }

    if (!account) {
      account = accounts.find((a) => a.provider === 'Mistral' && a.status === 'Active');
    }

    if (!account) {
      res.status(401).json({ error: 'No valid Mistral account found' });
      return;
    }

    const conversations = await getMistralConversations(account.credential);
    res.json(conversations);
  } catch (error: any) {
    console.error('[Server] Get Mistral Conversations Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Mistral conversation detail
expressApp.get('/v1/mistral/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const emailQuery = req.query.email as string;

    if (!fs.existsSync(DATA_FILE)) {
      res.status(500).json({ error: 'Accounts database not found' });
      return;
    }

    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    let account: Account | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      account = accounts.find((a) => a.id === token);
    }

    if (!account && emailQuery) {
      account = accounts.find(
        (a) => a.email.toLowerCase() === emailQuery.toLowerCase() && a.provider === 'Mistral',
      );
    }

    if (!account) {
      account = accounts.find((a) => a.provider === 'Mistral' && a.status === 'Active');
    }

    if (!account) {
      res.status(401).json({ error: 'No valid Mistral account found' });
      return;
    }

    const messages = await getMistralConversationDetail(account.credential, id);
    res.json({ messages });
  } catch (error: any) {
    console.error('[Server] Get Mistral Conversation Detail Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Kimi conversations (Placeholder)
expressApp.get('/v1/kimi/conversations', async (_req, res) => {
  res.json([]);
});

// Get Kimi conversation detail (Placeholder)
expressApp.get('/v1/kimi/conversations/:id', async (_req, res) => {
  res.json({ messages: [] });
});

// Get Qwen conversations (Placeholder)
expressApp.get('/v1/qwen/conversations', async (_req, res) => {
  res.json([]);
});

// Get Qwen conversation detail (Placeholder)
expressApp.get('/v1/qwen/conversations/:id', async (_req, res) => {
  res.json({ messages: [] });
});

// Get Cohere conversations (Placeholder)
expressApp.get('/v1/cohere/conversations', async (_req, res) => {
  res.json([]);
});

expressApp.get('/v1/cohere/conversations/:id', async (_req, res) => {
  res.json({ messages: [] });
});

// Get Perplexity conversations
expressApp.get('/v1/perplexity/conversations', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const emailQuery = req.query.email as string;
    const limitQuery = parseInt(req.query.limit as string) || 20;

    if (!fs.existsSync(DATA_FILE)) {
      res.status(500).json({ error: 'Accounts database not found' });
      return;
    }

    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    let account: Account | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      account = accounts.find((a) => a.id === token);
    }

    if (!account && emailQuery) {
      account = accounts.find(
        (a) => a.email.toLowerCase() === emailQuery.toLowerCase() && a.provider === 'Perplexity',
      );
    }

    if (!account) {
      account = accounts.find((a) => a.provider === 'Perplexity' && a.status === 'Active');
    }

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

expressApp.get('/v1/perplexity/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const emailQuery = req.query.email as string;

    if (!fs.existsSync(DATA_FILE)) {
      res.status(500).json({ error: 'Accounts database not found' });
      return;
    }

    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    let account: Account | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      account = accounts.find((a) => a.id === token);
    }

    if (!account && emailQuery) {
      account = accounts.find(
        (a) => a.email.toLowerCase() === emailQuery.toLowerCase() && a.provider === 'Perplexity',
      );
    }

    if (!account) {
      account = accounts.find((a) => a.provider === 'Perplexity' && a.status === 'Active');
    }

    if (!account) {
      res.status(401).json({ error: 'No valid Perplexity account found' });
      return;
    }

    const messages = await getPerplexityConversationDetail(
      account.credential,
      id,
      account.userAgent,
    );
    res.json({ messages });
  } catch (error: any) {
    console.error('[Server] Get Perplexity Detail Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Groq conversations (Placeholder)
expressApp.get('/v1/groq/conversations', async (_req, res) => {
  res.json([]);
});

expressApp.get('/v1/groq/conversations/:id', async (_req, res) => {
  res.json({ messages: [] });
});

// Gemini Routes
expressApp.get('/v1/gemini/conversations', async (req, res) => {
  const account = await getAccount(req);
  if (!account) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  await gemini.getConversations(req, res, account);
});

expressApp.get('/v1/gemini/conversations/:id', async (req, res) => {
  const account = await getAccount(req);
  if (!account) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  await gemini.getConversation(req, res, account);
});

export const startServer = async () => {
  if (server) {
    const config = getProxyConfig();
    return { success: true, port: config.port, message: 'Server already running' };
  }

  try {
    const config = getProxyConfig();
    const port = config.port;
    const host = config.host;

    return new Promise(async (resolve) => {
      try {
        if (config.tls.enable) {
          // HTTPS mode
          const certManager = getCertificateManager();
          const certs = await certManager.ensureCertificates();

          const httpsOptions = {
            cert: fs.readFileSync(certs.cert),
            key: fs.readFileSync(certs.key),
          };

          server = https.createServer(httpsOptions, expressApp);
          isHttpsMode = true;
        } else {
          // HTTP mode
          server = http.createServer(expressApp);
          isHttpsMode = false;
        }

        server.listen(port, host, () => {
          resolve({ success: true, port, https: config.tls.enable });
        });

        server.on('error', (e: any) => {
          if (e.code === 'EADDRINUSE') {
            console.error(`[Server] Port ${port} is already in use`);
            resolve({
              success: false,
              error: `Port ${port} is already in use`,
              code: 'EADDRINUSE',
            });
          } else {
            console.error('[Server] Start Error:', e);
            resolve({ success: false, error: e.message });
          }
        });
      } catch (error: any) {
        console.error('[Server] Failed to start:', error);
        resolve({ success: false, error: error.message });
      }
    });
  } catch (error: any) {
    console.error('[Server] Configuration error:', error);
    return { success: false, error: error.message };
  }
};

export const stopServer = () => {
  if (!server) return { success: false, message: 'Server not running' };

  return new Promise((resolve) => {
    server?.close(() => {
      server = null;
      isHttpsMode = false;
      resolve({ success: true });
    });
  });
};

export const getServerInfo = () => {
  const config = getProxyConfig();
  return {
    running: server !== null,
    port: config.port,
    host: config.host,
    https: config.tls.enable,
    strategy: config.routing.strategy,
    localhostOnly: config.localhostOnly,
  };
};
