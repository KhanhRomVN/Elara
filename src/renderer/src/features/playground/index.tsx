import { useState, useEffect, useRef } from 'react';
import { Send, Plus, Upload, User, MoreHorizontal, ChevronDown, StopCircle } from 'lucide-react';
import { cn } from '../../shared/lib/utils';
import claudeIcon from '../../assets/provider_icons/claude.svg';
import deepseekIcon from '../../assets/provider_icons/deepseek.svg';
import chatgptIcon from '../../assets/provider_icons/openai.svg';
import mistralIcon from '../../assets/provider_icons/mistral.svg';
import kimiIcon from '../../assets/provider_icons/kimi.svg';
import qwenIcon from '../../assets/provider_icons/qwen.svg';
import cohereIcon from '../../assets/provider_icons/cohere.svg';
import perplexityIcon from '../../assets/provider_icons/perplexity.svg';
import groqIcon from '../../assets/provider_icons/groq.svg';
import geminiIcon from '../../assets/provider_icons/gemini.svg';
import { Switch } from '../../core/components/Switch';
import { GroqSidebarSettings, FunctionParams } from './components/GroqSidebarSettings';
import { GroqModelSelector } from './components/GroqModelSelector';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  backend_uuid?: string;
  read_write_token?: string;
}

interface Account {
  id: string;
  provider:
    | 'Claude'
    | 'DeepSeek'
    | 'Groq'
    | 'ChatGPT'
    | 'Mistral'
    | 'Kimi'
    | 'Qwen'
    | 'Cohere'
    | 'Perplexity';
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

