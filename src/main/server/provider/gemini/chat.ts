import { randomUUID } from 'crypto';

// Types (simplified for now)
export interface GeminiChatPayload {
  model: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
  }[];
  temperature?: number;
}

export const getCookies = (credential: string) => {
  if (!credential) return [];
  try {
    const parsed = JSON.parse(credential);
    const cookieStr = typeof parsed === 'object' && parsed.cookies ? parsed.cookies : credential;
    if (typeof cookieStr === 'string') {
      return cookieStr.split(';').map((c) => {
        const parts = c.trim().split('=');
        const name = parts[0];
        const value = parts.slice(1).join('=');
        return { name, value };
      });
    }
    return [];
  } catch (error) {
    return credential.split(';').map((c) => {
      const parts = c.trim().split('=');
      const name = parts[0];
      const value = parts.slice(1).join('=');
      return { name, value };
    });
  }
};

export const getMetadata = (credential: string, providedMetadata?: any) => {
  try {
    const parsed = JSON.parse(credential);
    if (typeof parsed === 'object' && parsed.metadata) {
      return { ...parsed.metadata, ...providedMetadata };
    }
  } catch (e) {
    // Not JSON or no metadata key
  }
  return providedMetadata || {};
};

export const getCookieValue = (cookies: any[], name: string) => {
  const cookie = cookies.find((c: any) => c.name === name);
  return cookie ? cookie.value : '';
};

export const chatCompletionStream = async (
  credential: string,
  payload: GeminiChatPayload,
  metadata: any,
  callbacks: {
    onContent: (content: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  },
  userAgent?: string,
) => {
  const cookies = getCookies(credential);
  const combinedMetadata = getMetadata(credential, metadata);
  console.log('[Gemini] Cookies count:', cookies.length);

  const sid = getCookieValue(cookies, '__Secure-1PSID');
  const snlm0e = combinedMetadata?.snlm0e;
  const bl = combinedMetadata?.bl || 'boq_assistant-bard-web-server_20240319.13_p0';

  // Validations
  if (!sid || !snlm0e) {
    callbacks.onError(new Error('Missing credentials (SID or SNlM0e)'));
    return;
  }

  try {
    const cookieHeader =
      typeof JSON.parse(credential) === 'object' && JSON.parse(credential).cookies
        ? JSON.parse(credential).cookies
        : credential;

    const { messages, model } = payload;
    const prompt = messages[messages.length - 1].content;

    // Construct f.req payload
    const reqBody = [
      null,
      JSON.stringify([[[prompt], null, [combinedMetadata?.conversationContext || '', '', '']]]),
      null,
      null,
    ];

    const fReq = JSON.stringify(reqBody);
    const params = new URLSearchParams();
    params.append('f.req', fReq);
    params.append('at', snlm0e || '');

    const response = await fetch(
      `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=${bl}&f.sid=${combinedMetadata?.f_sid || ''}&hl=en&_reqid=${Date.now()}&rt=c`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Cookie: cookieHeader,
          'User-Agent': userAgent || '',
          Origin: 'https://gemini.google.com',
          Referer: 'https://gemini.google.com/',
          'X-Same-Domain': '1',
        },
        body: params.toString(),
      },
    );
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gemini] API Error:', response.status, errorText);
      callbacks.onError(new Error(errorText));
      return;
    }

    console.log('[Gemini] Response OK, starting stream...');

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process line by line
        const lines = buffer.split('\n');
        // Keep the last partial line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          // Skip garbage or keep-alive
          if (line.includes(")]}'")) continue;

          try {
            const json = JSON.parse(line);

            // Skip numeric headers (length prefixes)
            if (typeof json === 'number') continue;

            // Normalize to array of chunks
            const chunks = Array.isArray(json) && Array.isArray(json[0]) ? json : [json];

            for (const item of chunks) {
              // Check for valid data wrapper
              if (Array.isArray(item) && typeof item[0] === 'string') {
                const payload = item[2];
                if (typeof payload === 'string') {
                  const innerJson = JSON.parse(payload);
                  let textChunk = null;

                  if (Array.isArray(innerJson)) {
                    // Strategy 1: Look for "rc_" updates (standard streaming content)
                    try {
                      const candidates = innerJson?.[4];
                      if (Array.isArray(candidates)) {
                        for (const candidate of candidates) {
                          if (Array.isArray(candidate) && candidate.length >= 2) {
                            const msgContent = candidate[1];
                            if (Array.isArray(msgContent) && msgContent.length > 0) {
                              if (typeof msgContent[0] === 'string') {
                                textChunk = msgContent[0];
                                break; // Found one
                              }
                            }
                          }
                        }
                      }
                    } catch (e) {
                      // console.log('[Gemini] Error extraction path 1:', e);
                    }

                    // Strategy 2: Fallback path
                    if (!textChunk) {
                      const altChunk = innerJson?.[0]?.[1]?.[0];
                      if (typeof altChunk === 'string') textChunk = altChunk;
                    }
                  }

                  if (textChunk) {
                    callbacks.onContent(textChunk);
                  }
                }
              }
            }
          } catch (e) {
            // console.error('Error parsing JSON chunk', e);
          }
        }
      }
    }

    callbacks.onDone();
  } catch (error: any) {
    console.error('Gemini Error:', error);
    callbacks.onError(error);
  }
};

