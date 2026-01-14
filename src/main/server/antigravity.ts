import http from 'http';
import https from 'https';
import crypto from 'crypto';
import importUrls from 'url';
const { URLSearchParams } = importUrls;
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// Use dynamic import for node-fetch to support ESM in CJS context
const fetch = async (url: any, init?: any) => {
  const { default: fetch } = await import('node-fetch');
  return fetch(url, init);
};
import { Account } from '../ipc/accounts';

const CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
// Updated to Production environment as per Antigravity-Manager
const BASE_URL = 'https://cloudcode-pa.googleapis.com';

// Force IPv4 to avoid EHOSTUNREACH on IPv6
const httpsAgent = new https.Agent({ family: 4 });

export class AntigravityAuthServer {
  private server: http.Server | null = null;
  private port = 0;

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((_req, res) => {
        // We'll handle callbacks elsewhere or here if needed,
        // but for now this is just to reserve a port and show success.
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          '<h1>Login Successful!</h1><p>You can close this window and return to the app.</p>',
        );
      });

      this.server.on('error', (err) => reject(err));

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server?.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
          const redirectUri = `http://127.0.0.1:${this.port}/callback`;

          const params = new URLSearchParams({
            client_id: CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: [
              'https://www.googleapis.com/auth/cloud-platform',
              'https://www.googleapis.com/auth/userinfo.email',
              'https://www.googleapis.com/auth/userinfo.profile',
              'https://www.googleapis.com/auth/cclog',
              'https://www.googleapis.com/auth/experimentsandconfigs',
            ].join(' '),
            access_type: 'offline',
            prompt: 'consent',
          });

          resolve(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
        } else {
          reject(new Error('Failed to get server address'));
        }
      });
    });
  }

  async waitForCode(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        return reject(new Error('Server not started'));
      }

      const requestListener = (req: http.IncomingMessage, _res: http.ServerResponse) => {
        if (req.url?.startsWith('/callback')) {
          const query = url.parse(req.url, true).query;
          if (query.code) {
            resolve(query.code as string);
          } else {
            reject(new Error('No code found in callback'));
          }
        }
      };

      this.server.on('request', requestListener);
    });
  }

  async exchangeCode(code: string): Promise<any> {
    const redirectUri = `http://127.0.0.1:${this.port}/callback`;
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
      agent: httpsAgent,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token exchange failed: ${text}`);
    }

    return await res.json();
  }

  async getUserInfo(accessToken: string): Promise<any> {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      agent: httpsAgent,
    });
    if (!res.ok) throw new Error('Failed to fetch user info');
    return await res.json();
  }

  static async refreshAccessToken(refreshToken: string): Promise<any> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      agent: httpsAgent,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token refresh failed: ${text}`);
    }
    return await res.json();
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

// --- Chat Completion Logic ---

const ensureAccessToken = async (account: Account): Promise<string> => {
  let creds: any;
  try {
    creds = JSON.parse(account.credential);
  } catch {
    return account.credential;
  }
  return creds.access_token;
};

const updateAccountCredentials = async (account: Account, newTokens: any) => {
  const fs = require('fs');
  const path = require('path');
  const { app } = require('electron');
  const DATA_FILE = path.join(app.getPath('userData'), 'accounts.json');

  if (fs.existsSync(DATA_FILE)) {
    const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const idx = accounts.findIndex((a) => a.id === account.id);
    if (idx !== -1) {
      let oldCreds = {};
      try {
        oldCreds = JSON.parse(accounts[idx].credential);
      } catch {}

      const updatedCreds = { ...oldCreds, ...newTokens };
      accounts[idx].credential = JSON.stringify(updatedCreds);
      fs.writeFileSync(DATA_FILE, JSON.stringify(accounts, null, 2));

      // Update the in-memory object reference passed to us
      account.credential = accounts[idx].credential;
    }
  }
};

