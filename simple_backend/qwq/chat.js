export async function handleMessage(options) {
  const { messages, model, onContent, onDone, onError, conversationId } = options;

  const payload = {
    chatSessionId: conversationId || crypto.randomUUID(),
    messages: messages.map((m) => ({
      role: m.role.toLowerCase(),
      content: m.content,
    })),
    model: model,
  };

  try {
    const response = await fetch('https://qwq32.com/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        origin: 'https://qwq32.com',
        referer: 'https://qwq32.com/chat',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QWQ API returned ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (trimmedLine.startsWith('data: ')) {
          const dataStr = trimmedLine.substring(6);
          if (dataStr === '[DONE]') {
            continue;
          }

          try {
            const json = JSON.parse(dataStr);
            if (json.content) {
              onContent(json.content);
            }
          } catch (e) {
            // Silently ignore parsing errors
          }
        }
      }
    }

    onDone();
  } catch (err) {
    onError(err);
  }
}
