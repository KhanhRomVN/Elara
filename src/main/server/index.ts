import express from 'express';
import cors from 'cors';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { Account } from '../ipc/accounts';
import { chatCompletionStream as deepseekChat } from './deepseek';
import { chatCompletionStream as claudeChat } from './claude';
import { statsManager } from '../core/stats';

const DATA_FILE = path.join(app.getPath('userData'), 'accounts.json');

let server: any = null;
const API_PORT = 11434; // Using Ollama-like port
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
  } catch (e) {
    console.error('[Server] Failed to update account stats:', e);
  }
};

const expressApp = express();
expressApp.use(cors());
expressApp.use(express.json());

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
    ],
  });
});

expressApp.post('/v1/chat/completions', async (req, res) => {
  try {
    const { model, messages, stream, thinking, search } = req.body;

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
      return res.status(500).json({ error: 'Accounts database not found' });
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
      const inferredProvider = model.includes('claude') ? 'Claude' : 'DeepSeek';
      const finalProvider = targetProvider || inferredProvider;
      account = accounts.find((a) => a.provider === finalProvider && a.status === 'Active');
    }

    if (!account) {
      return res.status(401).json({ error: 'No valid account found for this request' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    statsManager.trackRequest();

    const startTime = Date.now();
    let requestTokens = 0;

    const callbacks = {
      onContent: (content: string) => {
        // Estimate token count - very rough approximation (4 chars ~= 1 token)
        // Ideally the provider would return usage stats
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
        console.error(`[Server] ${account?.provider} Error:`, err);
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
        { model, messages, stream: true, thinking, search },
        account.userAgent,
        callbacks,
      );
    } else if (account.provider === 'Claude') {
      await claudeChat(
        account.credential,
        { model, messages, stream: true },
        account.userAgent,
        callbacks,
      );
    } else {
      res.write(`data: {"error": "Provider not supported"}\n\n`);
      res.end();
    }
  } catch (error: any) {
    console.error('[Server] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

export const startServer = () => {
  if (server) return { success: true, port: API_PORT, message: 'Server already running' };

  return new Promise((resolve) => {
    server = expressApp.listen(API_PORT, () => {
      resolve({ success: true, port: API_PORT });
    });
    server.on('error', (e: any) => {
      if (e.code === 'EADDRINUSE') {
        resolve({ success: true, port: API_PORT, message: 'Joined existing server' });
      } else {
        console.error('[Server] Start Error:', e);
        resolve({ success: false, error: e.message });
      }
    });
  });
};

export const stopServer = () => {
  if (!server) return { success: false, message: 'Server not running' };

  server.close();
  server = null;
  return { success: true };
};