  const [selectedProvider, setSelectedProvider] = useState<
    | 'Claude'
    | 'DeepSeek'
    | 'ChatGPT'
    | 'Mistral'
    | 'Kimi'
    | 'Qwen'
    | 'Cohere'
    | 'Perplexity'
    | 'Groq'
    | ''
  >('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [_currentMessageId, setCurrentMessageId] = useState<number | null>(null);
  const [sloganIndex, setSloganIndex] = useState(0);
  const [thinkingEnabled, setThinkingEnabled] = useState(true);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [claudeModel, setClaudeModel] = useState('claude-sonnet-4-5-20250929');
  const [chatgptModel, setChatgptModel] = useState('gpt-4o');

  // Groq State
  const [groqModel, setGroqModel] = useState('openai/gpt-oss-120b');
  const [groqModelsList, setGroqModelsList] = useState<any[]>([]);
  const [groqSettings, setGroqSettings] = useState({
    temperature: 1,
    maxTokens: 8192,
    reasoning: 'medium' as 'none' | 'low' | 'medium' | 'high',
    stream: true,
    jsonMode: false,
    tools: {
      browserSearch: false,
      codeInterpreter: false,
    },
    customFunctions: [] as FunctionParams[],
  });

  // Sidebar Resize State
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (sidebarRef.current) {
        const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
        if (newWidth > 150 && newWidth < 600) {
          setSidebarWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

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
    fetchAccounts();
  }, []);

  useEffect(() => {
    const fetchGroqModels = async () => {
      if (selectedProvider === 'Groq' && selectedAccount) {
        try {
          // @ts-ignore
          const status = await window.api.server.start();
          const port = status.port || 11434;

          const acc = accounts.find((a) => a.id === selectedAccount);
          if (!acc) return;

          // Fetch from internal API to get detailed info
          // We can try fetching directly from renderer if allowed, or we might need a proxy.
          // Assuming direct fetch to https://api.groq.com/internal/v1/models works or using a proxy if we have one.
          // The user specifically requested this URL.
          // Since we might run into CORS, let's try to fetch it. If it fails, we might need a server-side proxy.

          // However, the user mentioned getting response from "GET https://api.groq.com/internal/v1/models"
          // I will try to fetch it directly. If it fails due to CORS, I'll need to use the Electron main process proxy or similar.
          // For now, let's assume valid access if we have a token (acc.email might not be enough, usually need an API Key).
          // But wait, the previous code used `http://localhost:${port}/v1/groq/models?email=...`
          // which likely uses the backend to fetch. I should probably modify the backend to fetch from the internal API
          // OR I can try to fetch from renderer if I have the token.
          // Since I don't see the token here (it's in the main process store possibly), I should stick to the local proxy but
          // maybe I need to update the local proxy (server/groq.ts) to hit the internal API or return more data.

          // But the user request implies I should do it here or result in that data.
          // Let's stick to the existing pattern: fetch from local proxy, but maybe I need to update the local proxy?
          // The local proxy matches `v1/groq/models`.

          // Let's update `src/main/server/groq.ts` effectively?
          // User said "hover ... derived from response of GET ...".
          // If I change the frontend to use `GroqModelSelector` which expects `GroqModel` shape,
          // I need `groqModelsList` to contain that shape.

          // Let's assume I can change the endpoint or just fetch it.
          // If I change `index.tsx` to fetch from `https://api.groq.com/internal/v1/models`, I need the API Key.
          // I don't have the API key in renderer (it's in `accounts` but maybe hidden or I need to request it).
          // Actually `accounts` in `index.tsx` has `email` but not `apiKey`.

          // So I probably need to update the backend `src/main/server/groq.ts` to fetch from the internal API instead of the public one
          // OR returns the full object.

          // Let's checking `src/main/server/groq.ts` first?
          // I'll update the frontend to EXPECT the data, and if it's missing, I'll update the backend.

          // For this step I'll just update the component usage and state type.

          const res = await fetch(
            `http://localhost:${port}/v1/groq/models?email=${encodeURIComponent(acc.email)}`,
          );
          if (res.ok) {
            const data = await res.json();
            if (data.data && Array.isArray(data.data)) {
              setGroqModelsList(
                data.data.sort((a: { id: string }, b: { id: any }) => a.id.localeCompare(b.id)),
              );
            }
          }
        } catch (e) {
          console.error('Failed to fetch Groq models', e);
        }
      }
    };
    fetchGroqModels();
  }, [selectedProvider, selectedAccount, accounts]);

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

      const controller = new AbortController();
      setAbortController(controller);
      console.log('Starting request with controller:', controller);

      const response = await fetch(url, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model:
            account.provider === 'Claude'
              ? claudeModel
              : account.provider === 'ChatGPT'
                ? chatgptModel
                : account.provider === 'Mistral'
                  ? 'mistral-large-latest'
                  : account.provider === 'Kimi'
                    ? 'moonshot-v1-8k'
                    : account.provider === 'Qwen'
                      ? 'qwen-max'
                      : account.provider === 'Cohere'
                        ? 'command-r7b-12-2024'
                        : account.provider === 'Groq'
                          ? groqModel
                          : 'deepseek-chat',
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
          // New fields for context
          conversation_id: activeChatId !== 'new-session' ? activeChatId : undefined,
          parent_message_id: messages.length > 0 ? messages[messages.length - 1].id : undefined,

          // Groq specific parameters
          ...(account.provider === 'Groq'
            ? {
                temperature: groqSettings.temperature,
                max_completion_tokens: groqSettings.maxTokens,
                reasoning_effort:
                  groqSettings.reasoning === 'none' ? undefined : groqSettings.reasoning,
                response_format: groqSettings.jsonMode ? { type: 'json_object' } : undefined,
                tools: [
                  ...(groqSettings.tools.browserSearch ? [{ type: 'browser_search' }] : []),
                  ...(groqSettings.tools.codeInterpreter ? [{ type: 'code_interpreter' }] : []),
                  ...groqSettings.customFunctions.map((f) => ({
                    type: 'function',
                    function: {
                      name: f.name,
                      description: f.description,
                      parameters: f.parameters ? JSON.parse(f.parameters) : {},
                    },
                  })),
                ],
                // Explicitly set stream based on settings if Groq
                stream: groqSettings.stream,
              }
            : {}),
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
      setIsStreaming(true);

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
              const backend_uuid = parsed.choices?.[0]?.delta?.backend_uuid;
              const read_write_token = parsed.choices?.[0]?.delta?.read_write_token;

              if (content || backend_uuid || read_write_token) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? {
                          ...msg,
                          content: msg.content + (content || ''),
                          backend_uuid: backend_uuid || msg.backend_uuid,
                          read_write_token: read_write_token || msg.read_write_token,
                        }
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
      setIsStreaming(false);
    } catch (error) {
      // Ignore abort errors
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted'))
      ) {
        console.log('Request aborted by user');
        setLoading(false);
        setIsStreaming(false);
        return;
      }

      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setLoading(false);
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Real conversation history
  const [history, setHistory] = useState<any[]>([]);
  const [, setLoadingHistory] = useState(false);

  // Fetch conversation history when provider or account changes
  useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedProvider || !selectedAccount) {
        setHistory([]);
        return;
      }

