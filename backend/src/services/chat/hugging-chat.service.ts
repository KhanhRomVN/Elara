import { HttpClient } from '../../utils/http-client';

// Login is handled in main process, not backend

export interface Account {
  id: string;
  email: string;
  provider: string;
  credential: string;
  status: string;
  userAgent?: string;
}

export async function chatCompletionStream(req: any, res: any, account: Account) {
  const { model, messages } = req.body;

  const client = new HttpClient({
    baseURL: 'https://huggingface.co',
    headers: {
      Cookie: account.credential,
      'Content-Type': 'application/json',
      'User-Agent':
        account.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Origin: 'https://huggingface.co',
      Referer: 'https://huggingface.co/chat/',
    },
  });

  try {
    // Create conversation if needed
    let conversationId = req.body.conversation_id;

    if (!conversationId || conversationId === 'new') {
      const createResponse = await client.post('/chat/conversation', {
        model: model || 'meta-llama/Meta-Llama-3.1-70B-Instruct',
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('[HuggingChat] Create conversation error:', createResponse.status, errorText);
        return res.status(createResponse.status).json({ error: errorText });
      }

      const createData = (await createResponse.json()) as any;
      conversationId = createData.conversationId;

      // Send conversation ID to client
      res.setHeader('X-Conversation-Id', conversationId);
    }

    // Send message
    const lastMessage = messages[messages.length - 1];
    const payload = {
      inputs: lastMessage.content,
      parameters: {
        temperature: 0.7,
        top_p: 0.95,
        max_new_tokens: 1024,
      },
    };

    const response = await client.post(`/chat/conversation/${conversationId}`, payload);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[HuggingChat] API Error:', response.status, errorText);
      return res.status(response.status).json({ error: errorText });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!response.body) {
      return res.status(500).json({ error: 'No response body' });
    }

    // Stream response
    let buffer = '';
    for await (const chunk of response.body) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6).trim();
          if (jsonStr === '[DONE]') {
            res.write('data: [DONE]\n\n');
            continue;
          }

          try {
            const json = JSON.parse(jsonStr);
            if (json.token?.text) {
              const formatted = {
                choices: [{ delta: { content: json.token.text } }],
              };
              res.write(`data: ${JSON.stringify(formatted)}\n\n`);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    res.end();
  } catch (error: any) {
    console.error('[HuggingChat] Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}
