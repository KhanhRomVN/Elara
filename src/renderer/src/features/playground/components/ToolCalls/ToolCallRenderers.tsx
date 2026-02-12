import React, { useMemo } from 'react';
import { CodeBlock, CodeBlockDecoration } from '../../../../core/components/CodeBlock';
import { getFileIconPath } from '../../../../shared/utils/fileIconMapper';
import { ArrowRight } from 'lucide-react';

interface BaseRendererProps {
  path: string;
}

interface ReplaceInFileProps extends BaseRendererProps {
  // Supports multiple chunks if needed, but for now simplest is one or list
  replacements: { target: string; replacement: string }[];
}

interface WriteToFileProps extends BaseRendererProps {
  content: string;
  isOverwrite?: boolean; // If we can detect it
}

const getMonacoLanguage = (extension: string): string => {
  const map: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    html: 'html',
    css: 'css',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sh: 'shell',
    bash: 'shell',
    sql: 'sql',
    xml: 'xml',
  };
  return map[extension.toLowerCase()] || 'plaintext';
};

const FileHeader: React.FC<{ path: string; label?: string }> = ({ path, label }) => {
  const iconPath = getFileIconPath(path);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 border-b border-border rounded-t-md text-xs font-medium text-muted-foreground select-none">
      <img src={iconPath} alt="" className="w-4 h-4 object-contain" />
      <span className="text-foreground">{path}</span>
      {label && <span className="ml-auto text-[10px] uppercase tracking-wider">{label}</span>}
    </div>
  );
};

// Simple diff helper to find changed lines
// Returns: { originalDecorations, replacementDecorations }
const computeDiffDecorations = (target: string, replacement: string) => {
  const targetLines = target.split('\n');
  const replacementLines = replacement.split('\n');

  let start = 0;
  while (
    start < targetLines.length &&
    start < replacementLines.length &&
    targetLines[start] === replacementLines[start]
  ) {
    start++;
  }

  let endTarget = targetLines.length - 1;
  let endReplacement = replacementLines.length - 1;

  while (
    endTarget >= start &&
    endReplacement >= start &&
    targetLines[endTarget] === replacementLines[endReplacement]
  ) {
    endTarget--;
    endReplacement--;
  }

  const originalDecorations: CodeBlockDecoration[] = [];
  const replacementDecorations: CodeBlockDecoration[] = [];

  // if start <= endTarget, it means lines between start and endTarget were changed/removed
  if (start <= endTarget) {
    originalDecorations.push({
      startLine: start + 1,
      endLine: endTarget + 1,
      className: 'code-line-deleted',
      isWholeLine: true,
    });
  }

  // if start <= endReplacement, it means lines between start and endReplacement were changed/added
  if (start <= endReplacement) {
    replacementDecorations.push({
      startLine: start + 1,
      endLine: endReplacement + 1,
      className: 'code-line-added',
      isWholeLine: true,
    });
  }

  return { originalDecorations, replacementDecorations };
};

const ReplacementChunkRenderer: React.FC<{
  chunk: { target: string; replacement: string };
  language: string;
}> = ({ chunk, language }) => {
  const { originalDecorations, replacementDecorations } = useMemo(
    () => computeDiffDecorations(chunk.target, chunk.replacement),
    [chunk.target, chunk.replacement],
  );

  return (
    <div className="flex flex-col md:flex-row border-b border-border last:border-0 relative group">
      {/* Left: Original */}
      <div className="w-full md:w-1/2 md:border-r border-border min-w-0">
        <div className="px-2 py-1 text-[10px] text-red-500/70 font-mono uppercase bg-red-500/10 border-b border-red-500/20">
          Original
        </div>
        <CodeBlock
          code={chunk.target}
          language={language}
          showLineNumbers={true}
          maxLines={30}
          disableClick={true}
          decorations={originalDecorations}
          className="!bg-transparent"
          editorOptions={{
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: false,
            scrollBeyondLastLine: false,
            scrollbar: { vertical: 'hidden', horizontal: 'auto' },
            overviewRulerLanes: 0,
            padding: { top: 8, bottom: 8 },
            renderLineHighlight: 'none',
          }}
        />
      </div>

      {/* Right: New */}
      <div className="w-full md:w-1/2 min-w-0">
        <div className="px-2 py-1 text-[10px] text-green-500/70 font-mono uppercase bg-green-500/10 border-b border-green-500/20">
          Replacement
        </div>
        <CodeBlock
          code={chunk.replacement}
          language={language}
          showLineNumbers={true}
          maxLines={30}
          disableClick={true}
          decorations={replacementDecorations}
          className="!bg-transparent"
          editorOptions={{
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: false,
            scrollBeyondLastLine: false,
            scrollbar: { vertical: 'hidden', horizontal: 'auto' },
            overviewRulerLanes: 0,
            padding: { top: 8, bottom: 8 },
            renderLineHighlight: 'none',
          }}
        />
      </div>

      {/* Arrow Icon in the center (absolute) */}
      <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-border items-center justify-center z-10">
        <ArrowRight className="w-3 h-3 text-muted-foreground" />
      </div>
    </div>
  );
};

export const ReplaceInFileRenderer: React.FC<ReplaceInFileProps> = ({ path, replacements }) => {
  const extension = path.split('.').pop() || 'plaintext';
  const language = getMonacoLanguage(extension);

  return (
    <div className="my-4 border border-border rounded-md overflow-hidden bg-background">
      <FileHeader path={path} label="Modification" />
      <FileHeader path={path} label="Modification" />
      <div className="flex flex-col">
        {replacements.map((chunk, index) => (
          <ReplacementChunkRenderer key={index} chunk={chunk} language={language} />
        ))}
      </div>
    </div>
  );
};

export const WriteToFileRenderer: React.FC<WriteToFileProps> = ({ path, content }) => {
  const extension = path.split('.').pop() || 'plaintext';
  const language = getMonacoLanguage(extension);

  return (
    <div className="my-4 border border-border rounded-md overflow-hidden bg-background">
      <FileHeader path={path} label="Write" />
      <div className="bg-background">
        <CodeBlock
          code={content}
          language={language}
          showLineNumbers={true}
          maxLines={30} // Limit height for large writes
          disableClick={true}
          editorOptions={{
            padding: { top: 8, bottom: 8 },
            renderLineHighlight: 'none',
            scrollbar: { vertical: 'hidden', horizontal: 'auto' },
          }}
        />
      </div>
    </div>
  );
};