export const getModels = async (account: Account) => {
  console.log('[Antigravity] getModels called');
  let accessToken = await ensureAccessToken(account);
  const cachePath = path.join(app.getPath('userData'), 'antigravity_models_cache.json');

  const defaultModels = {
    models: {
      'gemini-3-pro-preview': {
        name: 'gemini-3-pro-preview',
        displayName: 'Gemini 3 Pro (Preview)',
        description: 'Complex reasoning, coding, and creative collaboration',
        supportedGenerationMethods: ['generateContent', 'countTokens'],
        inputTokenLimit: 32768,
        outputTokenLimit: 8192,
      },
      'gemini-3-flash-preview': {
        name: 'gemini-3-flash-preview',
        displayName: 'Gemini 3 Flash (Preview)',
        description: 'Fast and versatile performance for diverse tasks',
        supportedGenerationMethods: ['generateContent', 'countTokens'],
        inputTokenLimit: 32768,
        outputTokenLimit: 8192,
      },
    },
  };

  const fetchModels = async (token: string) => {
    // Only fetch from daily-cloudcode-pa, no need for project ID in body for this call usually?
    // CLIProxyAPI sends { project: projectID } in body for fetchAvailableModels.
    // Random project ID works for list? Or we need real one?
    // CLIProxyAPI: `httpReq, errReq := http.NewRequestWithContext(ctx, http.MethodPost, modelsURL, bytes.NewReader([]byte(`{}`)))`
    // Wait, CLIProxyAPI sends EMPTY JSON `{}` for fetchAvailableModels!

    console.log(`[Antigravity] Fetching models...`);
    const res = await fetch(`${BASE_URL}/v1internal:fetchAvailableModels`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'antigravity/1.11.3 Darwin/arm64',
      },
      body: JSON.stringify({}), // Empty body as per CLIProxyAPI
      agent: httpsAgent,
    });

    console.log(`[Antigravity] fetchAvailableModels Status: ${res.status}`);

    if (res.status === 401) throw new Error('401');
    if (!res.ok) {
      const txt = await res.text();
      console.error(`[Antigravity] fetchAvailableModels Error: ${txt}`);
      throw new Error(`Failed to fetch models: ${res.status} ${txt}`);
    }
    const data = (await res.json()) as any;
    console.log(
      '[Antigravity] fetchAvailableModels Success, models count:',
      data.models ? Object.keys(data.models).length : 'N/A',
    );

    if (data.models) {
      Object.entries(data.models).forEach(([key, val]: [string, any]) => {
        let usageStr = '';
        if (val.quotaInfo) {
          usageStr = ` - Quota: ${JSON.stringify(val.quotaInfo)}`;
        }
        console.log(`[Antigravity] Model: ${key}${usageStr}`);
      });
      // Save to cache
      try {
        fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
      } catch (err) {
        console.error('[Antigravity] Failed to save cache:', err);
      }
    }

    return data;
  };

  try {
    try {
      return await fetchModels(accessToken);
    } catch (e: any) {
      if (e.message === '401') {
        console.log('[Antigravity] Token expired, refreshing for getModels...');
        const creds = JSON.parse(account.credential);
        if (creds.refresh_token) {
          const newTokens = await AntigravityAuthServer.refreshAccessToken(creds.refresh_token);
          await updateAccountCredentials(account, newTokens);
          return await fetchModels(newTokens.access_token);
        }
      }
      throw e;
    }
  } catch (err) {
    console.warn('[Antigravity] API failed, attempting fallback:', err);
    try {
      if (fs.existsSync(cachePath)) {
        console.log('[Antigravity] Loading models from cache');
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
        if (cached && cached.models) return cached;
      }
    } catch (cacheErr) {
      console.error('[Antigravity] Failed to load cache:', cacheErr);
    }

    console.log('[Antigravity] Using default hardcoded models');
    return defaultModels;
  }
};

const projectIDCache = new Map<string, string>();

const generateUUID = () => crypto.randomUUID();

