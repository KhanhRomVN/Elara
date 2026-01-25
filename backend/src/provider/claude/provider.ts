import { Provider, SendMessageOptions } from '../types';
import { Router } from 'express';
import { HttpClient } from '../../utils/http-client';
import * as crypto from 'crypto';
import fetch from 'node-fetch';
import { findAccount } from '../../services/account-selector';
import { createLogger } from '../../utils/logger';
import { countTokens, countMessagesTokens } from '../../utils/tokenizer';

const logger = createLogger('ClaudeProvider');

const BASE_URL = 'https://claude.ai';

export class ClaudeProvider implements Provider {
  name = 'Claude';
  defaultModel = 'claude-3-5-sonnet-20241022';

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
    const client = this.createClient(credential);

    try {
      // 1. Get Organization
      const orgsRes = await client.get('/api/organizations');
      const orgs = await orgsRes.json();
      if (!orgs || !orgs.length) throw new Error('No organizations found');
      const orgId = orgs[0].uuid;

      // 2. Handle Conversation
      const convUuid = options.conversationId || crypto.randomUUID();
      let parentMessageUuid = '00000000-0000-4000-8000-000000000000';

      if (!options.conversationId) {
        await client.post(`/api/organizations/${orgId}/chat_conversations`, {
          uuid: convUuid,
          name: '',
        });
      } else {
        const lastId = await this.getLastMessageId(client, orgId, convUuid);
        if (lastId) parentMessageUuid = lastId;
      }

      // 3. Send Message
      const lastMessage = messages[messages.length - 1];
      const messagePayload = {
        prompt: lastMessage.content,
        timezone: 'Asia/Saigon',
        model: model || 'claude-3-5-sonnet-20241022',
        attachments: [],
        files: options.ref_file_ids || [],
        rendering_mode: 'messages',
        parent_message_uuid: parentMessageUuid,
        locale: 'en-US',
        tools: [
          { type: 'web_search_v0', name: 'web_search' },
          { type: 'artifacts_v0', name: 'artifacts' },
          { type: 'repl_v0', name: 'repl' },
        ],
        personalized_styles: [
          {
            type: 'default',
            key: 'Default',
            name: 'Normal',
            nameKey: 'normal_style_name',
            prompt: 'Normal\n',
            summary: 'Default responses from Claude',
            summaryKey: 'normal_style_summary',
            isDefault: true,
          },
        ],
      };

      const response = await client.post(
        `/api/organizations/${orgId}/chat_conversations/${convUuid}/completion`,
        messagePayload,
      );
      if (!response.ok) {
        const txt = await response.text();
        logger.error(`Claude API Error ${response.status}: ${txt}`);
        throw new Error(`Claude API Error ${response.status}: ${txt}`);
      }

      const promptTokens = countMessagesTokens(messages);
      let completionTokens = 0;

      if (onMetadata)
        onMetadata({
          conversation_id: convUuid,
          conversation_title: 'New Chat',
          total_token: promptTokens,
        });
      if (!response.body) throw new Error('No response body');

      let buffer = '';
      for await (const chunk of response.body) {
        const chunkStr = chunk.toString();
        buffer += chunkStr;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') {
              onDone();
              return;
            }
            try {
              const json = JSON.parse(jsonStr);
              // Handle old format
              if (json.completion) onContent(json.completion);

              // Handle "messages" rendering mode format
              if (json.type === 'content_block_delta' && json.delta?.text) {
                const deltaText = json.delta.text;
                completionTokens += countTokens(deltaText);
                onContent(deltaText);
                if (onMetadata) {
                  onMetadata({ total_token: promptTokens + completionTokens });
                }
              }

              if (json.stop_reason || json.type === 'message_stop') {
                onDone();
                return;
              }
            } catch (e) {}
          }
        }
      }
      onDone();
    } catch (err: any) {
      onError(err);
    }
  }

  async getConversations(
    credential: string,
    limit: number = 30,
  ): Promise<any[]> {
    const client = this.createClient(credential);
    const orgs = await (await client.get('/api/organizations')).json();
    if (!orgs.length) return [];
    const orgId = orgs[0].uuid;
    const res = await client.get(
      `/api/organizations/${orgId}/chat_conversations?limit=${limit}&consistency=eventual`,
    );
    return await res.json();
  }

  async getConversationDetail(
    credential: string,
    conversationId: string,
  ): Promise<any> {
    const client = this.createClient(credential);
    const orgsRes = await client.get('/api/organizations');
    const orgs = await orgsRes.json();
    if (!orgs || !orgs.length) throw new Error('No organizations found');
    const orgId = orgs[0].uuid;

    const res = await client.get(
      `/api/organizations/${orgId}/chat_conversations/${conversationId}?tree=True&rendering_mode=messages&render_all_tools=true&consistency=eventual`,
    );
    const data = await res.json();

    // Map Claude messages to unified format
    const messages = (data.chat_messages || []).map((m: any) => ({
      id: m.uuid,
      role: m.sender === 'human' ? 'user' : 'assistant',
      content: m.content?.[0]?.text || m.text || '',
      timestamp: m.created_at || Date.now() / 1000,
    }));

    const total_token = countMessagesTokens(messages);

    return {
      conversation_id: data.uuid,
      conversation_title: data.name || data.summary || 'Untitled',
      updated_at: data.updated_at || Date.now() / 1000,
      total_token,
      messages,
    };
  }

  private async getLastMessageId(
    client: HttpClient,
    orgId: string,
    convUuid: string,
  ): Promise<string | null> {
    try {
      const res = await client.get(
        `/api/organizations/${orgId}/chat_conversations/${convUuid}?tree=True&rendering_mode=messages`,
      );
      if (res.ok) {
        const data = await res.json();
        const messages = data?.chat_messages || [];
        if (messages.length > 0) {
          return messages[messages.length - 1].uuid;
        }
      }
    } catch (e) {
      logger.warn(`Failed to get last message ID for ${convUuid}:`, e);
    }
    return null;
  }

  async uploadFile(credential: string, file: any): Promise<any> {
    const client = this.createClient(credential);

    // 1. Get Org
    const orgs = await (await client.get('/api/organizations')).json();
    if (!orgs.length) throw new Error('No organizations found');
    const orgId = orgs[0].uuid;

    // 2. Prepare Multipart
    const boundary =
      '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
    const headers = {
      Cookie: `sessionKey=${credential}`,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
      Accept: 'application/json',
      'anthropic-client-platform': 'web_claude_ai',
      'anthropic-client-version': '1.0.0',
      'anthropic-device-id': crypto.randomUUID(),
      'anthropic-anonymous-id': `claudeai.v1.${crypto.randomUUID()}`,
    };

    // Claude expects 'file' field
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.originalname}"\r\nContent-Type: ${file.mimetype}\r\n\r\n`,
      ),
      file.buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await fetch(`${BASE_URL}/api/${orgId}/upload`, {
      method: 'POST',
      headers,
      body: body as any,
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Claude Upload Failed: ${res.status} ${txt}`);
    }

    const result = await res.json();
    // Expected response: {"file_uuid": "...", ...}
    if (result.file_uuid) {
      return result.file_uuid;
    }
    return result;
  }

  private createClient(credential: string) {
    return new HttpClient({
      baseURL: BASE_URL,
      headers: {
        Cookie: `sessionKey=${credential}`,
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Origin: BASE_URL,
        Referer: `${BASE_URL}/`,
        'anthropic-client-platform': 'web_claude_ai',
        'anthropic-client-version': '1.0.0',
        'anthropic-device-id': crypto.randomUUID(),
        'anthropic-anonymous-id': `claudeai.v1.${crypto.randomUUID()}`,
      },
    });
  }

  registerRoutes(router: Router) {
    router.get('/conversations', async (req, res) => {
      // Implementation...
      const account = findAccount(req, 'Claude');
      if (!account) return res.status(401).json({ error: 'No account' });
      try {
        const list = await this.getConversations(account.credential, 30);
        res.json(list);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });

    router.get('/conversations/:id', async (req, res) => {
      const account = findAccount(req, 'Claude');
      if (!account) return res.status(401).json({ error: 'No account' });
      try {
        const detail = await this.getConversationDetail(
          account.credential,
          req.params.id,
        );
        res.json(detail);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    });
  }

  isModelSupported(model: string): boolean {
    return model.toLowerCase().startsWith('claude-');
  }
}
