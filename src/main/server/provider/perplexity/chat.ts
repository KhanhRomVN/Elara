import { net } from 'electron';
import { randomUUID } from 'crypto';
import { PerplexityChatPayload as ChatPayload } from './types';
import { BASE_URL } from './api';

export async function chatCompletionStream(
  token: string, // Session token from cookies
  payload: ChatPayload,
  userAgent: string | undefined,
  callbacks: {
    onContent: (content: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
    onMetadata?: (metadata: any) => void;
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
        mode: 'concise',
        model_preference: 'turbo',
        is_related_query: false,
        is_sponsored: false,
        frontend_context_uuid: randomUUID(),
        frontend_uuid: payload.frontend_uuid || randomUUID(),
        query_source: payload.last_backend_uuid ? 'followup' : 'home',
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
        ...(payload.last_backend_uuid
          ? {
              search_model_uuid: payload.last_backend_uuid || null,
              read_write_token: payload.read_write_token,
              backend_uuid: payload.last_backend_uuid,
              conversation_uuid: payload.conversation_uuid,
            }
          : {}),
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
                // Check if we have backend_uuid/read_write_token in this chunk to emit as metadata
                if (data.backend_uuid && callbacks.onMetadata) {
                  callbacks.onMetadata({
                    backend_uuid: data.backend_uuid,
                    read_write_token: data.read_write_token || payload.read_write_token,
                    frontend_uuid: payload.frontend_uuid,
                    conversation_uuid: data.conversation_uuid || payload.conversation_uuid,
                  });
                }

                for (const block of data.blocks) {
                  if (block.intended_usage === 'ask_text_0_markdown') {
                    console.log('[Perplexity] Found text block. Has diff:', !!block.diff_block);
                    if (block.diff_block) {
                      const patches = block.diff_block.patches;
                      console.log('[Perplexity] Patch count:', patches?.length);
                      for (const patch of patches) {
                        if (typeof patch.value === 'string') {
                          console.log('[Perplexity] Emitting string chunk:', patch.value);
                          callbacks.onContent(patch.value);
                        } else if (patch.value && patch.value.chunks) {
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

// Get Perplexity conversations
export async function getConversations(
  token: string,
  userAgent?: string,
  limit: number = 20,
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    try {
      if (!token) {
        resolve([]);
        return;
      }

      const requestBody = {
        limit: limit,
        ascending: false,
        offset: 0,
      };

      const request = net.request({
        method: 'POST',
        url: `${BASE_URL}/rest/thread/list_ask_threads?version=2.18&source=default`,
      });

      request.setHeader('Content-Type', 'application/json');
      request.setHeader('Cookie', token);
      request.setHeader('Origin', BASE_URL);
      request.setHeader('Referer', `${BASE_URL}/`);
      if (userAgent) request.setHeader('User-Agent', userAgent);

      request.on('response', (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk.toString();
        });

        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              const data = JSON.parse(body);
              // Transform to generic format expected by frontend
              const formatted = data.map((thread: any) => ({
                id: thread.uuid, // Use uuid as ID
                title: thread.title,
                updated_at: new Date(thread.last_query_datetime).getTime() / 1000, // Unix timestamp in seconds
                created_at: new Date(thread.last_query_datetime).getTime() / 1000, // fallback
              }));
              resolve(formatted);
            } catch (e) {
              console.error('[Perplexity] Failed to parse history:', e);
              reject(e);
            }
          } else {
            console.error(`[Perplexity] History API error ${response.statusCode}: ${body}`);
            reject(new Error(`Perplexity API Error ${response.statusCode}`));
          }
        });
      });

      request.on('error', (err) => {
        reject(err);
      });

      request.write(JSON.stringify(requestBody));
      request.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Get Perplexity conversation detail
export async function getConversationDetail(
  token: string,
  id: string,
  userAgent?: string,
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    try {
      if (!token) {
        resolve([]);
        return;
      }

      const url = `${BASE_URL}/rest/thread/${id}?with_parent_info=true&with_schematized_response=true&version=2.18&source=default&limit=10&offset=0&from_first=true&supported_block_use_cases=answer_modes&supported_block_use_cases=media_items&supported_block_use_cases=knowledge_cards&supported_block_use_cases=inline_entity_cards&supported_block_use_cases=place_widgets&supported_block_use_cases=finance_widgets&supported_block_use_cases=prediction_market_widgets&supported_block_use_cases=sports_widgets&supported_block_use_cases=flight_status_widgets&supported_block_use_cases=news_widgets&supported_block_use_cases=shopping_widgets&supported_block_use_cases=jobs_widgets&supported_block_use_cases=search_result_widgets&supported_block_use_cases=inline_images&supported_block_use_cases=inline_assets&supported_block_use_cases=placeholder_cards&supported_block_use_cases=diff_blocks&supported_block_use_cases=inline_knowledge_cards&supported_block_use_cases=entity_group_v2&supported_block_use_cases=refinement_filters&supported_block_use_cases=canvas_mode&supported_block_use_cases=maps_preview&supported_block_use_cases=answer_tabs&supported_block_use_cases=price_comparison_widgets&supported_block_use_cases=preserve_latex&supported_block_use_cases=generic_onboarding_widgets&supported_block_use_cases=in_context_suggestions`;

      const request = net.request({
        method: 'GET',
        url: url,
      });

      request.setHeader('Content-Type', 'application/json');
      request.setHeader('Cookie', token);
      request.setHeader('Origin', BASE_URL);
      request.setHeader('Referer', `${BASE_URL}/`);
      if (userAgent) request.setHeader('User-Agent', userAgent);

      request.on('response', (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk.toString();
        });

        response.on('end', () => {
          console.log(`[Perplexity] Detail response status: ${response.statusCode}`);
          if (response.statusCode === 200) {
            try {
              console.log('[Perplexity] Parsing detail response...');
              const data = JSON.parse(body);
              console.log(
                '[Perplexity] Detail entries count:',
                data.entries ? data.entries.length : 0,
              );

              const messages: any[] = [];

              if (data && data.entries) {
                for (const entry of data.entries) {
                  // User message
                  if (entry.query_str) {
                    messages.push({
                      id: randomUUID(),
                      role: 'user',
                      content: entry.query_str,
                      timestamp: new Date(),
                    });
                  }

                  // Assistant message
                  let assistantContent = '';
                  if (entry.blocks) {
                    console.log(
                      '[Perplexity] Checking blocks for entry:',
                      entry.blocks.length,
                      entry.blocks.map((b: any) => b.intended_usage),
                    );
                    for (const block of entry.blocks) {
                      if (
                        block.intended_usage === 'ask_text_0_markdown' ||
                        block.intended_usage === 'ask_text'
                      ) {
                        if (block.markdown_block && block.markdown_block.answer) {
                          assistantContent = block.markdown_block.answer;
                          break;
                        }
                      }
                    }
                  } else {
                    console.log('[Perplexity] No blocks in entry');
                  }

                  if (assistantContent) {
                    messages.push({
                      id: entry.uuid || randomUUID(),
                      role: 'assistant',
                      content: assistantContent,
                      timestamp: new Date(),
                      // Store context for replying
                      backend_uuid: entry.backend_uuid,
                      read_write_token: data.read_write_token, // From top-level response
                    });
                  } else {
                    console.log('[Perplexity] No assistant content found for entry');
                  }
                }
              }

              console.log('[Perplexity] Parsed messages count:', messages.length);
              resolve(messages);
            } catch (e) {
              console.error('[Perplexity] Failed to parse detail:', e);
              reject(e);
            }
          } else {
            console.error(`[Perplexity] Detail API error ${response.statusCode}: ${body}`);
            reject(new Error(`Perplexity API Error ${response.statusCode}`));
          }
        });
      });

      request.on('error', (err) => {
        reject(err);
      });

      request.end();
    } catch (error) {
      reject(error);
    }
  });
}
