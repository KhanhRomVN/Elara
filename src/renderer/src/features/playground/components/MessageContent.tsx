import React, { useState } from 'react';
import { CodeBlock } from '../../../core/components/CodeBlock';
import { getFileIconPath } from '../../../shared/utils/fileIconMapper';
import { Copy, Download, Check } from 'lucide-react';

interface MessageContentProps {
  content: string;
}

/**
 * Parses markdown content and renders code blocks with syntax highlighting
 */
export const MessageContent: React.FC<MessageContentProps> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownload = (code: string, language: string) => {
    const extensions: Record<string, string> = {
      python: 'py',
      javascript: 'js',
      typescript: 'ts',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      csharp: 'cs',
      go: 'go',
      rust: 'rs',
      ruby: 'rb',
      php: 'php',
      swift: 'swift',
      kotlin: 'kt',
      sql: 'sql',
      html: 'html',
      css: 'css',
      json: 'json',
      yaml: 'yml',
      xml: 'xml',
      markdown: 'md',
      bash: 'sh',
      shell: 'sh',
    };

    const ext = extensions[language.toLowerCase()] || 'txt';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Parse markdown code blocks: ```language\ncode\n```
  const parseContent = (text: string) => {
    const parts: React.ReactNode[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        const textBefore = text.substring(lastIndex, match.index);
        parts.push(
          <span key={`text-${key++}`} className="whitespace-pre-wrap">
            {textBefore}
          </span>,
        );
      }

      // Add code block
      const language = match[1] || 'plaintext';
      const code = match[2].trim();
      const blockIndex = key;
      const iconPath = getFileIconPath(`file.${language}`);

      parts.push(
        <div key={`code-${key++}`} className="my-3 rounded-lg overflow-hidden border border-border">
          {/* Enhanced Header */}
          <div className="bg-muted px-3 py-2 border-b border-border flex items-center justify-between">
            {/* Left: Icon + Language */}
            <div className="flex items-center gap-2">
              <img src={iconPath} alt={language} className="w-4 h-4 object-contain" />
              <span className="text-xs font-medium text-foreground uppercase">{language}</span>
            </div>

            {/* Right: Copy + Download Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleCopy(code, blockIndex)}
                className="p-1.5 hover:bg-background rounded transition-colors"
                title="Copy code"
              >
                {copiedIndex === blockIndex ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                )}
              </button>
              <button
                onClick={() => handleDownload(code, language)}
                className="p-1.5 hover:bg-background rounded transition-colors"
                title="Download code"
              >
                <Download className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          </div>

          <CodeBlock
            code={code}
            language={language}
            showLineNumbers={false}
            maxLines={25}
            className="rounded-none"
            editorOptions={{
              // Disable indentation guides (vertical lines)
              guides: {
                indentation: false,
                bracketPairs: false,
                highlightActiveIndentation: false,
              },
              // Disable line highlighting
              renderLineHighlight: 'none',
              // Disable cursor
              cursorStyle: 'line-thin',
              cursorBlinking: 'solid',
              // Make completely non-interactive
              domReadOnly: true,
              // Disable selection decorations
              selectionHighlight: false,
              occurrencesHighlight: false,
              // Disable hover
              hover: { enabled: false },
            }}
          />
        </div>,
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${key++}`} className="whitespace-pre-wrap">
          {text.substring(lastIndex)}
        </span>,
      );
    }

    return parts.length > 0 ? parts : <span className="whitespace-pre-wrap">{text}</span>;
  };

  return <div className="text-sm">{parseContent(content)}</div>;
};
