import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import Spinner from 'ink-spinner';
import fetch from 'node-fetch';
import { DEFAULT_RULE_PROMPT } from '../prompts/index.js';
import { FuzzyMatcher } from '../utils/FuzzyMatcher.js';
import { ConfigService } from '../services/ConfigService.js';
import { getIconForFile } from '../utils/IconMapper.js';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const LOG_FILE = path.join(process.cwd(), 'debug.log');
const IS_DEV = process.env.npm_lifecycle_event === 'dev';

const logDebug = (message: string, data?: any) => {
  if (!IS_DEV) return;
  try {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message} ${data ? JSON.stringify(data, null, 2) : ''}\n`;
    fs.appendFileSync(LOG_FILE, logLine);
  } catch (e) {
    // ignore logging errors
  }
};

interface Message {
  role: string;
  content: string;
}

interface Account {
  id: string;
  email: string;
  provider_id: string;
}

// BASE_URL removed, will use state

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

const ToolBlock = React.memo(
  ({
    tagName,
    tagContent,
    status = 'success',
  }: {
    tagName: string;
    tagContent: string;
    status?: string;
  }) => {
    const args = parseTagArguments(tagContent);

    const getStatusColor = () => {
      switch (status) {
        case 'running':
          return 'yellow';
        case 'success':
          return 'green';
        case 'error':
          return 'red';
        default:
          return 'white'; // pending
      }
    };

    const getToolInfo = () => {
      switch (tagName) {
        case 'read_file':
          return { label: 'Read', color: 'cyan', arg: args.path };
        case 'write_to_file':
          return { label: 'Write', color: 'green', arg: args.path };
        case 'execute_command':
          return { label: 'Execute', color: 'yellow', arg: args.command };
        case 'list_files':
          return { label: 'ListFiles', color: 'magenta', arg: args.path || '.' };
        case 'replace_in_file':
          return { label: 'Update', color: 'blue', arg: args.path };
        default:
          return {
            label: tagName.charAt(0).toUpperCase() + tagName.slice(1),
            color: 'gray',
            arg: '',
          };
      }
    };

    const info = getToolInfo();

    if (tagName === 'text') return <Text color="white">{tagContent}</Text>;
    if (tagName === 'temp' || tagName === 'comment')
      return (
        <Box marginBottom={1}>
          <Text color="gray" italic>
            {tagContent}
          </Text>
        </Box>
      );

    if (!info) return null;

    const getMetadata = () => {
      if (tagName === 'write_to_file' && args.content) {
        const lines = args.content.split('\n').length;
        return `Write ${lines} lines`;
      }
      if (tagName === 'replace_in_file') {
        const blocks = tagContent.match(/<<<<<<< SEARCH[\s\S]*?>>>>>>> REPLACE/g);
        return `Update ${blocks?.length || 0} blocks`;
      }
      return null;
    };

    const metadata = getMetadata();

    return (
      <Box flexDirection="column" marginY={0}>
        <Box>
          <Text color={getStatusColor()} bold>
            {' '}
            ●{' '}
          </Text>
          <Text color={info.color} bold>
            {info.label}
          </Text>
          <Text color="white">(</Text>
          <Text color="white" underline>
            {info.arg}
          </Text>
          <Text color="white">)</Text>
        </Box>
        {metadata && (
          <Box marginLeft={2}>
            <Text color="gray" dimColor>
              ⎿ {metadata}
            </Text>
          </Box>
        )}

        {tagName === 'replace_in_file' && (
          <Box marginLeft={2} flexDirection="column" marginTop={1}>
            {tagContent
              .match(/<<<<<<< SEARCH[\s\S]*?=======[\s\S]*?>>>>>>> REPLACE/g)
              ?.map((block, idx) => {
                const match = block.match(
                  /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/,
                );
                if (!match) return null;
                const searchLines = match[1].split('\n');
                const replaceLines = match[2].split('\n');
                const max = 10;
                return (
                  <Box key={idx} flexDirection="row" width="100%" marginBottom={1}>
                    <Box
                      flexDirection="column"
                      flexGrow={1}
                      borderStyle="round"
                      borderColor="red"
                      paddingX={1}
                    >
                      <Text color="red" bold>
                        SEARCH (-{searchLines.length})
                      </Text>
                      <CLIHighlighter
                        code={
                          searchLines.slice(0, max).join('\n') +
                          (searchLines.length > max ? '\n...' : '')
                        }
                        language={args.path}
                      />
                    </Box>
                    <Box
                      flexDirection="column"
                      flexGrow={1}
                      borderStyle="round"
                      borderColor="green"
                      paddingX={1}
                      marginLeft={1}
                    >
                      <Text color="green" bold>
                        REPLACE (+{replaceLines.length})
                      </Text>
                      <CLIHighlighter
                        code={
                          replaceLines.slice(0, max).join('\n') +
                          (replaceLines.length > max ? '\n...' : '')
                        }
                        language={args.path}
                      />
                    </Box>
                  </Box>
                );
              })}
          </Box>
        )}

        {tagName === 'write_to_file' && args.content && (
          <Box
            marginLeft={2}
            borderStyle="round"
            borderColor={info.color}
            paddingX={1}
            marginTop={1}
          >
            <CLIHighlighter
              code={
                args.content.split('\n').slice(0, 15).join('\n') +
                (args.content.split('\n').length > 15 ? '\n...' : '')
              }
              language={args.path}
            />
          </Box>
        )}

        {tagName === 'execute_command' && (
          <Box marginLeft={2} marginTop={1} backgroundColor="#222" paddingX={1}>
            <Text color="white" bold>
              $ {args.command}
            </Text>
          </Box>
        )}
      </Box>
    );
  },
);

const CLIHighlighter = React.memo(({ code, language }: { code: string; language?: string }) => {
  const keywords =
    /\b(function|const|let|var|return|if|else|for|while|do|class|export|import|from|static|async|await|try|catch|type|interface|enum|public|private|protected|readonly|new|implements|extends)\b/g;
  const strings = /(['"`])[\s\S]*?\1/g;
  const numbers = /\b\d+(\.\d+)?\b/g;
  const comments = /(\/\/.*)/g;

  // Split by keywords, strings, comments to apply colors
  const parts = code.split(/(\/\/.*|['"`][\s\S]*?['"`]|\b\w+\b)/g);

  try {
    return (
      <Text color="white">
        {parts.map((part, i) => {
          if (!part) return null;
          if (part.startsWith('//'))
            return (
              <Text key={i} color="gray" italic>
                {part}
              </Text>
            );
          if (/^['"`]/.test(part))
            return (
              <Text key={i} color="green">
                {part}
              </Text>
            );
          if (keywords.test(part))
            return (
              <Text key={i} color="cyan" bold>
                {part}
              </Text>
            );
          if (numbers.test(part))
            return (
              <Text key={i} color="yellow">
                {part}
              </Text>
            );
          return part;
        })}
      </Text>
    );
  } catch (err: any) {
    logDebug('Error in CLIHighlighter', { error: err.message, code });
    return <Text>{code}</Text>;
  }
});

const ContentWithCodeBlocks = React.memo(({ content }: { content: string }) => {
  try {
    // logDebug('Rendering ContentWithCodeBlocks', { length: content.length, preview: content.slice(0, 20) });
    const blocks = content.split(/(```[\w-]*[ \t]*\n[\s\S]*?```)/g);

    return (
      <Box flexDirection="column">
        {blocks.map((part, i) => {
          if (part.startsWith('```')) {
            const match = part.match(/```([\w-]*)[ \t]*\n([\s\S]*?)```/);
            if (match) {
              const lang = match[1] || 'plaintext';
              const code = match[2].trim();
              return (
                <Box
                  key={i}
                  flexDirection="column"
                  marginY={1}
                  paddingX={1}
                  paddingY={0}
                  backgroundColor="#262626"
                >
                  <Box justifyContent="space-between">
                    <Text> </Text>
                    <Text color="gray" dimColor italic>
                      {getIconForFile(lang)} {lang || 'text'}
                    </Text>
                  </Box>
                  <CLIHighlighter code={code} language={lang} />
                </Box>
              );
            }
          }
          return part.trim() ? (
            <Text key={i} color="white">
              {part.trim()}
            </Text>
          ) : null;
        })}
      </Box>
    );
  } catch (err: any) {
    logDebug('Error in ContentWithCodeBlocks', { error: err.message, stack: err.stack, content });
    return <Text color="red">Rendering Error: {err.message}</Text>;
  }
});

const ToolCallRenderer = ({
  content,
  msgIndex,
  toolStatuses,
}: {
  content: string;
  msgIndex: number;
  toolStatuses: Record<string, string>;
}) => {
  const parts = content.split(
    /(<read_file>[\s\S]*?<\/read_file>|<write_to_file>[\s\S]*?<\/write_to_file>|<execute_command>[\s\S]*?<\/execute_command>|<list_files>[\s\S]*?<\/list_files>|<replace_in_file>[\s\S]*?<\/replace_in_file>|<text>[\s\S]*?<\/text>|<temp>[\s\S]*?<\/temp>|<comment>[\s\S]*?<\/comment>)/g,
  );

  return (
    <Box flexDirection="column">
      {parts
        .filter((p) => p.trim())
        .map((part, i) => {
          if (part.startsWith('<')) {
            const match = part.match(/<([\w_]+)>([\s\S]*?)<\/\1>/);
            if (match) {
              const status = toolStatuses[`${msgIndex}:${i}`] || 'success';
              return <ToolBlock key={i} tagName={match[1]} tagContent={match[2]} status={status} />;
            }
          }

          if (part.startsWith('[') && part.includes(']\n```')) {
            const resultMatch = part.match(/\[([\w_]+)\]\n```\n([\s\S]*?)\n```/);
            if (resultMatch) {
              const tagName = resultMatch[1];
              const result = resultMatch[2];
              const lineCount = result.split('\n').length;

              return (
                <Box key={i} flexDirection="column" marginLeft={2} marginY={1}>
                  <Text color="gray" dimColor>
                    ⎿ Read {lineCount} lines
                  </Text>
                  <Box paddingX={1} marginTop={1} backgroundColor="#262626" paddingY={0.5}>
                    <CLIHighlighter
                      code={result.length > 1000 ? result.slice(0, 1000) + '\n...' : result}
                      language={tagName}
                    />
                  </Box>
                </Box>
              );
            }
          }

          return <ContentWithCodeBlocks key={i} content={part} />;
        })}
    </Box>
  );
};

/* REFACTORED MessageList */
const MessageList = React.memo(
  ({
    messages,
    isLoading,
    chatAreaHeight,
    toolStatuses,
  }: {
    messages: Message[];
    isLoading: boolean;
    chatAreaHeight: number;
    toolStatuses: Record<string, string>;
  }) => {
    const visibleMessages = messages.slice(
      Math.max(0, messages.length - chatAreaHeight),
      messages.length,
    );

    return (
      <Box flexDirection="column" paddingX={1}>
        {visibleMessages.map((msg, index) => (
          <Box key={index} marginBottom={1} flexDirection="column">
            {msg.role === 'user' ? (
              <Box marginBottom={0}>
                <Text backgroundColor="#333333" color="white">
                  <Text color="yellow">› </Text>
                  {msg.content}
                </Text>
              </Box>
            ) : (
              <Box marginBottom={0} paddingX={1} flexDirection="column">
                <ToolCallRenderer
                  content={msg.content}
                  msgIndex={messages.indexOf(msg)}
                  toolStatuses={toolStatuses}
                />
              </Box>
            )}
          </Box>
        ))}
        {isLoading && (
          <Box paddingX={1}>
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
      if (input.trim()) {
        onSubmit(input);
      }
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

    // Gõ phím bình thường
    if (inputChar && !key.ctrl && !key.meta) {
      setInput(input + inputChar);
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
  ({
    chatMode,
    escPressCount,
    messageCount,
  }: {
    chatMode: string;
    escPressCount: number;
    messageCount: number;
  }) => (
    <Box justifyContent="space-between" paddingX={1}>
      <Box>
        <Text color="gray">
          / for tool | ? for help{messageCount === 0 ? ' | TAB to toggle mode' : ''}
        </Text>
        {escPressCount > 0 && <Text color="red"> (Press ESC again to exit)</Text>}
      </Box>
      {messageCount === 0 && (
        <Text color={chatMode === 'CHAT' ? 'green' : 'yellow'} bold>
          {chatMode}
        </Text>
      )}
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
  logDebug('AgentInterface rendering');
  const { stdout } = useStdout();
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('Ready');
  const [currentModel, setCurrentModel] = useState<string>('AUTO');
  const [currentProvider, setCurrentProvider] = useState<string>('');
  const [currentContext, setCurrentContext] = useState<string | number>('null');
  const [chatMode, setChatMode] = useState<'CHAT' | 'AGENT'>('CHAT');
  const [columns, setColumns] = useState<number>(process.stdout.columns || 80);
  const [rows, setRows] = useState<number>(process.stdout.rows || 24);
  const [escPressCount, setEscPressCount] = useState<number>(0);
  const [escTimer, setEscTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedCommandIdx, setSelectedCommandIdx] = useState<number>(0);
  const [currentConversationId, setCurrentConversationId] = useState<string>('');
  const [toolStatuses, setToolStatuses] = useState<Record<string, string>>({});
  const executedTagsRef = React.useRef<Set<string>>(new Set());
  const version = '1.1.6';
  const currentPath = process.cwd().replace(process.env.HOME || '', '~');

  // State for Base URL
  const [baseUrl, setBaseUrl] = useState<string>(ConfigService.getApiUrl());
  const [configPath, setConfigPath] = useState<string>(ConfigService.getConfigPath());

  // Watch for config changes
  useEffect(() => {
    ConfigService.watchConfig((newConfig) => {
      setBaseUrl(newConfig.url);
    });
  }, []);

  const [isSelectingModel, setIsSelectingModel] = useState<boolean>(false);
  const [isSelectingChatMode, setIsSelectingChatMode] = useState<boolean>(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedModelIdx, setSelectedModelIdx] = useState<number>(0);
  const [selectedChatModeIdx, setSelectedChatModeIdx] = useState<number>(0);
  const chatModes = ['CHAT', 'AGENT'];
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

  const executeToolCall = async (tagName: string, tagContent: string): Promise<string> => {
    const args = parseTagArguments(tagContent);
    const workspacePath = process.cwd();

    try {
      switch (tagName) {
        case 'read_file': {
          const path = args.path;
          if (!path) return 'Error: path is required.';
          const res = await fetch(
            `${baseUrl}/v1/commands/read-file?path=${encodeURIComponent(path)}&workspace=${encodeURIComponent(workspacePath)}`,
          );
          const data = (await res.json()) as any;
          return data.content || 'Error reading file';
        }
        case 'write_to_file': {
          const { path, content } = args;
          if (!path || content === undefined) return 'Error: path/content required.';
          const res = await fetch(`${baseUrl}/v1/commands/write-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content, workspace: workspacePath }),
          });
          return `Successfully wrote to ${path}`;
        }
        case 'execute_command': {
          const { command } = args;
          if (!command) return 'Error: command required.';
          const res = await fetch(`${baseUrl}/v1/shell/execute`, {
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
            `${baseUrl}/v1/commands/list-files?path=${encodeURIComponent(path || '.')}&workspace=${encodeURIComponent(workspacePath)}&recursive=${recursive === 'true'}`,
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
    let tagIndex = -1;
    const parts = message.content.split(/(<[\w_]+>[\s\S]*?<\/\1>)/g);
    const msgIndex = messages.indexOf(message);
    const results: string[] = [];
    let foundNew = false;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith('<')) {
        const match = part.match(/<([\w_]+)>([\s\S]*?)<\/\1>/);
        if (match) {
          const tagType = match[1];
          const tagContent = match[2];
          const fullTag = part;
          const statusKey = `${msgIndex}:${i}`;
          const executionKey = `${message.role}:${fullTag}`;

          if (!executedTagsRef.current.has(executionKey)) {
            foundNew = true;
            setToolStatuses((prev) => ({ ...prev, [statusKey]: 'running' }));
            try {
              const result = await executeToolCall(tagType, tagContent);
              results.push(`[${tagType}]\n\`\`\`\n${result}\n\`\`\``);
              setToolStatuses((prev) => ({ ...prev, [statusKey]: 'success' }));
            } catch (err) {
              setToolStatuses((prev) => ({ ...prev, [statusKey]: 'error' }));
              results.push(`[${tagType}]\n\`\`\`\nError: ${err}\n\`\`\``);
            }
            executedTagsRef.current.add(executionKey);
          }
        }
      }
    }

    if (foundNew) {
      const actualResult = results.join('\n\n');
      handleSendMessage(actualResult, true);
    }
  };

  useEffect(() => {
    if (chatMode === 'AGENT' && messages.length > 0 && !isLoading) {
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
        cmd =
          selectedCommandIdx === 0 ? '/mode' : selectedCommandIdx === 1 ? '/chat-mode' : '/config';
      }

      if (cmd.startsWith('/mode')) {
        await fetchProviders();
        setIsSelectingModel(true);
        setInput('');
      } else if (cmd.startsWith('/chat-mode')) {
        setIsSelectingChatMode(true);
        setSelectedChatModeIdx(chatMode === 'CHAT' ? 0 : 1);
        setInput('');
      } else if (cmd.startsWith('/config')) {
        const parts = cmd.match(/^\/config(?:\((.*?)\))?$/);
        const newUrl = parts ? parts[1] : null;

        if (newUrl) {
          ConfigService.saveConfig({ url: newUrl });
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `Configuration updated. New URL: ${newUrl}. Please restart the CLI for changes to take effect.`,
            },
          ]);
          setInput('');
        } else {
          // Open config file
          const configPath = ConfigService.getConfigPath();
          const editor = process.env.EDITOR || 'nano';

          // Use spawn to open editor. Note: This assumes standard TUI editors.
          // Since we are inside Ink, spawning a TUI editor might conflict with Ink's rendering.
          // However, for desktop usage, `xdg-open` or `code` might be better if available, or just printing the path.
          // User asked to "click to find tool editor file closest".
          // Let's try to open with system default or code.

          try {
            // Try to open with vs code by default if available, or fallback
            spawn(process.env.VISUAL || process.env.EDITOR || 'xdg-open' || 'code', [configPath], {
              detached: true,
              stdio: 'ignore',
            }).unref();
          } catch (e) {
            setMessages((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: `Could not open editor. Config file is at: ${configPath}`,
              },
            ]);
          }
          setInput('');
        }
      } else if (cmd === '/') {
        // Mặc định hiện danh sách lệnh
        setInput('/');
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Unknown command: ${cmd}` }]);
        setInput('');
      }
      return;
    }

    const userMessage: Message = { role: isToolResult ? 'assistant' : 'user', content: inputVal };
    if (!isToolResult) {
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
    }
    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout (2 mins)

    try {
      logDebug('handleSendMessage: Start', { input: inputVal, isToolResult });
      let finalPrompt = inputVal;
      if (messages.length === 0 && chatMode === 'AGENT' && !isToolResult) {
        finalPrompt = `${DEFAULT_RULE_PROMPT}\n\n## User Request\n${inputVal}`;
      }

      logDebug('handleSendMessage: Sending fetch request', {
        url: `${baseUrl}/v1/chat/accounts/messages`,
        model: currentModel,
        stream: false,
      });

      const response = await fetch(`${baseUrl}/v1/chat/accounts/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          modelId: currentModel === 'AUTO' ? 'auto' : currentModel.toLowerCase(),
          providerId: currentProvider || undefined,
          accountId: selectedAccount?.id || undefined,
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: isToolResult ? 'assistant' : 'user', content: finalPrompt },
          ],
          conversationId: currentConversationId,
          stream: false,
          thinking: currentModel.toLowerCase().includes('thinking'),
        }),
      });
      clearTimeout(timeoutId);
      logDebug('handleSendMessage: Got response', { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        throw new Error(errorData.error || 'Backend error');
      }

      const result = (await response.json()) as any;
      if (result.success) {
        logDebug('handleSendMessage: Success', { messageLength: result.message.content.length });
        setMessages((prev) => [...prev, result.message]);

        // Update metadata
        const metadata = result.metadata || {};
        if (metadata.conversation_id) {
          setCurrentConversationId(metadata.conversation_id);
        }
        if (metadata.accountId && !selectedAccount) {
          const foundAccount = accounts.find((a) => a.id === metadata.accountId);
          if (foundAccount) setSelectedAccount(foundAccount);
        }

        if (chatMode === 'AGENT') {
          processAgentTools(result.message);
        }
      } else {
        logDebug('handleSendMessage: Backend returned success=false');
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${result.error || 'Unknown error'}` },
        ]);
      }
    } catch (err: any) {
      logDebug('handleSendMessage: Error', { message: err.message, stack: err.stack });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message || 'Connection failed.'}` },
      ]);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${baseUrl}/v1/providers`);
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
        setChatMode(chatModes[selectedChatModeIdx] as 'CHAT' | 'AGENT');
        setIsSelectingChatMode(false);
      } else if (key.escape) {
        setIsSelectingChatMode(false);
        setInput('');
      }
      return;
    }

    if (key.tab && messages.length === 0) {
      setChatMode((prev) => (prev === 'CHAT' ? 'AGENT' : 'CHAT'));
      return;
    }

    if (input.startsWith('/') && !isSelectingModel && !isSelectingChatMode) {
      if (key.upArrow || key.downArrow) {
        // Cycle through 0, 1, 2
        if (selectedCommandIdx !== -1) {
          setSelectedCommandIdx((prev) => (prev === 0 ? 1 : 0));
        }
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

    /* REMOVED: Redundant key handling that caused duplicate inputs.
       InputArea now handles standard typing and submission.
    */
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
          url={baseUrl.replace('http://', '').replace('0.0.0.0', 'localhost')}
        />
      )}

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
          <MessageList
            messages={messages}
            isLoading={isLoading}
            chatAreaHeight={chatAreaHeight}
            toolStatuses={toolStatuses}
          />
        </>
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

      {!isSelectingModel && !isSelectingChatMode && (
        <>
          {input.startsWith('/') ? (
            <Box flexDirection="column" paddingX={2} marginBottom={1} marginLeft={1}>
              {(() => {
                const isModeSelected = selectedCommandIdx === 0;
                const isChatModeSelected = selectedCommandIdx === 1;
                const isConfigSelected = selectedCommandIdx === 2;

                const isModeMatch =
                  (input === '/' && isModeSelected) ||
                  (input.length > 1 && '/mode'.startsWith(input));
                const isChatModeMatch =
                  (input === '/' && isChatModeSelected) ||
                  (input.length > 1 && '/chat-mode'.startsWith(input));
                const isConfigMatch =
                  (input === '/' && isConfigSelected) ||
                  (input.length > 1 && '/config'.startsWith(input));

                const modeLabel = `/mode(${currentModel})`;
                const chatModeLabel = `/chat-mode(${chatMode})`;
                const configLabel = `/config(${configPath})`;

                const labels = [modeLabel, chatModeLabel, configLabel];
                return (
                  <>
                    <Box>
                      <Text color={isModeMatch ? 'green' : 'gray'}>{modeLabel}</Text>
                    </Box>
                    <Box>
                      <Text color={isChatModeMatch ? 'green' : 'gray'}>{chatModeLabel}</Text>
                    </Box>
                    <Box>
                      <Text color={isConfigMatch ? 'green' : 'gray'}>{configLabel}</Text>
                    </Box>
                  </>
                );
              })()}
            </Box>
          ) : (
            <StatusBar
              chatMode={chatMode}
              escPressCount={escPressCount}
              messageCount={messages.length}
            />
          )}
        </>
      )}
    </Box>
  );
};

export default AgentInterface;
