import { net } from 'electron';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import { join } from 'path';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import { startProxy, stopProxy, proxyEvents } from './proxy';
import { ChatPayload } from './deepseek';

const BASE_URL = 'https://www.perplexity.ai';

export async function chatCompletionStream(
  token: string, // Session token from cookies
  payload: ChatPayload,
  userAgent: string | undefined,
  callbacks: {
    onContent: (content: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
  },
) {
  try {
    const apiUrl = `${BASE_URL}/rest/sse/perplexity_ask`;
    const cookie = token; // Expect full cookie string

    // Build the request payload matching perplexity-ask.md
    const prompt = payload.messages[payload.messages.length - 1].content;

    const requestBody = {
      params: {
        attachments: [],
        language: 'en-US',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        search_focus: 'internet',
        sources: ['web'],
        search_recency_filter: null,
        frontend_uuid: randomUUID(),
        mode: 'concise',
        model_preference: 'turbo',
        is_related_query: false,
        is_sponsored: false,
        frontend_context_uuid: randomUUID(),
        prompt_source: 'user',
        query_source: 'home',
        is_incognito: false,
        use_schematized_api: true,
        send_back_text_in_streaming_api: false,
        supported_block_use_cases: [
          'answer_modes',
          'media_items',
          'knowledge_cards',
          'inline_entity_cards',
          'place_widgets',
          'finance_widgets',
          'prediction_market_widgets',
          'sports_widgets',
          'flight_status_widgets',
          'news_widgets',
          'shopping_widgets',
          'jobs_widgets',
          'search_result_widgets',
          'inline_images',
          'inline_assets',
          'placeholder_cards',
          'diff_blocks',
          'inline_knowledge_cards',
          'entity_group_v2',
          'refinement_filters',
          'canvas_mode',
          'maps_preview',
          'answer_tabs',
          'price_comparison_widgets',
          'preserve_latex',
          'generic_onboarding_widgets',
          'in_context_suggestions',
        ],
        client_coordinates: null,
        mentions: [],
        dsl_query: prompt,
        skip_search_enabled: true,
        is_nav_suggestions_disabled: false,
        source: 'default',
        always_search_override: false,
        override_no_search: false,
        should_ask_for_mcp_tool_confirmation: true,
        browser_agent_allow_once_from_toggle: false,
        force_enable_browser_agent: false,
        supported_features: ['browser_agent_permission_banner_v1.1'],
        version: '2.18',
      },
      query_str: prompt,
    };

    const request = net.request({
      method: 'POST',
      url: apiUrl,
    });

    // Set headers based on perplexity-ask.md
    request.setHeader('Content-Type', 'application/json');
    request.setHeader('Accept', 'text/event-stream');
    request.setHeader('Cookie', cookie);
    request.setHeader('Origin', BASE_URL);
    request.setHeader('Referer', `${BASE_URL}/`);
    if (userAgent) request.setHeader('User-Agent', userAgent);

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        let errorBody = '';
        response.on('data', (chunk) => (errorBody += chunk.toString()));
        response.on('end', () =>
          callbacks.onError(new Error(`Perplexity API Error ${response.statusCode}: ${errorBody}`)),
        );
        return;
      }

      let buffer = '';
      const decoder = new TextDecoder();

      response.on('data', (chunk) => {
        const text = decoder.decode(chunk, { stream: true });
        buffer += text;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: message')) continue;
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              console.log('[Perplexity] Received chunk of length:', dataStr.length);

              // Extract content from streaming response
              if (data.blocks) {
                for (const block of data.blocks) {
                  if (block.intended_usage === 'ask_text_0_markdown') {
                    console.log('[Perplexity] Found text block. Has diff:', !!block.diff_block);
                    if (block.diff_block) {
                      const patches = block.diff_block.patches;
                      console.log('[Perplexity] Patch count:', patches?.length);
                      for (const patch of patches) {
                        if (patch.value && patch.value.chunks) {
                          console.log('[Perplexity] Patch chunks:', patch.value.chunks.length);
                          for (const chunk of patch.value.chunks) {
                            console.log('[Perplexity] Emitting chunk:', chunk);
                            callbacks.onContent(chunk);
                          }
                        } else {
                          console.log(
                            '[Perplexity] Patch has no value/chunks:',
                            JSON.stringify(patch).slice(0, 100),
                          );
                        }
                      }
                    } else {
                      console.log('[Perplexity] Text block has no diff_block');
                    }
                  } else {
                    // console.log('[Perplexity] Other block:', block.intended_usage);
                  }
                }
              }

              // Check for final message
              if (data.final_sse_message) {
                console.log('[Perplexity] Final SSE message received');
                callbacks.onDone();
              }
            } catch (e) {
              // Skip unparseable lines
            }
          }
        }
      });

      response.on('end', () => {
        console.log('[Perplexity] Response ended');
        callbacks.onDone();
      });

      response.on('error', (err: Error) => callbacks.onError(err));
    });

    request.on('error', (err) => callbacks.onError(err));
    request.write(JSON.stringify(requestBody));
    request.end();
  } catch (error: any) {
    console.error('[Perplexity] Error:', error);
    callbacks.onError(error);
  }
}