      // Find the selected account object
      const account = accounts.find((a) => a.id === selectedAccount);
      if (!account) {
        setHistory([]);
        return;
      }

      setLoadingHistory(true);
      try {
        const endpoint =
          selectedProvider === 'Claude'
            ? 'http://localhost:11434/v1/claude/conversations'
            : selectedProvider === 'Mistral'
              ? 'http://localhost:11434/v1/mistral/conversations'
              : selectedProvider === 'Kimi'
                ? 'http://localhost:11434/v1/kimi/conversations'
                : selectedProvider === 'Qwen'
                  ? 'http://localhost:11434/v1/qwen/conversations'
                  : selectedProvider === 'Cohere'
                    ? 'http://localhost:11434/v1/cohere/conversations'
                    : selectedProvider === 'Perplexity'
                      ? 'http://localhost:11434/v1/perplexity/conversations'
                      : selectedProvider === 'Groq'
                        ? 'http://localhost:11434/v1/groq/conversations'
                        : 'http://localhost:11434/v1/deepseek/sessions';

        const response = await fetch(`${endpoint}?email=${encodeURIComponent(account.email)}`);

        if (response.ok) {
          const data = await response.json();

          // Format data for display
          const formattedHistory =
            selectedProvider === 'Claude'
              ? data.map((conv: any) => ({
                  id: conv.uuid,
                  title: conv.name || conv.summary || 'Untitled',
                  date: new Date(conv.updated_at).toLocaleDateString(),
                }))
              : selectedProvider === 'Mistral'
                ? data.map((conv: any) => ({
                    id: conv.id,
                    title: conv.title || 'Untitled',
                    date: new Date(conv.created_at || Date.now()).toLocaleDateString(),
                  }))
                : selectedProvider === 'Qwen'
                  ? data.map((conv: any) => ({
                      id: conv.id,
                      title: conv.title || 'Untitled',
                      date: new Date(
                        conv.updated_at ? conv.updated_at * 1000 : Date.now(),
                      ).toLocaleDateString(),
                    }))
                  : selectedProvider === 'Kimi' || selectedProvider === 'Cohere'
                    ? []
                    : data.map((session: any) => ({
                        id: session.id,
                        title: session.title || 'Untitled',
                        date: new Date(session.updated_at * 1000).toLocaleDateString(),
                      }));

          setHistory(formattedHistory);
        } else {
          const errorText = await response.text();
          console.error('[History] Failed to fetch:', response.status, errorText);
        }
      } catch (error) {
        console.error('[History] Error fetching history:', error);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [selectedProvider, selectedAccount, accounts]);

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string>('');

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
    setConversationTitle('');
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const account = accounts.find((a) => a.id === selectedAccount);
      if (!account) {
        console.error('[Conversation] No account found');
        return;
      }

      const endpoint =
        selectedProvider === 'Claude'
          ? `http://localhost:11434/v1/claude/conversations/${conversationId}`
          : selectedProvider === 'Mistral'
            ? `http://localhost:11434/v1/mistral/conversations/${conversationId}`
            : selectedProvider === 'Kimi'
              ? `http://localhost:11434/v1/kimi/conversations/${conversationId}`
              : selectedProvider === 'Qwen'
                ? `http://localhost:11434/v1/qwen/conversations/${conversationId}`
                : selectedProvider === 'Perplexity'
                  ? `http://localhost:11434/v1/perplexity/conversations/${conversationId}`
                  : selectedProvider === 'Groq'
                    ? `http://localhost:11434/v1/groq/conversations/${conversationId}`
                    : `http://localhost:11434/v1/deepseek/sessions/${conversationId}/messages`;

