import { Plus, Upload, StopCircle, ArrowUpFromDot, Sparkles, Globe } from 'lucide-react';
import { ChangeEvent, KeyboardEvent, useRef, useState, ClipboardEvent, DragEvent } from 'react';
import { cn } from '../../../shared/lib/utils';
import { FilePreviewModal } from './FilePreviewModal';
import { getFileIconPath } from '../../../shared/utils/fileIconMapper';

interface InputAreaProps {
  input: string;
  handleInput: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleSend: () => void;
  handleStop?: () => void;
  loading: boolean;
  isStreaming: boolean;
  selectedAccount?: string;
  selectedProvider?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string; // Allow external styling
  thinkingEnabled?: boolean;
  setThinkingEnabled?: (enabled: boolean) => void;
  searchEnabled?: boolean;
  setSearchEnabled?: (enabled: boolean) => void;
  innerClassName?: string;
  onFileSelect?: (files: FileList | File[] | null) => void;
  attachments?: File[];
  onRemoveAttachment?: (index: number) => void;
}

export const InputArea = ({
  input,
  handleInput,
  handleKeyDown,
  handleSend,
  handleStop,
  loading,
  isStreaming,
  selectedAccount,
  selectedProvider,
  disabled,
  placeholder = 'Type a message...',
  className,
  thinkingEnabled,
  setThinkingEnabled,
  searchEnabled,
  setSearchEnabled,
  innerClassName,
  onFileSelect,
  attachments,
  onRemoveAttachment,
}: InputAreaProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (onFileSelect && e.target.files) {
      onFileSelect(e.target.files);
    }
    // Reset input value to allow selecting same file again
    if (e.target) {
      e.target.value = '';
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const pastedFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          pastedFiles.push(file);
        }
      }
    }

    if (pastedFiles.length > 0 && onFileSelect) {
      onFileSelect(pastedFiles);
      // Optional: Prevent default paste if it's only images to avoid pasting the binary data as text (though usually textarea handles it fine or ignores)
      // e.preventDefault();
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (onFileSelect) {
        onFileSelect(e.dataTransfer.files);
      }
    }
  };

  return (
    <div className={cn('bg-background relative', className)}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
        accept="image/*, .pdf, .txt, .md, .csv, .json"
      />

      <div className={cn('max-w-4xl mx-auto px-6 py-4 flex flex-col gap-2', innerClassName)}>
        <style>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: hsl(var(--muted-foreground) / 0.3);
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: hsl(var(--muted-foreground) / 0.5);
          }
        `}</style>

        {/* Attachments Preview - Outside Main Input Box */}
        {/* Attachments Preview - Outside Main Input Box */}
        {attachments && attachments.length > 0 && (
          <div className="flex gap-2 pb-2 overflow-x-auto custom-scrollbar">
            {attachments.map((file, index) => (
              <div
                key={index}
                onClick={() => setPreviewFile(file)}
                className="relative group shrink-0 w-48 h-14 rounded-lg border bg-muted/20 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all flex items-center p-2 "
              >
                <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-background/50 flex items-center justify-center shadow-sm">
                  {file.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-full h-full object-cover"
                      onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
                    />
                  ) : (
                    <img src={getFileIconPath(file.name)} className="w-6 h-6" alt="icon" />
                  )}
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-medium truncate leading-tight" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {file.size < 1024
                      ? `${file.size} B`
                      : file.size < 1024 * 1024
                        ? `${(file.size / 1024).toFixed(1)} KB`
                        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                  </span>
                </div>

                {onRemoveAttachment && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveAttachment(index);
                    }}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  >
                    <span className="sr-only">Remove</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-3 h-3"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Main Input Box */}
        <div
          className={cn(
            'relative border rounded-xl bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring transition-all w-full flex flex-col',
            isDragging && 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/10',
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8" />
                <p className="text-sm font-medium">Drop files here</p>
              </div>
            </div>
          )}

          <textarea
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={disabled || loading || isStreaming}
            placeholder={placeholder}
            className="w-full min-h-[50px] border-none bg-transparent px-4 py-3 text-base focus:outline-none focus:ring-0 resize-none custom-scrollbar disabled:opacity-50 disabled:cursor-not-allowed"
            rows={1}
          />

          {/* Bottom Actions Bar */}
          <div className="flex justify-between items-center px-2 pb-2 pl-3">
            <div className="flex gap-2 items-center">
              {selectedProvider === 'DeepSeek' ? (
                <>
                  <button
                    onClick={() => setThinkingEnabled?.(!thinkingEnabled)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                      thinkingEnabled
                        ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20'
                        : 'bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    DeepThink
                  </button>
                  <button
                    onClick={() => setSearchEnabled?.(!searchEnabled)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                      searchEnabled
                        ? 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20'
                        : 'bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Search
                  </button>
                </>
              ) : (
                <div className="flex gap-1">
                  <button
                    className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50 transition-colors"
                    title="Add"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleUploadClick}
                    className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50 transition-colors"
                    title="Upload"
                  >
                    <Upload className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedProvider === 'DeepSeek' && (
                <button
                  onClick={handleUploadClick}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50 transition-colors"
                  title="Upload"
                >
                  <Upload className="h-5 w-5" />
                </button>
              )}

              {(loading || isStreaming) && handleStop ? (
                <button
                  onClick={handleStop}
                  className="h-8 w-8 text-white flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-700 transition-all"
                  title="Stop generating"
                >
                  <StopCircle className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || !selectedAccount}
                  className={cn(
                    'h-8 w-8 flex items-center justify-center rounded-lg transition-all',
                    input.trim() && selectedAccount
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                      : 'bg-muted text-muted-foreground/50 cursor-not-allowed',
                  )}
                >
                  <ArrowUpFromDot className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
};