// Get Perplexity conversations (placeholder - would need to implement based on their API)
export async function getConversations(
  token: string,
  userAgent?: string,
  limit: number = 20,
): Promise<any[]> {
  // Perplexity doesn't expose a simple history API in the docs provided
  // Return empty array for now
  return [];
}

const findChrome = (): string | null => {
  const commonPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }

  try {
    const output = execSync('which google-chrome || which chromium', { encoding: 'utf-8' });
    if (output.trim()) return output.trim();
  } catch (e) {
    // ignore
  }

  return null;
};

export async function login() {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('Chrome or Chromium not found. Please install it to use Perplexity.');
  }

  const profilePath = join(app.getPath('userData'), 'profiles', 'perplexity');
  if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(profilePath, { recursive: true });
  }

  console.log('[Perplexity] Starting Proxy...');
  await startProxy();

  console.log('[Perplexity] Spawning Chrome at:', chromePath);

  const args = [
    '--proxy-server=http=127.0.0.1:8080;https=127.0.0.1:8080',
    '--proxy-bypass-list=<-loopback>',
    '--ignore-certificate-errors',
    `--user-data-dir=${profilePath}`,
    '--disable-http2',
    '--disable-quic',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    '--class=perplexity-browser',
    'https://www.perplexity.ai/',
  ];

  const chromeProcess = spawn(chromePath, args, {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (chromeProcess.stdout) {
    chromeProcess.stdout.on('data', (data) => console.log(`[Perplexity Chrome Out]: ${data}`));
  }
  if (chromeProcess.stderr) {
    chromeProcess.stderr.on('data', (data) => console.error(`[Perplexity Chrome Err]: ${data}`));
  }

  return new Promise<{ cookies: string; email: string }>((resolve, reject) => {
    let resolved = false;
    let capturedCookies = '';

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        chromeProcess.kill();
        stopProxy();
        proxyEvents.off('perplexity-cookies', onCookies);
      }
    };

    const onCookies = (cookies: string) => {
      console.log('[Perplexity] Cookies captured!');
      capturedCookies = cookies;
      // Resolve after a short delay
      setTimeout(() => {
        cleanup();
        resolve({ cookies: capturedCookies, email: '' });
      }, 1000);
    };

    proxyEvents.on('perplexity-cookies', onCookies);

    chromeProcess.on('close', (code) => {
      if (!resolved) {
        if (capturedCookies) {
          cleanup();
          resolve({ cookies: capturedCookies, email: '' });
        } else {
          console.log('[Perplexity] Chrome closed with code:', code);
          cleanup();
          reject(new Error('Chrome user closed the window before login completed'));
        }
      }
    });
  });
}