const generateProjectID = () => {
  const adjectives = ['useful', 'bright', 'swift', 'calm', 'bold'];
  const nouns = ['fuze', 'wave', 'spark', 'flow', 'core'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomPart = generateUUID().substring(0, 5);
  return `${adj}-${noun}-${randomPart}`;
};

const fetchProjectID = async (accessToken: string): Promise<string> => {
  if (projectIDCache.has(accessToken)) {
    return projectIDCache.get(accessToken)!;
  }

  console.log('[Antigravity] Fetching real Project ID via loadCodeAssist...');

  const payload = {
    metadata: {
      ideType: 'IDE_UNSPECIFIED',
      platform: 'PLATFORM_UNSPECIFIED',
      pluginType: 'GEMINI',
    },
  };

  const res = await fetch(`${BASE_URL}/v1internal:loadCodeAssist`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'antigravity/1.11.3 Darwin/arm64',
      'X-Goog-Api-Client': 'antigravity/1.11.3',
    },
    body: JSON.stringify(payload),
    agent: httpsAgent,
  });

  if (!res.ok) {
    const txt = await res.text();
    console.warn(`[Antigravity] Failed to fetch real Project ID: ${res.status} ${txt}`);
    // Fallback to random if fetch fails
    return generateProjectID();
  }

  const data = (await res.json()) as any;
  // logic from CLIProxyAPI:
  // 1. cloudaicompanionProject (string)
  // 2. cloudaicompanionProject.id (string)

  let pid = '';
  if (typeof data.cloudaicompanionProject === 'string') {
    pid = data.cloudaicompanionProject;
  } else if (data.cloudaicompanionProject && data.cloudaicompanionProject.id) {
    pid = data.cloudaicompanionProject.id;
  }

  if (pid) {
    console.log(`[Antigravity] Got real Project ID: ${pid}`);
    projectIDCache.set(accessToken, pid);
    return pid;
  }

  console.warn(
    '[Antigravity] No project ID found in loadCodeAssist response, falling back to random.',
  );
  return generateProjectID();
};

// Generates a stable session ID based on content hash, similar to CLIProxyAPI
const generateStableSessionID = (messages: any[]): string => {
  // Try to find the first user message text
  const firstUserMsg = messages.find((m) => m.role === 'user');
  let text = '';
  if (firstUserMsg) {
    text = firstUserMsg.content || '';
  } else {
    // fallback random
    return '-' + Math.floor(Math.random() * 9000000000000000000).toString();
  }

  const hash = crypto.createHash('sha256').update(text).digest('hex');
  // Take first 8 bytes (16 chars in hex)
  const hexFirst8 = hash.substring(0, 16);
  // Convert to int64 (approx) - just need a large number
  const n = BigInt(`0x${hexFirst8}`) & BigInt('0x7FFFFFFFFFFFFFFF');
  return '-' + n.toString();
};

const alias2ModelName = (modelName: string): string => {
  // Mapping based on CLIProxyAPI
  // UI -> API
  switch (modelName) {
    case 'gemini-3-pro-preview':
      return 'gemini-3-pro-high';
    case 'gemini-3-flash-preview':
      return 'gemini-3-flash';
    default:
      return modelName;
  }
};

