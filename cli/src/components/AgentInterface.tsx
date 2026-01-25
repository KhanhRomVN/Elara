import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import Spinner from 'ink-spinner';
import fetch from 'node-fetch';
import { DEFAULT_RULE_PROMPT } from '../prompts/index.js';
import { FuzzyMatcher } from '../utils/FuzzyMatcher.js';

interface Message {
  role: string;
  content: string;
}

interface Account {
  id: string;
  email: string;
  provider_id: string;
}

const BASE_URL = 'http://0.0.0.0:11434';

const Header = React.memo(
  ({
    version,
    currentPath,
    currentModel,
    currentContext,
    columns,
    url,
  }: {
    version: string;
    currentPath: string;
    currentModel: string;
    currentContext: string | number;
    columns: number;
    url: string;
  }) => {
    const logo = `
███████╗██╗      █████╗ ██████╗  █████╗
██╔════╝██║     ██╔══██╗██╔══██╗██╔══██╗
█████╗  ██║     ███████║██████╔╝███████║
██╔══╝  ██║     ██╔══██║██╔══██╗██╔══██║
███████╗███████╗██║  ██║██║  ██║██║  ██║
╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝`.trim();

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text color="cyan">{logo}</Text>
        <Box marginTop={1}>
          <Text color="gray">
            url: <Text color="white">{url}</Text> │ version: <Text color="white">{version}</Text> │
            workspace: <Text color="white">{currentPath}</Text> │ model:{' '}
            <Text color="white">{currentModel}</Text> │ context:{' '}
            <Text color="white">{currentContext || 'null'}</Text>
          </Text>
        </Box>
      </Box>
    );
  },
);

const MessageList = React.memo(
  ({
    messages,
    isLoading,
    chatAreaHeight,
  }: {
    messages: Message[];
    isLoading: boolean;
    chatAreaHeight: number;
  }) => {
    const visibleMessages = messages.slice(
      Math.max(0, messages.length - chatAreaHeight),
      messages.length,
    );

    return (
      <Box
        flexGrow={1}
        flexDirection="column"
        paddingX={1}
        height={chatAreaHeight}
        overflow="hidden"
      >
        {visibleMessages.map((msg, index) => (
          <Box key={index} marginBottom={1} flexDirection="row">
            <Box width={10}>
              <Text bold color={msg.role === 'user' ? 'blue' : 'green'}>
                {msg.role === 'user' ? 'You: ' : 'Elara: '}
              </Text>
            </Box>
            <Box flexGrow={1}>
              <Text color="white">{msg.content}</Text>
            </Box>
          </Box>
        ))}
        {isLoading && (
          <Box>
            <Text color="yellow">
              <Spinner type="dots" /> Elara is thinking...
            </Text>
          </Box>
        )}
      </Box>
    );
  },
);

const InputArea = ({
  input,
  setInput,
  onSubmit,
  isLoading,
  separator,
  onKeyDown,
  isSearching = false,
}: {
  input: string;
  setInput: (val: string) => void;
  onSubmit: (val: string) => void;
  isLoading: boolean;
  separator: string;
  onKeyDown?: (inputChar: string, key: any) => void;
  isSearching?: boolean;
}) => {
  useInput((inputChar, key) => {
    if (isLoading) return;

    if (onKeyDown) {
      onKeyDown(inputChar, key);
    }

    if (key.return) {
      return;
    }

    if (key.backspace || key.delete) {
      setInput(input.slice(0, -1));
      return;
    }

    if (key.escape || (key.ctrl && inputChar === 'c')) {
      if (!isSearching) {
        process.exit(0);
      }
      return;
    }

    if (key.ctrl && inputChar === 'u') {
      setInput('');
      return;
    }

    // Gõ phím bình thường và ép tiếng Anh (Force Latin/ASCII)
    if (inputChar && !key.ctrl && !key.meta) {
      const sanitizedChar = inputChar
        .normalize('NFD') // Tách các thành phần của ký tự có dấu (ví dụ 'ệ' -> 'e' và dấu nặng)
        .replace(/[\u0300-\u036f]/g, '') // Loại bỏ các tổ hợp dấu tiếng Việt
        .replace(/[^\x20-\x7E]/g, ''); // Chỉ giữ lại các ký tự Latin chuẩn (ASCII 32-126)

      if (sanitizedChar) {
        setInput(input + sanitizedChar);
      }
    }
  });

  return (
    <Box flexDirection="column" marginTop={0}>
      <Text color="gray">{separator}</Text>
      <Box paddingX={1} flexDirection="row">
        <Box marginRight={1}>
          <Text color="cyan" bold>
            {isSearching ? 'Search Model: ' : '> '}
          </Text>
        </Box>
        <Text color="white">{input}</Text>
        {!isLoading && <Text color="cyan">█</Text>}
      </Box>
      <Text color="gray">{separator}</Text>
    </Box>
  );
};

