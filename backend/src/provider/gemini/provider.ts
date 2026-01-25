import { Provider, SendMessageOptions } from '../types';
import { Router } from 'express';
import { HttpClient } from '../../utils/http-client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { findAccount } from '../../services/account-selector';
import { createLogger } from '../../utils/logger';
import { GeminiContext } from './types';

const logger = createLogger('GeminiProvider');
const BASE_URL = 'https://gemini.google.com';

export class GeminiProvider implements Provider {
  name = 'Gemini';
  defaultModel = '0';

  private cachedContext: GeminiContext | null = null;
  private cachedModels: any[] | null = null;

  private async loadModelsFromConfig(): Promise<any[]> {
    if (this.cachedModels) return this.cachedModels;
    try {
      const configPath = path.resolve(process.cwd(), 'provider.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const providers = JSON.parse(raw);
        const gemini = providers.find((p: any) => p.provider_id === 'gemini');
        if (gemini && gemini.models) {
          this.cachedModels = gemini.models;
          return gemini.models;
        }
      }
    } catch (e) {
      logger.error('Failed to load models from provider.json', e);
    }
    return [];
  }

  async getModels(credential: string): Promise<any[]> {
    return this.loadModelsFromConfig();
  }

  async handleMessage(options: SendMessageOptions): Promise<void> {
    const {
      credential,
      messages,
      model,
      onContent,
      onMetadata,
      onDone,
      onError,
    } = options;

    try {
      let cookie = credential;
      let context: GeminiContext;

      // Check if credential is a JSON object
      if (credential.trim().startsWith('{')) {
        try {
          let parsed = JSON.parse(credential);
          // Handle case where credential is double-stringified (common in some storage layers)
          if (typeof parsed === 'string') {
            try {
              parsed = JSON.parse(parsed);
            } catch (e) {
              // It was just a string json, keep parsed as is
            }
          }

          if (parsed.cookies) {
            // Ensure cookies are a single string
            if (typeof parsed.cookies === 'object') {
              cookie = Object.entries(parsed.cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');
            } else {
              cookie = parsed.cookies;
            }
          }

          if (parsed.metadata) {
            context = {
              bl: parsed.metadata.bl || '',
              sid: parsed.metadata.f_sid || '',
              at: parsed.metadata.snlm0e || '',
            };
            this.cachedContext = context;
          }
        } catch (e) {
          logger.warn(
            'Failed to parse credential as JSON, using as raw cookie string',
            e,
          );
        }
      }

      const client = new HttpClient({
        baseURL: BASE_URL,
        headers: {
          Cookie: cookie,
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
          Origin: BASE_URL,
          Referer: `${BASE_URL}/app`,
          'X-Same-Domain': '1',
        },
      });

      // 1. Get Context (sid, bl, at)
      context = await this.getContext(client);

      // 2. Prepare Request
      // Model mapping: 0 -> 3 (Flash), 2 -> 4 (Pro)
      let modelValue = 3; // Default to Flash
      const modelId = model || '0';
      if (modelId === '2') {
        modelValue = 4;
      }
      // TODO: Handle 1 (Thinking) if mapping is different

      const lastMessage = messages[messages.length - 1];
      const conversationId = options.conversationId; // TODO: Handle conversation history properly

      // If we have ref_file_ids, we need to handle them. For now, simple text.
      // The capture shows image attachment as part of the message or separate upload.
      // We will assume simple text first.

      const reqId = Math.floor(Math.random() * 100000) + 100000; // Random reqid

      const messageStruct = [
        [lastMessage.content, 0, null, null, null, null, 0],
        ['vi'],
        options.conversationId
          ? [options.conversationId, null, null] // Try to pass conversation ID if known format
          : [
              'c_' + crypto.randomBytes(8).toString('hex'),
              'r_' + crypto.randomBytes(8).toString('hex'),
              null,
            ],
        null,
        null,
        null,
        [1],
        1,
        null,
        null,
        1,
        0,
        null,
        null,
        null,
        null,
        null,
        [[modelValue]], // Model Selection
        0,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        // More fields might be needed from capture
      ];

      // Based on capture, the structure is deeply nested and specific.
      // Let's use a simplified compatible structure if possible, or exact copy.
      // Capture 1 (Flash):
      // [null, JSON_STRING]
      // JSON_STRING: [
      //   ["xin chào 1", 0, null, null, null, null, 0],
      //   ["vi"],
      //   [cid, rid, rcid, ...],
      //   null,
      //   null,
      //   null,
      //   [1],
      //   1,
      //   null,
      //   null,
      //   1,
      //   0,
      //   null,
      //   null,
      //   null,
      //   null,
      //   null,
      //   [[0]], ...
      // ]

      // Let's construct the inner array carefully.
      // Adjusted based on reverse engineering of https-requests-Gemini.json
      // Index 2 is Session: [cid, rid, rcid, null, null, null, null, null, null, context]
      // Index 3 is unknown opaque string (often history state), sending null for new/safe.
      // Index 4 is Trace ID (16 bytes hex)
      // Index 17 is Model
      // Index 59 is Client UUID
      // Index 66 is [Timestamp, TimezoneOffset]

      const clientUuid = crypto.randomUUID().toUpperCase();

      const sessionArr = options.conversationId
        ? [
            options.conversationId,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
          ] // Detailed structure TODO: store/retrieve rid/rcid
        : [
            '',
            '',
            '',
            null,
            null,
            null,
            null,
            null,
            null,
            'AwAAAAAAAAAQANM7mBjXKZRJHvpAvhk',
          ]; // Some default or empty? Capture showed this.

      // If we have history, we might need to parse the conversationId which might be "c_...|r_...|rc_..."
      // For now, assuming simple New Chat flow works with empty strings.

      if (options.conversationId && options.conversationId.includes('|')) {
        const parts = options.conversationId.split('|');
        sessionArr[0] = parts[0] || '';
        sessionArr[1] = parts[1] || '';
        sessionArr[2] = parts[2] || '';
      } else if (options.conversationId) {
        sessionArr[0] = options.conversationId;
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const timezoneOffset = -new Date().getTimezoneOffset() * 60; // Seconds

      const innerReq = [
        [lastMessage.content, 0, null, null, null, null, 0], // 0: Message
        ['vi'], // 1: Language (Hardcoded to vi based on capture, should be dynamic?)
        sessionArr, // 2: Session
        context.cfb2h || null, // 3: Opaque State String (from cfb2h)
        crypto.randomBytes(16).toString('hex'), // 4: Trace ID
        null, // 5
        [1], // 6
        1, // 7
        null, // 8
        null, // 9
        1, // 10
        0, // 11
        null, // 12
        null, // 13
        null, // 14
        null, // 15
        null, // 16
        [[modelValue]], // 17: Model Selection
        0, // 18
        null, // 19
        null, // 20
        null, // 21
        null, // 22
        null, // 23
        null, // 24
        null, // 25
        null, // 26
        1, // 27
        null, // 28
        null, // 29
        [4], // 30 (Flash used [4], Pro used [4])
        null, // 31
        null, // 32
        null, // 33
        null, // 34
        null, // 35
        null, // 36
        null, // 37
        null, // 38
        null, // 39
        null, // 40
        [1], // 41
        null, // 42
        null, // 43
        null, // 44
        null, // 45
        null, // 46
        null, // 47
        null, // 48
        14, // 49: Required constant 14 based on capture
        null, // 50
        null, // 51
        null, // 52
        0, // 53
        null, // 54
        null, // 55
        null, // 56
        null, // 57
        null, // 58
        clientUuid, // 59: Client UUID
        null, // 60
        [], // 61
        null, // 62
        null, // 63
        null, // 64
        null, // 65
        [timestamp, timezoneOffset], // 66: Timestamp
        null, // 67
        2, // 68
      ];

      const fReq = [null, JSON.stringify(innerReq)];
      logger.info(
        'Generated Gemini f.req Payload:',
        JSON.stringify(fReq, null, 2),
      );

      const params = new URLSearchParams();
      // params.append('rpcids', 'ESY5D'); // Not used in StreamGenerate
      // params.append('source-path', '/app/cc3201b594e2f3f6'); // Not used in StreamGenerate
      params.append('bl', context.bl);
      params.append('f.sid', context.sid);
      params.append('hl', 'vi'); // TODO: Make dynamic
      params.append('_reqid', reqId.toString());
      params.append('rt', 'c');

      const body = new URLSearchParams();
      body.append('f.req', JSON.stringify(fReq));
      body.append('at', context.at);

      const requestUrl = `/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?${params.toString()}`;
      logger.info('Gemini Request URL:', BASE_URL + requestUrl);

      const response = await client.post(requestUrl, body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'X-Goog-Ext-73010989-jspb': '[0]',
          'X-Goog-Ext-525001261-jspb': `[1,null,null,null,"${(context as any).wizId || '9d8ca3786ebdfbea'}",null,null,0,[4],null,null,1]`,
          'X-Goog-Ext-525005358-jspb': JSON.stringify([clientUuid, 1]),
        },
      });

      if (!response.ok) {
        throw new Error(
          `Gemini API Error: ${response.status} ${await response.text()}`,
        );
      }

      // Stream parsing
      const text = await response.text();
      logger.info('Gemini Raw Response Body:', text);
      // The response is a "batchexecute" format (JSON with length prefix or just array).
      // Capture 68: )]}'\n\n130\n[[\"wrb.fr\",\"ESY5D\",...

      // We need to parse this custom Google format.
      // Usually it's: )]}' \n [length] \n [JSON]

      // Simple parse attempt: find lines starting with [[
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('[[')) {
          try {
            const data = JSON.parse(line);
            // data is like [["wrb.fr", "ESY5D", "JSON_STRING", ...]]
            for (const item of data) {
              if (item[0] === 'wrb.fr' && item[1] === 'ESY5D') {
                const innerData = JSON.parse(item[2]);
                // innerData structure needs analysis from capture
                // Usually: [["response_id"], ["topic_id"], null, null, [[["content"]]]]

                // Let's extract content
                // This is highly dependent on structure.
                // We will try to find the content string deeply.

                // Based on known Bard/Gemini reverses:
                // response[0] = conversation_id (c_...)
                // response[4] = [ [ ["content", ...], ... ] ]

                if (innerData) {
                  // Opaque token extraction (usually index 2 or sometimes deep inside)
                  // innerData structure: [null, [conv_id, req_id], "OPAQUE_TOKEN", null, ...]
                  if (
                    typeof innerData[2] === 'string' &&
                    innerData[2].startsWith('!')
                  ) {
                    if (this.cachedContext) {
                      this.cachedContext.cfb2h = innerData[2];
                      logger.info(
                        'Updated Gemini Opaque Token:',
                        this.cachedContext.cfb2h,
                      );
                    }
                  }
                }

                if (innerData && innerData[4]) {
                  const chatData = innerData[4];
                  if (chatData && chatData[0] && chatData[0][1]) {
                    const contentCandidates = chatData[0][1];
                    if (contentCandidates && contentCandidates[0]) {
                      const textContent = contentCandidates[0];
                      if (typeof textContent === 'string') {
                        onContent(textContent);
                      }
                    }
                  }
                }

                if (innerData && innerData[1]) {
                  // Conversation ID is usually [c_id, r_id]
                  let convId = innerData[1];
                  if (Array.isArray(convId)) {
                    convId = convId.join('|');
                  }
                  if (onMetadata) {
                    onMetadata({ conversation_id: convId });
                  }
                }
              }
            }
          } catch (e) {
            // ignore
          }
        }
      }

