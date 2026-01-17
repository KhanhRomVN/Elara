import { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Account, PendingAttachment, ConversationTab, FunctionParams } from '../types';
import { getStreamHandler } from '../stream-handlers';
import { getHistoryEndpoint, parseConversationList } from '../utils/conversation-utils';
import { getCachedModels, fetchAndCacheModels } from '../../../utils/model-cache';

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

  // Model States - Initialize with empty defaults, will be populated from cache/API
  const [claudeModel, setClaudeModel] = useState(() => activeTab?.claudeModel || '');
  const [antigravityModel, setAntigravityModel] = useState(() => activeTab?.antigravityModel || '');
  const [geminiModel, setGeminiModel] = useState(() => activeTab?.geminiModel || '');
  const [groqModel, setGroqModel] = useState(() => activeTab?.groqModel || '');
  const [huggingChatModel, setHuggingChatModel] = useState(() => activeTab?.huggingChatModel || '');
  const [deepseekModel, setDeepseekModel] = useState(() => activeTab?.deepseekModel || '');

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

  // Fetch Models using cache
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
          // Try cache first
          const cached = getCachedModels('Groq');
          if (cached && cached.length > 0) {
            setGroqModelsList(cached.sort((a: any, b: any) => a.id.localeCompare(b.id)));
            if (!groqModel) setGroqModel(cached[0].id);
          }
          // Fetch and update
          const models = await fetchAndCacheModels('Groq', acc.email, port);
          if (models.length > 0) {
            setGroqModelsList(models.sort((a: any, b: any) => a.id.localeCompare(b.id)));
            if (!groqModel) setGroqModel(models[0].id);
          }
        } else if (selectedProvider === 'Antigravity') {
          const cached = getCachedModels('Antigravity');
          if (cached && cached.length > 0) {
            setAntigravityModelsList(cached);
            if (!antigravityModel) setAntigravityModel(cached[0].id || cached[0].name || '');
          }
          const models = await fetchAndCacheModels('Antigravity', acc.email, port);
          if (models.length > 0) {
            setAntigravityModelsList(models);
            if (!antigravityModel) setAntigravityModel(models[0].id || models[0].name || '');
          }
        } else if (selectedProvider === 'Gemini') {
          const cached = getCachedModels('Gemini');
          if (cached && cached.length > 0) {
            setGeminiModelsList(cached);
            if (!geminiModel) setGeminiModel(cached[0].id);
          }
          const models = await fetchAndCacheModels('Gemini', acc.email, port);
          if (models.length > 0) {
            setGeminiModelsList(models);
            if (!geminiModel) setGeminiModel(models[0].id);
          }
        } else if (selectedProvider === 'HuggingChat') {
          const cached = getCachedModels('HuggingChat');
          if (cached && cached.length > 0) {
            setHuggingChatModelsList(cached);
            if (!huggingChatModel) setHuggingChatModel(cached[0].id);
          }
          const models = await fetchAndCacheModels('HuggingChat', acc.email, port);
          if (models.length > 0) {
            setHuggingChatModelsList(models);
            if (!huggingChatModel) setHuggingChatModel(models[0].id);
          }
        } else if (selectedProvider === 'LMArena') {
          const cached = getCachedModels('LMArena');
          if (cached && cached.length > 0) {
            setGroqModels(cached);
            if (!groqModel) setGroqModel(cached[0].id);
          }
          const models = await fetchAndCacheModels('LMArena', acc.email, port);
          if (models.length > 0) {
            setGroqModels(models);
            if (!groqModel) setGroqModel(models[0].id);
          }
        } else if (selectedProvider === 'DeepSeek') {
          const cached = getCachedModels('DeepSeek');
          if (cached && cached.length > 0 && !deepseekModel) {
            setDeepseekModel(cached[0].id);
          }
          const models = await fetchAndCacheModels('DeepSeek', acc.email, port);
          if (models.length > 0 && !deepseekModel) {
            setDeepseekModel(models[0].id);
          }
        } else if (selectedProvider === 'Claude') {
          const cached = getCachedModels('Claude');
          if (cached && cached.length > 0 && !claudeModel) {
            setClaudeModel(cached[0].id);
          }
          const models = await fetchAndCacheModels('Claude', acc.email, port);
          if (models.length > 0 && !claudeModel) {
            setClaudeModel(models[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
    };
    fetchModels();
  }, [selectedProvider, selectedAccount, accounts]);

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
      if (!input) {
        setInputTokenCount(0);
        return;
      }

      // Claude token counting
      if (selectedProvider === 'Claude') {
        try {
          const { countClaudeTokens } = await import('../utils/claude-tokenizer');
          const tokens = countClaudeTokens(input);
          setInputTokenCount(tokens);
        } catch (error) {
          console.error('Error counting Claude input tokens:', error);
          setInputTokenCount(0);
        }
      }
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

      // Helper to get model ID for providers without explicit state
      const getProviderModel = (providerId: string): string => {
        const cached = getCachedModels(providerId);
        return cached && cached.length > 0 ? cached[0].id : '';
      };

      const response = await fetch(url, {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:
            account.provider === 'Claude'
              ? claudeModel
              : account.provider === 'Mistral'
                ? getProviderModel('Mistral')
                : account.provider === 'Kimi'
                  ? getProviderModel('Kimi')
                  : account.provider === 'Qwen'
                    ? getProviderModel('Qwen')
                    : account.provider === 'Cohere'
                      ? getProviderModel('Cohere')
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
          thinking:
            account.provider === 'DeepSeek'
              ? deepseekModel === 'deepseek-reasoner' || thinkingEnabled
              : undefined,
          search: account.provider === 'DeepSeek' ? searchEnabled : undefined,
          ref_file_ids: uploadedFileIds.length > 0 ? uploadedFileIds : undefined,
          conversation_id: activeChatId !== 'new-session' ? activeChatId : undefined,
          parent_message_id:
            account.provider === 'DeepSeek'
              ? [...messages].reverse().find((m) => m.role === 'assistant')?.deepseek_message_id
              : account.provider === 'Claude'
                ? [...messages].reverse().find((m) => m.role === 'assistant')?.claude_message_uuid
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

          // Calculate total tokens for Claude conversations
          try {
            const { countClaudeMessagesTokens } = await import('../utils/claude-tokenizer');
            const totalTokens = countClaudeMessagesTokens(formattedMessages);
            setTokenCount(totalTokens);
          } catch (error) {
            console.error('Error counting Claude conversation tokens:', error);
          }
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
