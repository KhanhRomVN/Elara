import { net } from 'electron';

export async function sendMessage(
  token: string,
  model: string,
  messages: any[],
  onProgress: (content: string) => void,
) {
  const payload = {
    model: model || 'command-r7b-12-2024',
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    stream: true,
  };

  return new Promise<void>((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: 'https://api.cohere.com/v2/chat',
    });

    request.setHeader('Authorization', `Bearer ${token}`);
    request.setHeader('Content-Type', 'application/json');
    request.setHeader('User-Agent', 'Elara/1.0.0');

    request.write(JSON.stringify(payload));

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        let errorData = '';
        response.on('data', (d) => {
          errorData += d.toString();
        });
        response.on('end', () => {
          console.error('[Cohere] API Error Body:', errorData);
          reject(new Error(`Cohere API returned ${response.statusCode}: ${errorData}`));
        });
        return;
      }

      let buffer = '';
      response.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

          if (trimmedLine.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmedLine.substring(6));
              // Cohere v2 stream format: https://docs.cohere.com/reference/chat-v2
              if (json.type === 'content-delta' && json.delta?.message?.content?.text) {
                onProgress(json.delta.message.content.text);
              }
            } catch (e) {
              // Ignore parse errors for partial chunks
            }
          }
        }
      });

      response.on('end', () => {
        resolve();
      });

      response.on('error', (e: any) => reject(e));
    });

    request.on('error', (e) => reject(e));
    request.end();
  });
}
