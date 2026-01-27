import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Message,
  Account,
  PendingAttachment,
  ConversationTab,
  FunctionParams,
  HistoryItem,
} from '../types';
import { fetchProviders } from '../../../config/providers';
import {
  getHistoryEndpoint,
  getConversationDetailEndpoint,
  parseConversationList,
} from '../utils/conversation-utils';
import { getCachedModels, fetchAndCacheModels } from '../../../utils/model-cache';
import { combinePrompts } from '../prompts';
import { FuzzyMatcher } from '../../../utils/FuzzyMatcher';
import { getApiBaseUrl } from '../../../utils/apiUrl';

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

  const [selectedProvider, setSelectedProvider] = useState<string>(
    () => (activeTab?.selectedProvider as any) || '',
  );
  const [selectedAccount, setSelectedAccount] = useState<string>(
    () => activeTab?.selectedAccount || '',
  );
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [, setCurrentMessageId] = useState<number | null>(null);
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const executedTagsRef = useRef<Set<string>>(new Set());

  const [thinkingEnabled, setThinkingEnabled] = useState(() => activeTab?.thinkingEnabled ?? true);
  const [searchEnabled, setSearchEnabled] = useState(() => activeTab?.searchEnabled ?? false);
  const [agentMode, setAgentMode] = useState(() => activeTab?.agentMode ?? false);
  const [indexingEnabled, setIndexingEnabled] = useState(() => activeTab?.indexingEnabled ?? true);
  const [attachments, setAttachments] = useState<PendingAttachment[]>(
    () => activeTab?.attachments || [],
  );
  const [tokenCount, setTokenCount] = useState(() => activeTab?.tokenCount || 0);
  const [inputTokenCount, setInputTokenCount] = useState(() => activeTab?.inputTokenCount || 0);
  const [accumulatedUsage, setAccumulatedUsage] = useState(() => activeTab?.accumulatedUsage || 0);

  const [selectedWorkspacePath, setSelectedWorkspacePath] = useState<string | undefined>(
    () => activeTab?.selectedWorkspacePath,
  );
  const [temperature, setTemperature] = useState<number>(() => activeTab?.temperature ?? 0.7);
  const [language, setLanguage] = useState<string | null>(() => {
    if (activeTab?.language) return activeTab.language;
    return localStorage.getItem('elara_preferred_language');
  });

  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('elara_recent_workspaces');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [systemInfo, setSystemInfo] = useState<any>(null);

  // Fetch system info on mount
  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        const info = await window.api.app.getSystemInfo();
        setSystemInfo(info);
      } catch (error) {
        console.error('Failed to fetch system info:', error);
      }
    };
    fetchSystemInfo();
  }, []);

  // Verify recent workspaces on mount
  useEffect(() => {
    const verifyWorkspaces = async () => {
      const validWorkspaces: string[] = [];
      for (const path of recentWorkspaces) {
        const exists = await window.api.commands.checkPathExists(path);
        if (exists) {
          validWorkspaces.push(path);
        }
      }
      if (validWorkspaces.length !== recentWorkspaces.length) {
        setRecentWorkspaces(validWorkspaces);
        localStorage.setItem('elara_recent_workspaces', JSON.stringify(validWorkspaces));
      }
    };
    verifyWorkspaces();
  }, []);

  const [activeChatId, setActiveChatId] = useState<string | null>(
    () => activeTab?.activeChatId || null,
  );
  const [conversationTitle, setConversationTitle] = useState<string>(
    () => activeTab?.conversationTitle || '',
  );

  // Model selections - Mapping provider_id to selected model_id
  const [providerModels, setProviderModels] = useState<Record<string, string>>(
    () => activeTab?.providerModels || {},
  );

  // Model lists - Mapping provider_id to list of models
  const [providerModelsList, setProviderModelsList] = useState<Record<string, any[]>>(
    () => activeTab?.providerModelsList || {},
  );

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

  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Indexing status state
  const [indexingStatus, setIndexingStatus] = useState<{
    indexed: boolean;
    configured: boolean;
    loading?: boolean;
    needsSync?: boolean;
    syncStats?: { added: number; modified: number; deleted: number };
  }>({ indexed: false, configured: false });

  // Check indexing status when workspace changes
  useEffect(() => {
    const checkIndexing = async () => {
      console.log('[Indexing] Check triggered:', { selectedWorkspacePath, agentMode });

      if (!selectedWorkspacePath) {
        setIndexingStatus({ indexed: false, configured: false });
        return;
      }

      try {
        const serverStatus = await window.api.server.start();
        const port = serverStatus.port || 11434;

        const baseUrl = getApiBaseUrl(port);

        console.log('[Indexing] Fetching status for:', selectedWorkspacePath);

        const response = await fetch(
          `${baseUrl}/v1/indexing/status?workspace_path=${encodeURIComponent(selectedWorkspacePath)}`,
        );

        console.log('[Indexing] Response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('[Indexing] Response data:', data);
          if (data.success && data.data) {
            setIndexingStatus({
              indexed: data.data.indexed,
              configured: data.data.configured,
              needsSync: data.data.needsSync,
              syncStats: data.data.syncStats,
            });
          }
        } else {
          console.error('[Indexing] Response not ok:', response.status);
          setIndexingStatus({ indexed: false, configured: false });
        }
      } catch (error) {
        console.error('[Indexing] Failed to check indexing status:', error);
        setIndexingStatus({ indexed: false, configured: false });
      }
    };

    checkIndexing();
  }, [selectedWorkspacePath]);

  // Start indexing handler
  const handleStartIndexing = async () => {
    if (!selectedWorkspacePath || indexingStatus.loading) return;

    setIndexingStatus((prev) => ({ ...prev, loading: true }));

    try {
      const serverStatus = await window.api.server.start();
      const port = serverStatus.port || 11434;

      const baseUrl = getApiBaseUrl(port);
      // Use sync endpoint if already indexed but needs sync
      const endpoint =
        indexingStatus.indexed && indexingStatus.needsSync
          ? `${baseUrl}/v1/indexing/sync`
          : `${baseUrl}/v1/indexing/start`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_path: selectedWorkspacePath }),
      });

      if (response.ok) {
        // Poll for completion
        const pollInterval = setInterval(async () => {
          try {
            const baseUrl = getApiBaseUrl(port);
            const statusRes = await fetch(
              `${baseUrl}/v1/indexing/status?workspace_path=${encodeURIComponent(selectedWorkspacePath)}`,
            );
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (statusData.success && statusData.data?.indexed && !statusData.data?.needsSync) {
                clearInterval(pollInterval);
                setIndexingStatus({
                  indexed: true,
                  configured: true,
                  loading: false,
                  needsSync: false,
                });
              }
            }
          } catch {
            // Ignore polling errors
          }
        }, 3000);

        // Stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setIndexingStatus((prev) => ({ ...prev, loading: false }));
        }, 300000);
      }
    } catch (error) {
      console.error('Failed to start indexing:', error);
      setIndexingStatus((prev) => ({ ...prev, loading: false }));
    }
  };

  // Read ELARA.md content
  const readElaraContent = async (): Promise<string> => {
    if (!selectedWorkspacePath) return '';

    const elaraPath = selectedWorkspacePath + '/ELARA.md';
    try {
      const content = await window.api.commands.readFile(elaraPath);
      return content;
    } catch {
      // File doesn't exist, create empty one
      try {
        await window.api.commands.writeFile(elaraPath, '');
      } catch {
        // Ignore creation errors
      }
      return '';
    }
  };

  // Search relevant files from RAG
  const searchRelevantFiles = async (query: string): Promise<string[]> => {
    if (!selectedWorkspacePath || !indexingStatus.indexed) return [];

    try {
      const serverStatus = await window.api.server.start();
      const port = serverStatus.port || 11434;

      const baseUrl = getApiBaseUrl(port);

      const response = await fetch(`${baseUrl}/v1/indexing/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_path: selectedWorkspacePath,
          query,
          limit: 10,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.files) {
          return data.data.files.map((f: any) => f.path);
        }
      }
    } catch (error) {
      console.error('Failed to search relevant files:', error);
    }

    return [];
  };

  const parseTagArguments = (tagContent: string) => {
    const args: Record<string, string> = {};
    const tagRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let match;
    while ((match = tagRegex.exec(tagContent)) !== null) {
      args[match[1]] = match[2].trim();
    }
    return args;
  };

  const applyDiff = (content: string, diff: string): string => {
    const diffRegex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
    let newContent = content;
    let match;
    let found = false;

    while ((match = diffRegex.exec(diff)) !== null) {
      found = true;
      const search = match[1];
      const replace = match[2];

      if (newContent.includes(search)) {
        newContent = newContent.replace(search, replace);
      } else {
        // Try fuzzy match
        const fuzzyMatch = FuzzyMatcher.findMatch(newContent, search);
        if (fuzzyMatch && fuzzyMatch.score < 0.4) {
          // Similarity > 60%
          newContent = newContent.replace(fuzzyMatch.originalText, replace);
        } else {
          throw new Error(
            `Could not find search block in file for replacement. ${
              fuzzyMatch
                ? `Best fuzzy match similarity only ${((1 - fuzzyMatch.score) * 100).toFixed(1)}%.`
                : ''
            }`,
          );
        }
      }
    }

    if (!found) {
      // Fallback if the format is slightly different (e.g. no newlines after/before markers)
      const looseRegex = /<<<<<<< SEARCH([\s\S]*?)=======([\s\S]*?)>>>>>>> REPLACE/g;
      while ((match = looseRegex.exec(diff)) !== null) {
        found = true;
        const search = match[1].trim();
        const replace = match[2].trim();
        if (newContent.includes(search)) {
          newContent = newContent.replace(search, replace);
        } else {
          // Try fuzzy match even for loose format
          const fuzzyMatch = FuzzyMatcher.findMatch(newContent, search);
          if (fuzzyMatch && fuzzyMatch.score < 0.4) {
            newContent = newContent.replace(fuzzyMatch.originalText, replace);
          } else {
            throw new Error(
              `Could not find search block in file for replacement (loose match). ${
                fuzzyMatch
                  ? `Best fuzzy match similarity only ${((1 - fuzzyMatch.score) * 100).toFixed(1)}%.`
                  : ''
              }`,
            );
          }
        }
      }
    }
    return newContent;
  };

  const executeToolCall = async (tagName: string, tagContent: string): Promise<string> => {
    if (!selectedWorkspacePath) return 'Error: No workspace selected.';
    const args = parseTagArguments(tagContent);

    try {
      switch (tagName) {
        case 'read_file': {
          const path = args.path;
          if (!path) return 'Error: path is required.';
          const fullPath = selectedWorkspacePath + '/' + path;
          const content = await window.api.commands.readFile(fullPath);
          return content;
        }
        case 'write_to_file': {
          const { path, content } = args;
          if (!path || content === undefined) return 'Error: path and content are required.';
          const fullPath = selectedWorkspacePath + '/' + path;
          // Clean triple backticks if present
          const cleanContent = content.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
          await window.api.commands.writeFile(fullPath, cleanContent);
          return `Successfully wrote to ${path}`;
        }
        case 'replace_in_file': {
          const { path, diff } = args;
          if (!path || !diff) return 'Error: path and diff are required.';
          const fullPath = selectedWorkspacePath + '/' + path;
          const oldContent = await window.api.commands.readFile(fullPath);
          const newContent = applyDiff(oldContent, diff);
          await window.api.commands.writeFile(fullPath, newContent);
          return `Successfully updated ${path}`;
        }
        case 'list_files':
        case 'list_file': {
          const { path, recursive } = args;
          // Normalize: if path is '.' or empty, use workspace root
          const relPath = !path || path === '.' ? '' : path;
          const targetPath = relPath
            ? selectedWorkspacePath + '/' + relPath
            : selectedWorkspacePath;
          const files = await window.api.commands.listFiles(targetPath, recursive === 'true');
          return files.map((f: string) => f.replace(selectedWorkspacePath, '')).join('\n');
        }
        case 'search_files': {
          const { path, regex, file_pattern } = args;
          const targetPath = path ? selectedWorkspacePath + '/' + path : selectedWorkspacePath;
          const result = await window.api.commands.searchFiles({
            path: targetPath,
            regex,
            pattern: file_pattern,
          });
          return result || 'No matches found.';
        }
        case 'execute_command': {
          const { command } = args;
          if (!command) return 'Error: command is required.';
          const output = await window.api.shell.execute(command, selectedWorkspacePath);
          return output;
        }
        case 'write_to_file_elara': {
          const { content } = args;
          if (content === undefined) return 'Error: content is required.';
          const elaraPath = selectedWorkspacePath + '/ELARA.md';
          const cleanContent = content.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
          await window.api.commands.writeFile(elaraPath, cleanContent);
          return 'Successfully wrote to ELARA.md';
        }
        case 'replace_in_file_elara': {
          const { diff } = args;
          if (!diff) return 'Error: diff is required.';
          const elaraPath = selectedWorkspacePath + '/ELARA.md';
          try {
            const oldContent = await window.api.commands.readFile(elaraPath);
            const newContent = applyDiff(oldContent, diff);
            await window.api.commands.writeFile(elaraPath, newContent);
            return 'Successfully updated ELARA.md';
          } catch {
            return 'Error: ELARA.md not found. Use write_to_file_elara to create it first.';
          }
        }
        default:
          return `Error: Unknown tool ${tagName}`;
      }
    } catch (err: any) {
      return `Error executing ${tagName}: ${err.message || err}`;
    }
  };

  const processAgentTools = async (message: Message) => {
    if (isExecutingTool) return;
    const content = message.content;
    const toolRegex =
      /<(read_file|write_to_file|replace_in_file|list_files|list_file|search_files|execute_command|write_to_file_elara|replace_in_file_elara)(?:>([\s\S]*?)<\/\1>| \/>|\/>)/g;

    const results: { display: string; actual: string }[] = [];
    let match;
    let foundNew = false;

    while ((match = toolRegex.exec(content)) !== null) {
      const fullTag = match[0];
      const tagType = match[1];
      const tagInner = match[2];

      // Use message ID + tag content as unique key
      const key = `${message.id}:${fullTag}`;
      if (!executedTagsRef.current.has(key)) {
        foundNew = true;
        setIsExecutingTool(true);
        const result = await executeToolCall(tagType, tagInner);
        const args = parseTagArguments(tagInner);

        // Determine info for the header
        let info = '';
        if (
          tagType === 'read_file' ||
          tagType === 'write_to_file' ||
          tagType === 'replace_in_file'
        ) {
          info = args.path || 'file';
        } else if (tagType === 'list_files' || tagType === 'list_file') {
          info = args.path || 'directory';
        } else if (tagType === 'search_files') {
          info = args.regex || 'query';
        } else if (tagType === 'execute_command') {
          info = args.command || 'command';
        }

        const header = info ? `${tagType} for '${info}'` : tagType;
        const displayLabel = '__HIDDEN_TOOL_RESULT__';

        results.push({
          display: displayLabel,
          actual: `[${header}]\n\`\`\`\n${result}\n\`\`\``,
        });

        executedTagsRef.current.add(key);
      }
    }

    if (foundNew) {
      const displayResult = results.map((r) => r.display).join('\n\n');
      const actualResult = results.map((r) => r.actual).join('\n\n');

      setIsExecutingTool(false);
      // Auto-send result back to agent
      if (agentMode) {
        // Hide tool result messages from the UI for a cleaner experience
        handleSend(displayResult, actualResult, true);
      }
    }
  };

  useEffect(() => {
    if (!isStreaming && agentMode && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        processAgentTools(lastMessage);
      }
    }
  }, [isStreaming, agentMode, messages]);

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

  useEffect(() => {
    const providerConfig = providersList.find(
      (p) => p.provider_id.toLowerCase() === selectedProvider.toLowerCase(),
    );
    if (providerConfig?.conflict_search_with_upload && attachments.length > 0 && searchEnabled) {
      setSearchEnabled(false);
    }
  }, [attachments, searchEnabled, selectedProvider]);

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle File Uploads (Smart Upload Management)
  useEffect(() => {
    const uploadPendingFiles = async () => {
      // Check if provider supports upload from config
      const config = providersList.find((p) => p.provider_id === selectedProvider);
      if (!config?.is_upload) return;

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

      // Mark as uploading immediately to prevent double-triggering
      setAttachments((prev) =>
        prev.map((a) =>
          itemsToUpload.some((i) => i.id === a.id) ? { ...a, status: 'uploading', progress: 0 } : a,
        ),
      );

      try {
        const serverStatus = await window.api.server.start();
        const port = serverStatus.port || 11434;

        // Process uploads in parallel
        itemsToUpload.forEach(async (att) => {
          try {
            const formData = new FormData();
            formData.append('file', att.file);

            // Backend endpoint: POST /v1/chat/accounts/:accountId/uploads
            const baseUrl = getApiBaseUrl(port);
            const uploadUrl = `${baseUrl}/v1/chat/accounts/${account.id}/uploads`;

            const res = await fetch(uploadUrl, {
              method: 'POST',
              body: formData,
              // Note: No Content-Type header; fetch sets it with boundary for FormData
            });

            if (res.ok) {
              const data = await res.json();
              if (data.success && data.data?.file_id) {
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
                if (data.data.token_usage) {
                  setAccumulatedUsage((prev) => prev + data.data.token_usage);
                }
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

  const handleSelectWorkspace = async () => {
    try {
      const result = await window.api.dialog.openDirectory();
      if (!result.canceled && result.filePaths.length > 0) {
        const newPath = result.filePaths[0];
        setSelectedWorkspacePath(newPath);

        // Update recent workspaces
        setRecentWorkspaces((prev) => {
          const filtered = prev.filter((p) => p !== newPath);
          const updated = [newPath, ...filtered].slice(0, 10);
          localStorage.setItem('elara_recent_workspaces', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (error) {
      console.error('Failed to select workspace:', error);
    }
  };

  const handleQuickSelectWorkspace = (path: string) => {
    setSelectedWorkspacePath(path);
    // Move to top of history
    setRecentWorkspaces((prev) => {
      const filtered = prev.filter((p) => p !== path);
      const updated = [path, ...filtered].slice(0, 10);
      localStorage.setItem('elara_recent_workspaces', JSON.stringify(updated));
      return updated;
    });
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
    providerModels,
    providerModelsList,
    thinkingEnabled,
    searchEnabled,
    agentMode,
    indexingEnabled,
    attachments,
    tokenCount,
    accumulatedUsage,
    inputTokenCount,
    groqSettings,
    activeChatId,
    conversationTitle,
    selectedWorkspacePath,
    temperature,
    language,
  });

  useEffect(() => {
    stateRef.current = {
      messages,
      input,
      selectedProvider,
      selectedAccount,
      providerModels,
      providerModelsList,
      thinkingEnabled,
      searchEnabled,
      agentMode,
      indexingEnabled,
      attachments,
      tokenCount,
      accumulatedUsage,
      inputTokenCount,
      groqSettings,
      activeChatId,
      conversationTitle,
      selectedWorkspacePath,
      temperature,
      language,
    };
  }, [
    messages,
    input,
    selectedProvider,
    selectedAccount,
    providerModels,
    providerModelsList,
    thinkingEnabled,
    searchEnabled,
    agentMode,
    attachments,
    tokenCount,
    accumulatedUsage,
    inputTokenCount,
    groqSettings,
    activeChatId,
    conversationTitle,
    selectedWorkspacePath,
    temperature,
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
    const loadProviders = async () => {
      try {
        const serverStatus = await window.api.server.start();
        const port = serverStatus.port || 11434;
        const allProviders = await fetchProviders(port);
        setProvidersList(allProviders);
      } catch (error) {
        console.error('Failed to fetch providers:', error);
      }
    };
    loadProviders();
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
        const status = await window.api.server.start();
        const port = status.port || 11434;

        // Use lowercase provider_id from configuration
        const providerId = selectedProvider.toLowerCase();

        const baseUrl = getApiBaseUrl(port);
        const res = await fetch(
          `${baseUrl}/v1/accounts?page=1&limit=10&provider_id=${encodeURIComponent(providerId)}`,
        );
        if (res.ok) {
          const data = await res.json();
          const accountsList = data.data?.accounts || [];
          setAccounts(accountsList);
          // Auto-select first account when provider changes
          if (accountsList.length > 0) {
            setSelectedAccount(accountsList[0].id);
          } else {
            setSelectedAccount('');
          }
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

  // Fetch Models using cache - trigger on provider selection
  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedProvider) return;

      try {
        const status = await window.api.server.start();
        const port = status.port || 11434;

        // Find the correct provider ID from the list
        // selectedProvider currently holds the provider NAME (e.g. "QwQ")
        // but we need the ID (e.g. "qwq") for the API call
        const providerConfig = providersList.find(
          (p) => p.provider_name === selectedProvider || p.provider_id === selectedProvider,
        );
        const providerId = providerConfig?.provider_id || selectedProvider;

        const updateModels = (models: any[]) => {
          // maintain compatibility with UI which uses selectedProvider (name) as key
          // or we should consistently use the same key.
          // looking at index.tsx: providerModels[selectedProvider.toLowerCase()]
          // so we should probably stick to lowercased selectedProvider for the key
          // ensuring it matches what index.tsx expects.
          const providerKey = selectedProvider.toLowerCase();

          setProviderModelsList((prev) => ({
            ...prev,
            [providerKey]: models,
          }));

          if (!providerModels[providerKey] && models.length > 0) {
            setProviderModels((prev) => ({
              ...prev,
              [providerKey]: models[0].id || models[0].name || '',
            }));
          }
        };

        // Try cache first
        const cached = getCachedModels(providerId);
        if (cached && cached.length > 0) {
          updateModels(cached);
        }

        // Fetch and update
        const models = await fetchAndCacheModels(providerId, '', port);
        if (models.length > 0) {
          updateModels(models);
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
    };
    fetchModels();
  }, [selectedProvider, providersList]);

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
        const status = await window.api.server.start();
        const port = status.port || 11434;
        // Use new unified endpoint with accountId
        const endpoint = getHistoryEndpoint(selectedProvider, port, acc.id);
        const response = await fetch(`${endpoint}?page=1&limit=30`);
        if (response.ok) {
          const result = await response.json();
          // New API returns { data: { conversations: [...] } }
          const conversations = result.data?.conversations || [];
          setHistory(parseConversationList(conversations));
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
    }, 500);
    return () => clearTimeout(timer);
  }, [input, selectedProvider, providerModels]);

  const handleSend = async (
    overrideContent?: string,
    hiddenContent?: string,
    uiHidden?: boolean,
  ) => {
    const finalInput = overrideContent ?? input;
    if (!finalInput.trim()) return;

    if (!selectedProvider) {
      console.warn('[Chat] No provider selected');
      return;
    }

    const providerKey = selectedProvider.toLowerCase();
    const modelId = providerModels[providerKey];
    if (!modelId) {
      console.warn('[Chat] No model selected for provider:', selectedProvider);
      return;
    }

    setTokenCount((prev) => prev + accumulatedUsage);
    setAccumulatedUsage(0);

    const account = accounts.find((acc) => acc.id === selectedAccount);
    if (!account && selectedAccount) {
      console.warn('Selected account not found');
      return;
    }

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
      content: finalInput,
      hiddenText: hiddenContent,
      uiHidden: uiHidden,
      timestamp: new Date(),
      attachments:
        !overrideContent && messageAttachments.length > 0 ? (messageAttachments as any) : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentAttachments = overrideContent ? [] : attachments;
    if (!overrideContent) {
      setInput('');
      setAttachments([]);
    }
    setLoading(true);

    try {
      const serverStatus = await window.api.server.start();
      if (!serverStatus.success) throw new Error('Server not running');
      const port = serverStatus.port;

      const account = accounts.find((acc) => acc.id === selectedAccount);

      // Check if provider requires account
      const providerConfig = providersList.find(
        (p) => p.provider_id.toLowerCase() === selectedProvider.toLowerCase(),
      );
      const requiresAccount = providerConfig?.auth_method && providerConfig.auth_method.length > 0;

      if (!account && requiresAccount) throw new Error('Account not found');

      // Use new unified endpoint
      const baseUrl = getApiBaseUrl(port);
      const url = `${baseUrl}/v1/chat/accounts/messages`;

      const controller = new AbortController();
      setAbortController(controller);

      const uploadedFileIds: string[] = [];
      currentAttachments.forEach((att) => {
        if (att.fileId) uploadedFileIds.push(att.fileId);
      });

      // Helper to get model ID for providers without explicit state
      const getProviderModel = (providerId: string): string => {
        const id = providerModels[providerId.toLowerCase()];
        if (id) return id;
        const cached = getCachedModels(providerId);
        return cached && cached.length > 0 ? cached[0].id : '';
      };

      // Build first message content with codebase context if enabled
      let firstMessageContent = hiddenContent ?? finalInput;
      if (messages.length === 0 && !overrideContent) {
        let contextSection = '';
        let agentPrompt = '';

        if (indexingEnabled) {
          // Read ELARA.md content
          const elaraContent = await readElaraContent();

          // Search for relevant files
          const relevantFiles = await searchRelevantFiles(finalInput);

          if (elaraContent.trim()) {
            contextSection += `\n\n## ELARA.md (Project Context)\n\`\`\`\n${elaraContent}\n\`\`\``;
          }

          if (relevantFiles.length > 0) {
            contextSection += `\n\n## Relevant Files (from codebase index)\n${relevantFiles.map((f) => `- ${f}`).join('\n')}`;
          }
        }

        if (agentMode) {
          // Get language name for prompt
          let langName = 'English';
          if (language) {
            try {
              const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
              langName = displayNames.of(language) || 'English';
            } catch (e) {
              // Fallback
            }
          }

          agentPrompt = combinePrompts({
            language: langName,
            systemInfo: {
              os: systemInfo?.os || 'Linux',
              ide: 'Elara IDE',
              shell: systemInfo?.shell || '/bin/bash',
              homeDir: systemInfo?.homeDir || '/home/user',
              cwd: selectedWorkspacePath || systemInfo?.cwd || process.env.CWD || '',
              language: langName,
            },
          });
        }

        if (agentPrompt || contextSection) {
          firstMessageContent = `${agentPrompt}${contextSection}\n\n## User Request\n${finalInput}`;
        }
      }

      // Add language constraint if selected
      if (language) {
        let langName = language;
        try {
          const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
          langName = displayNames.of(language) || language;
        } catch (e) {
          // Fallback to code if DisplayNames fails
        }
        const langPrompt = `\n\nIMPORTANT: Please respond to the user using ${langName} language.`;
        if (messages.length === 0) {
          firstMessageContent += langPrompt;
        }
      }

      const response = await fetch(url, {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: getProviderModel(account?.provider_id || selectedProvider),
          providerId: account?.provider_id || selectedProvider,
          accountId: account?.id || null,
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.hiddenText ?? m.content })),
            {
              role: 'user',
              content: firstMessageContent,
            },
          ],
          conversationId: activeChatId && activeChatId !== 'new-session' ? activeChatId : '',
          stream: streamEnabled,
          search: searchEnabled,
          ref_file_ids: uploadedFileIds,
          thinking: (() => {
            return thinkingEnabled;
          })(),
          temperature,
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

        let readerDone = false;
        while (!readerDone) {
          const result = await reader.read();
          readerDone = result.done;
          const value = result.value;
          if (readerDone) break;
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

                // Handle thinking chunk: { thinking: "..." }
                if (parsed.thinking) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId
                        ? {
                            ...m,
                            thinking: (m.thinking || '') + parsed.thinking,
                          }
                        : m,
                    ),
                  );
                }

                // Handle metadata: { meta: { conversation_id, conversation_title, thinking_elapsed } }
                if (parsed.meta) {
                  if (parsed.meta.conversation_id) {
                    setActiveChatId(parsed.meta.conversation_id);
                  }
                  if (parsed.meta.conversation_title) {
                    setConversationTitle(parsed.meta.conversation_title);
                  }
                  if (parsed.meta.total_token !== undefined) {
                    setTokenCount(parsed.meta.total_token);
                  }
                  if (parsed.meta.accountId && !selectedAccount) {
                    setSelectedAccount(parsed.meta.accountId);
                  }
                  if (parsed.meta.thinking_elapsed !== undefined) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, thinking_elapsed: parsed.meta.thinking_elapsed }
                          : m,
                      ),
                    );
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
          if (result.metadata.total_token !== undefined) {
            setTokenCount(result.metadata.total_token);
          }
          if (result.metadata.accountId && !selectedAccount) {
            setSelectedAccount(result.metadata.accountId);
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
          const providerId = account?.provider_id || selectedProvider;
          const accountId = account?.id || 'public'; // Fallback for no-auth providers

          const endpoint = getHistoryEndpoint(providerId, port || 11434, accountId);
          const historyRes = await fetch(`${endpoint}?page=1&limit=30`);
          if (historyRes.ok) {
            const resultData = await historyRes.json();
            const conversations = resultData.data?.conversations || resultData;
            const historyList = parseConversationList(conversations);
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
    executedTagsRef.current.clear();
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const account = accounts.find((a) => a.id === selectedAccount);
      if (!account) return;
      const status = await window.api.server.start();
      const port = status.port || 11434;

      const endpoint = getConversationDetailEndpoint(port, account.id, conversationId);

      const response = await fetch(endpoint);
      if (response.ok) {
        const json = await response.json();
        if (!json.success || !json.data) {
          throw new Error(json.message || 'Failed to load conversation details');
        }

        const data = json.data;
        const title = data.conversation_title || 'Untitled';
        const messagesData = data.messages || [];

        setConversationTitle(title);
        if (data.total_token !== undefined) {
          setTokenCount(data.total_token);
        }
        if (data.temperature !== undefined) {
          setTemperature(data.temperature);
        }

        const formattedMessages: Message[] = messagesData.map((m: any) => {
          let timestamp = m.created_at || m.timestamp || Date.now();
          if (typeof timestamp === 'number' && timestamp < 10000000000) {
            timestamp *= 1000;
          }

          return {
            id:
              m.uuid ||
              m.message_id ||
              m.id ||
              window.crypto?.randomUUID?.() ||
              Math.random().toString(36).substring(2),
            role: m.role?.toLowerCase() === 'assistant' ? 'assistant' : 'user',
            content: m.content || m.text || '',
            timestamp: new Date(timestamp),
          };
        });

        setMessages(formattedMessages);
        setActiveChatId(conversationId);

        // Auto-detect Agent Mode
        const agentToolTags = [
          'read_file',
          'replace_in_file',
          'write_to_file',
          'list_file',
          'list_files',
          'execute_command',
          'search_files',
        ];
        const hasAgentTools = formattedMessages.some((m) =>
          agentToolTags.some((tag) => m.content.includes(`<${tag}`)),
        );
        setAgentMode(hasAgentTools);
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
    agentMode,
    setAgentMode,
    indexingEnabled,
    setIndexingEnabled,
    selectedWorkspacePath,
    handleSelectWorkspace,
    attachments,
    handleFileSelect,
    handleRemoveAttachment,
    tokenCount,
    accumulatedUsage,
    inputTokenCount,
    activeChatId,
    conversationTitle,
    providerModels,
    setProviderModels,
    providerModelsList,
    setProviderModelsList,
    providersList,
    streamEnabled,
    setStreamEnabled,
    groqSettings,
    setGroqSettings,
    history,
    recentWorkspaces,
    handleQuickSelectWorkspace,
    handleSend,
    handleStop,
    handleInput,
    handleKeyDown,
    startNewChat,
    loadConversation,
    temperature,
    setTemperature,
    language,
    setLanguage: (lang: string | null) => {
      setLanguage(lang);
      if (lang) {
        localStorage.setItem('elara_preferred_language', lang);
      } else {
        localStorage.removeItem('elara_preferred_language');
      }
    },
    indexingStatus,
    handleStartIndexing,
  };
};
