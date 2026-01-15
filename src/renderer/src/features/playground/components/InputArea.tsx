import { Send, Plus, Upload, StopCircle } from 'lucide-react';
import { ChangeEvent, KeyboardEvent } from 'react';
import { cn } from '../../../shared/lib/utils';

interface InputAreaProps {
  input: string;
  handleInput: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleSend: () => void;
  handleStop?: () => void;
  loading: boolean;
  isStreaming: boolean;
  selectedAccount?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string; // Allow external styling
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
  disabled,
  placeholder = 'Type a message...',
  className,
}: InputAreaProps) => {
  return (
    <div className={cn('bg-background border-t', className)}>
      <div className="max-w-4xl mx-auto px-6 py-4">
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
        <div className="relative border rounded-xl bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring transition-shadow w-full">
          <textarea
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled || loading || isStreaming}
            placeholder={placeholder}
            className="w-full min-h-[50px] border-none bg-transparent p-4 text-base focus:outline-none focus:ring-0 resize-none pb-14 custom-scrollbar disabled:opacity-50 disabled:cursor-not-allowed"
            rows={1}
          />

          {/* Bottom Actions Bar */}
          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
            <div className="flex gap-1">
              <button
                className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50 transition-colors"
                title="Add"
              >
                <Plus className="h-5 w-5" />
              </button>
              <button
                className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50 transition-colors"
                title="Upload"
              >
                <Upload className="h-5 w-5" />
              </button>
            </div>

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
                className="h-8 w-8 text-white flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
