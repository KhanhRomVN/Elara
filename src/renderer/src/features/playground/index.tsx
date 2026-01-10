import { useState, useEffect, useRef } from 'react';
import {
  Send,
  Plus,
  Upload,
  User,
  MoreHorizontal,
  ChevronDown,
  Lightbulb,
  Search,
} from 'lucide-react';
import { cn } from '../../shared/lib/utils';
import claudeIcon from '../../assets/provider_icons/claude.svg';
import deepseekIcon from '../../assets/provider_icons/deepseek.svg';
import { Switch } from '../../core/components/Switch';

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
  status?: 'Active' | 'Rate Limit' | 'Error';
}

const CustomSelect = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon?: string | React.ReactNode }[];
  placeholder?: string;
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'h-10 w-full min-w-[140px] flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:bg-accent/50',
          !value && 'text-muted-foreground',
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.icon &&
            (typeof selectedOption.icon === 'string' ? (
              <img src={selectedOption.icon} alt="" className="w-5 h-5 shrink-0" />
            ) : (
              selectedOption.icon
            ))}
          <span className="truncate font-medium">{selectedOption?.label || placeholder}</span>
        </div>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full min-w-[180px] overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2">
          <div className="p-1">
            {options.map((option) => (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'relative flex select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer',
                  value === option.value && 'bg-accent text-accent-foreground',
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  {option.icon &&
                    (typeof option.icon === 'string' ? (
                      <img src={option.icon} alt="" className="w-5 h-5 shrink-0" />
                    ) : (
                      option.icon
                    ))}
                  <span className="truncate font-medium">{option.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const PlaygroundPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<'Claude' | 'DeepSeek' | ''>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [sloganIndex, setSloganIndex] = useState(0);
  const [thinkingEnabled, setThinkingEnabled] = useState(true);
  const [searchEnabled, setSearchEnabled] = useState(false);

  const slogans = [
    'Feel Free Chat Free!!',
    'Experience the Power of AI',
    'Your Personal Assistant',
    'Unlock Infinite Possibilities',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setSloganIndex((prev) => (prev + 1) % slogans.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        // @ts-ignore
        const data = await window.api.accounts.getAll();
        setAccounts(data);

        // Auto-select optimal account (DeepSeek priority)
        if (data.length > 0) {
          const deepseekAccount = data.find(
            (acc) => acc.provider === 'DeepSeek' && acc.status === 'Active',
          );
          const otherAccount = data.find((acc) => acc.status === 'Active');
          const target = deepseekAccount || otherAccount || data[0];

          if (target) {
            setSelectedProvider(target.provider);
            setSelectedAccount(target.id);
          }
        }
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
          thinking: account.provider === 'DeepSeek' ? thinkingEnabled : undefined,
          search: account.provider === 'DeepSeek' ? searchEnabled : undefined,
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

  // Fake history data
  const history = [
    { id: '1', title: 'React Performance Tips', date: 'Today' },
    { id: '2', title: 'Explain Quantum Computing', date: 'Yesterday' },
    { id: '3', title: 'Debug Node.js Error', date: 'Previous 7 Days' },
  ];

  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
  };

  const handleSendUninitialized = async () => {
    if (!input.trim() || !selectedAccount) return;
    setActiveChatId('new-session'); // simplistic state transition
    await handleSend();
  };

  const handleKeyDownUninitialized = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendUninitialized();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    target.style.height = 'auto'; // Reset height
    const maxHeight = 24 * 10; // Approx 10 lines
    const newHeight = Math.min(target.scrollHeight, maxHeight);
    target.style.height = `${newHeight}px`;
    setInput(target.value);
  };

  const account = accounts.find((a) => a.id === selectedAccount);

  const providerOptions = [
    { value: 'Claude', label: 'Claude', icon: claudeIcon },
    { value: 'DeepSeek', label: 'DeepSeek', icon: deepseekIcon },
  ];

  const accountOptions = filteredAccounts.map((acc) => ({
    value: acc.id,
    label: acc.name || acc.email,
    icon: acc.picture ? (
      <img src={acc.picture} className="w-4 h-4 rounded-full" alt="" />
    ) : (
      <User className="w-4 h-4" />
    ),
  }));

  const renderDropdowns = () => (
    <div className="flex gap-3 justify-start items-center">
      <div className="w-[180px]">
        <CustomSelect
          value={selectedProvider}
          onChange={(val) => {
            const newProvider = val as 'Claude' | 'DeepSeek' | '';
            setSelectedProvider(newProvider);
            if (newProvider) {
              const matches = accounts.filter((acc) => acc.provider === newProvider);
              const active = matches.find((acc) => acc.status === 'Active');
              setSelectedAccount(active?.id || matches[0]?.id || '');
            } else {
              setSelectedAccount('');
            }
          }}
          options={providerOptions}
          placeholder="Select Provider"
        />
      </div>
      <div className="w-[240px]">
        <CustomSelect
          value={selectedAccount}
          onChange={setSelectedAccount}
          options={accountOptions}
          placeholder="Select Account"
          disabled={!selectedProvider}
        />
      </div>
      {selectedProvider === 'DeepSeek' && (
        <>
          <div className="flex items-center gap-2 ml-2 p-2 rounded-md bg-accent/30 border border-border">
            <Lightbulb
              className={cn(
                'w-4 h-4',
                thinkingEnabled ? 'text-yellow-500 fill-current' : 'text-muted-foreground',
              )}
            />
            <span className="text-sm font-medium">Thinking</span>
            <Switch checked={thinkingEnabled} onCheckedChange={setThinkingEnabled} />
          </div>
          <div className="flex items-center gap-2 ml-2 p-2 rounded-md bg-accent/30 border border-border">
            <Search
              className={cn('w-4 h-4', searchEnabled ? 'text-blue-500' : 'text-muted-foreground')}
            />
            <span className="text-sm font-medium">Search</span>
            <Switch checked={searchEnabled} onCheckedChange={setSearchEnabled} />
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
      <div className="mt-4">
        <h2 className="text-2xl font-bold tracking-tight">Playground</h2>
        {/* Animated Slogan */}
        <div className="h-8 relative overflow-hidden mt-1">
          {slogans.map((slogan, index) => (
            <p
              key={index}
              className={cn(
                'absolute top-0 left-0 w-full transition-all duration-500 text-lg text-muted-foreground',
                index === sloganIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
              )}
            >
              {slogan}
            </p>
          ))}
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden rounded-xl border bg-card">
        {/* Sidebar */}
        <div className="w-64 border-r bg-muted/10 flex flex-col p-4 gap-4">
          {/* Top Sidebar: Provider Icon */}
          <div className="flex items-center gap-2 px-2 pb-4 border-b shrink-0">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-background border shadow-sm">
              <img
                src={selectedProvider === 'Claude' ? claudeIcon : deepseekIcon}
                alt="Provider"
                className="w-5 h-5"
              />
            </div>
            <span className="font-bold text-lg">{selectedProvider || 'P'}</span>
          </div>

          <button
            onClick={startNewChat}
            className="flex items-center gap-2 w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4 text-white" />
            <span className="font-medium text-white">New Chat</span>
          </button>

          <div className="flex-1 overflow-y-auto space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 py-2">Recents</p>
            {history.map((item) => (
              <button
                key={item.id}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground text-sm truncate transition-colors flex items-center gap-2"
              >
                <MoreHorizontal className="w-4 h-4 opacity-70" />
                <span className="truncate">{item.title}</span>
              </button>
            ))}
          </div>

          {/* User Info (Bottom Sidebar) */}
          <div className="mt-auto border-t pt-4 flex items-center gap-3 shrink-0">
            {account ? (
              <>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                  {account.picture ? (
                    <img src={account.picture} className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{account.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{account.email}</p>
                </div>
              </>
            ) : (
              <>
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-muted-foreground">No Account</p>
                </div>
              </>
            )}
            <button className="text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col relative">
          {/* Only show Account Selectors at top right or similar, or keep them above chat? 
            For now, I'll place them floating or in the top bar if in chat, 
            but for the request "Section centered" usually implies a clean look. 
            However, we need to select account to chat. 
            I will put the selectors in the "Welcome" screen above the input or just below the text.
        */}

          {activeChatId ? (
            /* Active Chat View */
            <div className="flex flex-col h-full bg-background">
              {/* Header / Top bar with Selectors */}
              <div className="border-b p-3 flex justify-between items-center bg-background/95 backdrop-blur z-10">
                {renderDropdowns()}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                          ? 'bg-blue-600 text-white'
                          : 'bg-muted text-foreground',
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted text-foreground">
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input Bar */}
              <div className="p-4 border-t bg-background">
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
                    placeholder="Type a message..."
                    className="w-full min-h-[50px] border-none bg-transparent p-4 text-base focus:outline-none focus:ring-0 resize-none pb-14 custom-scrollbar"
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

                    <button
                      onClick={handleSend}
                      disabled={loading}
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Welcome Screen */
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight text-foreground">Elara</h1>
                <p className="text-xl font-medium text-muted-foreground/80">
                  Feel Free Chat Free!!
                </p>
              </div>

              <div className="w-full max-w-2xl space-y-4 text-left">
                {/* Account Selection */}
                {renderDropdowns()}

                <div className="relative border rounded-xl bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring transition-shadow w-full max-w-2xl text-left">
                  <textarea
                    value={input}
                    onChange={handleInput}
                    onKeyDown={handleKeyDownUninitialized}
                    placeholder="Ask anything..."
                    className="w-full min-h-[50px] border-none bg-transparent p-4 text-base focus:outline-none focus:ring-0 resize-none pb-14 custom-scrollbar"
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

                    <button
                      onClick={handleSendUninitialized}
                      disabled={!input.trim() || !selectedAccount || loading}
                      className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <Send className="h-4 w-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaygroundPage;