const HighlightedText = ({
  text,
  term,
  color = 'white',
  highlightColor = 'yellow',
}: {
  text: string;
  term: string;
  color?: string;
  highlightColor?: string;
}) => {
  if (!term.trim()) return <Text color={color}>{text}</Text>;

  try {
    const parts = text.split(new RegExp(`(${term})`, 'gi'));
    return (
      <Text color={color}>
        {parts.map((part, i) =>
          part.toLowerCase() === term.toLowerCase() ? (
            <Text key={i} color={highlightColor} bold>
              {part}
            </Text>
          ) : (
            part
          ),
        )}
      </Text>
    );
  } catch (e) {
    return <Text color={color}>{text}</Text>;
  }
};

const StatusBar = React.memo(
  ({ chatMode, escPressCount }: { chatMode: string; escPressCount: number }) => (
    <Box justifyContent="space-between" paddingX={1}>
      <Box>
        <Text color="gray">/ for tool | ? for help</Text>
        {escPressCount > 0 && <Text color="red"> (Press ESC again to exit)</Text>}
      </Box>
      <Text color="cyan" bold>
        {chatMode.toLowerCase()} mode
      </Text>
    </Box>
  ),
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
      const fuzzyMatch = FuzzyMatcher.findMatch(newContent, search);
      if (fuzzyMatch && fuzzyMatch.score < 0.4) {
        newContent = newContent.replace(fuzzyMatch.originalText, replace);
      } else {
        throw new Error(`Could not find search block in file for replacement.`);
      }
    }
  }
  return newContent;
};

