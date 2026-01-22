import { Account } from '../../../ipc/accounts';
import crypto from 'crypto';
import { ensureAccessToken, updateAccountCredentials, fetchProjectID, generateUUID } from './api';
import { BASE_URL, httpsAgent, AntigravityAuthServer } from './auth';

// Use dynamic import for node-fetch to support ESM in CJS context
const fetch = async (url: any, init?: any) => {
  const { default: fetch } = await import('node-fetch');
  return fetch(url, init);
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

  const accessToken = await ensureAccessToken(account);

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
