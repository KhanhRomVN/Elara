/**
 * ------------------------------------------------------------------
 * Z.AI Helpers
 * ------------------------------------------------------------------
 * Helper functions cho Z.AI API.
 *
 * Main functions:
 * - getAuthDataFromCredential() : Parse credential thành ZAIAuthData
 * - parseUserAgentDetails()     : Parse user-agent thành chi tiết
 * - generateSignatureAndParams(): Tạo signature và query params
 * - sanitizeCookies()           : Sanitize cookie string với token
 * - buildZAIHeaders()           : Build headers cho Z.AI request
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import * as crypto from 'crypto';
import type { ZAIAuthData, SignatureResult, ZAIUserAgentDetails } from './zai.types';
import { BASE_URL, DEFAULT_USER_AGENT, SALT, FE_VERSION } from './zai.constant';

// ─── Functions ──────────────────────────────────────────────────────────

export function getAuthDataFromCredential(credential: string): ZAIAuthData | null {
  if (!credential) return null;

  try {
    const credParts = credential.split('|||');
    const jwtToken = credParts[0];
    const cookies = credParts[1] || '';
    const userAgent = credParts[2] || '';

    const parts = jwtToken.split('.');
    if (parts.length >= 2) {
      const payloadB64 = parts[1];
      const padding = '='.repeat((4 - (payloadB64.length % 4)) % 4);
      const payloadJson = Buffer.from(payloadB64 + padding, 'base64').toString('utf-8');
      const payload = JSON.parse(payloadJson);
      const userId = payload.id;
      return {
        token: jwtToken,
        userId: userId || '',
        email: payload.email,
        cookies,
        userAgent,
      };
    }
    return { token: jwtToken, userId: '', cookies, userAgent };
  } catch (e) {
    return null;
  }
}

export function parseUserAgentDetails(userAgent: string): ZAIUserAgentDetails {
  let osName = 'Windows';
  let secChUaPlatform = '"Windows"';

  if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS X')) {
    osName = 'Mac';
    secChUaPlatform = '"macOS"';
  } else if (userAgent.includes('Linux') || userAgent.includes('X11')) {
    osName = 'Linux';
    secChUaPlatform = '"Linux"';
  }

  let chromeVersion = '124';
  const match = userAgent.match(/Chrome\/([0-9]+)\./);
  if (match) {
    chromeVersion = match[1];
  }

  const secChUa = `"Chromium";v="${chromeVersion}", "Not-A.Brand";v="24", "Google Chrome";v="${chromeVersion}"`;

  return { osName, secChUaPlatform, secChUa };
}

export function generateSignatureAndParams(
  prompt: string,
  token: string,
  userId: string,
  chatId?: string,
  timestampMs?: string,
  userAgent?: string,
): SignatureResult {
  const timestamp = timestampMs || String(Date.now());
  const requestId = crypto.randomUUID();

  const currentUrl = chatId ? `${BASE_URL}/c/${chatId}` : `${BASE_URL}/`;
  const pathname = chatId ? `/c/${chatId}` : '/';

  const activeUa = userAgent || DEFAULT_USER_AGENT;
  const uaDetails = parseUserAgentDetails(activeUa);

  const metadata: Record<string, string> = {
    timestamp,
    requestId,
    user_id: userId,
    version: '0.0.1',
    platform: 'web',
    token,
    user_agent: activeUa,
    language: 'vi',
    languages: 'vi,en-US,en',
    timezone: 'Asia/Saigon',
    cookie_enabled: 'true',
    screen_width: '1920',
    screen_height: '1080',
    screen_resolution: '1920x1080',
    viewport_height: '1080',
    viewport_width: '1920',
    viewport_size: '1920x1080',
    color_depth: '24',
    pixel_ratio: '1',
    current_url: currentUrl,
    pathname: pathname,
    search: '',
    hash: '',
    host: 'chat.z.ai',
    hostname: 'chat.z.ai',
    protocol: 'https:',
    referrer: '',
    title: 'Z.ai - Free AI Chatbot',
    timezone_offset: '-420',
    local_time: new Date().toISOString(),
    utc_time: new Date().toUTCString(),
    is_mobile: 'false',
    is_touch: 'false',
    max_touch_points: '0',
    browser_name: 'Chrome',
    os_name: uaDetails.osName,
    signature_timestamp: timestamp,
  };

  const sigPayload = { requestId, timestamp, user_id: userId };
  const sortedKeys = Object.keys(sigPayload).sort();
  const sortedItems: string[] = [];
  for (const k of sortedKeys) {
    sortedItems.push(k);
    sortedItems.push(String(sigPayload[k as keyof typeof sigPayload]));
  }
  const sortedPayload = sortedItems.join(',');

  const b64Prompt = Buffer.from(prompt, 'utf-8').toString('base64');
  const dataString = `${sortedPayload}|${b64Prompt}|${timestamp}`;

  const timeChunk = String(Math.floor(Number(timestamp) / 300000));
  const k1 = crypto.createHmac('sha256', SALT).update(timeChunk).digest('hex');
  const signature = crypto.createHmac('sha256', k1).update(dataString).digest('hex');

  const queryParams = new URLSearchParams(metadata).toString();

  return { signature, timestamp, requestId, queryParams };
}

export function sanitizeCookies(cookieString: string, token: string): string {
  if (!cookieString) return '';
  const regex = /token=[^;]+/g;
  if (regex.test(cookieString)) {
    return cookieString.replace(regex, `token=${token}`);
  } else {
    return cookieString.trim().endsWith(';')
      ? `${cookieString} token=${token};`
      : `${cookieString}; token=${token};`;
  }
}

export function buildZAIHeaders(
  token: string,
  signature: string,
  chatId?: string,
  cookies?: string,
  userAgent?: string,
): Record<string, string> {
  const activeUa = userAgent || DEFAULT_USER_AGENT;
  const uaDetails = parseUserAgentDetails(activeUa);
  const referer = chatId ? `${BASE_URL}/c/${chatId}` : `${BASE_URL}/`;

  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Signature': signature,
    'X-Fe-Version': FE_VERSION,
    'User-Agent': activeUa,
    Origin: BASE_URL,
    Referer: referer,
    'sec-ch-ua': uaDetails.secChUa,
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': uaDetails.secChUaPlatform,
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'accept-language': 'vi,en-US,en',
  };
  if (cookies) {
    headers['Cookie'] = sanitizeCookies(cookies, token);
  }
  return headers;
}