import { net } from 'electron';
import crypto from 'crypto';
import { store } from '../../../store';
import { loginWithRealBrowser } from '../../browser-login';

export const BASE_URL = 'https://claude.ai';

export async function login() {
  return await loginWithRealBrowser({
    providerId: 'Claude',
    loginUrl: 'https://claude.ai/login',
    partition: `claude-${Date.now()}`,
    cookieEvent: 'claude-cookies',
    validate: async (data: { cookies: string; headers?: any }) => {
      // Need sessionKey
      const match = data.cookies.match(/sessionKey=([^;]+)/);
      if (match && match[1]) {
        const sessionKey = match[1];
        // Validate by fetching profile
        const profile = await getProfile(sessionKey, data.headers?.['User-Agent']);
        if (profile.email) {
          return { isValid: true, cookies: sessionKey, email: profile.email };
        }
      }
      return { isValid: false };
    },
  });
}

// Restore getProfile from legacy
export async function getProfile(
  token: string,
  userAgent?: string,
): Promise<{ email: string | null; name?: string }> {
  try {
    const origin = BASE_URL;
    const cookie = `sessionKey=${token}`;

    const setCommonHeaders = (req: Electron.ClientRequest) => {
      req.setHeader('Cookie', cookie);
      req.setHeader('Origin', origin);
      req.setHeader('Accept', 'application/json');
      req.setHeader('anthropic-client-platform', 'web_claude_ai');
      req.setHeader('anthropic-client-version', '1.0.0');
      req.setHeader('anthropic-device-id', getDeviceId());
      req.setHeader('anthropic-anonymous-id', getAnonymousId());
      if (userAgent) req.setHeader('User-Agent', userAgent);
    };

    // Use /api/bootstrap as it contains full account info including email
    const req = net.request({ method: 'GET', url: `${BASE_URL}/api/bootstrap` });
    setCommonHeaders(req);

    return new Promise((resolve, reject) => {
      let data = '';
      req.on('response', (response) => {
        response.on('data', (chunk) => (data += chunk.toString()));
        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              if (json && json.account && json.account.email_address) {
                resolve({
                  email: json.account.email_address,
                  name: json.account.full_name || json.account.display_name,
                });
              } else {
                resolve({ email: null });
              }
            } catch (e) {
              console.error('[Claude] Error parsing bootstrap data:', e);
              reject(e);
            }
          } else {
            console.error('[Claude] Bootstrap request failed:', response.statusCode);
            resolve({ email: null });
          }
        });
      });
      req.on('error', (e) => {
        console.error('[Claude] Bootstrap request error:', e);
        reject(e);
      });
      req.end();
    });
  } catch (e) {
    console.error('[Claude] Get Profile Error:', e);
    return { email: null };
  }
}

// Generate stable device/anonymous IDs
export function getDeviceId(): string {
  let deviceId = store.get('deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    store.set('deviceId', deviceId);
  }
  return deviceId;
}

export function getAnonymousId(): string {
  let anonId = store.get('anonymousId');
  if (!anonId) {
    anonId = `claudeai.v1.${crypto.randomUUID()}`;
    store.set('anonymousId', anonId);
  }
  return anonId;
}
