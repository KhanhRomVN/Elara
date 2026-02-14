import { useRef, useEffect } from 'react';
import { X, FileCode, CheckCircle2, Send, GitCommit } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { CodeBlock } from '../../../core/components/CodeBlock';
import { getFileIconPath } from '../../../shared/utils/fileIconMapper';
import Button from '../../../shared/components/ui/button/Button';

interface FileTab {
  path: string;
  name: string;
  content: string;
  language: string;
}

interface FilePreviewPanelProps {
  className?: string;
  width?: number;
  files: Record<string, FileTab>; // Path -> Tab Data
  activeFilePath: string | null;
  onCloseTab: (path: string) => void;
  onSetActiveTab: (path: string) => void;
  commitMessage?: string | null;
  onPush?: (message: string) => void;
  isPushing?: boolean;
  onFileContentChange?: (path: string, content: string) => void;
  onCommitMessageChange?: (message: string) => void;
}

export const FilePreviewPanel = ({
  className,
  width,
  files,
  activeFilePath,
  onCloseTab,
  onSetActiveTab,
  commitMessage,
  onPush,
  isPushing,
  onFileContentChange,
  onCommitMessageChange,
}: FilePreviewPanelProps) => {
  const activeFile = activeFilePath ? files[activeFilePath] : null;
  console.log('[FilePreviewPanel] Render', {
    activeFilePath,
    hasActiveFile: !!activeFile,
    fileName: activeFile?.name,
  });
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (activeFilePath && tabRefs.current[activeFilePath]) {
      tabRefs.current[activeFilePath]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeFilePath]);

  if (Object.keys(files).length === 0) return null;

  return (
    <div
      className={cn('flex flex-col h-full bg-background flex-shrink-0 relative', className)}
      style={{ width }}
    >
      {/* ... existing code ... */}
      {/* Tab Bar */}
      <div className="flex items-center h-9 bg-secondary/20 border-b overflow-x-auto no-scrollbar shrink-0">
        {Object.values(files).map((file) => (
          <div
            key={file.path}
            ref={(el) => (tabRefs.current[file.path] = el)}
            className={cn(
              'flex items-center gap-2 px-3 h-full text-[11px] border-r border-border/50 cursor-pointer min-w-[120px] max-w-[200px] group transition-colors',
              activeFilePath === file.path
                ? 'bg-background text-foreground font-medium border-t border-t-primary'
                : 'bg-transparent text-muted-foreground hover:bg-secondary/40',
            )}
            onClick={() => onSetActiveTab(file.path)}
          >
            <img src={getFileIconPath(file.name)} alt="" className="w-3.5 h-3.5" />
            <span className="truncate flex-1">{file.name}</span>
            <button
              className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded-sm p-0.5 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(file.path);
              }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative group">
        {activeFile ? (
          <div className="h-full overflow-hidden p-0 bg-background">
            <CodeBlock
              key={activeFile.path}
              id={activeFile.path}
              code={activeFile.content}
              language={activeFile.language}
              showLineNumbers={true}
              readOnly={false}
              onChange={(newContent) => onFileContentChange?.(activeFile.path, newContent)}
              wordWrap="on"
              className="h-full"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <FileCode className="w-12 h-12 opacity-20" />
            <span className="text-xs">Select a file to view</span>
          </div>
        )}
      </div>

      {/* Commit Message Section */}
      {commitMessage !== undefined && commitMessage !== null && (
        <div className="border-t bg-secondary/10 p-4 animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Generated Commit Message
            </span>
          </div>
          <textarea
            value={commitMessage}
            onChange={(e) => onCommitMessageChange?.(e.target.value)}
            placeholder="Enter commit message..."
            className="w-full bg-background/50 border rounded-lg p-3 mb-3 font-mono text-xs leading-relaxed text-foreground/90 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 custom-scrollbar"
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              icon={Send}
              onClick={() => onPush?.(commitMessage)}
              loading={isPushing}
              disabled={isPushing || !commitMessage.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 h-9 text-xs font-bold rounded-lg shadow-lg flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Commit & Push
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
