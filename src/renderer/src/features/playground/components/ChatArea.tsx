import { useState } from 'react';
import { Message } from '../types';
import { MessageContent } from './MessageContent';
import { FilePreviewModal } from './FilePreviewModal';
import { FileText } from 'lucide-react';

interface ChatAreaProps {
  messages: Message[];
  loading: boolean;
  isStreaming: boolean;
  conversationTitle?: string;
  className?: string;
  agentMode?: boolean;
  workspacePath?: string;
}

export const ChatArea = ({
  messages,
  loading,
  isStreaming,
  conversationTitle,
  className,
  agentMode,
  workspacePath,
}: ChatAreaProps) => {
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    type: string;
    url?: string;
  } | null>(null);

  return (
    <div className={`flex flex-col flex-1 min-h-0 bg-background ${className || ''} relative`}>
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
          {messages
            .filter((m) => !m.uiHidden)
            .map((message) => (
              <div key={message.id} className="w-full">
                {/* User Message - Right Aligned */}
                {message.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="flex flex-col items-end gap-2 max-w-[85%]">
                      <div className="rounded-lg px-4 py-3 bg-primary/10 text-foreground w-full">
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                      {/* Attachments */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-end">
                          {message.attachments.map((att) => (
                            <div
                              key={att.id}
                              onClick={() => setPreviewFile(att)}
                              className="relative group shrink-0 w-auto max-w-sm h-14 rounded-lg border bg-muted/20 flex items-center p-2 pr-4 cursor-pointer hover:bg-muted/30 transition-colors"
                            >
                              <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-background/50 flex items-center justify-center shadow-sm relative">
                                {att.type === 'image' && att.url ? (
                                  <img
                                    src={att.url}
                                    alt={att.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <FileText className="w-6 h-6 text-muted-foreground" />
                                )}
                              </div>

                              <div className="flex flex-col min-w-0 flex-1 ml-2">
                                <span
                                  className="text-xs font-medium truncate leading-tight text-left"
                                  title={att.name}
                                >
                                  {att.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground text-left">
                                  {att.size && att.size < 1024
                                    ? `${att.size} B`
                                    : att.size && att.size < 1024 * 1024
                                      ? `${(att.size / 1024).toFixed(1)} KB`
                                      : `${((att.size || 0) / (1024 * 1024)).toFixed(1)} MB`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Assistant Message - Full Width */
                  <div className="w-full">
                    {message.thinking && !agentMode && (
                      <div className="mb-3 text-sm text-muted-foreground border-l-2 border-primary/20 pl-4">
                        <details open>
                          <summary className="cursor-pointer font-medium hover:text-foreground transition-colors list-none flex items-center gap-2 select-none">
                            <span>Thought Process</span>
                            {/* ... thinking time ... */}
                          </summary>
                          <div className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed opacity-90">
                            {message.thinking}
                          </div>
                        </details>
                      </div>
                    )}
                    <div className="text-foreground">
                      <MessageContent content={message.content} workspacePath={workspacePath} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          {(loading || isStreaming) && (
            <div className="w-full">
              <div className="flex items-center gap-2 text-muted-foreground">
                {/* ... loader ... */}
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

      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
};