      const response = await fetch(`${endpoint}?email=${encodeURIComponent(account.email)}`);

      if (response.ok) {
        const data = await response.json();

        // Extract conversation title
        const title =
          selectedProvider === 'Claude'
            ? data.name || data.summary || 'Untitled Conversation'
            : selectedProvider === 'Mistral'
              ? 'Conversation' // Mistral detail doesn't currently return title in my stub
              : selectedProvider === 'Kimi' || selectedProvider === 'Qwen'
                ? 'Chat'
                : data.chat_session?.title || 'Untitled Conversation';

        setConversationTitle(title);

        // Format messages from API response
        const formattedMessages: Message[] =
          selectedProvider === 'Claude'
            ? data.chat_messages
                ?.map((msg: any) => ({
                  id: msg.uuid,
                  role: msg.sender === 'human' ? ('user' as const) : ('assistant' as const),
                  content:
                    msg.content
                      ?.map((c: any) => c.text || '')
                      .join('')
                      .trim() ||
                    msg.text ||
                    '',
                }))
                .filter((m: Message) => m.content) || []
            : selectedProvider === 'Mistral'
              ? data.messages?.map((msg: any) => ({
                  id: msg.id || crypto.randomUUID(),
                  role: msg.role,
                  content: msg.content,
                })) || []
              : selectedProvider === 'Kimi' || selectedProvider === 'Qwen'
                ? []
                : selectedProvider === 'Perplexity'
                  ? data.messages?.map((msg: any) => ({
                      id: msg.id || crypto.randomUUID(),
                      role: msg.role,
                      content: msg.content,
                      backend_uuid: msg.backend_uuid,
                      read_write_token: msg.read_write_token,
                    })) || []
                  : data.chat_messages
                      ?.map((msg: any) => ({
                        id: msg.message_id,
                        role: msg.role === 'USER' ? ('user' as const) : ('assistant' as const),
                        content:
                          msg.fragments
                            ?.map((f: any) => f.content || '')
                            .join('')
                            .trim() || '',
                      }))
                      .filter((m: Message) => m.content) || [];

        setMessages(formattedMessages);
        setActiveChatId(conversationId);
      } else {
        console.error('[Conversation] Failed to load:', response.status);
      }
    } catch (error) {
      console.error('[Conversation] Error loading conversation:', error);
    }
  };

  const handleStop = async () => {
    console.log('Stopping request, controller:', abortController);
    // Abort the fetch request
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }

    setLoading(false);
    setIsStreaming(false);
    setCurrentMessageId(null);
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
    { value: 'ChatGPT', label: 'ChatGPT', icon: chatgptIcon },
    { value: 'Mistral', label: 'Mistral', icon: mistralIcon },
    { value: 'Kimi', label: 'Kimi', icon: kimiIcon },
    { value: 'Qwen', label: 'Qwen', icon: qwenIcon },
    { value: 'Perplexity', label: 'Perplexity', icon: perplexityIcon },
    { value: 'Groq', label: 'Groq', icon: groqIcon },
    { value: 'Gemini', label: 'Gemini', icon: geminiIcon },
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
            const newProvider = val as 'Claude' | 'DeepSeek' | 'ChatGPT' | '';
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
      {selectedProvider === 'Claude' && (
        <div className="w-[200px]">
          <CustomSelect
            value={claudeModel}
            onChange={setClaudeModel}
            options={[
              { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
              { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5' },
            ]}
            placeholder="Select Model"
          />
        </div>
      )}
      {selectedProvider === 'ChatGPT' && (
        <div className="w-[200px]">
          <CustomSelect
            value={chatgptModel}
            onChange={setChatgptModel}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'gpt-4o', label: 'GPT-4o' },
              { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
              { value: 'o1-preview', label: 'o1 Preview' },
              { value: 'o1-mini', label: 'o1 Mini' },
            ]}
            placeholder="Select Model"
          />
        </div>
      )}
      {selectedProvider === 'DeepSeek' && (
        <>
          <div className="flex items-center gap-2 ml-2 p-2 rounded-md bg-accent/30 border border-border">
            <span className="text-sm font-medium">Thinking</span>
            <Switch checked={thinkingEnabled} onCheckedChange={setThinkingEnabled} />
          </div>
          <div className="flex items-center gap-2 ml-2 p-2 rounded-md bg-accent/30 border border-border">
            <span className="text-sm font-medium">Search</span>
            <Switch checked={searchEnabled} onCheckedChange={setSearchEnabled} />
          </div>
        </>
      )}
      {selectedProvider === 'Groq' && (
        <div className="flex items-center gap-2 ml-2">
          <div className="w-[300px]">
            <GroqModelSelector
              value={groqModel}
              onChange={setGroqModel}
              models={groqModelsList}
              placeholder="Select Model"
            />
          </div>
        </div>
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
      <div className="flex-1 overflow-hidden rounded-xl border bg-card flex" ref={sidebarRef}>
        {/* Sidebar */}
        <div
          className="flex flex-col h-full border-r bg-muted/10 shrink-0"
          style={{ width: sidebarWidth }}
        >
          <div className="flex flex-col h-full p-4 gap-4 overflow-hidden">
            {/* Top Sidebar: Provider Icon */}
            <div className="flex items-center gap-2 px-2 pb-4 border-b shrink-0">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-background border shadow-sm">
                <img
                  src={
                    selectedProvider === 'Claude'
                      ? claudeIcon
                      : selectedProvider === 'ChatGPT'
                        ? chatgptIcon
                        : selectedProvider === 'Mistral'
                          ? mistralIcon
                          : selectedProvider === 'Kimi'
                            ? kimiIcon
                            : selectedProvider === 'Qwen'
                              ? qwenIcon
                              : selectedProvider === 'Cohere'
                                ? cohereIcon
                                : selectedProvider === 'Groq'
                                  ? groqIcon
                                  : deepseekIcon
                  }
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

            {selectedProvider === 'Groq' ? (
              <GroqSidebarSettings settings={groqSettings} onSettingsChange={setGroqSettings} />
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1">
                <p className="text-xs font-medium text-muted-foreground px-2 py-2">Recents</p>
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadConversation(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground text-sm truncate transition-colors flex items-center gap-2 ${
                      activeChatId === item.id ? 'bg-accent' : ''
                    }`}
                  >
                    <span className="truncate">{item.title}</span>
                  </button>
                ))}
              </div>
            )}

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
        </div>

        {/* Resizer Handle */}
        <div
          className="w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors flex items-center justify-center group"
          onMouseDown={startResizing}
        >
          <div className="h-8 w-[2px] bg-muted-foreground/20 group-hover:bg-primary rounded-full" />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col relative h-full min-w-0">
          {/* Only show Account Selectors at top right or similar, or keep them above chat? 
            For now, I'll place them floating or in the top bar if in chat, 
            but for the request "Section centered" usually implies a clean look. 
            However, we need to select account to chat. 
            I will put the selectors in the "Welcome" screen above the input or just below the text.
        */}

          {activeChatId ? (
            /* Active Chat View */
            <div className="flex flex-col h-full bg-background">
              {/* Conversation Title Header */}
              {conversationTitle && (
                <div className="border-b p-4 bg-background/95 backdrop-blur">
                  <h2 className="text-lg font-semibold truncate">{conversationTitle}</h2>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] ${
                        message.role === 'user'
                          ? 'rounded-lg px-4 py-3 bg-muted text-foreground'
                          : 'text-foreground'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
                {(loading || isStreaming) && (
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
                    disabled={loading || isStreaming}
                    placeholder="Type a message..."
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

                    {loading || isStreaming ? (
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
                      disabled={!input.trim() || !selectedAccount || loading || isStreaming}
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
