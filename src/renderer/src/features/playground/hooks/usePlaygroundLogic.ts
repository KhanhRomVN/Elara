import { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Account, PendingAttachment, ConversationTab, FunctionParams } from '../types';
import { getStreamHandler } from '../stream-handlers';
import { getHistoryEndpoint, parseConversationList } from '../utils/conversation-utils';

export const usePlaygroundLogic = ({
  activeTab,
  activeTabId,
  onUpdateTab,
}: {
  activeTab?: ConversationTab;
  activeTabId?: string;
  onUpdateTab?: (id: string, data: Partial<ConversationTab>) => void;
}) => {
  const [messages, setMessages] = useState<Message[]>(() => activeTab?.messages || []);
  const [input, setInput] = useState(() => activeTab?.input || '');
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
    | 'Antigravity'
    | 'Gemini'
    | 'HuggingChat'
    | 'LMArena'
    | ''
  >(() => (activeTab?.selectedProvider as any) || '');
  const [selectedAccount, setSelectedAccount] = useState<string>(
    () => activeTab?.selectedAccount || '',
  );
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [, setCurrentMessageId] = useState<number | null>(null);

  const [thinkingEnabled, setThinkingEnabled] = useState(() => activeTab?.thinkingEnabled ?? true);
  const [searchEnabled, setSearchEnabled] = useState(() => activeTab?.searchEnabled ?? false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>(
    () => activeTab?.attachments || [],
  );
  const [tokenCount, setTokenCount] = useState(() => activeTab?.tokenCount || 0);
  const [inputTokenCount, setInputTokenCount] = useState(() => activeTab?.inputTokenCount || 0);
  const [accumulatedUsage, setAccumulatedUsage] = useState(() => activeTab?.accumulatedUsage || 0);

  const [activeChatId, setActiveChatId] = useState<string | null>(
    () => activeTab?.activeChatId || null,
  );
  const [conversationTitle, setConversationTitle] = useState<string>(
    () => activeTab?.conversationTitle || '',
  );

  // Model States
  const [claudeModel, setClaudeModel] = useState(
    () => activeTab?.claudeModel || 'claude-sonnet-4-5-20250929',
  );
  const [antigravityModel, setAntigravityModel] = useState(
    () => activeTab?.antigravityModel || 'models/gemini-3-pro-preview',
  );
  const [geminiModel, setGeminiModel] = useState(
    () => activeTab?.geminiModel || 'fbb127bbb056c959',
  );
  const [groqModel, setGroqModel] = useState(() => activeTab?.groqModel || 'openai/gpt-oss-120b');
  const [huggingChatModel, setHuggingChatModel] = useState(() => activeTab?.huggingChatModel || '');
  const [deepseekModel, setDeepseekModel] = useState(
    () => activeTab?.deepseekModel || 'deepseek-ai/DeepSeek-V3.2',
  );

  const [groqModels, setGroqModels] = useState<any[]>([]); // For LMArena

  // Lists
  const [groqModelsList, setGroqModelsList] = useState<any[]>([]);
  const [antigravityModelsList, setAntigravityModelsList] = useState<any[]>([]);
  const [geminiModelsList, setGeminiModelsList] = useState<any[]>([]);
  const [huggingChatModelsList, setHuggingChatModelsList] = useState<any[]>([]);

  const [groqSettings, setGroqSettings] = useState(
    () =>
      activeTab?.groqSettings || {
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
      },
  );

  const [history, setHistory] = useState<any[]>([]);

  // Helper to normalize file input
  const itemsToFileArray = (items: FileList | File[]): File[] => {
    if (Array.isArray(items)) {
      return items;
    }
    return Array.from(items);
  };

  const handleFileSelect = async (files: FileList | File[] | null) => {
    if (!files) return;
    const newFiles = itemsToFileArray(files);

    const newAttachments: PendingAttachment[] = newFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'pending',
      previewUrl: URL.createObjectURL(file),
      progress: 0,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);

    if (selectedProvider === 'DeepSeek') {
      try {
        // @ts-ignore
        const serverStatus = await window.api.server.start();
        const port = serverStatus.port;
        const account = accounts.find((acc) => acc.id === selectedAccount);

        if (account) {
          newAttachments.forEach(async (att) => {
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
      } catch (e) {
        console.error('Failed to upload file', e);
      }
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStop = useCallback(async () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setLoading(false);
    setIsStreaming(false);
    setCurrentMessageId(null);
  }, [abortController]);

  // Sync state ref
  const stateRef = useRef({
    messages,
    input,
    selectedProvider,
    selectedAccount,
    claudeModel,
    groqModel,
    antigravityModel,
    geminiModel,
    huggingChatModel,
    deepseekModel,
    thinkingEnabled,
    searchEnabled,
    attachments,
    tokenCount,
    accumulatedUsage,
    inputTokenCount,
    groqSettings,
    activeChatId,
    conversationTitle,
  });

  useEffect(() => {
    stateRef.current = {
      messages,
      input,
      selectedProvider,
      selectedAccount,
      claudeModel,
      groqModel,
      antigravityModel,
      geminiModel,
      huggingChatModel,
      deepseekModel,
      thinkingEnabled,
      searchEnabled,
      attachments,
      tokenCount,
      accumulatedUsage,
      inputTokenCount,
      groqSettings,
      activeChatId,
      conversationTitle,
    };
  }, [
    messages,
    input,
    selectedProvider,
    selectedAccount,
    claudeModel,
    groqModel,
    antigravityModel,
    geminiModel,
    huggingChatModel,
    deepseekModel,
    thinkingEnabled,
    searchEnabled,
    attachments,
    tokenCount,
    accumulatedUsage,
    inputTokenCount,
    groqSettings,
    activeChatId,
    conversationTitle,
  ]);

  // Sync state on unmount or tab change
  useEffect(() => {
    return () => {
      if (onUpdateTab && activeTabId) {
        onUpdateTab(activeTabId, stateRef.current);
      }
    };
  }, [activeTabId, onUpdateTab]);

  // Sync title immediately
  useEffect(() => {
    if (onUpdateTab && activeTabId && conversationTitle) {
      onUpdateTab(activeTabId, { conversationTitle });
    }
  }, [conversationTitle, activeTabId, onUpdateTab]);

  // Sync messages on done
  useEffect(() => {
    if (!isStreaming && messages.length > 0 && onUpdateTab && activeTabId) {
      onUpdateTab(activeTabId, { messages, tokenCount, accumulatedUsage });
    }
  }, [isStreaming, messages, tokenCount, accumulatedUsage, activeTabId, onUpdateTab]);

  // Fetch Accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        // @ts-ignore
        const data = await window.api.accounts.getAll();
        setAccounts(data);

        if (data.length > 0) {
          const deepseekAccount = data.find(
            (acc: Account) => acc.provider === 'DeepSeek' && acc.status === 'Active',
          );
          const otherAccount = data.find((acc: Account) => acc.status === 'Active');
          const target = deepseekAccount || otherAccount || data[0];

          if (target && !selectedProvider) {
            setSelectedProvider(target.provider);
            setSelectedAccount(target.id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      }
    };
    fetchAccounts();
  }, []); // Run once on mount

  // Fetch Models
  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedAccount) return;

      const acc = accounts.find((a) => a.id === selectedAccount);
      if (!acc) return;

      try {
        // @ts-ignore
        const status = await window.api.server.start();
        const port = status.port || 11434;

        if (selectedProvider === 'Groq') {
          const res = await fetch(
            `http://localhost:${port}/v1/groq/models?email=${encodeURIComponent(acc.email)}`,
          );
          if (res.ok) {
            const data = await res.json();
            if (data.data && Array.isArray(data.data)) {
              setGroqModelsList(data.data.sort((a: any, b: any) => a.id.localeCompare(b.id)));
            }
          }
        } else if (selectedProvider === 'Antigravity') {
          const res = await fetch(
            `http://localhost:${port}/v1/antigravity/models?email=${encodeURIComponent(acc.email)}`,
          );
          if (res.ok) {
            const data = await res.json();
            if (data.models) {
              if (Array.isArray(data.models)) {
                setAntigravityModelsList(data.models);
              } else {
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
        } else if (selectedProvider === 'Gemini') {
          // Cache logic handled inside the original simplified for hook
          const cacheKey = `gemini-models-${acc.email}`;
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setGeminiModelsList(parsed);
              if (!geminiModel || !parsed.find((m: any) => m.id === geminiModel)) {
                setGeminiModel(parsed[0].id);
              }
            }
          }
          const res = await fetch(
            `http://localhost:${port}/v1/gemini/models?email=${encodeURIComponent(acc.email)}`,
          );
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              setGeminiModelsList(data);
              localStorage.setItem(cacheKey, JSON.stringify(data));
              if (
                data.length > 0 &&
                (!geminiModel || !data.find((m: any) => m.id === geminiModel))
              ) {
                setGeminiModel(data[0].id);
              }
            }
          }
        } else if (selectedProvider === 'HuggingChat') {
          const res = await fetch(
            `http://localhost:${port}/v1/huggingchat/models?email=${encodeURIComponent(acc.email)}`,
          );
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              setHuggingChatModelsList(data);
              if (
                data.length > 0 &&
                (!huggingChatModel || !data.find((m: any) => m.id === huggingChatModel))
              ) {
                setHuggingChatModel(data[0].id);
              }
            }
          }
        } else if (selectedProvider === 'LMArena') {
          const res = await fetch(
            `http://localhost:${port}/v1/lmarena/models?email=${encodeURIComponent(acc.email)}`,
          );
          if (res.ok) {
            const json = await res.json();
            if (json.data && Array.isArray(json.data)) {
              const models = json.data.map((m: any) => ({ id: m.id, name: m.name }));
              setGroqModels(models); // Using groqModels state for LMArena as in original
              if (
                models.length > 0 &&
                (!groqModel || !models.find((m: any) => m.id === groqModel))
              ) {
                setGroqModel(models[0].id);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
    };
    fetchModels();
  }, [selectedProvider, selectedAccount, accounts]); // geminiModel etc deps removed to avoid infinite loops, simplistic approach

  // Fetch History
  useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedProvider || !selectedAccount) {
        setHistory([]);
        return;
      }
      const acc = accounts.find((a) => a.id === selectedAccount);
      if (!acc) return;

      try {
        // @ts-ignore
        const status = await window.api.server.start();
        const port = status.port || 11434;
        const endpoint = getHistoryEndpoint(selectedProvider, port);
        const response = await fetch(`${endpoint}?email=${encodeURIComponent(acc.email)}`);
        if (response.ok) {
          const data = await response.json();
          setHistory(parseConversationList(selectedProvider, data));
        }
      } catch (error) {
        console.error('History fetch error', error);
      }
    };
    fetchHistory();
  }, [selectedProvider, selectedAccount, accounts]);

  // Input Token Count
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!input) setInputTokenCount(0);
      // else logic removed as in original
    }, 500);
    return () => clearTimeout(timer);
  }, [input, selectedProvider, deepseekModel]);

  const handleSend = async () => {
    if (!input.trim() || !selectedAccount) return;

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
      // @ts-ignore
      const serverStatus = await window.api.server.start();
      if (!serverStatus.success) throw new Error('Server not running');
      const port = serverStatus.port;

      const account = accounts.find((acc) => acc.id === selectedAccount);
      if (!account) throw new Error('Account not found');

      const url = `http://localhost:${port}/v1/chat/completions?email=${encodeURIComponent(account.email)}&provider=${account.provider.toLowerCase()}`;

      const controller = new AbortController();
      setAbortController(controller);

      const uploadedFileIds: string[] = [];
      currentAttachments.forEach((att) => {
        if (att.fileId) uploadedFileIds.push(att.fileId);
      });

      const response = await fetch(url, {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
                              : account.provider === 'LMArena'
                                ? groqModel
                                : deepseekModel,
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: currentInput },
          ],
          stream: true,
          thinking: account.provider === 'DeepSeek' ? thinkingEnabled : undefined,
          search: account.provider === 'DeepSeek' ? searchEnabled : undefined,
          ref_file_ids: uploadedFileIds.length > 0 ? uploadedFileIds : undefined,
          conversation_id: activeChatId !== 'new-session' ? activeChatId : undefined,
          parent_message_id:
            account.provider === 'DeepSeek'
              ? [...messages].reverse().find((m) => m.role === 'assistant')?.deepseek_message_id
              : messages.length > 0
                ? messages[messages.length - 1].id
                : undefined,
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
                stream: groqSettings.stream,
              }
            : {}),
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

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

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      if (!reader) throw new Error('No response body');

      const streamHandler = getStreamHandler(account.provider);
      let currentSessionId = activeChatId;

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
              (usage) => setAccumulatedUsage((prev) => prev + usage),
              (sessionId) => {
                setActiveChatId(sessionId);
                currentSessionId = sessionId;
              },
              (title) => setConversationTitle(title),
            );
          }
        }
      }
      setIsStreaming(false);

      if (
        !conversationTitle ||
        conversationTitle === 'New Chat' ||
        conversationTitle === 'Untitled'
      ) {
        try {
          const endpoint = getHistoryEndpoint(account.provider, port || 11434);
          const historyRes = await fetch(`${endpoint}?email=${encodeURIComponent(account.email)}`);
          if (historyRes.ok) {
            const historyData = await historyRes.json();
            const historyList = parseConversationList(account.provider, historyData);
            let targetChat = currentSessionId
              ? historyList.find((c) => c.id === currentSessionId)
              : null;
            if (
              !targetChat &&
              (!activeChatId || activeChatId === 'new-session') &&
              historyList.length > 0
            ) {
              targetChat = historyList[0];
            }
            if (targetChat && targetChat.title && targetChat.title !== 'New Chat') {
              setConversationTitle(targetChat.title);
              if (!activeChatId || activeChatId === 'new-session') {
                setActiveChatId(targetChat.id);
              }
            }
          }
        } catch (e) {
          console.error('Failed to update title', e);
        }
      }
    } catch (error) {
      // @ts-ignore
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted'))
      ) {
        setLoading(false);
        setIsStreaming(false);
        return;
      }
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setLoading(false);
      setIsStreaming(false);
    }
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
    setConversationTitle('');
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const account = accounts.find((a) => a.id === selectedAccount);
      if (!account) return;
      // @ts-ignore
      const status = await window.api.server.start();
      const port = status.port || 11434;

      let endpoint = '';
      const provider = selectedProvider.toLowerCase();
      if (provider === 'deepseek')
        endpoint = `http://localhost:${port}/v1/deepseek/sessions/${conversationId}/messages`;
      else endpoint = `http://localhost:${port}/v1/${provider}/conversations/${conversationId}`;

      const response = await fetch(`${endpoint}?email=${encodeURIComponent(account.email)}`);
      if (response.ok) {
        const data = await response.json();
        // Title extraction logic reduced for brevity, relying on previous logic pattern
        let title = 'Conversation';
        if (selectedProvider === 'Claude') title = data.name || data.summary || 'Untitled';
        else if (selectedProvider === 'DeepSeek') title = data.chat_session?.title || 'Untitled';

        setConversationTitle(title);

        let formattedMessages: Message[] = [];
        if (selectedProvider === 'Claude') {
          formattedMessages = (data.chat_messages || []).map((m: any) => ({
            id: m.uuid,
            role: m.sender === 'human' ? 'user' : 'assistant',
            content: m.content?.[0]?.text || m.text || '',
          }));
        } else if (selectedProvider === 'DeepSeek') {
          formattedMessages = (data.chat_messages || []).map((m: any) => ({
            id: m.message_id,
            role: m.role === 'USER' ? 'user' : 'assistant',
            content: m.fragments?.map((f: any) => f.content).join('') || '',
          }));
          const totalTokens = (data.chat_messages || []).reduce(
            (acc: number, msg: any) => acc + (msg.accumulated_token_usage || 0),
            0,
          );
          setTokenCount(totalTokens);
        } else if (selectedProvider === 'HuggingChat') {
          formattedMessages = (data.messages || []).map((m: any) => ({
            id: m.id,
            role: m.from === 'user' ? 'user' : 'assistant',
            content: m.content,
          }));
        }
        // Add other providers as needed

        setMessages(formattedMessages);
        setActiveChatId(conversationId);
      }
    } catch (e) {
      console.error('Failed to load conversation', e);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    target.style.height = 'auto';
    const maxHeight = 240;
    const newHeight = Math.min(target.scrollHeight, maxHeight);
    target.style.height = `${newHeight}px`;
    setInput(target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return {
    messages,
    setMessages,
    input,
    setInput,
    accounts,
    selectedProvider,
    setSelectedProvider,
    selectedAccount,
    setSelectedAccount,
    loading,
    isStreaming,
    thinkingEnabled,
    setThinkingEnabled,
    searchEnabled,
    setSearchEnabled,
    attachments,
    handleFileSelect,
    handleRemoveAttachment,
    tokenCount,
    accumulatedUsage,
    inputTokenCount,
    activeChatId,
    conversationTitle,
    claudeModel,
    setClaudeModel,
    antigravityModel,
    setAntigravityModel,
    geminiModel,
    setGeminiModel,
    groqModel,
    setGroqModel,
    huggingChatModel,
    setHuggingChatModel,
    deepseekModel,
    setDeepseekModel,
    groqModels,
    groqModelsList,
    antigravityModelsList,
    geminiModelsList,
    huggingChatModelsList,
    groqSettings,
    setGroqSettings,
    history,
    handleSend,
    handleStop,
    handleInput,
    handleKeyDown,
    startNewChat,
    loadConversation,
  };
};
