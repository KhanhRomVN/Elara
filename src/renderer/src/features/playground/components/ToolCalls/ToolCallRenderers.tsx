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

const FileHeader: React.FC<{
  path: string;
  label?: string;
  stats?: { added: number; removed: number };
}> = ({ path, label, stats }) => {
  const iconPath = getFileIconPath(path);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/20 border-b border-border text-[10px] font-bold text-muted-foreground/70 select-none uppercase tracking-wider">
      <img src={iconPath} alt="" className="w-3.5 h-3.5 object-contain opacity-70" />
      <span className="text-foreground/80">{path}</span>
      {stats && (
        <div className="flex items-center gap-2 ml-2 text-[9px] font-mono leading-none">
          <span className="text-green-500">+{stats.added}</span>
          <span className="text-red-500">-{stats.removed}</span>
        </div>
      )}
      {label && <span className="ml-auto">{label}</span>}
    </div>
  );
};

const ToolActionHeader: React.FC<{ path: string; action: string; dotColor?: string }> = ({
  path,
  action,
  dotColor = 'bg-green-500',
}) => {
  const iconPath = getFileIconPath(path);

  return (
    <div className="flex items-center gap-2 mb-2 text-[13px] font-medium font-mono leading-none">
      <div className={`w-1.5 h-1.5 rounded-full ${dotColor} flex-shrink-0`} />
      <span className="text-foreground opacity-80">{action}</span>
      <div className="inline-flex items-center gap-1.5 py-0.5 text-xs select-none">
        <img src={iconPath} alt="file" className="w-3.5 h-3.5 object-contain opacity-80" />
        <span className="text-foreground/90 truncate max-w-[200px]">{path}</span>
      </div>
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

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;

    replacements.forEach((chunk) => {
      const { originalDecorations, replacementDecorations } = computeDiffDecorations(
        chunk.target,
        chunk.replacement,
      );

      originalDecorations.forEach((d) => {
        removed += d.endLine - d.startLine + 1;
      });

      replacementDecorations.forEach((d) => {
        added += d.endLine - d.startLine + 1;
      });
    });

    return { added, removed };
  }, [replacements]);

  return (
    <div className="my-4">
      <ToolActionHeader path={path} action="Edit" dotColor="bg-green-500" />
      <div className="border border-border rounded-md overflow-hidden bg-background shadow-sm">
        <FileHeader path={path} label="Modification" stats={stats} />
        <div className="flex flex-col">
          {replacements.map((chunk, index) => (
            <ReplacementChunkRenderer key={index} chunk={chunk} language={language} />
          ))}
        </div>
      </div>
    </div>
  );
};

export const WriteToFileRenderer: React.FC<WriteToFileProps> = ({ path }) => {
  return (
    <div className="my-4">
      <ToolActionHeader path={path} action="Create" dotColor="bg-blue-500" />
      <div className="border border-border rounded-md overflow-hidden bg-background shadow-sm">
        <FileHeader path={path.toUpperCase()} label="WRITE" />
      </div>
    </div>
  );
};
