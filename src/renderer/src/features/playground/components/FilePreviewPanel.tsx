import React from 'react';
import { X, FileCode } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { CodeBlock } from '../../../core/components/CodeBlock';
import { getFileIconPath } from '../../../shared/utils/fileIconMapper';

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
}

export const FilePreviewPanel = ({
  className,
  width,
  files,
  activeFilePath,
  onCloseTab,
  onSetActiveTab,
}: FilePreviewPanelProps) => {
  const activeFile = activeFilePath ? files[activeFilePath] : null;

  if (Object.keys(files).length === 0) return null;

  return (
    <div
      className={cn('flex flex-col h-full bg-background flex-shrink-0', className)}
      style={{ width }}
    >
      {/* Tab Bar */}
      <div className="flex items-center h-9 bg-secondary/20 border-b overflow-x-auto no-scrollbar">
        {Object.values(files).map((file) => (
          <div
            key={file.path}
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
              code={activeFile.content}
              language={activeFile.language}
              showLineNumbers={true}
              readOnly={true}
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
    </div>
  );
};
