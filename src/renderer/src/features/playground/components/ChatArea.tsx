import { Message } from '../types';
import { MessageContent } from './MessageContent';

interface ChatAreaProps {
  messages: Message[];
  loading: boolean;
  isStreaming: boolean;
  conversationTitle?: string;
  className?: string;
}

export const ChatArea = ({
  messages,
  loading,
  isStreaming,
  conversationTitle,
  className,
}: ChatAreaProps) => {
  return (
    <div className={`flex flex-col h-full bg-background ${className || ''}`}>
      {/* Conversation Title Header */}
      {conversationTitle && (
        <div className="border-b bg-background/95 backdrop-blur">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <h2 className="text-lg font-semibold truncate">{conversationTitle}</h2>
          </div>
        </div>
      )}

      {/* Messages - Centered Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
          {messages.map((message) => (
            <div key={message.id} className="w-full">
              {/* User Message - Right Aligned */}
              {message.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg px-4 py-3 bg-primary/10 text-foreground">
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ) : (
                /* Assistant Message - Full Width */
                <div className="w-full">
                  {message.thinking && (
                    <div className="mb-3 text-sm text-muted-foreground border-l-2 border-primary/20 pl-4">
                      <details open>
                        <summary className="cursor-pointer font-medium hover:text-foreground transition-colors list-none flex items-center gap-2 select-none">
                          <span>Thought Process</span>
                          {message.thinking_elapsed && (
                            <span className="text-xs opacity-70">
                              ({message.thinking_elapsed.toFixed(1)}s)
                            </span>
                          )}
                        </summary>
                        <div className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed opacity-90">
                          {message.thinking}
                        </div>
                      </details>
                    </div>
                  )}
                  <div className="text-foreground">
                    <MessageContent content={message.content} />
                  </div>
                </div>
              )}
            </div>
          ))}
          {(loading || isStreaming) && (
            <div className="w-full">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="flex gap-1">
                  <span
                    className="w-2 h-2 rounded-full bg-primary/60 animate-pulse"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-primary/60 animate-pulse"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-primary/60 animate-pulse"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
