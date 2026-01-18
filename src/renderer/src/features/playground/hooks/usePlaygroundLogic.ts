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
  const [providersList, setProvidersList] = useState<any[]>([]);
  const [streamEnabled, setStreamEnabled] = useState(true);

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
  };

  // Auto-disable search if files are attached (DeepSeek)
  useEffect(() => {
    if (selectedProvider === 'DeepSeek' && attachments.length > 0 && searchEnabled) {
      setSearchEnabled(false);
    }
  }, [attachments, searchEnabled, selectedProvider]);

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle File Uploads (Smart Upload Management)
  useEffect(() => {
    const uploadPendingFiles = async () => {
      // Only Smart Upload for DeepSeek currently
      if (selectedProvider !== 'DeepSeek') return;

      // If no account selected, we wait (files remain in 'pending' state)
      if (!selectedAccount) return;

      const account = accounts.find((a) => a.id === selectedAccount);
      if (!account) return;

      // Identify files needing upload:
      // 1. Newly selected (pending)
      // 2. Previously uploaded but with different account (re-upload needed for context)
      const itemsToUpload = attachments.filter(
        (a) =>
          a.status === 'pending' ||
          (a.status === 'completed' && a.accountId !== selectedAccount) ||
          (a.status === 'error' && a.accountId !== selectedAccount),
      );

      if (itemsToUpload.length === 0) return;

      console.log(
        `[Smart Upload] Uploading ${itemsToUpload.length} files for account ${selectedAccount}`,
      );

      // Mark as uploading immediately to prevent double-triggering
      setAttachments((prev) =>
        prev.map((a) =>
          itemsToUpload.some((i) => i.id === a.id) ? { ...a, status: 'uploading', progress: 0 } : a,
        ),
      );

      try {
        // @ts-ignore
        const serverStatus = await window.api.server.start();
        const port = serverStatus.port || 11434;

        // Process uploads in parallel
        itemsToUpload.forEach(async (att) => {
          try {
            const formData = new FormData();
            formData.append('file', att.file);

            // Backend endpoint: POST /v1/chat/accounts/:accountId/uploads
            const uploadUrl = `http://localhost:${port}/v1/chat/accounts/${account.id}/uploads`;

            const res = await fetch(uploadUrl, {
              method: 'POST',
              body: formData,
              // Note: No Content-Type header; fetch sets it with boundary for FormData
            });

            if (res.ok) {
              const data = await res.json();
              if (data.success && data.data?.file_id) {
                console.log(`[Smart Upload] Success: ${att.file.name} -> ${data.data.file_id}`);
                setAttachments((prev) =>
                  prev.map((p) =>
                    p.id === att.id
                      ? {
                          ...p,
                          status: 'completed',
                          fileId: data.data.file_id,
                          accountId: account.id, // Bind to this account
                          progress: 100,
                        }
                      : p,
                  ),
                );
                setAccumulatedUsage((prev) => prev + (data.data.token_usage || 0));
              } else {
                throw new Error(data.error || 'Invalid upload response');
              }
            } else {
              const errText = await res.text();
              throw new Error(`Upload failed ${res.status}: ${errText}`);
            }
          } catch (err) {
            console.error(`[Smart Upload] Error uploading ${att.file.name}:`, err);
            setAttachments((prev) =>
              prev.map((p) => (p.id === att.id ? { ...p, status: 'error' } : p)),
            );
          }
        });
      } catch (e) {
        console.error('[Smart Upload] System error:', e);
      }
    };

    uploadPendingFiles();
  }, [attachments, selectedAccount, selectedProvider, accounts]);

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
  const lastSyncedTitleRef = useRef<string>('');
  useEffect(() => {
    if (
      onUpdateTab &&
      activeTabId &&
      conversationTitle &&
      conversationTitle !== lastSyncedTitleRef.current
    ) {
      lastSyncedTitleRef.current = conversationTitle;
      onUpdateTab(activeTabId, { conversationTitle });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationTitle, activeTabId]);

  // Sync messages on done
  useEffect(() => {
    if (!isStreaming && messages.length > 0 && onUpdateTab && activeTabId) {
      onUpdateTab(activeTabId, { messages, tokenCount, accumulatedUsage });
    }
  }, [isStreaming, messages, tokenCount, accumulatedUsage, activeTabId, onUpdateTab]);

  // Fetch Providers
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await fetch(
          'https://raw.githubusercontent.com/KhanhRomVN/Elara/main/provider.json',
        );
        if (res.ok) {
          const data = await res.json();
          setProvidersList(data);
        }
      } catch (error) {
        console.error('Failed to fetch providers:', error);
      }
    };
    fetchProviders();
  }, []);

  // Fetch Accounts when provider changes
  useEffect(() => {
    const fetchAccountsByProvider = async () => {
      if (!selectedProvider) {
        setAccounts([]);
        setSelectedAccount('');
        return;
      }

      try {
        // @ts-ignore
        const status = await window.api.server.start();
        const port = status.port || 11434;

        // Convert provider name to provider_id (lowercase, handle special cases)
        let providerId = selectedProvider.toLowerCase();
        // Handle special case: HuggingChat -> hugging-chat
        if (providerId === 'huggingchat') {
          providerId = 'hugging-chat';
        }

        console.log('[Playground] Fetching accounts for provider:', providerId);

        const res = await fetch(
          `http://localhost:${port}/v1/accounts?page=1&limit=10&provider_id=${encodeURIComponent(providerId)}`,
        );
        if (res.ok) {
          const data = await res.json();
          console.log('[Playground] Accounts response:', data);
          const accountsList = data.data?.accounts || [];
          setAccounts(accountsList);
          // Reset selected account when provider changes
          setSelectedAccount('');
        } else {
          console.error('[Playground] Failed to fetch accounts, status:', res.status);
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
        setAccounts([]);
      }
    };
    fetchAccountsByProvider();
  }, [selectedProvider]);

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
        // Use new unified endpoint with accountId
        const endpoint = getHistoryEndpoint(selectedProvider, port, acc.id);
        const response = await fetch(`${endpoint}?page=1&limit=30`);
        if (response.ok) {
          const result = await response.json();
          // New API returns { data: { conversations: [...] } }
          const conversations = result.data?.conversations || result;
          setHistory(parseConversationList(selectedProvider, conversations));
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

    const messageAttachments = attachments.map((att) => ({
      id: att.id,
      name: att.file.name,
      type: att.file.type.startsWith('image/') ? 'image' : 'file',
      url: att.previewUrl,
      size: att.file.size,
      mimeType: att.file.type,
    }));

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      attachments: messageAttachments.length > 0 ? (messageAttachments as any) : undefined,
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

      // Use new unified endpoint
      const url = `http://localhost:${port}/v1/chat/accounts/${account.id}/messages`;

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

      // Determine model based on provider
      const getModelForProvider = () => {
        const pid = account.provider_id.toLowerCase();
        switch (pid) {
          case 'claude':
            return claudeModel;
          case 'deepseek':
            return deepseekModel;
          case 'groq':
            return groqModel;
          case 'antigravity':
            return antigravityModel;
          case 'gemini':
            return geminiModel;
          case 'huggingchat':
            return huggingChatModel;
          case 'lmarena':
            return groqModel;
          default:
            return getProviderModel(account.provider_id);
        }
      };

      const response = await fetch(url, {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: getModelForProvider(),
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: currentInput },
          ],
          conversationId: activeChatId && activeChatId !== 'new-session' ? activeChatId : '',
          stream: streamEnabled,
          search: searchEnabled,
          ref_file_ids: uploadedFileIds,
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

      if (streamEnabled) {
        // Handle streaming response
        setIsStreaming(true);

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
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);

                // Handle content chunk: { content: "..." }
                if (parsed.content) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: m.content + parsed.content }
                        : m,
                    ),
                  );
                }

                // Handle metadata: { meta: { conversation_id, conversation_title } }
                if (parsed.meta) {
                  if (parsed.meta.conversation_id) {
                    setActiveChatId(parsed.meta.conversation_id);
                  }
                  if (parsed.meta.conversation_title) {
                    setConversationTitle(parsed.meta.conversation_title);
                  }
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
        setIsStreaming(false);
      } else {
        // Handle non-streaming response
        const result = await response.json();
        if (result.success && result.message) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, content: result.message.content } : m,
            ),
          );
        }
        if (result.metadata) {
          if (result.metadata.conversation_id) {
            setActiveChatId(result.metadata.conversation_id);
          }
          if (result.metadata.conversation_title) {
            setConversationTitle(result.metadata.conversation_title);
          }
        }
      }

      // Fetch updated title if still "New Chat"
      if (
        !conversationTitle ||
        conversationTitle === 'New Chat' ||
        conversationTitle === 'Untitled'
      ) {
        try {
          const endpoint = getHistoryEndpoint(account.provider_id, port || 11434, account.id);
          const historyRes = await fetch(`${endpoint}?page=1&limit=30`);
          if (historyRes.ok) {
            const resultData = await historyRes.json();
            const conversations = resultData.data?.conversations || resultData;
            const historyList = parseConversationList(account.provider_id, conversations);
            const currentConvId = activeChatId;
            let targetChat = currentConvId ? historyList.find((c) => c.id === currentConvId) : null;
            if (!targetChat && historyList.length > 0) {
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

      // Requirement: lấy lịch sử chat của conversatiion qua account_id và conversation_id
      const response = await fetch(`${endpoint}?accountId=${encodeURIComponent(account.id)}`);
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
    providersList,
    streamEnabled,
    setStreamEnabled,
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
