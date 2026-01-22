export class LMArenaStreamParser {
  processLine(line: string): { type: 'content' | 'session_id' | 'meta'; value: any }[] {
    const results: { type: 'content' | 'session_id' | 'meta'; value: any }[] = [];

    try {
      if (!line.trim() || line.trim() === '[DONE]') return results;

      const parsed = JSON.parse(line);

      // Handle standard OpenAI format (if backend outputs this)
      if (parsed.choices && parsed.choices[0]?.delta?.content) {
        const content = parsed.choices[0].delta.content;
        results.push({ type: 'content', value: content });
      }

      // Handle potential session ID if passed in metadata
      if (parsed.id) {
        results.push({ type: 'meta', value: { id: parsed.id } });
      }
    } catch (e) {
      // console.error('Error parsing line:', e);
    }
    return results;
  }
}
