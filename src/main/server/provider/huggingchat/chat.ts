import { Request, Response } from 'express';
import { Account } from '../../../ipc/accounts';
import { request as httpRequest } from 'https';
import { randomUUID } from 'crypto';
import { getCookies, buildCookieHeader, fetchJson } from './api';

// Simple stream parser for HuggingChat response
class HuggingChatStreamParser {
  processLine(line: string): Array<{ type: string; value: any }> {
    const results = [];
    try {
      // HuggingChat stream format: data: {...}
      if (line.startsWith('data: ')) {
        const dataStr = line.substring(6).trim();
        if (dataStr === '[DONE]') {
          results.push({ type: 'done', value: null });
        } else {
          try {
            const parsed = JSON.parse(dataStr);
            results.push({ type: 'data', value: parsed });
          } catch (e) {
            results.push({ type: 'error', value: `Invalid JSON: ${dataStr}` });
          }
        }
      } else {
        results.push({ type: 'raw', value: line });
      }
    } catch (e) {
      results.push({ type: 'error', value: (e as Error).message });
    }
    return results;
  }
}

// Get conversation list
export const getConversations = (cookies: string, page: number = 0): Promise<any> => {
  return new Promise(async (resolve, reject) => {
    try {
      const json = await fetchJson(
        `https://huggingface.co/chat/api/v2/conversations?p=${page}`,
        cookies,
      );
      resolve(json);
    } catch (e) {
      console.error('[HuggingChat] Error fetching conversations:', e);
      reject(e as Error);
    }
  });
};

// Get specific conversation detail
export const getConversation = (cookies: string, conversationId: string): Promise<any> => {
  return new Promise(async (resolve, reject) => {
    try {
      const json = await fetchJson(
        `https://huggingface.co/chat/api/v2/conversations/${conversationId}`,
        cookies,
      );
      resolve(json);
    } catch (e) {
      console.error('[HuggingChat] Error fetching conversation:', e);
      reject(e as Error);
    }
  });
};

