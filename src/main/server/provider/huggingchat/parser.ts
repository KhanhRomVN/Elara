export class HuggingChatStreamParser {
  processLine(
    line: string,
  ): { type: 'content' | 'title' | 'session_id' | 'meta' | 'error'; value: any }[] {
    const results: { type: 'content' | 'title' | 'session_id' | 'meta' | 'error'; value: any }[] =
      [];

    try {
      if (!line.trim()) return results;

      // Handle raw line cleaning if needed (though chat.ts should handle it)
      const cleanedLine = line.replace(/\\u0000/g, '');
      const parsed = JSON.parse(cleanedLine);

      if (parsed.error) {
        results.push({ type: 'error', value: parsed.error });
        return results;
      }

      // Handle stream token updates
      if (parsed.type === 'stream') {
        const token = parsed.token || '';
        results.push({ type: 'content', value: token });
      }

      // Handle final answer
      else if (parsed.type === 'finalAnswer') {
        const finalText = parsed.text || '';
        // In unified stream, we can use this as a fallback if needed
        // but typically we rely on 'stream' events
      }

      // Handle status/title updates
      else if (parsed.type === 'title' && parsed.title) {
        results.push({ type: 'title', value: parsed.title });
      }

      // Handle conversation ID creation
      else if (parsed.type === 'conversation' && parsed.id) {
        results.push({ type: 'session_id', value: parsed.id });
      }

      // Handle message metadata
      else if (parsed.id && parsed.from === 'assistant') {
        results.push({ type: 'meta', value: { message_id: parsed.id } });
      }

      // Handle updates array
      else if (parsed.updates && Array.isArray(parsed.updates)) {
        for (const update of parsed.updates) {
          if (update.type === 'stream' && update.token) {
            results.push({ type: 'content', value: update.token });
          }
        }
      }
    } catch (e) {
      // JSON.parse might fail on partial lines, ignore them
    }

    return results;
  }
}