export const chatCompletionStream = async (req: any, res: any, account: Account) => {
  console.log('[Antigravity] chatCompletionStream called');
  const { model, messages, temperature } = req.body;
  console.log(`[Antigravity] Request Model (UI): ${model}`);

  // 1. Resolve Model Name
  let targetModel = model;
  if (targetModel.startsWith('models/')) targetModel = targetModel.replace('models/', '');
  targetModel = alias2ModelName(targetModel);

  console.log(`[Antigravity] Resolved Target Model (API): ${targetModel}`);

  let accessToken = await ensureAccessToken(account);

  const convertMessages = (msgs: any[]) => {
    return msgs.map((m) => {
      const parts = [];
      if (m.content) {
        parts.push({ text: m.content });
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: parts,
      };
    });
  };

  const makeRequest = async (token: string) => {
    // USE REAL PROJECT ID
    const projectID = await fetchProjectID(token);
    const sessionID = generateStableSessionID(messages);

    // Construct payload matching CLIProxyAPI structure
    const payload: any = {
      model: targetModel,
      userAgent: 'antigravity',
      requestType: 'agent',
      project: projectID,
      requestId: 'agent-' + generateUUID(),
      request: {
        sessionId: sessionID,
        contents: convertMessages(messages),
        toolConfig: {
          functionCallingConfig: {
            mode: 'VALIDATED',
          },
        },
        generationConfig: {
          temperature: temperature || 0.7,
          maxOutputTokens: 8192,
          candidateCount: 1,
          thinkingConfig: {
            thinkingBudget: 1024,
            include_thoughts: true,
          },
        },
        // IMPORTANT: No safetySettings
      },
    };

    // Add logic to strip thinking config if model doesn't support it or adjust budget
    // CLIProxyAPI has extensive logic here. For now, we assume gemini-3-pro-preview/high supports it.
    // If using flash, maybe remove it?
    if (!targetModel.includes('gemini-3-pro')) {
      // simplistic check, ideally use list of thinking models
      delete payload.request.generationConfig.thinkingConfig;
    }

    console.log('[Antigravity] Chat Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${BASE_URL}/v1internal:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'antigravity/1.11.3 Darwin/arm64',
        'x-goog-api-client': 'antigravity/1.11.3',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(payload),
      agent: httpsAgent,
    });

    console.log(`[Antigravity] Chat Response Status: ${response.status}`);

    if (response.status === 401) throw new Error('401');
    if (!response.ok) {
      const txt = await response.text();
      console.error(`[Antigravity] Chat Response Error Body: ${txt}`);
      throw new Error(`Antigravity API Error: ${response.status} ${txt}`);
    }

    return response;
  };

  let response;
  try {
    response = await makeRequest(accessToken);
  } catch (e: any) {
    if (e.message === '401') {
      console.log('[Antigravity] Chat 401, refreshing token...');
      const creds = JSON.parse(account.credential);
      if (creds.refresh_token) {
        const newTokens = await AntigravityAuthServer.refreshAccessToken(creds.refresh_token);
        await updateAccountCredentials(account, newTokens);
        response = await makeRequest(newTokens.access_token);
      } else {
        throw e;
      }
    } else {
      throw e;
    }
  }

  if (!response || !response.body) {
    console.error('[Antigravity] No response body received');
    throw new Error('No response body from Antigravity');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const stream = response.body;

  stream.on('data', (chunk: Buffer) => {
    const str = chunk.toString();
    // console.log('[Antigravity] Stream Chunk Raw:', str); // DEBUG

    const lines = str.split('\n').filter((l) => l.trim());
    for (const line of lines) {
      let cleanLine = line.trim();
      if (cleanLine.startsWith('data: ')) cleanLine = cleanLine.substring(6); // Handle SSE format if present

      // CLIProxyAPI handles raw JSON lines in streamScannerBuffer loop
      // The Daily endpoint might return clean JSON per line or SSE "data: {...}"
      // The `?alt=sse` parameter suggests SSE format.

      if (!cleanLine) continue;
      if (cleanLine === '[DONE]') return;

      try {
        const data = JSON.parse(cleanLine);

        // CLIProxyAPI logic:
        // root.Get("response").Get("candidates.0.content.parts")

        let candidates = data.candidates;
        if (data.response && data.response.candidates) {
          candidates = data.response.candidates;
        }

        const cand = candidates?.[0];
        const parts = cand?.content?.parts;
        // Text part
        let text = '';

        if (parts) {
          for (const p of parts) {
            // Handle thoughts
            // if (p.thought) ...
            if (p.text) {
              text += p.text;
            }
          }
        }

        // Console log text for debug
        if (text) process.stdout.write(text);

        if (text) {
          const openaiChunk = {
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: model,
            choices: [{ delta: { content: text }, index: 0, finish_reason: null }],
          };
          res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
        }

        if (cand?.finishReason || cand?.finish_reason) {
          // Send finish signal?
        }
      } catch (e) {
        // ignore partial chunks
      }
    }
  });

  stream.on('end', () => {
    console.log('\n[Antigravity] Stream Ended');
    res.write('data: [DONE]\n\n');
    res.end();
  });

  stream.on('error', (err: any) => {
    console.error('[Antigravity] Stream error:', err);
    res.write(`data: {"error": "${err.message}"}\n\n`);
    res.end();
  });
};