export const getModels = async (credential: string, metadata: any, userAgent?: string) => {
  console.log('[Gemini] Fetching models...');
  const combinedMetadata = getMetadata(credential, metadata);
  console.log(
    '[Gemini] Combined Metadata:',
    JSON.stringify(combinedMetadata, null, 2).slice(0, 100) + '...',
  );

  const bl = combinedMetadata?.bl || 'boq_assistant-bard-web-server_20240319.13_p0';
  const f_sid = combinedMetadata?.f_sid || '';
  const snlm0e = combinedMetadata?.snlm0e || '';

  if (!snlm0e) {
    console.warn(
      '[Gemini] getModels called without SNlM0e token! Credential length:',
      credential?.length,
    );
    throw new Error('Missing SNlM0e token');
  }

  try {
    const fReq = JSON.stringify([[['otAQ7b', '[]', null, 'generic']]]);
    const params = new URLSearchParams();
    params.append('f.req', fReq);
    params.append('at', snlm0e);

    const cookieHeader =
      typeof JSON.parse(credential) === 'object' && JSON.parse(credential).cookies
        ? JSON.parse(credential).cookies
        : credential;

    const url = `https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=otAQ7b&source-path=%2Fapp&bl=${bl}&f.sid=${f_sid}&hl=en&_reqid=${Date.now()}&rt=c`;
    console.log('[Gemini] Fetching models from URL:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Cookie: cookieHeader,
        'User-Agent': userAgent || '',
        Origin: 'https://gemini.google.com',
        Referer: 'https://gemini.google.com/',
        'X-Same-Domain': '1',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      console.error('[Gemini] Models fetch failed status:', response.status);
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    const text = await response.text();
    console.log('[Gemini] Models direct response text length:', text.length);

    // Parse the response
    const lines = text.split('\n');
    let models: any[] = [];

    for (const line of lines) {
      if (line.includes(")]}'")) continue;
      try {
        const json = JSON.parse(line);
        const chunks = Array.isArray(json) && Array.isArray(json[0]) ? json : [json];

        for (const item of chunks) {
          if (Array.isArray(item) && item[0] === 'wrb.fr' && item[1] === 'otAQ7b') {
            const payload = item[2];
            console.log('[Gemini] Found otAQ7b payload chunk');
            if (typeof payload === 'string') {
              const innerJson = JSON.parse(payload);
              // Expected structure from user snippet:
              // innerJson[0] = 1, innerJson[1] = stats, ..., innerJson[15] = models array
              if (Array.isArray(innerJson) && Array.isArray(innerJson[15])) {
                console.log(
                  '[Gemini] Parsing models from innerJson[15], length:',
                  innerJson[15].length,
                );
                models = innerJson[15].map((m: any) => ({
                  id: m[0],
                  name: m[1],
                  description: m[2],
                }));
              } else if (Array.isArray(innerJson)) {
                console.log(
                  '[Gemini] innerJson is array but index 15 not found. Structure depth:',
                  innerJson.length,
                );
                // Fallback parsing for alternative structures if needed
                for (const el of innerJson) {
                  if (Array.isArray(el) && el.length > 0 && Array.isArray(el[0])) {
                    if (typeof el[0][1] === 'string' && typeof el[0][2] === 'string') {
                      console.log('[Gemini] Found alternative model list structure');
                      models = el.map((m: any) => ({
                        id: m[0],
                        name: m[1],
                        description: m[2],
                      }));
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('[Gemini] Error parsing models line:', e);
      }
    }

    console.log('[Gemini] Final found models count:', models.length);
    return models;
  } catch (error) {
    console.error('Gemini Models Error:', error);
    throw error;
  }
};
