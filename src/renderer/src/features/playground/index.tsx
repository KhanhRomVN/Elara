import { useState, useEffect, useRef } from 'react';
import { User, ChevronDown } from 'lucide-react';
import { cn } from '../../shared/lib/utils';
import claudeIcon from '../../assets/provider_icons/claude.svg';
import deepseekIcon from '../../assets/provider_icons/deepseek.svg';

import mistralIcon from '../../assets/provider_icons/mistral.svg';
import kimiIcon from '../../assets/provider_icons/kimi.svg';
import qwenIcon from '../../assets/provider_icons/qwen.svg';
import cohereIcon from '../../assets/provider_icons/cohere.svg';
import perplexityIcon from '../../assets/provider_icons/perplexity.svg';
import groqIcon from '../../assets/provider_icons/groq.svg';
import geminiIcon from '../../assets/provider_icons/gemini.svg';
import antigravityIcon from '../../assets/provider_icons/antigravity.svg';
import huggingChatIcon from '../../assets/provider_icons/huggingface.svg';
import lmArenaIcon from '../../assets/provider_icons/lmarena.svg';
import { FunctionParams } from './components/GroqSidebarSettings';
import { GroqModelSelector } from './components/GroqModelSelector';
import { AntigravityModelSelector } from './components/AntigravityModelSelector';
import { GeminiModelSelector } from './components/GeminiModelSelector';

import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { InputArea } from './components/InputArea';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Message, Account, PendingAttachment } from './types';
import { getStreamHandler } from './stream-handlers';

