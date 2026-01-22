import { updateAccountDirectly, Account } from '../../../ipc/accounts';
import { USER_AGENT, getCookieValue } from './api';

const orgIdCache: Record<string, string> = {};

const getCookies = (account: Account) => {
  if (!account.credential) return [];
  try {
    return JSON.parse(account.credential);
  } catch (error) {
    return account.credential.split(';').map((c) => {
      const parts = c.trim().split('=');
      const name = parts[0];
      const value = parts.slice(1).join('=');
      return { name, value };
    });
  }
};

const getOrgIdFromJwt = (token: string): string | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(''),
    );

    const payload = JSON.parse(jsonPayload);
    console.log('[Groq Debug] Decoded JWT Payload:', JSON.stringify(payload, null, 2));

    if (payload['https://groq.com/organization'] && payload['https://groq.com/organization'].id) {
      return payload['https://groq.com/organization'].id;
    }
    return null;
  } catch (e) {
    console.error('Error decoding JWT:', e);
    return null;
  }
};

const refreshGroqSession = async (account: Account): Promise<boolean> => {
  try {
    const stytchSession = account.credential.match(/stytch_session=([^;]+)/)?.[1];
    if (!stytchSession) {
      console.log('[Groq] No stytch_session found for refresh');
      return false;
    }

    const publicToken = 'public-token-live-58df57a9-a1f5-4066-bc0c-2ff942db684f';
    const authString = `${publicToken}:${stytchSession}`;
    const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;

    console.log('[Groq] Attempting session refresh for', account.email);

    const sdkClient =
      account.headers?.['x-sdk-client'] ||
      'eyJldmVudF9pZCI6ImV2ZW50LWlkLTdlNTA3Yjg2LTBhNTQtNDg1OC04YTI0LWY5ODA1YTBlMTAxOCIsImFwcF9zZXNzaW9uX2lkIjoiYXBwLXNlc3Npb24taWQtMWRiZDZmYzItMjNhOS00NGUzLTlmNmUtMTdhMjZkOTUxM2IzIiwicGVyc2lzdGVudF9pZCI6InBlcnNpc3RlbnQtaWQtYWI2NmM4MWItZWVlMi00Njk2LTgxZmUtNWE4ZDRhMTc0YWJjIiwiY2xpZW50X3NlbnRfYXQiOiIyMDI2LTAxLTEzVDE2OjA5OjEwLjI1MloiLCJ0aW1lem9uZSI6IkFzaWEvU2FpZ29uIiwic3R5dGNoX21lbWJlcl9pZCI6Im1lbWJlci1saXZlLTAxNjdlMWFmLTYxZTYtNDM0ZC04ZGFiLWM3ODQ5NWNjMThhNSIsInN0eXRjaF9tZW1iZXJfc2Vzc2lvbl9pZCI6Im1lbWJlci1zZXNzaW9uLWxpdmUtMDNkZjkyZTgtMWQ0NC00OGM0LTgyODctNGMzODdhNzdiYjVmIiwiYXBwIjp7ImlkZW50aWZpZXIiOiJjb25zb2xlLmdyb3EuY29tIn0sInNkayI6eyJpZGVudGlmaWVyIjoiU3R5dGNoLmpzIEphdmFzY3JpcHQgU0RLIiwidmVyc2lvbiI6IjUuNDMuMCJ9fQ==';

    const response = await fetch(
      'https://api.stytchb2b.groq.com/sdk/v1/b2b/sessions/authenticate',
      {
        method: 'POST',
        headers: {
          host: 'api.stytchb2b.groq.com',
          authorization: authHeader,
          'content-type': 'application/json',
          origin: 'https://console.groq.com',
          referer: 'https://console.groq.com/',
          'user-agent':
            account.userAgent ||
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
          'x-sdk-client': sdkClient,
          'x-sdk-parent-host': 'https://console.groq.com',
        },
        body: JSON.stringify({}),
      },
    );

    if (!response.ok) {
      console.error('[Groq] Refresh failed with status:', response.status);
      return false;
    }

    const data: any = await response.json();
    const newJwt = data?.data?.session_jwt;
    const newToken = data?.data?.session_token;

    if (newJwt) {
      console.log('[Groq] Refresh successful. Updating account...');

      let cookies = account.credential;
      if (cookies.includes('stytch_session_jwt=')) {
        cookies = cookies.replace(/stytch_session_jwt=[^;]+/, `stytch_session_jwt=${newJwt}`);
      } else {
        cookies += `; stytch_session_jwt=${newJwt}`;
      }

      if (newToken) {
        if (cookies.includes('stytch_session=')) {
          cookies = cookies.replace(/stytch_session=[^;]+/, `stytch_session=${newToken}`);
        } else {
          cookies += `; stytch_session=${newToken}`;
        }
      }

      updateAccountDirectly('Groq', { credential: cookies }, (a) => a.id === account.id);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Groq] Error refreshing session:', error);
    return false;
  }
};

