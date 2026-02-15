import { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Account, PendingAttachment, ConversationTab, FunctionParams } from '../types';
import { fetchProviders } from '../../../config/providers';

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
  // Load state from localStorage on mount

  const [messages, setMessages] = useState<Message[]>(() => activeTab?.messages || []);
  const [input, setInput] = useState(() => activeTab?.input || '');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [providersList, setProvidersList] = useState<any[]>([]);
  const [streamEnabled, setStreamEnabled] = useState(() => activeTab?.groqSettings?.stream ?? true);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [temperature, setTemperature] = useState<number>(
    () => activeTab?.temperature ?? activeTab?.groqSettings?.temperature ?? 0.7,
  );

  // Agent Mode State
  const [agentMode, setAgentMode] = useState(() => activeTab?.agentMode ?? false);
  const [selectedWorkspacePath, setSelectedWorkspacePath] = useState<string | undefined>(
    () => activeTab?.selectedWorkspacePath,
  );

  const [availableWorkspaces, setAvailableWorkspaces] = useState<any[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | undefined>();

  const [taskProgress, setTaskProgress] = useState<{
    current: {
      taskName: string;
      tasks: { text: string; status: 'todo' | 'done' }[];
      files: string[];
    } | null;
    history: {
      taskName: string;
      tasks: { text: string; status: 'todo' | 'done' }[];
      files: string[];
    }[];
  }>(() => activeTab?.taskProgress || { current: null, history: [] });

  const [activePreviewFile, setActivePreviewFile] = useState<string | null>(
    () => activeTab?.activePreviewFile ?? null,
  );
  const [previewFiles, setPreviewFiles] = useState<Record<string, any>>(
    () => activeTab?.previewFiles || {},
  );

  // Quick Model Switcher State
  const [selectedQuickModel, setSelectedQuickModel] = useState<{
    providerId: string;
    modelId: string;
    accountId?: string;
  } | null>(null);

  // Mention Dropdown State
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionOptions, setMentionOptions] = useState<any[]>([]);
  const [mentionMode, setMentionMode] = useState<'initial' | 'file' | 'folder' | 'mcp' | 'skill'>(
    'initial',
  );
  const [selectedMentions, setSelectedMentions] = useState<any[]>([]);

  // Note: Persist functionality is now handled by the parent PlaygroundWithTabs
  // via the tabs array and onUpdateTab callback. We remove the individual
  // localStorage effects here to prevent multi-tab state overwrites.

  // Extract Task Progress from messages
  useEffect(() => {
    const assistantMessages = messages.filter(
      (m) => m.role === 'assistant' && m.content.includes('<task_progress>'),
    );

    if (assistantMessages.length === 0) {
      if (taskProgress.current !== null || taskProgress.history.length > 0) {
        setTaskProgress({ current: null, history: [] });
      }
      return;
    }

    const allSessions: {
      taskName: string;
      tasks: { text: string; status: 'todo' | 'done' }[];
      files: string[];
    }[] = [];

    assistantMessages.forEach((msg) => {
      const content = msg.content;
      const progressBlocks = content.match(/<task_progress>([\s\S]*?)<\/task_progress>/g);

      if (progressBlocks) {
        progressBlocks.forEach((block) => {
          const nameMatch = block.match(/<task_name>([\s\S]*?)<\/task_name>/);
          const taskName = nameMatch ? nameMatch[1].trim() : 'Untitled Task';

          const taskRegex = /<(task|task_done)>([\s\S]*?)<\/\1>/g;
          const tasks: { text: string; status: 'todo' | 'done' }[] = [];
          let m;
          while ((m = taskRegex.exec(block)) !== null) {
            tasks.push({
              text: m[2].trim(),
              status: m[1] === 'task_done' ? 'done' : 'todo',
            });
          }

          const files: string[] = [];
          const fileRegex = /<task_file>([\s\S]*?)<\/task_file>/g;
          let fMatch;
          while ((fMatch = fileRegex.exec(block)) !== null) {
            files.push(fMatch[1].trim());
          }

          if (tasks.length > 0 || files.length > 0) {
            const existingIdx = allSessions.findIndex((s) => s.taskName === taskName);
            if (existingIdx !== -1) {
              allSessions[existingIdx] = { taskName, tasks, files };
            } else {
              allSessions.push({ taskName, tasks, files });
            }
          }
        });
      }
    });

    const current = allSessions.length > 0 ? allSessions[allSessions.length - 1] : null;

    if (JSON.stringify({ current, history: allSessions }) !== JSON.stringify(taskProgress)) {
      setTaskProgress({
        current,
        history: allSessions,
      });
    }
  }, [messages, taskProgress]);

  const [selectedProvider, setSelectedProvider] = useState<string>(
    () => (activeTab?.selectedProvider as any) || localStorage.getItem('elara_last_provider') || '',
  );
  const [selectedAccount, setSelectedAccount] = useState<string>(
    () => activeTab?.selectedAccount || localStorage.getItem('elara_last_account') || '',
  );
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [, setCurrentMessageId] = useState<number | null>(null);
  const [isExecutingTool, setIsExecutingTool] = useState(false);
  const executedTagsRef = useRef<Set<string>>(new Set());

  const [thinkingEnabled, setThinkingEnabled] = useState(() => activeTab?.thinkingEnabled ?? true);
  const [searchEnabled, setSearchEnabled] = useState(() => activeTab?.searchEnabled ?? false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>(
    () => activeTab?.attachments || [],
  );
  const [tokenCount, setTokenCount] = useState(() => activeTab?.tokenCount || 0);
  const [inputTokenCount, setInputTokenCount] = useState(() => activeTab?.inputTokenCount || 0);
  const [accumulatedUsage, setAccumulatedUsage] = useState(() => activeTab?.accumulatedUsage || 0);

  // Note: agentMode, selectedWorkspacePath, taskProgress, availableWorkspaces, currentWorkspaceId
  // are already defined at the top of the hook with persistence logic.
  // We need to remove the duplicate declarations here.

  // Checking for other duplicates... contextFiles is fine.
  const [contextFiles, setContextFiles] = useState<{ workspace: string; rules: string }>({
    workspace: '',
    rules: '',
  });
  const [language, setLanguage] = useState<string | null>(() => {
    return localStorage.getItem('elara_preferred_language');
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setLanguage(localStorage.getItem('elara_preferred_language'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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

  // Fetch available workspaces from persistent storage
  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        // @ts-ignore
        const data = await window.api.workspaces.list();
        setAvailableWorkspaces(data || []);
      } catch (error) {
        console.error('Failed to fetch persistent workspaces:', error);
      }
    };
    fetchWorkspaces();
  }, []);

  // Fetch context files when workspace ID changes
  useEffect(() => {
    const fetchContext = async () => {
      if (!currentWorkspaceId) {
        setContextFiles({ workspace: '', rules: '' });
        return;
      }
      setIsLoadingContext(true);
      try {
        // @ts-ignore
        const data = await window.api.workspaces.getContext(currentWorkspaceId);
        setContextFiles(data);
      } catch (error) {
        console.error('Failed to fetch workspace context files:', error);
      } finally {
        setIsLoadingContext(false);
      }
    };
    fetchContext();
  }, [currentWorkspaceId]);

  const [activeChatId, setActiveChatId] = useState<string | null>(
    () => activeTab?.activeChatId || null,
  );
  const [conversationTitle, setConversationTitle] = useState<string>(
    () => activeTab?.conversationTitle || '',
  );

  // Model selections - Mapping provider_id to selected model_id
  const [providerModels, setProviderModels] = useState<Record<string, string>>(() => {
    if (activeTab?.providerModels) return activeTab.providerModels;
    try {
      const saved = localStorage.getItem('elara_last_provider_models');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  // Save configuration to localStorage
  useEffect(() => {
    if (selectedProvider) localStorage.setItem('elara_last_provider', selectedProvider);
    if (selectedAccount) localStorage.setItem('elara_last_account', selectedAccount);
    if (selectedWorkspacePath)
      localStorage.setItem('elara_last_workspace_path', selectedWorkspacePath);
    if (providerModels && Object.keys(providerModels).length > 0) {
      localStorage.setItem('elara_last_provider_models', JSON.stringify(providerModels));
    }
  }, [selectedProvider, selectedAccount, selectedWorkspacePath, providerModels]);

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

  const parseTagArguments = (tagContent: string) => {
    const args: Record<string, string> = {};
    const tagRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let match;
    while ((match = tagRegex.exec(tagContent)) !== null) {
      args[match[1]] = match[2].trim();
    }
    return args;
  };

  const estimateTokens = (text: string): number => {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
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
        case 'read_workspace_context': {
          // @ts-ignore
          const contextData = await window.api.workspaces.getContext(currentWorkspaceId);
          return contextData.workspace || '';
        }
        case 'update_workspace_context': {
          const { content } = args;
          if (content === undefined) return 'Error: content is required.';
          const cleanContent = content.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
          // @ts-ignore
          await window.api.workspaces.updateContext(currentWorkspaceId, 'workspace', cleanContent);
          return 'Successfully updated workspace.md';
        }
        case 'read_workspace_rules_context': {
          // @ts-ignore
          const contextData = await window.api.workspaces.getContext(currentWorkspaceId);
          return contextData.rules || '';
        }
        case 'update_workspace_rules_context': {
          const { content } = args;
          if (content === undefined) return 'Error: content is required.';
          const cleanContent = content.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
          // @ts-ignore
          await window.api.workspaces.updateContext(currentWorkspaceId, 'rules', cleanContent);
          return 'Successfully updated workspace_rules.md';
        }
        case 'read_current_conversation_summary_context': {
          if (!activeChatId) return 'Error: No active conversation.';
          // @ts-ignore
          const summary = await window.api.workspaces.getSummary(currentWorkspaceId, activeChatId);
          return summary || '';
        }
        case 'update_current_conversation_summary_context': {
          const { content } = args;
          if (!activeChatId) return 'Error: No active conversation.';
          if (content === undefined) return 'Error: content is required.';
          const cleanContent = content.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
          // @ts-ignore
          await window.api.workspaces.updateSummary(currentWorkspaceId, activeChatId, cleanContent);
          return 'Successfully updated conversation summary';
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
      /<(read_file|write_to_file|replace_in_file|list_files|list_file|search_files|execute_command|write_to_file_elara|replace_in_file_elara|read_workspace_context|update_workspace_context|read_workspace_rules_context|update_workspace_rules_context|read_current_conversation_summary_context|update_current_conversation_summary_context)(?:>([\s\S]*?)<\/\1>| \/>|\/>)/g;

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
        } else if (tagType.includes('workspace_context')) {
          info = 'workspace.md';
        } else if (tagType.includes('workspace_rules')) {
          info = 'workspace_rules.md';
        } else if (tagType.includes('conversation_summary')) {
          info = 'summary.md';
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
        const port = serverStatus.port || Number(import.meta.env.VITE_BACKEND_PORT) || 8888;

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

  const handleDeleteWorkspace = async (id: string) => {
    try {
      // @ts-ignore
      await window.api.workspaces.unlink(id);
      // Refresh list
      // @ts-ignore
      const updatedList = await window.api.workspaces.list();
      setAvailableWorkspaces(updatedList);

      const deletedWs = availableWorkspaces.find((w) => w.id === id);
      if (deletedWs && selectedWorkspacePath === deletedWs.path) {
        setSelectedWorkspacePath(undefined);
        setCurrentWorkspaceId(undefined);
      }
    } catch (error) {
      console.error('Failed to delete workspace:', error);
    }
  };

  const handleSelectWorkspace = async () => {
    try {
      // @ts-ignore
      const result = await window.api.dialog.openDirectory();
      if (result.canceled || result.filePaths.length === 0) return;

      const folderPath = result.filePaths[0];
      // @ts-ignore
      const workspace = await window.api.workspaces.link(folderPath);

      setSelectedWorkspacePath(workspace.path);
      setCurrentWorkspaceId(workspace.id);

      // Refresh list
      // @ts-ignore
      const updatedList = await window.api.workspaces.list();
      setAvailableWorkspaces(updatedList);
    } catch (error) {
      console.error('Failed to select workspace:', error);
    }
  };

  const handleQuickSelectWorkspace = (path: string) => {
    const workspace = availableWorkspaces.find((w) => w.path === path);
    if (workspace) {
      setSelectedWorkspacePath(workspace.path);
      setCurrentWorkspaceId(workspace.id);
    }
  };

  const handleUpdateContextFile = async (type: 'workspace' | 'rules', content: string) => {
    if (!currentWorkspaceId) return;
    setContextFiles((prev) => ({ ...prev, [type]: content }));
    try {
      // @ts-ignore
      await window.api.workspaces.updateContext(currentWorkspaceId, type, content);
    } catch (error) {
      console.error('Failed to update context file:', error);
    }
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
    taskProgress,
    activePreviewFile,
    previewFiles,
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
      taskProgress,
      activePreviewFile,
      previewFiles,
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
    taskProgress,
    activePreviewFile,
    previewFiles,
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

  // Sync preview state immediately
  useEffect(() => {
    if (onUpdateTab && activeTabId) {
      onUpdateTab(activeTabId, { activePreviewFile, previewFiles });
    }
  }, [activePreviewFile, previewFiles, activeTabId, onUpdateTab]);

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
        const port = serverStatus.port || Number(import.meta.env.VITE_BACKEND_PORT) || 8888;
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
        const port = status.port || Number(import.meta.env.VITE_BACKEND_PORT) || 8888;

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
        const port = status.port || Number(import.meta.env.VITE_BACKEND_PORT) || 8888;

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

  useEffect(() => {
    if (!isMentionOpen || !selectedWorkspacePath) {
      setMentionOptions([]);
      setMentionMode('initial');
      return;
    }

    const fetchMentionResults = async () => {
      try {
        const results: any[] = [];
        const normalizedSearch = mentionSearch.toLowerCase();

        if (mentionMode === 'initial' && !mentionSearch) {
          setMentionOptions([]);
          return;
        }

        // 1. Search Files & Folders
        if (
          (mentionMode === 'file' || mentionMode === 'folder' || mentionMode === 'initial') &&
          selectedWorkspacePath
        ) {
          try {
            // Use the same tree as FileTreeView for consistency and performance
            // @ts-ignore
            const tree = await window.api.workspaces.getTree(selectedWorkspacePath);

            const flattenAndFilter = (entries: any[]) => {
              entries.forEach((entry) => {
                const isMatch =
                  !mentionSearch || entry.name.toLowerCase().includes(mentionSearch.toLowerCase());

                if (isMatch) {
                  if (mentionMode === 'file' && !entry.isDirectory) {
                    results.push({
                      id: `ws-${entry.path}`,
                      label: entry.path,
                      type: 'File',
                    });
                  } else if (mentionMode === 'folder' && entry.isDirectory) {
                    results.push({
                      id: `ws-${entry.path}`,
                      label: entry.path,
                      type: 'Folder',
                    });
                  } else if (mentionMode === 'initial') {
                    results.push({
                      id: `ws-${entry.path}`,
                      label: entry.path,
                      type: entry.isDirectory ? 'Folder' : 'File',
                    });
                  }
                }

                if (entry.children && entry.children.length > 0) {
                  flattenAndFilter(entry.children);
                }
              });
            };

            flattenAndFilter(tree);
          } catch (err) {
            console.error('Failed to fetch workspace tree for mentions:', err);
          }
        }

        // 2. Search MCP
        if (mentionMode === 'mcp' || mentionMode === 'initial') {
          const mcpList = ['GitHub', 'Slack', 'Linear', 'Database'];
          mcpList.forEach((mcp) => {
            if (!normalizedSearch || mcp.toLowerCase().includes(normalizedSearch)) {
              results.push({ id: `mcp-${mcp}`, label: mcp, type: 'MCP' });
            }
          });
        }

        // 3. Search Skills
        if (mentionMode === 'skill' || mentionMode === 'initial') {
          const skillList = ['CodeInterpreter', 'WebSearch', 'ImageGen'];
          skillList.forEach((skill) => {
            if (!normalizedSearch || skill.toLowerCase().includes(normalizedSearch)) {
              results.push({ id: `skill-${skill}`, label: skill, type: 'Skill' });
            }
          });
        }

        // Sort by relevance (shortest name first for now)
        results.sort((a, b) => a.label.length - b.label.length);

        setMentionOptions(results.slice(0, 30));
      } catch (err) {
        console.error('Mention search error:', err);
      }
    };

    const timer = setTimeout(fetchMentionResults, mentionSearch ? 200 : 0);
    return () => clearTimeout(timer);
  }, [mentionSearch, isMentionOpen, selectedWorkspacePath, mentionMode]);

  const handleSend = async (
    overrideContent?: string,
    hiddenContent?: string,
    uiHidden?: boolean,
  ) => {
    const finalInput = overrideContent ?? input;
    if (!finalInput.trim() && selectedMentions.length === 0) return;

    // Append mentions to the input content
    const mentionContext =
      selectedMentions.length > 0
        ? `\n\nMentions context:\n${selectedMentions.map((m) => `- ${m.path}`).join('\n')}`
        : '';
    const finalInputWithMentions = finalInput + mentionContext;

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
      content: finalInputWithMentions,
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
      setSelectedMentions([]);
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
        if (
          selectedQuickModel &&
          selectedQuickModel.providerId.toLowerCase() === providerId.toLowerCase()
        ) {
          return selectedQuickModel.modelId;
        }
        const id = providerModels[providerId.toLowerCase()];
        if (id) return id;
        const cached = getCachedModels(providerId);
        return cached && cached.length > 0 ? cached[0].id : '';
      };

      // Build first message content with codebase context if enabled
      let firstMessageContent = hiddenContent ?? finalInputWithMentions;
      const forceContextInjection = !!selectedQuickModel;

      if ((messages.length === 0 && !overrideContent) || forceContextInjection) {
        let contextSection = '';
        let agentPrompt = '';

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

          // Fetch Project Context and Tree View if workspace is selected
          if (selectedWorkspacePath) {
            try {
              // 1. Get Workspace ID
              let wsId = currentWorkspaceId;
              if (!wsId) {
                // @ts-ignore
                const workspace = await window.api.workspaces.link(selectedWorkspacePath);
                wsId = workspace.id;
                setCurrentWorkspaceId(wsId);
              }

              if (wsId) {
                // 2. Fetch context files via IPC
                // @ts-ignore
                const contextData = await window.api.workspaces.getContext(wsId);
                const { workspace, rules } = contextData;

                contextSection += `\n\n## Project Overview (workspace.md)\n\`\`\`\n${workspace || ''}\n\`\`\``;
                contextSection += `\n\n## Project Rules (workspace_rules.md)\n\`\`\`\n${rules || ''}\n\`\`\``;

                // 3. Fetch Project Structure (Tree View) via IPC
                // @ts-ignore
                const treeView = await window.api.workspaces.scan(selectedWorkspacePath);
                contextSection += `\n\n## Project Structure\n\`\`\`\n${treeView || 'NULL'}\n\`\`\``;

                // 4. Create Session File & Summary
                if (activeChatId && activeChatId !== 'new-session') {
                  try {
                    // @ts-ignore
                    await window.api.workspaces.createSession(wsId, activeChatId, {
                      timestamp: Date.now(),
                      modelId: getProviderModel(account?.provider_id || selectedProvider),
                      systemInfo: {
                        os: systemInfo?.os || 'Linux',
                        cwd: selectedWorkspacePath,
                      },
                    });

                    // 5. Inject Summary Context
                    // @ts-ignore
                    const summary = await window.api.workspaces.getSummary?.(wsId, activeChatId);
                    if (summary) {
                      contextSection += `\n\n## Conversation Summary (summary.md)\n\`\`\`\n${summary}\n\`\`\``;
                    }
                  } catch (err) {
                    console.error('Failed to create/get session info:', err);
                  }
                }

                // 6. Inject Task Progress (History + Current) in Markdown format
                const formatTP = (tp: any) => {
                  if (!tp) return '';
                  let md = `### ${tp.taskName}\n`;
                  tp.tasks.forEach((t: any) => {
                    md += `- [${t.status === 'done' ? 'x' : ' '}] ${t.text}\n`;
                  });
                  return md;
                };

                const historyMd = taskProgress.history.map(formatTP).join('\n');
                const currentMd = formatTP(taskProgress.current);
                const allTasksMd = [historyMd, currentMd].filter(Boolean).join('\n');

                const hasTodoTasks = taskProgress.current?.tasks.some((t) => t.status === 'todo');
                if (allTasksMd && (hasTodoTasks || !!selectedQuickModel)) {
                  contextSection += `\n\n## TASK\n${allTasksMd}`;
                }
              }
            } catch (e) {
              console.error('Failed to inject persistent context:', e);
            }
          }
        }

        if (agentPrompt || contextSection) {
          const fullContent = `${agentPrompt}${contextSection}\n\n## User Request\n${finalInput}`;
          firstMessageContent = fullContent;

          // Critical Fix: Persist context in message state specifically for the first message
          // so it is included in subsequent requests' history.
          setMessages((prev) =>
            prev.map((m) => (m.id === userMessage.id ? { ...m, hiddenText: fullContent } : m)),
          );
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

      // Estimate input tokens
      const currentInputTokens =
        inputTokenCount > 0
          ? inputTokenCount
          : estimateTokens(JSON.stringify(messages) + firstMessageContent);

      console.log(
        '[TokenDebug] currentInputTokens:',
        currentInputTokens,
        'inputTokenCount:',
        inputTokenCount,
      );

      const targetProviderId =
        selectedQuickModel?.providerId || account?.provider_id || selectedProvider;
      const targetAccountId = selectedQuickModel
        ? selectedQuickModel.accountId || null
        : account?.id || null;
      const targetModelId = getProviderModel(targetProviderId);

      const response = await fetch(url, {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: targetModelId,
          providerId: targetProviderId,
          accountId: targetAccountId,
          messages: [
            ...(selectedQuickModel
              ? []
              : messages.map((m) => ({ role: m.role, content: m.hiddenText ?? m.content }))),
            {
              role: 'user',
              content: firstMessageContent,
            },
          ],
          conversationId: selectedQuickModel
            ? ''
            : activeChatId && activeChatId !== 'new-session'
              ? activeChatId
              : '',
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

      let accumulatedContent = '';
      let accumulatedMetadata: any = {};

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
                  accumulatedContent += parsed.content;
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
                  accumulatedMetadata = { ...accumulatedMetadata, ...parsed.meta };
                  if (parsed.meta.conversation_id) {
                    setActiveChatId(parsed.meta.conversation_id);
                  }
                  if (parsed.meta.conversation_title) {
                    setConversationTitle(parsed.meta.conversation_title);
                  }
                  if (parsed.meta.total_token !== undefined) {
                    // Logic fix: Ensure total_token doesn't drop below input tokens
                    // Some providers might return only output usage in stream
                    const reportedTotal = parsed.meta.total_token;
                    const currentOutput = estimateTokens(accumulatedContent);
                    console.log('[TokenDebug] Stream meta:', {
                      reportedTotal,
                      currentOutput,
                      currentInputTokens,
                    });
                    setTokenCount(Math.max(reportedTotal, currentInputTokens + currentOutput));
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
          accumulatedContent = result.message.content;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId ? { ...m, content: result.message.content } : m,
            ),
          );
        }
        if (result.metadata) {
          accumulatedMetadata = result.metadata;
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

      // Calculate and report metrics
      const finalInputTokens = currentInputTokens;
      const finalOutputTokens = estimateTokens(accumulatedContent);
      // Prefer provider metadata if available and reasonable
      const providerTotal = accumulatedMetadata?.total_token || 0;
      const totalTokens = Math.max(providerTotal, finalInputTokens + finalOutputTokens);

      console.log('[TokenDebug] Final Metrics:', {
        finalInputTokens,
        finalOutputTokens,
        providerTotal,
        totalTokens,
        accumulatedMetadata,
      });

      // Report to backend
      if (account) {
        try {
          const metricsUrl = `${baseUrl}/v1/stats/metrics`;
          fetch(metricsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              account_id: account.id,
              provider_id: account.provider_id,
              model_id: getProviderModel(account.provider_id),
              conversation_id: activeChatId, // Session ID is updated during stream
              total_tokens: totalTokens,
              timestamp: Date.now(),
            }),
          }).catch((err) => console.error('Failed to report metrics', err));
        } catch (e) {
          console.error('Error reporting metrics', e);
        }
      }

      // Update Agent Session (ProjectContext)
      if (agentMode && selectedWorkspacePath && currentWorkspaceId) {
        // We need to save the session to preserve history
        // If activeChatId is null/new-session, we need a new ID.
        // But wait, the backend response might have given us a conversation_id if we sent one or if it generated one?
        // Actually, for Agent Mode, we want to control the session ID or use the one from metadata.

        const sessionId =
          activeChatId === 'new-session' || !activeChatId
            ? accumulatedMetadata?.conversation_id || crypto.randomUUID()
            : activeChatId;

        if (sessionId !== activeChatId) {
          setActiveChatId(sessionId);
        }

        // Construct session data
        const sessionData = {
          messages: [
            ...messages,
            userMessage,
            { ...assistantMessage, content: accumulatedContent }, // Use accumulated content
          ],
          model: targetModelId,
          provider: targetProviderId,
          tokenUsage: totalTokens,
          taskName: accumulatedMetadata?.conversation_title || conversationTitle || 'Untitled Task',
          taskProgress: taskProgress, // Save current task progress
          timestamp: Date.now(),
        };

        try {
          // @ts-ignore
          await window.api.workspaces.createSession(currentWorkspaceId, sessionId, sessionData);
        } catch (err) {
          console.error('Failed to save agent session:', err);
        }
      }

      // Fetch updated title if still "New Chat" (REMOVED HISTORY FETCH)
      if (
        !conversationTitle ||
        conversationTitle === 'New Chat' ||
        conversationTitle === 'Untitled'
      ) {
        // Logic to update title from history removed
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted'))
      ) {
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
    } finally {
      setLoading(false);
      setIsStreaming(false);
      if (selectedQuickModel) {
        setSelectedQuickModel(null);
      }
    }
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
    setConversationTitle('');
    executedTagsRef.current.clear();
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    target.style.height = 'auto';
    const maxHeight = 240;
    const newHeight = Math.min(target.scrollHeight, maxHeight);
    target.style.height = `${newHeight}px`;
    const newValue = target.value;
    setInput(newValue);

    // Mention detection logic
    if (agentMode) {
      const cursorPosition = target.selectionStart;
      const textUntilCursor = newValue.slice(0, cursorPosition);
      const mentionMatch = textUntilCursor.match(/(^|\s)@(\w*)$/);

      if (mentionMatch) {
        setIsMentionOpen(true);
        setMentionSearch(mentionMatch[2]);
        setMentionIndex(0);
      } else {
        setIsMentionOpen(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isMentionOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const total = mentionSearch || mentionMode !== 'initial' ? mentionOptions.length : 4;
        setMentionIndex((prev) => (prev + 1) % Math.max(1, total));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const total = mentionSearch || mentionMode !== 'initial' ? mentionOptions.length : 4;
        setMentionIndex((prev) => (prev - 1 + total) % Math.max(1, total));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const options =
          mentionSearch || mentionMode !== 'initial'
            ? mentionOptions
            : [
                { id: 'file', label: 'File', type: 'File' },
                { id: 'folder', label: 'Folder', type: 'Folder' },
                { id: 'mcp', label: 'MCP', type: 'MCP' },
                { id: 'skill', label: 'Skill', type: 'Skill' },
              ];
        if (options[mentionIndex]) {
          handleSelectMention(options[mentionIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        setIsMentionOpen(false);
        setMentionMode('initial');
        return;
      }
      if (e.key === 'Backspace' && !mentionSearch && mentionMode !== 'initial') {
        setMentionMode('initial');
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectMention = (option: any) => {
    // If selecting a category in initial mode, transition to search mode for that category
    if (mentionMode === 'initial' && !mentionSearch) {
      if (option.id === 'file') {
        setMentionMode('file');
        setMentionIndex(0);
        return;
      }
      if (option.id === 'folder') {
        setMentionMode('folder');
        setMentionIndex(0);
        return;
      }
      if (option.id === 'mcp') {
        setMentionMode('mcp');
        setMentionIndex(0);
        return;
      }
      if (option.id === 'skill') {
        setMentionMode('skill');
        setMentionIndex(0);
        return;
      }
    }

    const targetInput = document.querySelector('textarea');
    if (!targetInput) return;

    const cursorPosition = targetInput.selectionStart;
    const textUntilCursor = input.slice(0, cursorPosition);
    const textAfterCursor = input.slice(cursorPosition);

    const mentionRegex = /@\w*$/;

    if (option.type === 'File' || option.type === 'Folder') {
      // Add to selected mentions instead of inserting text
      const newMention = {
        id: option.id || `${option.type}-${option.label}-${Date.now()}`,
        label: option.label,
        type: option.type,
        path: option.path || option.label,
      };

      // Avoid duplicates
      setSelectedMentions((prev) => {
        if (prev.some((m) => m.path === newMention.path)) return prev;
        return [...prev, newMention];
      });

      // Remove the @mention text from input
      const newInput = textUntilCursor.replace(mentionRegex, '') + textAfterCursor;
      setInput(newInput);
    } else {
      // For MCP/Skill, keep the text behavior for now or handle them as badges too if needed
      const label = option.label;
      const newInput = textUntilCursor.replace(mentionRegex, `${label} `) + textAfterCursor;
      setInput(newInput);
    }

    setIsMentionOpen(false);
    setMentionMode('initial');

    // Auto-focus back to textarea
    setTimeout(() => targetInput.focus(), 0);
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
    handleQuickSelectWorkspace,
    handleSend,
    handleStop,
    handleInput,
    handleKeyDown,
    startNewChat,
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
    availableWorkspaces,
    contextFiles,
    isLoadingContext,
    handleUpdateContextFile,
    handleSelectWorkspace,
    handleDeleteWorkspace,
    selectedWorkspacePath,
    currentWorkspaceId,
    taskProgress,
    activePreviewFile,
    setActivePreviewFile,
    previewFiles,
    setPreviewFiles,
    selectedQuickModel,
    setSelectedQuickModel,
    isMentionOpen,
    setIsMentionOpen,
    mentionSearch,
    mentionIndex,
    mentionOptions,
    mentionMode,
    selectedMentions,
    setSelectedMentions,
    handleSelectMention,
    removeMention: (id: string) => {
      setSelectedMentions((prev) => prev.filter((m) => m.id !== id));
    },
  };
};