// Interfaces moved to types.ts

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
          'h-10 w-fit min-w-[140px] flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:bg-accent/50',
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
        <div className="absolute z-50 mt-1 max-h-60 w-max min-w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2">
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
    | 'Mistral'
    | 'Kimi'
    | 'Qwen'
    | 'Cohere'
    | 'Perplexity'
    | 'Groq'
    | 'Groq'
    | 'Antigravity'
    | 'Gemini'
    | 'Gemini'
    | 'HuggingChat'
    | 'LMArena'
    | ''
  >('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [_currentMessageId, setCurrentMessageId] = useState<number | null>(null);

  const [thinkingEnabled, setThinkingEnabled] = useState(true);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [tokenCount, setTokenCount] = useState(0);
  const [inputTokenCount, setInputTokenCount] = useState(0);
  const [accumulatedUsage, setAccumulatedUsage] = useState(0);

  // Re-use Groq Model State for generic providers like LMArena
  const [groqModels, setGroqModels] = useState<any[]>([]);

  const handleFileSelect = async (files: FileList | File[] | null) => {
    if (!files) return;
    const newFiles = itemsToFileArray(files);

    // Create new PendingAttachments
    const newAttachments: PendingAttachment[] = newFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'pending',
      previewUrl: URL.createObjectURL(file),
      progress: 0,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);
    console.log('Selected files:', newFiles);

    // Trigger uploads immediately if provider is DeepSeek
    // (Or for all providers if we plan to support them later)
    if (selectedProvider === 'DeepSeek') {
      // @ts-ignore
      const serverStatus = await window.api.server.start(); // Ensure server running
      const port = serverStatus.port;
      const account = accounts.find((acc) => acc.id === selectedAccount);

      if (account) {
        newAttachments.forEach(async (att) => {
          // Update status to uploading
          setAttachments((prev) =>
            prev.map((p) => (p.id === att.id ? { ...p, status: 'uploading' } : p)),
          );

          try {
            const uploadUrl = `http://localhost:${port}/v1/deepseek/files`;
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(att.file);
            });

            const uploadRes = await fetch(uploadUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                file: base64,
                fileName: att.file.name,
                email: account.email,
              }),
            });

            if (uploadRes.ok) {
              const data = await uploadRes.json();
              if (data.id) {
                console.log(`Uploaded ${att.file.name}, ID: ${data.id}`);
                setAttachments((prev) =>
                  prev.map((p) =>
                    p.id === att.id ? { ...p, status: 'completed', fileId: data.id } : p,
                  ),
                );
              } else {
                throw new Error('No ID returned');
              }
            } else {
              throw new Error('Upload failed');
            }
          } catch (error) {
            console.error(`Error uploading ${att.file.name}:`, error);
            setAttachments((prev) =>
              prev.map((p) => (p.id === att.id ? { ...p, status: 'error' } : p)),
            );
          }
        });
      }
    }
  };

  // Helper to normalize file input
  const itemsToFileArray = (items: FileList | File[]): File[] => {
    if (Array.isArray(items)) {
      return items;
    }
    return Array.from(items);
  };
  const [claudeModel, setClaudeModel] = useState('claude-sonnet-4-5-20250929');

  // Antigravity State
  const [antigravityModel, setAntigravityModel] = useState('models/gemini-3-pro-preview');
  const [antigravityModelsList, setAntigravityModelsList] = useState<any[]>([]);

  // Gemini State
  const [geminiModel, setGeminiModel] = useState('fbb127bbb056c959'); // Default to "Nhanh" usually
  const [geminiModelsList, setGeminiModelsList] = useState<any[]>([]);

  // Groq State
  const [groqModel, setGroqModel] = useState('openai/gpt-oss-120b');
  const [groqModelsList, setGroqModelsList] = useState<any[]>([]);

  // HuggingChat State
  const [huggingChatModel, setHuggingChatModel] = useState('');
  const [huggingChatModelsList, setHuggingChatModelsList] = useState<any[]>([]);

  // DeepSeek State
  const [deepseekModel, setDeepseekModel] = useState('deepseek-ai/DeepSeek-V3.2');
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

  // Input Token Counting Effect
  useEffect(() => {
    const updateInputTokenCount = async () => {
      if (!input) {
        setInputTokenCount(0);
        return;
      }

      let modelId = 'Xenova/Llama-2-7b-chat-tokenizer';
      if (selectedProvider === 'DeepSeek') {
        // DeepSeek uses Llama-based tokenizer. Xenova/Llama-3-8b-instruct is a good approximation for V3
        // The user logs showed LlamaTokenizerFast.
        modelId = 'Xenova/Llama-3-8b-instruct';
      } else if (selectedProvider === 'Claude') {
        modelId = 'Xenova/Llama-2-7b-chat-tokenizer';
      }
    };

    const timer = setTimeout(updateInputTokenCount, 500);
    return () => clearTimeout(timer);
  }, [input, selectedProvider, deepseekModel]);

  /* Unused variables/functions removed */

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
    // fetchAccounts(); // duplicate removed
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

      if (selectedProvider === 'Antigravity' && selectedAccount) {
        try {
          // @ts-ignore
          const status = await window.api.server.start();
          const port = status.port || 11434;
          const acc = accounts.find((a) => a.id === selectedAccount);
          if (!acc) return;

          const res = await fetch(
            `http://localhost:${port}/v1/antigravity/models?email=${encodeURIComponent(acc.email)}`,
          );
          if (res.ok) {
            const data = await res.json();
            if (data.models) {
              if (Array.isArray(data.models)) {
                setAntigravityModelsList(data.models);
              } else {
                // Convert object map to array of model objects, ensuring 'name' exists
                const modelsArray = Object.entries(data.models).map(
                  ([key, val]: [string, any]) => ({
                    ...val,
                    name: val.name || key,
                  }),
                );
                setAntigravityModelsList(modelsArray);
              }
            }
          }
        } catch (e) {
          console.error('Failed to fetch Antigravity models', e);
        }
      }

      if (selectedProvider === 'Gemini' && selectedAccount) {
        const acc = accounts.find((a) => a.id === selectedAccount);
        if (!acc) return;

        const cacheKey = `gemini-models-${acc.email}`;

        // Load from cache first
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setGeminiModelsList(parsed);
              if (!geminiModel || !parsed.find((m: any) => m.id === geminiModel)) {
                setGeminiModel(parsed[0].id);
              }
            }
          } catch (e) {
            console.error('Failed to parse cached Gemini models', e);
          }
        }

        try {
          // @ts-ignore
          const status = await window.api.server.start();
          const port = status.port || 11434;

          const res = await fetch(
            `http://localhost:${port}/v1/gemini/models?email=${encodeURIComponent(acc.email)}`,
          );
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              setGeminiModelsList(data);
              localStorage.setItem(cacheKey, JSON.stringify(data));

              // Auto-select first if current selection invalid or empty
              if (
                data.length > 0 &&
                (!geminiModel || !data.find((m: any) => m.id === geminiModel))
              ) {
                setGeminiModel(data[0].id);
              }
            }
          }
        } catch (e) {
          console.error('Failed to fetch Gemini models', e);
        }
      }

      if (selectedProvider === 'HuggingChat' && selectedAccount) {
        try {
          // @ts-ignore
          const status = await window.api.server.start();
          const port = status.port || 11434;
          const acc = accounts.find((a) => a.id === selectedAccount);
          if (!acc) return;

          const res = await fetch(
            `http://localhost:${port}/v1/huggingchat/models?email=${encodeURIComponent(acc.email)}`,
          );
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              setHuggingChatModelsList(data);
              // Auto-select first model if none selected
              if (
                data.length > 0 &&
                (!huggingChatModel || !data.find((m: any) => m.id === huggingChatModel))
              ) {
                setHuggingChatModel(data[0].id);
              }
            }
          }
        } catch (e) {
          console.error('Failed to fetch HuggingChat models', e);
        }
      }

      if (selectedProvider === 'LMArena' && selectedAccount) {
        try {
          // @ts-ignore
          const status = await window.api.server.start();
          const port = status.port || 11434;
          const acc = accounts.find((a) => a.id === selectedAccount);
          if (!acc) return;

          const res = await fetch(
            `http://localhost:${port}/v1/lmarena/models?email=${encodeURIComponent(acc.email)}`,
          );
          if (res.ok) {
            const json = await res.json();
            // Backend returns { data: [...] }
            if (json.data && Array.isArray(json.data)) {
              const models = json.data.map((m: any) => ({ id: m.id, name: m.name }));
              setGroqModels(models);
              if (
                models.length > 0 &&
                (!groqModel || !models.find((m: any) => m.id === groqModel))
              ) {
                setGroqModel(models[0].id);
              }
            }
          }
        } catch (e) {
          console.error('Failed to fetch LMArena models', e);
        }
      }
    };
    fetchGroqModels();
  }, [selectedProvider, selectedAccount, accounts, geminiModel, huggingChatModel]);

  const filteredAccounts = selectedProvider
    ? accounts.filter((acc) => acc.provider === selectedProvider)
    : [];

  const handleSend = async () => {
    if (!input.trim() || !selectedAccount) return;

    // Reset accumulated usage on new message send if needed,
    // or keep it accumulating. Assuming reset per turn or separate display.
    // If we want total session usage, we might not reset here, but `accumulatedUsage`
    // seems to be for the *current* stream if it's "accumulated_token_usage" from deepseek
    // which usually means "for this response".
    // However, the user request says "+ dồn vào tổng token ở headerbar".
    // Let's reset it at start of send to be safe, or if it's total session property?
    // The log says "accumulated_token_usage", v: 148.
    // If it comes in final BATCH, it's likely total for that generation.
    // We will simply add it to our display.
    // Let's NOT reset it here if we want to add to the total count over time.
    // But wait, `tokenCount` is re-calculated from messages.
    // So `accumulatedUsage` should probably be just for the current streaming response
    // and then once the message is in `messages` state, `calculateTokens` might count it?
    // Actually `calculateTokens` counts naive tokens (length/4 etc) or via model.
    // Getting exact usage from server is better.
    // Let's store it in a way that persists.
    // Actually, simpler: just set it when we get it.

    // Commit the accumulated usage from the previous turn to the total
    setTokenCount((prev) => prev + accumulatedUsage);
    setAccumulatedUsage(0);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    const currentAttachments = attachments;
    setInput('');
    setAttachments([]);
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

      // Handle Attachments (Use already uploaded IDs)
      const uploadedFileIds: string[] = [];
      console.error(
        '[Frontend Debug] handleSend - currentAttachments:',
        JSON.stringify(currentAttachments, null, 2),
      );

      if (currentAttachments.length > 0) {
        // Collect IDs from completed uploads
        currentAttachments.forEach((att) => {
          if (att.fileId) {
            uploadedFileIds.push(att.fileId);
          } else {
            console.error('[Frontend Debug] Attachment missing fileId:', att);
          }
        });

        console.error('[Frontend Debug] uploadedFileIds:', uploadedFileIds);

        // If DeepSeek and there are attachments but no IDs (e.g. failed or still uploading), we might warn or skip?
        // Ideally we should block send until upload done?
        // But for now, we just send what we have.
      }

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
                        : account.provider === 'Antigravity'
                          ? antigravityModel
                          : account.provider === 'Gemini'
                            ? geminiModel
                            : account.provider === 'HuggingChat'
                              ? huggingChatModel
                              : deepseekModel,
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
          ref_file_ids: uploadedFileIds.length > 0 ? uploadedFileIds : undefined,
          // New fields for context
          conversation_id: activeChatId !== 'new-session' ? activeChatId : undefined,
          parent_message_id:
            account.provider === 'DeepSeek'
              ? (() => {
                  // For DeepSeek, use the last assistant message's deepseek_message_id
                  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
                  const parentId = lastAssistant?.deepseek_message_id;
                  return parentId;
                })()
              : messages.length > 0
                ? messages[messages.length - 1].id
                : undefined,

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

      const streamHandler = getStreamHandler(account.provider);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ') || line.startsWith('event: ')) {
            const data = line.startsWith('data: ') ? line.slice(6) : line;
            if (data === '[DONE]') continue;
            streamHandler.processLine(
              data,
              assistantMessageId,
              setMessages,
              (usage) => {
                setAccumulatedUsage((prev) => prev + usage);
              },
              (sessionId) => {
                console.log('Session Created:', sessionId);
                setActiveChatId(sessionId);
              },
            );
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
      const account = accounts.find((a: { id: any }) => a.id === selectedAccount);
      if (!account) {
        setHistory([]);
        return;
      }

      setLoadingHistory(true);
      try {
        // @ts-ignore
        const status = await window.api.server.start();
        const port = status.port || 11434;

        const endpoint =
          selectedProvider === 'Claude'
            ? `http://localhost:${port}/v1/claude/conversations`
            : selectedProvider === 'Mistral'
              ? `http://localhost:${port}/v1/mistral/conversations`
              : selectedProvider === 'Kimi'
                ? `http://localhost:${port}/v1/kimi/conversations`
                : selectedProvider === 'Qwen'
                  ? `http://localhost:${port}/v1/qwen/conversations`
                  : selectedProvider === 'Cohere'
                    ? `http://localhost:${port}/v1/cohere/conversations`
                    : selectedProvider === 'Perplexity'
                      ? `http://localhost:${port}/v1/perplexity/conversations`
                      : selectedProvider === 'Groq'
                        ? `http://localhost:${port}/v1/groq/conversations`
                        : selectedProvider === 'Antigravity'
                          ? `http://localhost:${port}/v1/antigravity/conversations`
                          : selectedProvider === 'HuggingChat'
                            ? `http://localhost:${port}/v1/huggingchat/conversations`
                            : selectedProvider === 'LMArena'
                              ? `http://localhost:${port}/v1/lmarena/conversations`
                              : `http://localhost:${port}/v1/deepseek/sessions`;

        const response = await fetch(`${endpoint}?email=${encodeURIComponent(account.email)}`);

        if (response.ok) {
          const data = await response.json();

          if (selectedProvider === 'LMArena') {
            const formatted = (data.conversations || []).map((c: any) => ({
              id: c.conversationId || c.id,
              title: c.title || 'Conversation',
            }));
            setHistory(formatted);
          } else {
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
          }
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

    if (selectedProvider === 'DeepSeek') {
      console.log('[History] Fetching DeepSeek history for account:', account?.email);
    }

    fetchHistory();
  }, [selectedProvider, selectedAccount, accounts]);

  // Debug fetch history
  useEffect(() => {
    if (selectedProvider === 'DeepSeek') {
      console.log('DeepSeek Selected. History:', history);
    }
  }, [history, selectedProvider]);

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

      // @ts-ignore
      const status = await window.api.server.start();
      const port = status.port || 11434;

      const endpoint =
        selectedProvider === 'Claude'
          ? `http://localhost:${port}/v1/claude/conversations/${conversationId}`
          : selectedProvider === 'Mistral'
            ? `http://localhost:${port}/v1/mistral/conversations/${conversationId}`
            : selectedProvider === 'Kimi'
              ? `http://localhost:${port}/v1/kimi/conversations/${conversationId}`
              : selectedProvider === 'Qwen'
                ? `http://localhost:${port}/v1/qwen/conversations/${conversationId}`
                : selectedProvider === 'Perplexity'
                  ? `http://localhost:${port}/v1/perplexity/conversations/${conversationId}`
                  : selectedProvider === 'Groq'
                    ? `http://localhost:${port}/v1/groq/conversations/${conversationId}`
                    : `http://localhost:${port}/v1/deepseek/sessions/${conversationId}/messages`;

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

        // Calculate total tokens for DeepSeek from history
        if (selectedProvider === 'DeepSeek' && data.chat_messages) {
          const totalTokens = data.chat_messages.reduce((acc: number, msg: any) => {
            return acc + (msg.accumulated_token_usage || 0);
          }, 0);
          setTokenCount(totalTokens);
        } else {
          // Reset or recalculate for other providers if needed, though they might not have this field
          // For now we rely on the realtime accumulation for new chats
          // and this history load for old chats.
          // If it's not DeepSeek, we might want to recalculate using local tokenizer if we had one,
          // but since we removed it, we might just set to 0 or leave as is.
          // Better to set to 0 to avoid stale data from previous chat
          if (selectedProvider !== 'DeepSeek') {
            setTokenCount(0);
          }
        }

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

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    target.style.height = 'auto'; // Reset height
    const maxHeight = 24 * 10; // Approx 10 lines
    const newHeight = Math.min(target.scrollHeight, maxHeight);
    target.style.height = `${newHeight}px`;
    setInput(target.value);
  };

  const account = accounts.find((a) => a.id === selectedAccount);

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="h-full flex flex-col bg-background p-4 gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Playground</h2>
        <p className="text-muted-foreground">Experiment with different AI models.</p>
      </div>
      <div className="flex-1 flex overflow-hidden border border-dashed border-zinc-500/25 rounded-lg relative">
        {/* Sidebar */}
        <div ref={sidebarRef} className="relative flex-shrink-0" style={{ width: sidebarWidth }}>
          <div className="h-full overflow-y-auto border-r bg-muted/10 w-full">
            <Sidebar
              sidebarWidth={sidebarWidth}
              selectedProvider={selectedProvider}
              history={history}
              activeChatId={activeChatId}
              startNewChat={startNewChat}
              loadConversation={loadConversation}
              account={account || null}
              groqSettings={groqSettings}
              setGroqSettings={setGroqSettings}
            />
          </div>

          {/* Resizer Handle */}
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-10"
            onMouseDown={startResizing}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-background relative">
          {messages.length === 0 ? (
            <WelcomeScreen
              dropdowns={
                <div className="flex flex-wrap gap-4">
                  <CustomSelect
                    value={selectedProvider}
                    onChange={(val) => {
                      setSelectedProvider(val as any);
                      // Auto-select first account of the new provider
                      const providerAccounts = accounts.filter((acc) => acc.provider === val);
                      if (providerAccounts.length > 0) {
                        setSelectedAccount(providerAccounts[0].id);
                      } else {
                        setSelectedAccount('');
                      }
                    }}
                    options={[
                      { value: 'DeepSeek', label: 'DeepSeek', icon: deepseekIcon },
                      { value: 'Claude', label: 'Claude', icon: claudeIcon },
                      { value: 'Mistral', label: 'Mistral', icon: mistralIcon },
                      { value: 'Kimi', label: 'Kimi', icon: kimiIcon },
                      { value: 'Qwen', label: 'Qwen', icon: qwenIcon },
                      { value: 'Cohere', label: 'Cohere', icon: cohereIcon },
                      { value: 'Perplexity', label: 'Perplexity', icon: perplexityIcon },
                      { value: 'Groq', label: 'Groq', icon: groqIcon },
                      { value: 'Antigravity', label: 'Antigravity', icon: antigravityIcon },
                      { value: 'Gemini', label: 'Gemini', icon: geminiIcon },
                      { value: 'HuggingChat', label: 'HuggingChat', icon: huggingChatIcon },
                    ]}
                    placeholder="Select Provider"
                  />
                  {selectedProvider && (
                    <div className="flex flex-row items-center gap-4">
                      <CustomSelect
                        value={selectedAccount}
                        onChange={setSelectedAccount}
                        options={filteredAccounts.map((acc) => ({
                          value: acc.id,
                          label: acc.name || acc.email,
                          icon: <User className="h-4 w-4" />,
                        }))}
                        placeholder="Select Account"
                        disabled={!selectedProvider}
                      />

                      {selectedProvider === 'Claude' && (
                        <div className="w-[300px]">
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

                      {/* Model Selectors */}
                      {selectedProvider === 'Groq' && selectedAccount && (
                        <div className="space-y-4">
                          <GroqModelSelector
                            value={groqModel}
                            onChange={setGroqModel}
                            models={groqModelsList}
                          />
                          {/* <GroqSidebarSettings
                            settings={groqSettings}
                            onSettingsChange={setGroqSettings}
                          /> */}
                        </div>
                      )}

                      {selectedProvider === 'Antigravity' && selectedAccount && (
                        <AntigravityModelSelector
                          value={antigravityModel}
                          onChange={setAntigravityModel}
                          models={antigravityModelsList}
                        />
                      )}
                      {selectedProvider === 'Gemini' && selectedAccount && (
                        <GeminiModelSelector
                          value={geminiModel}
                          onChange={setGeminiModel}
                          models={geminiModelsList}
                        />
                      )}

                      {selectedProvider === 'HuggingChat' && selectedAccount && (
                        <div className="w-[300px]">
                          <CustomSelect
                            value={huggingChatModel}
                            onChange={setHuggingChatModel}
                            options={huggingChatModelsList.map((model) => ({
                              value: model.id,
                              label: model.displayName || model.name || model.id,
                            }))}
                            placeholder="Select Model"
                            disabled={huggingChatModelsList.length === 0}
                          />
                        </div>
                      )}

                      {selectedProvider === 'LMArena' && selectedAccount && (
                        <div className="w-[300px]">
                          <CustomSelect
                            value={groqModel}
                            onChange={setGroqModel}
                            options={groqModels.map((model) => ({
                              value: model.id,
                              label: model.name || model.id,
                            }))}
                            placeholder="Select Model"
                            disabled={groqModels.length === 0}
                          />
                        </div>
                      )}

                      {selectedProvider === 'DeepSeek' && (
                        <div className="w-[300px]">
                          <CustomSelect
                            value={deepseekModel}
                            onChange={setDeepseekModel}
                            options={[
                              {
                                value: 'deepseek-ai/DeepSeek-V3.2',
                                label: 'deepseek-ai/DeepSeek-V3.2',
                              },
                            ]}
                            placeholder="Select Model"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              }
              input={input}
              handleInput={handleInput}
              handleKeyDown={handleKeyDown}
              handleSend={handleSend}
              loading={loading}
              isStreaming={isStreaming}
              selectedAccount={selectedAccount}
              selectedProvider={selectedProvider}
              thinkingEnabled={thinkingEnabled}
              setThinkingEnabled={setThinkingEnabled}
              searchEnabled={searchEnabled}
              setSearchEnabled={setSearchEnabled}
              onFileSelect={handleFileSelect}
              attachments={attachments}
              onRemoveAttachment={handleRemoveAttachment}
            />
          ) : (
            <>
              {/* Header */}
              <div className="h-14 border-b flex items-center justify-between px-4 bg-background/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="font-medium truncate flex-1 text-center">
                  {conversationTitle || 'New Chat'}
                </div>
                {/* Right side actions if any */}
                <div className="w-24 text-right text-xs text-muted-foreground mr-2">
                  {(tokenCount + accumulatedUsage + inputTokenCount).toLocaleString()} tokens
                </div>
              </div>

              <ChatArea messages={messages} loading={loading} isStreaming={isStreaming} />

              <InputArea
                input={input}
                handleInput={handleInput}
                handleKeyDown={handleKeyDown}
                handleSend={handleSend}
                handleStop={handleStop}
                loading={loading}
                isStreaming={isStreaming}
                selectedAccount={selectedAccount}
                selectedProvider={selectedProvider}
                thinkingEnabled={thinkingEnabled}
                setThinkingEnabled={setThinkingEnabled}
                searchEnabled={searchEnabled}
                setSearchEnabled={setSearchEnabled}
                onFileSelect={handleFileSelect}
                attachments={attachments}
                onRemoveAttachment={handleRemoveAttachment}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaygroundPage;