const AgentInterface: React.FC = () => {
  const { stdout } = useStdout();
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [status, setStatus] = useState<string>('Connecting...');
  const [currentModel, setCurrentModel] = useState<string>('AUTO');
  const [currentProvider, setCurrentProvider] = useState<string>('');
  const [currentContext, setCurrentContext] = useState<string | number>('null');
  const [chatMode, setChatMode] = useState<'Chat' | 'Agent'>('Chat');
  const [columns, setColumns] = useState<number>(process.stdout.columns || 80);
  const [rows, setRows] = useState<number>(process.stdout.rows || 24);
  const [escPressCount, setEscPressCount] = useState<number>(0);
  const [escTimer, setEscTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedCommandIdx, setSelectedCommandIdx] = useState<number>(0);
  const [currentConversationId, setCurrentConversationId] = useState<string>('');
  const executedTagsRef = React.useRef<Set<string>>(new Set());
  const version = '1.1.6';
  const currentPath = process.cwd().replace(process.env.HOME || '', '~');

  const [isSelectingModel, setIsSelectingModel] = useState<boolean>(false);
  const [isSelectingChatMode, setIsSelectingChatMode] = useState<boolean>(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedModelIdx, setSelectedModelIdx] = useState<number>(0);
  const [selectedChatModeIdx, setSelectedChatModeIdx] = useState<number>(0);
  const chatModes = ['Chat', 'Agent'];
  const [flatModels, setFlatModels] = useState<any[]>([]);

  const filteredModels = useMemo(() => {
    if (!isSelectingModel) return [];
    if (!input.trim()) return flatModels;
    const term = input.toLowerCase();
    return flatModels.filter(
      (m) =>
        m.id.toLowerCase().includes(term) ||
        m.provider.toLowerCase().includes(term) ||
        (m.name && m.name.toLowerCase().includes(term)),
    );
  }, [isSelectingModel, input, flatModels]);

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => {
      if (stdout.columns && stdout.columns > 0) {
        setColumns(stdout.columns);
      }
      if (stdout.rows && stdout.rows > 0) {
        setRows(stdout.rows);
      }
    };
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await fetch(`${BASE_URL}/v1/accounts`);
        if (!response.ok) throw new Error('Backend error');
        const result = (await response.json()) as any;
        if (result.success && result.data.length > 0) {
          setAccounts(result.data);
          setSelectedAccount(result.data[0]);
          setStatus('Connected');
        } else {
          setStatus('No accounts found');
        }
      } catch (err) {
        setStatus('Disconnected');
      } finally {
        setIsInitializing(false);
      }
    };
    fetchAccounts();
  }, []);

  const executeToolCall = async (tagName: string, tagContent: string): Promise<string> => {
    const args = parseTagArguments(tagContent);
    const workspacePath = process.cwd();

    try {
      switch (tagName) {
        case 'read_file': {
          const path = args.path;
          if (!path) return 'Error: path is required.';
          const res = await fetch(
            `${BASE_URL}/v1/commands/read-file?path=${encodeURIComponent(path)}&workspace=${encodeURIComponent(workspacePath)}`,
          );
          const data = (await res.json()) as any;
          return data.content || 'Error reading file';
        }
        case 'write_to_file': {
          const { path, content } = args;
          if (!path || content === undefined) return 'Error: path/content required.';
          const res = await fetch(`${BASE_URL}/v1/commands/write-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content, workspace: workspacePath }),
          });
          return `Successfully wrote to ${path}`;
        }
        case 'execute_command': {
          const { command } = args;
          if (!command) return 'Error: command required.';
          const res = await fetch(`${BASE_URL}/v1/shell/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command, cwd: workspacePath }),
          });
          const data = (await res.json()) as any;
          return data.output || 'Command executed';
        }
        case 'list_files': {
          const { path, recursive } = args;
          const res = await fetch(
            `${BASE_URL}/v1/commands/list-files?path=${encodeURIComponent(path || '.')}&workspace=${encodeURIComponent(workspacePath)}&recursive=${recursive === 'true'}`,
          );
          const data = (await res.json()) as any;
          return Array.isArray(data.files) ? data.files.join('\n') : 'Error listing files';
        }
        default:
          return `Error: Unknown tool ${tagName}`;
      }
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  };

  const processAgentTools = async (message: Message) => {
    const toolRegex =
      /<(read_file|write_to_file|replace_in_file|list_files|execute_command)(?:>([\s\S]*?)<\/\1>| \/>|\/>)/g;
    let match;
    const results: string[] = [];
    let foundNew = false;

    while ((match = toolRegex.exec(message.content)) !== null) {
      const fullTag = match[0];
      const tagType = match[1];
      const tagInner = match[2];
      const key = `${message.role}:${fullTag}`;

      if (!executedTagsRef.current.has(key)) {
        foundNew = true;
        const result = await executeToolCall(tagType, tagInner);
        results.push(`[${tagType}]\n\`\`\`\n${result}\n\`\`\``);
        executedTagsRef.current.add(key);
      }
    }

    if (foundNew) {
      const actualResult = results.join('\n\n');
      handleSendMessage(actualResult, true);
    }
  };

  useEffect(() => {
    if (chatMode === 'Agent' && messages.length > 0 && !isLoading) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant') {
        processAgentTools(lastMsg);
      }
    }
  }, [messages, isLoading, chatMode]);

  const handleSendMessage = async (inputVal: string, isToolResult = false) => {
    if (!inputVal.trim() || (isLoading && !isToolResult)) return;

    if (!isToolResult && inputVal.startsWith('/')) {
      let cmd = inputVal.trim();
      if (cmd === '/') {
        cmd = selectedCommandIdx === 0 ? '/mode' : '/chat-mode';
      }

      if (cmd.startsWith('/mode')) {
        await fetchProviders();
        setIsSelectingModel(true);
        setInput('');
      } else if (cmd.startsWith('/chat-mode')) {
        setIsSelectingChatMode(true);
        setSelectedChatModeIdx(chatMode === 'Chat' ? 0 : 1);
        setInput('');
      } else if (cmd === '/') {
        // Mặc định hiện danh sách lệnh
        setInput('/');
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Unknown command: ${cmd}` }]);
        setInput('');
      }
      return;
    }

    // Cho phép AUTO model hoạt động mà không cần selectedAccount (backend sẽ tự chọn)
    if (!selectedAccount && currentModel !== 'AUTO') {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: inputVal },
        {
          role: 'assistant',
          content: 'Error: No active account. Please add an account in Elara Desktop.',
        },
      ]);
      setInput('');
      return;
    }

    const userMessage: Message = { role: isToolResult ? 'assistant' : 'user', content: inputVal };
    if (!isToolResult) {
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
    }
    setIsLoading(true);

    try {
      let finalPrompt = inputVal;
      if (messages.length === 0 && chatMode === 'Agent' && !isToolResult) {
        finalPrompt = `${DEFAULT_RULE_PROMPT}\n\n## User Request\n${inputVal}`;
      }

      const response = await fetch(`${BASE_URL}/v1/chat/accounts/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: currentModel === 'AUTO' ? 'auto' : currentModel.toLowerCase(),
          providerId: currentProvider || undefined,
          accountId: selectedAccount?.id || null,
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: isToolResult ? 'assistant' : 'user', content: finalPrompt },
          ],
          conversationId: currentConversationId,
          stream: false,
          thinking: currentModel.toLowerCase().includes('thinking'),
        }),
      });

      const result = (await response.json()) as any;
      if (result.success) {
        setMessages((prev) => [...prev, result.message]);

        // Cập nhật metadata từ response
        const metadata = result.metadata || {};
        if (metadata.conversation_id) {
          setCurrentConversationId(metadata.conversation_id);
        }
        if (metadata.accountId && !selectedAccount) {
          // Nếu ban đầu không có account, cập nhật account từ server trả về
          const foundAccount = accounts.find((a) => a.id === metadata.accountId);
          if (foundAccount) setSelectedAccount(foundAccount);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${result.error || 'Unknown error'}` },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Connection failed.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${BASE_URL}/v1/providers`);
      const result = (await res.json()) as any;
      if (result.success) {
        setProviders(result.data);
        // Flatten models for easy navigation
        const flat: any[] = [];
        result.data.forEach((p: any) => {
          if (p.models && p.models.length > 0) {
            p.models.forEach((m: any) => {
              flat.push({ ...m, provider: p.provider_name, provider_enabled: p.is_enabled });
            });
          }
        });
        setFlatModels(flat);

        // Find first enabled model to select
        const firstEnabled = flat.findIndex((m) => m.provider_enabled);
        setSelectedModelIdx(firstEnabled !== -1 ? firstEnabled : 0);
      }
    } catch (err) {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputKeyDown = (inputChar: string, key: any) => {
    if (isSelectingModel) {
      const models = filteredModels;
      if (key.upArrow) {
        setSelectedModelIdx((prev) =>
          models.length > 0 ? (prev > 0 ? prev - 1 : models.length - 1) : 0,
        );
      } else if (key.downArrow) {
        setSelectedModelIdx((prev) =>
          models.length > 0 ? (prev < models.length - 1 ? prev + 1 : 0) : 0,
        );
      } else if (key.return) {
        const model = models[selectedModelIdx];
        if (model) {
          setCurrentModel(model.name || model.id);
          setCurrentProvider(model.provider || '');
          setCurrentContext(model.context_length || 'null');
          setIsSelectingModel(false);
          setInput('');
        }
      } else if (key.escape) {
        setIsSelectingModel(false);
        setInput('');
      } else if (inputChar || key.backspace || key.delete) {
        setSelectedModelIdx(0); // Reset selection when searching
      }
      return;
    }

    if (isSelectingChatMode) {
      if (key.upArrow || key.downArrow) {
        setSelectedChatModeIdx((prev) => (prev === 0 ? 1 : 0));
      } else if (key.return) {
        setChatMode(chatModes[selectedChatModeIdx] as 'Chat' | 'Agent');
        setIsSelectingChatMode(false);
      } else if (key.escape) {
        setIsSelectingChatMode(false);
      }
      return;
    }

    if (input.startsWith('/') && !isSelectingModel && !isSelectingChatMode) {
      if (key.upArrow || key.downArrow) {
        setSelectedCommandIdx((prev) => (prev === 0 ? 1 : 0));
        return;
      }
    }

    if (key.escape) {
      if (escPressCount === 0) {
        setEscPressCount(1);
        if (escTimer) clearTimeout(escTimer);
        const timer = setTimeout(() => {
          setEscPressCount(0);
        }, 2000);
        setEscTimer(timer);
      } else {
        process.exit(0);
      }
      return;
    }

    // Reset ESC count if any other key is pressed
    if (inputChar || key.return || key.backspace || key.delete) {
      setEscPressCount(0);
      if (escTimer) {
        clearTimeout(escTimer);
        setEscTimer(null);
      }
    }

    if (key.return) {
      handleSendMessage(input);
    }
  };

  const separator = useMemo(() => {
    const width = Math.max(10, columns - 2);
    return '─'.repeat(width);
  }, [columns]);

  // Calculate area heights
  const headerHeight = 9; // Logo (6) + Spacing (1) + Version Line (1) + Margin (1)
  const inputAreaHeight = 3; // Separator + Input + Separator
  const statusBarHeight = 1;
  const chatAreaHeight = Math.max(5, rows - headerHeight - inputAreaHeight - statusBarHeight - 2);

  if (isInitializing) {
    return (
      <Box padding={1}>
        <Spinner type="dots" />
        <Text> Initializing Elara...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {!isSelectingModel && !isSelectingChatMode && (
        <Header
          version={version}
          currentPath={currentPath}
          currentModel={currentModel}
          currentContext={currentContext}
          columns={columns}
          url={BASE_URL.replace('http://', '').replace('0.0.0.0', 'localhost')}
        />
      )}

      <InputArea
        input={input}
        setInput={setInput}
        onSubmit={handleSendMessage}
        isLoading={isLoading}
        separator={separator}
        onKeyDown={handleInputKeyDown}
        isSearching={isSelectingModel || isSelectingChatMode}
      />

      {isSelectingModel ? (
        <Box flexDirection="column" paddingX={2} marginBottom={1}>
          <Box marginBottom={1}>
            <Text color="yellow" bold>
              Select a model ({filteredModels.length > 0 ? selectedModelIdx + 1 : 0}/
              {filteredModels.length}):
            </Text>
          </Box>

          {(() => {
            const models = filteredModels;
            if (models.length === 0) {
              return (
                <Box paddingY={1}>
                  <Text color="red">No models found for "{input}"</Text>
                </Box>
              );
            }

            const MAX_VISIBLE = 15;
            const half = Math.floor(MAX_VISIBLE / 2);
            let start = Math.max(0, selectedModelIdx - half);
            let end = Math.min(models.length, start + MAX_VISIBLE);

            if (end - start < MAX_VISIBLE) {
              start = Math.max(0, end - MAX_VISIBLE);
            }

            const visibleModels = models.slice(start, end);
            const visibleProviders = providers.filter((p) =>
              visibleModels.some((m) => m.provider === p.provider_name),
            );

            return (
              <>
                {start > 0 && <Text color="gray"> ...</Text>}
                {visibleProviders.map((p) => {
                  const providerModelsInWindow = visibleModels.filter(
                    (m) => m.provider === p.provider_name,
                  );
                  if (providerModelsInWindow.length === 0) return null;

                  return (
                    <Box key={p.provider_id} flexDirection="column" marginTop={0}>
                      <HighlightedText
                        text={p.provider_name.toLowerCase()}
                        term={input}
                        color={p.is_enabled ? 'cyan' : 'gray'}
                      />
                      {!p.is_enabled && (
                        <Text color="gray" dimColor>
                          {' '}
                          (disabled)
                        </Text>
                      )}

                      {providerModelsInWindow.map((m) => {
                        const globalIdx = models.findIndex(
                          (fm) => fm.id === m.id && fm.provider === p.provider_name,
                        );
                        const isSelected = globalIdx === selectedModelIdx;
                        const isDisabled = !p.is_enabled;

                        return (
                          <Box key={m.id}>
                            <Text color={isDisabled ? 'gray' : isSelected ? 'green' : 'white'}>
                              {'           '}
                              {isSelected && !isDisabled ? '→ ' : '  '}
                              <HighlightedText
                                text={m.id}
                                term={input}
                                color={isDisabled ? 'gray' : isSelected ? 'green' : 'white'}
                              />
                              <Text>
                                {' '}
                                | thinking: {m.is_thinking ? 'true' : 'false'} | context:{' '}
                                {m.context_length || 'null'}
                              </Text>
                            </Text>
                          </Box>
                        );
                      })}
                    </Box>
                  );
                })}
                {end < models.length && <Text color="gray"> ...</Text>}
              </>
            );
          })()}

          <Box marginTop={1}>
            <Text color="gray">↑↓ Navigate • Enter Select • ESC Cancel</Text>
          </Box>
        </Box>
      ) : isSelectingChatMode ? (
        <Box flexDirection="column" paddingX={2} marginBottom={1}>
          <Box marginBottom={1}>
            <Text color="yellow" bold>
              Select chat mode:
            </Text>
          </Box>
          {chatModes.map((mode, idx) => (
            <Box key={mode} marginLeft={2}>
              <Text color={idx === selectedChatModeIdx ? 'green' : 'white'}>
                {idx === selectedChatModeIdx ? '→ ' : '  '}
                {mode}
              </Text>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text color="gray">↑↓ Navigate • Enter Select • ESC Cancel</Text>
          </Box>
        </Box>
      ) : (
        <>
          {input.startsWith('/') ? (
            <Box flexDirection="column" paddingX={2} marginBottom={1} marginLeft={1}>
              {(() => {
                const isModeSelected = selectedCommandIdx === 0;
                const isChatModeSelected = selectedCommandIdx === 1;

                const isModeMatch =
                  (input === '/' && isModeSelected) ||
                  (input.length > 1 && '/mode'.startsWith(input));
                const isChatModeMatch =
                  (input === '/' && isChatModeSelected) ||
                  (input.length > 1 && '/chat-mode'.startsWith(input));

                const modeLabel = `/mode(${currentModel})`;
                const chatModeLabel = `/chat-mode(${chatMode})`;

                return (
                  <>
                    <Box>
                      <Text color={isModeMatch ? 'green' : 'gray'}>{modeLabel.padEnd(28)}</Text>
                      <Text color={isModeMatch ? 'white' : 'gray'}>Change model</Text>
                    </Box>
                    <Box>
                      <Text color={isChatModeMatch ? 'green' : 'gray'}>
                        {chatModeLabel.padEnd(28)}
                      </Text>
                      <Text color={isChatModeMatch ? 'white' : 'gray'}>Change to Chat/Agent</Text>
                    </Box>
                  </>
                );
              })()}
            </Box>
          ) : (
            <StatusBar chatMode={chatMode} escPressCount={escPressCount} />
          )}

          <MessageList messages={messages} isLoading={isLoading} chatAreaHeight={chatAreaHeight} />
        </>
      )}
    </Box>
  );
};

export default AgentInterface;