      onDone();
    } catch (err: any) {
      logger.error('Gemini Error:', err);
      onError(err);
    }
  }

  private async getContext(client: HttpClient): Promise<GeminiContext> {
    if (this.cachedContext) return this.cachedContext;

    logger.info('Fetching Gemini Context from /app...');
    const res = await client.get('/app');
    const html = await res.text();

    // Robust regex to handle both "key":"value" and \"key\":\"value\"
    const extract = (key: string) => {
      const regex = new RegExp(`${key}\\\\*":\\\\*"(.*?)\\\\*"`);
      const match = html.match(regex);
      return match ? match[1].replace(/\\"/g, '"') : null;
    };

    // Prioritize boq_assistant-bard-web-server (The actual Chat backend)
    // Avoid boq_identityfrontend... (The login server)
    const blAssistantMatch = html.match(
      /boq_assistant-bard-web-server_[0-9.]*_p[0-9]/,
    );
    const blIdentityMatch = html.match(
      /boq_identityfrontendauthuiserver_[0-9.]*_p[0-9]/,
    );

    let bl = blAssistantMatch ? blAssistantMatch[0] : null;
    if (!bl) {
      bl = extract('cfb2h'); // Fallback to cfb2h key which often contains bl
      // If the extracted value starts with boq_identity, ignore it and use hardcoded safe fallback or look deeper
      if (bl && bl.startsWith('boq_identity')) {
        bl = null;
      }
    }

    // Final fallback to a known good assistant label if all else fails
    if (!bl) {
      bl = 'boq_assistant-bard-web-server_20260112.07_p2';
    }

    const at = extract('SNlM0e');
    const sid = extract('FdrFJe');

    // Extract WIZ ID (usually 16 byte hex string in arrays)
    const wizIdMatch = html.match(
      /[a-f0-9]{16}(?=\\*")|(?<=\\*")[a-f0-9]{16}/g,
    );
    // There might be many, let's find one that appears in WIZ_global_data or similar context if possible
    // For now, take the first one that fits the typical pattern if found
    const wizId = wizIdMatch
      ? wizIdMatch.find((id) => id.length === 16)
      : undefined;

    logger.info('Extracted Gemini Context:', {
      bl,
      at: at ? at.substring(0, 10) + '...' : null,
      sid,
      wizId,
    });

    if (!bl || !at || !sid) {
      if (this.cachedContext) return this.cachedContext; // Fallback
      throw new Error(
        `Failed to extract Gemini context parameters (bl: ${!!bl}, at: ${!!at}, sid: ${!!sid})`,
      );
    }

    this.cachedContext = {
      bl,
      at,
      sid,
      wizId,
    } as GeminiContext;
    return this.cachedContext as GeminiContext;
  }

  registerRoutes(router: Router) {
    router.get('/models', async (req, res) => {
      const account = findAccount(req, 'Gemini');
      if (!account) return res.status(401).json({ error: 'No account' });
      res.json(await this.getModels(account.credential));
    });
  }

  isModelSupported(model: string): boolean {
    // Gemini models in Elara are usually '0', '1', '2' or contain 'gemini'
    const m = model.toLowerCase();
    return m === '0' || m === '1' || m === '2' || m.includes('gemini');
  }
}
