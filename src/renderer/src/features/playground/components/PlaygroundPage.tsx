import { useState, useEffect } from 'react';
import { Send } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Account {
  id: string;
  provider: 'Claude' | 'DeepSeek';
  email: string;
  name?: string;
  picture?: string;
}

export const PlaygroundPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<'Claude' | 'DeepSeek' | ''>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [serverPort, setServerPort] = useState<number | null>(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        // @ts-ignore
        const data = await window.api.accounts.getAll();
        setAccounts(data);
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      }
    };

    fetchAccounts();
  }, []);

  const filteredAccounts = selectedProvider
    ? accounts.filter((acc) => acc.provider === selectedProvider)
    : [];

  const handleSend = async () => {
    if (!input.trim() || !selectedAccount) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      // Get server status to get port
      // @ts-ignore
      const serverStatus = await window.api.server.start();
      if (!serverStatus.success) {
        throw new Error('Server not running');
      }

      const port = serverStatus.port;
      setServerPort(port);

      const account = accounts.find((acc) => acc.id === selectedAccount);
      if (!account) throw new Error('Account not found');

      // Call the API
      const url = `http://localhost:${port}/v1/chat/completions?email=${encodeURIComponent(account.email)}&provider=${account.provider.toLowerCase()}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: account.provider === 'Claude' ? 'claude-3-5-sonnet-20241022' : 'deepseek-chat',
          messages: [
            ...messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            {
              role: 'user',
              content: currentInput,
            },
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Create a placeholder message for streaming
      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setLoading(false);

      // Parse SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                throw new Error(parsed.error);
              }

              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: msg.content + content }
                      : msg,
                  ),
                );
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Playground</h2>
        <p className="text-muted-foreground mt-1">
          Test and experiment with AI interactions in a sandbox environment.
        </p>
      </div>

      <div className="flex-1 flex flex-col rounded-xl border bg-card shadow-sm overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium">Start a conversation</p>
                <p className="text-sm mt-1">
                  Select a provider and account, then type a message below
                </p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex w-full',
                message.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-4 py-3',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground',
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs mt-2 opacity-70">{message.timestamp.toLocaleTimeString()}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted text-foreground">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div
                      className="w-2 h-2 rounded-full bg-current animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-current animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-current animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t bg-background p-4 space-y-3">
          {/* Provider and Account Selectors */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Provider
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => {
                  setSelectedProvider(e.target.value as 'Claude' | 'DeepSeek' | '');
                  setSelectedAccount('');
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Select provider...</option>
                <option value="Claude">Claude</option>
                <option value="DeepSeek">DeepSeek</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Account
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                disabled={!selectedProvider || filteredAccounts.length === 0}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select account...</option>
                {filteredAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name || account.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Message Input */}
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedAccount
                  ? 'Type your message here... (Shift+Enter for new line)'
                  : 'Select an account to start chatting...'
              }
              disabled={!selectedAccount || loading}
              className="flex-1 min-h-[60px] max-h-[200px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              rows={2}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !selectedAccount || loading}
              className={cn(
                'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
                'bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-10 shrink-0 self-end',
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaygroundPage;
