export class StreamingThinkingParser {
  private inThinking = false;
  private currentCloseTag = '';
  private buffer = '';
  private onContent: (chunk: string) => void;
  private onThinking?: (chunk: string) => void;

  private readonly openTags = ['<thinking>', '<think>'];
  private readonly tagPairs: Record<string, string> = {
    '<thinking>': '</thinking>',
    '<think>': '</think>',
  };

  constructor(
    onContent: (chunk: string) => void,
    onThinking?: (chunk: string) => void,
  ) {
    this.onContent = onContent;
    this.onThinking = onThinking;
  }

  feed(chunk: string) {
    this.buffer += chunk;

    while (this.buffer.length > 0) {
      if (!this.inThinking) {
        // Find if any open tag exists in buffer
        let earliestPos = -1;
        let matchedOpenTag = '';

        for (const tag of this.openTags) {
          const pos = this.buffer.indexOf(tag);
          if (pos !== -1 && (earliestPos === -1 || pos < earliestPos)) {
            earliestPos = pos;
            matchedOpenTag = tag;
          }
        }

        if (earliestPos === -1) {
          // Check for partial tag at end of buffer
          let possiblePartial = false;
          for (const tag of this.openTags) {
            for (let i = 1; i < tag.length; i++) {
              if (this.buffer.endsWith(tag.slice(0, i))) {
                const safePart = this.buffer.slice(0, this.buffer.length - i);
                if (safePart) {
                  this.onContent(safePart);
                }
                this.buffer = this.buffer.slice(this.buffer.length - i);
                possiblePartial = true;
                break;
              }
            }
            if (possiblePartial) break;
          }
          if (!possiblePartial) {
            this.onContent(this.buffer);
            this.buffer = '';
          }
          break;
        } else {
          // Emit text before the tag
          const beforeTag = this.buffer.slice(0, earliestPos);
          if (beforeTag) {
            this.onContent(beforeTag);
          }
          this.inThinking = true;
          this.currentCloseTag = this.tagPairs[matchedOpenTag];
          this.buffer = this.buffer.slice(earliestPos + matchedOpenTag.length);
        }
      } else {
        // Look for currentCloseTag
        const endPos = this.buffer.indexOf(this.currentCloseTag);
        if (endPos === -1) {
          // Check for partial close tag at end of buffer
          let possiblePartial = false;
          for (let i = 1; i < this.currentCloseTag.length; i++) {
            if (this.buffer.endsWith(this.currentCloseTag.slice(0, i))) {
              const safePart = this.buffer.slice(0, this.buffer.length - i);
              if (safePart && this.onThinking) {
                this.onThinking(safePart);
              }
              this.buffer = this.buffer.slice(this.buffer.length - i);
              possiblePartial = true;
              break;
            }
          }
          if (!possiblePartial) {
            if (this.onThinking) {
              this.onThinking(this.buffer);
            }
            this.buffer = '';
          }
          break;
        } else {
          const thinkingText = this.buffer.slice(0, endPos);
          if (thinkingText && this.onThinking) {
            this.onThinking(thinkingText);
          }
          this.inThinking = false;
          this.buffer = this.buffer.slice(endPos + this.currentCloseTag.length);
          if (this.buffer.startsWith('\n')) {
            this.buffer = this.buffer.slice(1);
          }
          this.currentCloseTag = '';
        }
      }
    }
  }

  flush() {
    if (this.buffer) {
      if (this.inThinking && this.onThinking) {
        this.onThinking(this.buffer);
      } else {
        this.onContent(this.buffer);
      }
      this.buffer = '';
    }
  }
}
