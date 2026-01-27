import { handleMessage } from './qwq/chat.js';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Vui lòng sử dụng phương thức POST', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response('Dữ liệu JSON không hợp lệ', { status: 400 });
    }

    const { messages, stream = true, model = 'allenai/molmo-2-8b:free' } = body;
    let { conversationId } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response('Thiếu tham số messages (array)', { status: 400 });
    }

    if (!conversationId) {
      conversationId = crypto.randomUUID();
    }

    // --- Chế độ Streaming (SSE) ---
    if (stream) {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      writer.write(encoder.encode(`data: ${JSON.stringify({ conversationId })}\n\n`));

      const options = {
        model,
        messages,
        conversationId,
        onContent: (content) => {
          writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
        },
        onDone: () => {
          writer.write(encoder.encode('data: [DONE]\n\n'));
          writer.close();
        },
        onError: (err) => {
          writer.write(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
          writer.close();
        },
      };

      ctx.waitUntil(handleMessage(options));

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // --- Chế độ Non-Streaming (JSON) ---
    let accumulatedContent = '';
    let errorMessage = null;

    return new Promise((resolve) => {
      const options = {
        model,
        messages,
        conversationId,
        onContent: (content) => {
          accumulatedContent += content;
        },
        onDone: () => {
          resolve(
            new Response(
              JSON.stringify({
                success: true,
                conversationId,
                message: {
                  role: 'assistant',
                  content: accumulatedContent,
                },
              }),
              {
                headers: {
                  'Content-Type': 'application/json; charset=utf-8',
                  'Access-Control-Allow-Origin': '*',
                },
              },
            ),
          );
        },
        onError: (err) => {
          resolve(
            new Response(
              JSON.stringify({
                success: false,
                error: err.message,
                conversationId,
              }),
              {
                status: 500,
                headers: {
                  'Content-Type': 'application/json; charset=utf-8',
                  'Access-Control-Allow-Origin': '*',
                },
              },
            ),
          );
        },
      };

      handleMessage(options);
    });
  },
};
