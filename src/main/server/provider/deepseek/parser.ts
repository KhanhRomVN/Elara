export class DeepSeekStreamParser {
  private nextDataType: string | null = null;

  processLine(
    line: string,
  ): { type: 'content' | 'thinking' | 'session_id' | 'token_usage' | 'meta'; value: any }[] {
    const results: {
      type: 'content' | 'thinking' | 'session_id' | 'token_usage' | 'meta';
      value: any;
    }[] = [];

    try {
      // Handle SSE events (e.g., "event: session_created")
      if (line.startsWith('event:')) {
        const eventType = line.replace('event:', '').trim();
        if (eventType === 'session_created') {
          this.nextDataType = 'session_created';
        }
        return results;
      }

      if (this.nextDataType === 'session_created') {
        if (line.trim()) {
          results.push({ type: 'session_id', value: line.trim() });
        }
        this.nextDataType = null;
        return results;
      }

      // Standard data line handling
      if (!line.trim() || !line.trim().startsWith('{')) return results;

      const parsed = JSON.parse(line);

      // Handle value updates - Check if 'v' exists and is a string
      if (parsed.v !== undefined && typeof parsed.v === 'string') {
        const value = parsed.v;
        const path = parsed.p;
        const op = parsed.o;

        // 1. Explicit Thinking Content Update
        if (path === 'response/thinking_content' || path?.endsWith('thinking_content')) {
          results.push({ type: 'thinking', value });
        }

        // 2. Explicit Content Update
        else if (path === 'response/content') {
          results.push({ type: 'content', value });
        }

        // 3. Fragment content update
        else if (path?.includes('fragments') && path?.endsWith('/content')) {
          results.push({ type: 'content', value });
        }

        // 4. Implicit Update
        else if (!path && value) {
          if (op !== 'BATCH' && op !== 'SET') {
            results.push({ type: 'content', value });
          }
        }
      }

      // Handle fragment array creation (e.g., {"p":"response/fragments","o":"APPEND","v":[{...}]})
      else if (Array.isArray(parsed.v) && parsed.p === 'response/fragments') {
        const fragment = parsed.v[0];
        if (fragment.type === 'THINK') {
          results.push({ type: 'thinking', value: fragment.content || '' });
        } else if (fragment.type === 'RESPONSE') {
          results.push({ type: 'content', value: fragment.content || '' });
        }
      }

      // Handle elapsed time
      else if (parsed.p?.endsWith('/elapsed_secs') || parsed.p?.endsWith('thinking_elapsed_secs')) {
        results.push({ type: 'meta', value: { thinking_elapsed: parsed.v } });
      }

      // Handle Batch operations for token usage
      if (parsed.o === 'BATCH' && Array.isArray(parsed.v)) {
        const tokenUsageItem = parsed.v.find((item: any) => item.p === 'accumulated_token_usage');
        if (tokenUsageItem && typeof tokenUsageItem.v === 'number') {
          results.push({ type: 'token_usage', value: tokenUsageItem.v });
        }
      }
    } catch (e) {
      console.error('Error parsing DeepSeek data:', e, 'Line:', line);
    }

    return results;
  }
}
