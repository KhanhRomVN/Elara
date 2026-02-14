import { Account } from '../../../ipc/accounts';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { BASE_URL, httpsAgent } from './auth';

// Use dynamic import for node-fetch to support ESM in CJS context
const fetch = async (url: any, init?: any) => {
  const { default: fetch } = await import('node-fetch');
  return fetch(url, init);
};

export const ensureAccessToken = async (account: Account): Promise<string> => {
  let creds: any;
  try {
    creds = JSON.parse(account.credential);
  } catch {
    return account.credential;
  }
  return creds.access_token;
};

export const updateAccountCredentials = async (account: Account, newTokens: any) => {
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

const defaultModels = {
  models: {
    'gemini-3-flash': {
      name: 'gemini-3-flash',
      displayName: 'Gemini 3 Flash',
      description: 'Fast and versatile performance (Verified)',
      supportedGenerationMethods: ['generateContent', 'countTokens'],
      inputTokenLimit: 32768,
      outputTokenLimit: 8192,
    },
    'gemini-2.5-flash': {
      name: 'gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
      description: 'Next-gen fast model (Verified)',
      supportedGenerationMethods: ['generateContent', 'countTokens'],
      inputTokenLimit: 32768,
      outputTokenLimit: 8192,
    },
    'gemini-2.5-flash-lite': {
      name: 'gemini-2.5-flash-lite',
      displayName: 'Gemini 2.5 Flash Lite',
      description: 'Lightweight efficient model (Verified)',
      supportedGenerationMethods: ['generateContent', 'countTokens'],
      inputTokenLimit: 32768,
      outputTokenLimit: 8192,
    },
    tab_flash_lite_preview: {
      name: 'tab_flash_lite_preview',
      displayName: 'Tab Flash Lite',
      description: 'Code completion optimized (Verified)',
      supportedGenerationMethods: ['generateContent', 'countTokens'],
      inputTokenLimit: 32768,
      outputTokenLimit: 8192,
    },
    'gemini-3-pro-image': {
      name: 'gemini-3-pro-image',
      displayName: 'Gemini 3 Pro Image',
      description: 'Multimodal image generation (Verified)',
      supportedGenerationMethods: ['generateContent', 'countTokens'],
      inputTokenLimit: 32768,
      outputTokenLimit: 8192,
    },
    'gpt-oss-120b-medium': {
      name: 'gpt-oss-120b-medium',
      displayName: 'GPT OSS 120B',
      description: 'Open source 120B model (Verified)',
      supportedGenerationMethods: ['generateContent', 'countTokens'],
      inputTokenLimit: 32768,
      outputTokenLimit: 8192,
    },
    'rev19-uic3-1p': {
      name: 'rev19-uic3-1p',
      displayName: 'Rev19 UIC3 1P',
      description: 'Experimental model (Verified)',
      supportedGenerationMethods: ['generateContent', 'countTokens'],
      inputTokenLimit: 32768,
      outputTokenLimit: 8192,
    },
  },
};

export const getModels = async (_account: Account) => {
  console.log('[Antigravity] getModels called - returning verified hardcoded list');
  const result = Object.values(defaultModels.models);
  console.log(
    '[Antigravity] getModels result isArray:',
    Array.isArray(result),
    'length:',
    result.length,
  );
  // Return the verified hardcoded list directly as an array
  return result;
};

const projectIDCache = new Map<string, string>();

export const generateUUID = () => crypto.randomUUID();

export const generateProjectID = () => {
  const adjectives = ['useful', 'bright', 'swift', 'calm', 'bold'];
  const nouns = ['fuze', 'wave', 'spark', 'flow', 'core'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomPart = generateUUID().substring(0, 5);
  return `${adj}-${noun}-${randomPart}`;
};

export const fetchProjectID = async (accessToken: string): Promise<string> => {
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