export const getModels = async (account: Account) => {
  let sessionJwt = '';
  const cookies = getCookies(account);
  const jwtCookie = cookies.find((c: any) => c.name === 'stytch_session_jwt');
  if (jwtCookie) sessionJwt = jwtCookie.value;

  if (!sessionJwt) {
    throw new Error('No session JWT found. Please login to Groq first.');
  }

  const orgId = getOrgIdFromJwt(sessionJwt) || orgIdCache[sessionJwt];

  const makeRequest = async (jwt: string, organizationId: string | undefined) => {
    return fetch('https://api.groq.com/internal/v1/models', {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'groq-organization': organizationId || '',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        Origin: 'https://console.groq.com',
        Referer: 'https://console.groq.com/',
      },
    });
  };

  let response = await makeRequest(sessionJwt, orgId);

  if (response.status === 401) {
    console.log('[Groq] GetModels Got 401. Attempting to refresh token...');
    const refreshed = await refreshGroqSession(account);
    if (refreshed) {
      const fs = await import('fs');
      const path = await import('path');
      const { app } = await import('electron');
      const DATA_FILE = path.join(app.getPath('userData'), 'accounts.json');
      const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      const updatedAccount = accounts.find((a) => a.id === account.id);

      if (updatedAccount) {
        const newCookies = getCookies(updatedAccount); // Use helper
        const newJwt = getCookieValue(newCookies, 'stytch_session_jwt');
        if (newJwt) {
          const newOrgId = getOrgIdFromJwt(newJwt) || orgIdCache[newJwt];
          response = await makeRequest(newJwt, newOrgId); // Retry
        }
      }
    } else {
      console.error('[Groq] Refresh failed during getModels.');
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch models: ${response.statusText} - ${errorText}`);
  }

  return response.json();
};

export const chatCompletionStream = async (
  payload: any,
  account: Account,
  callbacks: {
    onContent: (content: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  },
) => {
  try {
    let sessionJwt = '';
    const cookies = getCookies(account);
    const jwtCookie = cookies.find((c: any) => c.name === 'stytch_session_jwt');
    if (jwtCookie) sessionJwt = jwtCookie.value;

    const orgId = getOrgIdFromJwt(sessionJwt) || orgIdCache[sessionJwt];

    const makeRequest = async (jwt: string, organizationId: string | undefined) => {
      const headers: any = {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        Origin: 'https://console.groq.com',
        Referer: 'https://console.groq.com/',
        'User-Agent': USER_AGENT,
      };
      if (organizationId) headers['groq-organization'] = organizationId;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { conversation_id, parent_message_id, ...cleanBody } = payload;

      return fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify(cleanBody),
      });
    };

    let response = await makeRequest(sessionJwt, orgId);

    if (response.status === 401) {
      console.log('[Groq] Got 401. Attempting to refresh token...');
      const refreshed = await refreshGroqSession(account);
      if (refreshed) {
        const fs = await import('fs');
        const path = await import('path');
        const { app } = await import('electron');
        const DATA_FILE = path.join(app.getPath('userData'), 'accounts.json');
        const accounts: Account[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        const updatedAccount = accounts.find((a) => a.id === account.id);

        if (updatedAccount) {
          const newCookies = getCookies(updatedAccount);
          const newJwt = getCookieValue(newCookies, 'stytch_session_jwt');
          if (newJwt) {
            response = await makeRequest(newJwt, orgId); // Retry
          }
        }
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    if (response.body) {
      // @ts-ignore
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const json = JSON.parse(data);
                const text = json.choices?.[0]?.delta?.content;
                if (text) callbacks.onContent(text);
              } catch (e) {
                // ignore
              }
            }
          }
        }
      } catch (err: any) {
        console.error('[Groq] Stream error:', err);
        callbacks.onError(err);
      } finally {
        callbacks.onDone();
      }
    } else {
      callbacks.onDone();
    }
  } catch (error: any) {
    console.error('Groq Error:', error);
    callbacks.onError(error);
  }
};
