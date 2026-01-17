import { HttpClient } from '../../utils/http-client';
import { randomBytes } from 'crypto';

// Login is handled in main process, not backend

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

// UUIDv7 generator (time-based UUID)
const uuidv7 = (): string => {
  const timestamp = Date.now();
  const bytes = randomBytes(16);

  bytes[0] = Math.floor(timestamp / 0x10000000000) & 0xff;
  bytes[1] = Math.floor(timestamp / 0x100000000) & 0xff;
  bytes[2] = Math.floor(timestamp / 0x1000000) & 0xff;
  bytes[3] = Math.floor(timestamp / 0x10000) & 0xff;
  bytes[4] = Math.floor(timestamp / 0x100) & 0xff;
  bytes[5] = timestamp & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return [
    bytes.subarray(0, 4).toString('hex'),
    bytes.subarray(4, 6).toString('hex'),
    bytes.subarray(6, 8).toString('hex'),
    bytes.subarray(8, 10).toString('hex'),
    bytes.subarray(10, 16).toString('hex'),
  ].join('-');
};

export interface Account {
  id: string;
  email: string;
  provider: string;
  credential: string;
  status: string;
  userAgent?: string;
}

export async function getModels(account: Account) {
  const NEXT_ACTION_ID = '60dd5def2cd15cb0c3eb89a128f43e18bcf6d48eb0';

  const client = new HttpClient({
    baseURL: 'https://lmarena.ai',
    headers: {
      Cookie: account.credential,
      'Content-Type': 'text/plain;charset=UTF-8',
      'User-Agent': account.userAgent || USER_AGENT,
      'Next-Action': NEXT_ACTION_ID,
    },
  });

  try {
    const response = await client.post('/vi?mode=direct', [account.email || '']);
    const responseBody = await response.text();

    // Extract initialModels from RSC response
    const startStr = '"initialModels":';
    const startIndex = responseBody.indexOf(startStr);

    if (startIndex !== -1) {
      let arrayStart = startIndex + startStr.length;
      let arrayEnd = arrayStart;
      let stack = 0;
      let inString = false;

      for (let i = arrayStart; i < responseBody.length; i++) {
        const char = responseBody[i];
        if (char === '"' && responseBody[i - 1] !== '\\') {
          inString = !inString;
        }
        if (!inString) {
          if (char === '[') stack++;
          else if (char === ']') {
            stack--;
            if (stack === 0) {
              arrayEnd = i + 1;
              break;
            }
          }
        }
      }

      if (arrayEnd > arrayStart) {
        const arrayStr = responseBody.substring(arrayStart, arrayEnd);
        const models = JSON.parse(arrayStr);
        return models.map((m: any) => ({
          id: m.id,
          name: m.name || m.publicName || m.displayName,
          organization: m.organization,
          provider: m.provider,
        }));
      }
    }

    // Fallback
    return [
      { id: 'gpt-4o-2024-05-13', name: 'GPT-4o' },
      { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
    ];
  } catch (error) {
    console.error('[LMArena] Failed to fetch models:', error);
    return [];
  }
}

export async function chatCompletionStream(req: any, res: any, account: Account) {
  const { messages, model, conversation_id } = req.body;

  const client = new HttpClient({
    baseURL: 'https://lmarena.ai',
    headers: {
      Cookie: account.credential,
      'Content-Type': 'text/plain;charset=UTF-8',
      'User-Agent': account.userAgent || USER_AGENT,
      Origin: 'https://lmarena.ai',
    },
  });

  const lastMessage = messages[messages.length - 1];
  const userContent = lastMessage.content;

  const newMsgId = uuidv7();
  const sessionId = conversation_id || uuidv7();
  const isNewChat = !conversation_id;

  const url = isNewChat
    ? '/nextjs-api/stream/create-evaluation'
    : `/nextjs-api/stream/post-to-evaluation/${sessionId}`;

  const payload = {
    id: sessionId,
    mode: 'direct',
    modelAId: model,
    userMessageId: newMsgId,
    modelAMessageId: uuidv7(),
    ...(isNewChat ? { modality: 'chat' } : {}),
    userMessage: {
      content: userContent,
      experimental_attachments: [],
      metadata: {},
    },
  };

  try {
    const response = await client.post(url, payload, {
      headers: {
        Referer: `https://lmarena.ai/c/${sessionId}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!response.body) {
      return res.status(500).json({ error: 'No response body' });
    }

    // Process LMArena streaming format
    let buffer = '';
    for await (const chunk of response.body) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        if (line.startsWith('a0:')) {
          try {
            const contentStr = line.substring(3);
            const content = JSON.parse(contentStr);
            const msg = {
              choices: [{ delta: { content } }],
            };
            res.write(`data: ${JSON.stringify(msg)}\n\n`);
          } catch (e) {
            // Ignore parse errors
          }
        } else if (line.startsWith('ad:')) {
          const msg = {
            choices: [{ delta: {}, finish_reason: 'stop' }],
          };
          res.write(`data: ${JSON.stringify(msg)}\n\n`);
          res.write('data: [DONE]\n\n');
        }
      }
    }

    res.end();
  } catch (error: any) {
    console.error('[LMArena] Stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}