// Create a new conversation
const createConversation = (cookies: string, model: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    console.log('[HuggingChat] Creating new conversation...');

    // Use proper HTTPS request
    const postData = JSON.stringify({ model, preprompt: '' });

    const options = {
      method: 'POST',
      hostname: 'huggingface.co',
      path: '/chat/conversation',
      headers: {
        Cookie: cookies,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        Origin: 'https://huggingface.co',
        Referer: 'https://huggingface.co/chat/',
      },
    };

    const req = httpRequest(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk.toString()));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.conversationId) {
            console.log('[HuggingChat] New conversation created:', json.conversationId);
            resolve(json.conversationId);
          } else {
            console.error('[HuggingChat] Failed to create conversation, response:', json);
            reject(new Error('Failed to create conversation'));
          }
        } catch (e) {
          console.error('[HuggingChat] Error parsing create conversation response:', e);
          reject(e as Error);
        }
      });
    });

    req.on('error', (e) => {
      console.error('[HuggingChat] Create conversation error:', e);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
};

// Chat completion stream
export const chatCompletionStream = async (req: Request, res: Response, account: Account) => {
  const { messages, model, conversation_id } = req.body;
  console.log(
    '[HuggingChat] Starting chat stream, model:',
    model,
    'conversation_id:',
    conversation_id,
  );
  const cookies = getCookies(account);
  const cookieHeader = buildCookieHeader(cookies);

  // Get the last user message
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') {
    res.status(400).json({ error: 'Last message must be from user' });
    return;
  }

  const userContent = lastMessage.content;
  console.log('[HuggingChat] User message:', userContent.substring(0, 100) + '...');

  // Determine conversation ID - use existing or let server create new one
  let targetConversationId = conversation_id;

  if (!targetConversationId) {
    try {
      targetConversationId = await createConversation(cookieHeader, model);
    } catch (e: any) {
      console.error('[HuggingChat] Failed to create new conversation:', e);
      res.status(500).json({ error: 'Failed to create new conversation: ' + e.message });
      return;
    }
  }

  // ---------------------------------------------------------------------
  // CRITICAL STEP: Fetch conversation details to get the REAL parent ID
  // ---------------------------------------------------------------------
  let parentMessageId = '';
  try {
    console.log('[HuggingChat] Fetching details for conversation:', targetConversationId);
    const convoDetails = await getConversation(cookieHeader, targetConversationId);
    const details = convoDetails.json || convoDetails; // Handle potential wrapper

    // Logic to find parent ID from message history
    if (details.messages && details.messages.length > 0) {
      // The last message in the array is usually the one we want to reply to
      const lastMsg = details.messages[details.messages.length - 1];
      parentMessageId = lastMsg.id;
      console.log('[HuggingChat] Found parent message ID from history:', parentMessageId);
    } else if (details.rootMessageId) {
      // If no messages yet (just created), use rootMessageId
      parentMessageId = details.rootMessageId;
      console.log('[HuggingChat] Using root message ID:', parentMessageId);
    } else {
      console.warn('[HuggingChat] No parent ID found, using random UUID (might fail)');
      parentMessageId = randomUUID();
    }
  } catch (e) {
    console.error('[HuggingChat] Failed to fetch conversation details:', e);
    // Fallback
    parentMessageId = randomUUID();
  }

  // Build multipart form data
  const boundary =
    '----WebKitFormBoundary' +
    Math.random().toString(36).substring(2, 14) +
    Math.random().toString(36).substring(2, 14);
  let formData = '';

  // Construct proper payload matching user sample EXACTLY
  const payload = {
    inputs: userContent,
    id: parentMessageId, // <--- Using the fetched parent ID
    is_retry: false,
    is_continue: false,
    selectedMcpServerNames: [],
    selectedMcpServers: [],
  };

  // Add message content - PAY ATTENTION TO CRLF
  formData += `--${boundary}\r\n`;
  formData += `Content-Disposition: form-data; name="data"\r\n\r\n`;
  formData += JSON.stringify(payload) + '\r\n';
  formData += `--${boundary}--\r\n`;

  // Use Buffer to get exact byte length
  const formBuffer = Buffer.from(formData, 'utf-8');

  // Use Node.js HTTPS module instead of Electron net Request
  const path = `/chat/conversation/${targetConversationId}`;

  const options = {
    method: 'POST',
    hostname: 'huggingface.co',
    path: path,
    headers: {
      Cookie: cookieHeader,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': formBuffer.length, // EXPLICIT CONTENT LENGTH
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Origin: 'https://huggingface.co',
      Referer: `https://huggingface.co/chat/conversation/${targetConversationId}`,
      Priority: 'u=1, i',
    },
  };

  console.log('[HuggingChat] Sending HTTPS request to:', 'https://huggingface.co' + path);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (targetConversationId) {
    const convoEvent = { type: 'conversation', id: targetConversationId };
    res.write(`data: ${JSON.stringify(convoEvent)}\n\n`);
  }

  const parser = new HuggingChatStreamParser();

  // Make request
  const reqStream = httpRequest(options, (response) => {
    console.log('[HuggingChat] Response status:', response.statusCode);

    if (response.statusCode !== 200) {
      let errData = '';
      response.on('data', (c) => (errData += c));
      response.on('end', () => {
        res.write(
          `data: ${JSON.stringify({ error: `HuggingChat API Error ${response.statusCode}: ${errData}` })}\n\n`,
        );
        res.end();
      });
      return;
    }

    response.on('data', (chunk) => {
      const rawData = chunk.toString();
      const lines = rawData.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        const results = parser.processLine(line);
        for (const result of results) {
          if (result.type === 'error') {
            console.error('[HuggingChat] Stream error:', result.value);
            res.write(`data: ${JSON.stringify({ error: result.value })}\n\n`);
          } else {
            // Forward everything else to client
            res.write(`data: ${line}\n\n`);
          }
        }
      }
    });

    response.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });

  reqStream.on('error', (e) => {
    console.error('[HuggingChat] Stream request error:', e);
    res.write(`data: ${JSON.stringify({ error: e.message })}\\n\\n`);
    res.end();
  });

  reqStream.write(formBuffer);
  reqStream.end();
};

// Summarize conversation
export const summarizeConversation = (cookies: string, conversationId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    console.log('[HuggingChat] Summarizing conversation:', conversationId);

    const match = conversationId.match(/[a-zA-Z0-9]+/);
    const path = `/chat/conversation/${conversationId}/summarize`;

    const options = {
      method: 'POST',
      hostname: 'huggingface.co',
      path: path,
      headers: {
        Cookie: cookies,
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        Origin: 'https://huggingface.co',
        Referer: `https://huggingface.co/chat/conversation/${conversationId}`,
        Priority: 'u=1, i',
      },
    };

    const req = httpRequest(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk.toString()));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.title) {
            console.log('[HuggingChat] Conversation summarized:', json.title);
            resolve(json.title);
          } else {
            console.error('[HuggingChat] Failed to summarize, response:', json);
            reject(new Error('Failed to summarize conversation'));
          }
        } catch (e) {
          console.error('[HuggingChat] Error parsing summarize response:', e);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error('[HuggingChat] Summarize request error:', e);
      reject(e);
    });

    req.end();
  });
};
