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
import * as crypto from 'crypto';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

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
  id: string;
  role: string;
  content: string;
  uiHidden?: boolean;
}

interface Account {
  id: string;
  email: string;
  provider_id: string;
}

// BASE_URL removed, will use state

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

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
    additionalMetadata,
  }: {
    tagName: string;
    tagContent: string;
    status?: string;
    additionalMetadata?: string;
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
        case 'update_context_fact':
          return { label: 'Memory', color: 'cyan', arg: args.fact || 'fact' };
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
    if (tagName === 'temp') return null; // Hide temp tags
    if (tagName === 'comment')
      return (
        <Box marginBottom={1}>
          <Text color="gray" italic>
            {tagContent}
          </Text>
        </Box>
      );

    if (tagName === 'code') {
      const languageMatch = tagContent.match(/<language>([\s\S]*?)<\/language>/);
      const contentMatch = tagContent.match(/<content>([\s\S]*?)<\/content>/);
      const language = languageMatch ? languageMatch[1].trim() : 'text';
      const code = contentMatch ? contentMatch[1].trim() : '';

      return (
        <Box flexDirection="column" marginY={1} paddingX={1} paddingY={0} backgroundColor="#262626">
          <Box justifyContent="space-between">
            <Text> </Text>
            <Text color="gray" dimColor italic>
              {getIconForFile(language)} {language}
            </Text>
          </Box>
          <CLIHighlighter code={code} language={language} />
        </Box>
      );
    }

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
      if (tagName === 'read_file') {
        if (additionalMetadata) return additionalMetadata;
      }
      return null;
    };

    const metadata = getMetadata();

    return (
      <Box flexDirection="column" marginY={0}>
        <Box marginLeft={-1}>
          <Text color={getStatusColor()} bold>
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
                return (
                  <Box
                    key={idx}
                    flexDirection="column"
                    marginBottom={1}
                    paddingX={0}
                    backgroundColor="#1e1e1e"
                  >
                    {searchLines.map((line, i) => (
                      <CodeLine
                        key={`search-${i}`}
                        code={line}
                        lineNumber={i + 1}
                        language={args.path}
                        bgColor="#220505"
                        paddingX={0}
                      />
                    ))}
                    {replaceLines.map((line, i) => (
                      <CodeLine
                        key={`replace-${i}`}
                        code={line}
                        lineNumber={i + 1}
                        language={args.path}
                        bgColor="#072322"
                        paddingX={0}
                      />
                    ))}
                  </Box>
                );
              })}
          </Box>
        )}

        {tagName === 'write_to_file' && args.content && (
          <Box marginLeft={2} marginTop={1}>
            <Box flexDirection="column" paddingX={0} paddingY={0} backgroundColor="#1e1e1e">
              <Box justifyContent="space-between" marginBottom={0} paddingX={1}>
                <Text> </Text>
                <Text color="gray" dimColor italic>
                  {getIconForFile(args.path || '')} {args.path || 'file'}
                </Text>
              </Box>
              <Box flexDirection="column" paddingX={0}>
                {args.content
                  .split('\n')
                  .slice(0, 15)
                  .map((line, i) => (
                    <CodeLine
                      key={`write-${i}`}
                      code={line}
                      lineNumber={i + 1}
                      language={args.path}
                      bgColor="#1e1e1e"
                      paddingX={0}
                    />
                  ))}
                {args.content.split('\n').length > 15 && (
                  <Box paddingX={1} paddingY={0.5}>
                    <Text color="gray" italic>
                      ...
                    </Text>
                  </Box>
                )}
              </Box>
            </Box>
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
    /\b(function|const|let|var|return|if|else|for|while|do|class|export|import|from|static|async|await|try|catch|type|interface|enum|public|private|protected|readonly|new|implements|extends|as|of|in|yield|await|break|continue|default|switch|case|throw|finally)\b/g;
  const types = /\b(string|number|boolean|any|void|unknown|never|object|Symbol|bigint)\b/g;
  const booleans = /\b(true|false|null|undefined)\b/g;
  const numbers = /\b\d+(\.\d+)?\b/g;
  const operators = /([\+\-\*\/\=%&\|\^!<> \?\:\[\]\{\}]+)/g;

  // Split logic needs to be more robust to handle overlapping patterns
  // We'll use a single regex with groups to capture everything in order
  const tokens = code.split(/(\/\/.*|['"`][\s\S]*?['"`]|\b\w+\b|[^\w\s])/g);

  try {
    return (
      <Text color="#d4d4d4">
        {tokens.map((token, i) => {
          if (!token) return null;

          // Comments - Gray
          if (token.startsWith('//')) {
            return (
              <Text key={i} color="#6a9955" italic>
                {token}
              </Text>
            );
          }

          // Strings - Orange/Brownish
          if (/^['"`]/.test(token)) {
            return (
              <Text key={i} color="#ce9178">
                {token}
              </Text>
            );
          }

          // Keywords - Blue
          if (new RegExp(`^${keywords.source}$`).test(token)) {
            return (
              <Text key={i} color="#569cd6" bold>
                {token}
              </Text>
            );
          }

          // Types - Teal/Cyan
          if (new RegExp(`^${types.source}$`).test(token)) {
            return (
              <Text key={i} color="#4ec9b0">
                {token}
              </Text>
            );
          }

          // Booleans/Null - Purple/Blue
          if (new RegExp(`^${booleans.source}$`).test(token)) {
            return (
              <Text key={i} color="#569cd6">
                {token}
              </Text>
            );
          }

          // Numbers - Light Green/Yellow
          if (new RegExp(`^${numbers.source}$`).test(token)) {
            return (
              <Text key={i} color="#b5cea8">
                {token}
              </Text>
            );
          }

          // Function calls - Yellow
          const nextToken = tokens[i + 1] || '';
          if (/^\w+$/.test(token) && nextToken.trim().startsWith('(')) {
            return (
              <Text key={i} color="#dcdcaa">
                {token}
              </Text>
            );
          }

          // Operators & Symbols - White/Cyanish
          if (/^[^\w\s]$/.test(token)) {
            return (
              <Text key={i} color="#808080">
                {token}
              </Text>
            );
          }

          return token;
        })}
      </Text>
    );
  } catch (err: any) {
    logDebug('Error in CLIHighlighter', { error: err.message, code });
    return <Text>{code}</Text>;
  }
});

const CodeLine = React.memo(
  ({
    code,
    lineNumber,
    language,
    bgColor,
    paddingX = 0,
  }: {
    code: string;
    lineNumber: number | string;
    language?: string;
    bgColor?: string;
    paddingX?: number;
  }) => (
    <Box flexDirection="row" paddingX={paddingX}>
      <Box width={4} marginRight={1} justifyContent="flex-end">
        <Text color="gray" dimColor>
          {lineNumber}
        </Text>
      </Box>
      <Box flexGrow={1} backgroundColor={bgColor}>
        <CLIHighlighter code={code} language={language} />
      </Box>
    </Box>
  ),
);

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
                  <Box flexDirection="column" paddingX={0}>
                    {code.split('\n').map((line, idx) => (
                      <CodeLine
                        key={`code-${idx}`}
                        code={line}
                        lineNumber={idx + 1}
                        language={lang}
                        bgColor="#262626"
                        paddingX={0}
                      />
                    ))}
                  </Box>
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
  messages,
}: {
  content: string;
  msgIndex: number;
  toolStatuses: Record<string, string>;
  messages?: Message[];
}) => {
  const parts = content.split(
    /(<read_file>[\s\S]*?<\/read_file>|<write_to_file>[\s\S]*?<\/write_to_file>|<execute_command>[\s\S]*?<\/execute_command>|<list_files>[\s\S]*?<\/list_files>|<replace_in_file>[\s\S]*?<\/replace_in_file>|<update_context_fact>[\s\S]*?<\/update_context_fact>|<text>[\s\S]*?<\/text>|<temp>[\s\S]*?<\/temp>|<comment>[\s\S]*?<\/comment>|<code>[\s\S]*?<\/code>)/g,
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
              let additionalMetadata: string | undefined;

              if (match[1] === 'read_file' && messages) {
                // Try to find the result in the next message
                const nextMsg = messages[msgIndex + 1];
                if (nextMsg && nextMsg.role === 'user') {
                  const resultRegex = new RegExp(
                    `\\[read_file\\]\\n\`\`\`\\n([\\s\\S]*?)\\n\`\`\``,
                  );
                  const resultMatch = nextMsg.content.match(resultRegex);
                  if (resultMatch) {
                    // Check if this result matches the path?
                    // Assuming sequential single tool use for now or consistent order
                    const lines = resultMatch[1].split('\n').length;
                    additionalMetadata = `Read ${lines} lines`;
                  }
                }
                // Fallback: check current content if result is appended
                if (!additionalMetadata) {
                  const resultRegex = /\[read_file\]\n```\n([\s\S]*?)\n```/;
                  const resultMatch = content.match(resultRegex);
                  if (resultMatch) {
                    const lines = resultMatch[1].split('\n').length;
                    additionalMetadata = `Read ${lines} lines`;
                  }
                }
              }

              return (
                <ToolBlock
                  key={i}
                  tagName={match[1]}
                  tagContent={match[2]}
                  status={status}
                  additionalMetadata={additionalMetadata}
                />
              );
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
                  <Box flexDirection="column" marginTop={1} backgroundColor="#262626" paddingY={0}>
                    {result
                      .split('\n')
                      .slice(0, 50)
                      .map((line, idx) => (
                        <CodeLine
                          key={`read-${idx}`}
                          code={line}
                          lineNumber={idx + 1}
                          language={tagName}
                          bgColor="#262626"
                          paddingX={0}
                        />
                      ))}
                    {result.split('\n').length > 50 && (
                      <Box paddingX={1} paddingY={0.5}>
                        <Text color="gray">...</Text>
                      </Box>
                    )}
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
    thinkingTime,
  }: {
    messages: Message[];
    isLoading: boolean;
    chatAreaHeight: number;
    toolStatuses: Record<string, string>;
    thinkingTime: number;
  }) => {
    const filteredMessages = messages.filter((m) => !m.uiHidden);
    const visibleMessages = filteredMessages.slice(
      Math.max(0, filteredMessages.length - chatAreaHeight),
      filteredMessages.length,
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
                  messages={messages}
                />
              </Box>
            )}
          </Box>
        ))}
        {isLoading && (
          <Box paddingX={1}>
            <Text color="yellow">
              <Spinner type="dots" /> Elara is thinking...{' '}
              <Text color="gray" dimColor>
                (ESC to stop, {formatTime(thinkingTime)})
              </Text>
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
    if (isLoading) {
      if (key.escape) {
        onKeyDown?.(inputChar, key);
      }
      return;
    }

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
    tokenCount,
  }: {
    chatMode: string;
    escPressCount: number;
    messageCount: number;
    tokenCount: number;
  }) => (
    <Box justifyContent="space-between" paddingX={1}>
      <Box>
        <Text color="gray">
          / for tool | ? for help{messageCount === 0 ? ' | TAB to toggle mode' : ''}
        </Text>
        {escPressCount > 0 && <Text color="red"> (Press ESC again to exit)</Text>}
      </Box>
      <Text color={chatMode === 'CHAT' ? 'green' : 'yellow'} bold>
        ({tokenCount} token) {chatMode}
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
  const conversationIdRef = React.useRef<string>('');
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [toolStatuses, setToolStatuses] = useState<Record<string, string>>({});
  const [isExecutingTool, setIsExecutingTool] = useState<boolean>(false);
  const [thinkingTime, setThinkingTime] = useState<number>(0);
  const abortControllerRef = React.useRef<AbortController | null>(null);
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

  // Thinking timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isLoading) {
      setThinkingTime(0);
      interval = setInterval(() => {
        setThinkingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setThinkingTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  // Placeholder for component logic

  const executeToolCall = async (tagName: string, tagContent: string): Promise<string> => {
    const args = parseTagArguments(tagContent);
    const workspacePath = process.cwd();

    try {
      switch (tagName) {
        case 'read_file': {
          const filePath = args.path;
          if (!filePath) return 'Error: path is required.';
          const fullPath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(workspacePath, filePath);

          if (!fs.existsSync(fullPath)) {
            return `Error: File not found: ${filePath}`;
          }
          return fs.readFileSync(fullPath, 'utf-8');
        }
        case 'write_to_file': {
          const { path: filePath, content } = args;
          if (!filePath || content === undefined) return 'Error: path/content required.';
          const fullPath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(workspacePath, filePath);

          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(fullPath, content, 'utf-8');
          return `Successfully wrote to ${filePath}`;
        }
        case 'execute_command': {
          const { command } = args;
          if (!command) return 'Error: command required.';

          const { stdout, stderr } = await execAsync(command, {
            cwd: workspacePath,
            maxBuffer: 50 * 1024 * 1024,
          });
          return stdout.trim() || stderr.trim() || 'Command executed';
        }
        case 'list_files': {
          const { path: dirPath, recursive } = args;
          const relPath = !dirPath || dirPath === '.' ? '' : dirPath;
          const targetPath = path.isAbsolute(relPath)
            ? relPath
            : path.resolve(workspacePath, relPath);

          if (!fs.existsSync(targetPath)) {
            return 'Error: Directory not found';
          }

          const isRecursive = recursive === 'true';
          const listDir = (dir: string, depth = 0): string[] => {
            if (depth > 5) return []; // Limit depth for safety
            const results: string[] = [];
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
              const full = path.join(dir, entry.name);
              const rel = path.relative(workspacePath, full);

              if (entry.isDirectory()) {
                if (entry.name === 'node_modules' || entry.name === '.git') continue;
                results.push(rel + '/');
                if (isRecursive) {
                  results.push(...listDir(full, depth + 1));
                }
              } else {
                results.push(rel);
              }
            }
            return results;
          };

          const files = listDir(targetPath);
          return files.join('\n') || 'No files found';
        }
        case 'replace_in_file': {
          const { path: filePath } = args;
          if (!filePath) return 'Error: path is required.';

          const fullPath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(workspacePath, filePath);

          if (!fs.existsSync(fullPath)) {
            return `Error: File not found: ${filePath}`;
          }

          const content = fs.readFileSync(fullPath, 'utf-8');
          const newContent = applyDiff(content, tagContent);

          fs.writeFileSync(fullPath, newContent, 'utf-8');
          return `Successfully updated ${filePath}`;
        }
        case 'update_context_fact': {
          const { fact } = args;
          if (!fact) return 'Error: fact is required.';

          try {
            const response = await fetch(`${baseUrl}/v1/context-agent/jobs`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'EXTRACT_FACTS',
                workspacePath,
                data: {
                  fact,
                  llmConfig: {
                    provider: currentProvider,
                    account: selectedAccount?.id,
                    model: currentModel,
                  },
                },
              }),
            });

            if (response.ok) {
              return `Fact added to user memory: "${fact}"`;
            } else {
              return `Failed to add fact. Status: ${response.status}`;
            }
          } catch (e: any) {
            return `Error adding fact: ${e.message}`;
          }
        }
        default:
          return `Error: Unknown tool ${tagName}`;
      }
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  };

  const processAgentTools = async (message: Message) => {
    if (isExecutingTool) return;
    const content = message.content;
    const toolRegex =
      /<(read_file|write_to_file|replace_in_file|list_files|list_file|search_files|execute_command|update_context_fact)(?:>([\s\S]*?)<\/\1>| \/>|\/>)/g;

    const results: string[] = [];
    let match;
    let foundNew = false;

    // Check if there are any new tools to execute before setting state
    const tempMatches = [];
    const tempToolRegex = new RegExp(toolRegex);
    let m;
    while ((m = tempToolRegex.exec(content)) !== null) {
      if (!executedTagsRef.current.has(`${message.id}:${m[0]}`)) {
        tempMatches.push(m);
      }
    }

    if (tempMatches.length === 0) return;

    setIsExecutingTool(true);
    try {
      for (const match of tempMatches) {
        const fullTag = match[0];
        const tagType = match[1];
        const tagInner = match[2];

        const key = `${message.id}:${fullTag}`;
        foundNew = true;

        // Find match index for tool status display
        const msgIndex = messages.findIndex((m) => m.id === message.id);
        const statusKey = `${msgIndex}:${match.index}`;

        setToolStatuses((prev) => ({ ...prev, [statusKey]: 'running' }));
        try {
          const result = await executeToolCall(tagType, tagInner);

          const args = parseTagArguments(tagInner);
          let info = '';
          if (
            tagType === 'read_file' ||
            tagType === 'write_to_file' ||
            tagType === 'replace_in_file'
          ) {
            info = args.path || 'file';
          } else if (tagType === 'list_files' || tagType === 'list_file') {
            info = args.path || 'directory';
          } else if (tagType === 'execute_command') {
            info = args.command || 'command';
          } else if (tagType === 'update_context_fact') {
            info = args.fact
              ? args.fact.length > 30
                ? args.fact.substring(0, 30) + '...'
                : args.fact
              : 'fact';
          }
          const header = info ? `${tagType} for '${info}'` : tagType;

          results.push(`[${header}]\n\`\`\`\n${result}\n\`\`\``);
          setToolStatuses((prev) => ({ ...prev, [statusKey]: 'success' }));
        } catch (err) {
          setToolStatuses((prev) => ({ ...prev, [statusKey]: 'error' }));
          results.push(`[${tagType}]\n\`\`\`\nError: ${err}\n\`\`\``);
        }
        executedTagsRef.current.add(key);
      }

      if (foundNew) {
        const actualResult = results.join('\n\n');
        handleSendMessage(actualResult, true);
      }
    } finally {
      setIsExecutingTool(false);
    }
  };

  useEffect(() => {
    if (!isLoading && chatMode === 'AGENT' && messages.length > 0) {
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
          selectedCommandIdx === 0
            ? '/mode'
            : selectedCommandIdx === 1
              ? '/chat-mode'
              : selectedCommandIdx === 2
                ? '/config'
                : '/new';
      }

      if (cmd.startsWith('/new')) {
        setMessages([]);
        setCurrentConversationId('');
        conversationIdRef.current = '';
        setTokenCount(0);
        setToolStatuses({});
        executedTagsRef.current = new Set();
        setInput('');
        return;
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
              id: crypto.randomUUID(),
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
                id: crypto.randomUUID(),
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
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: `Unknown command: ${cmd}` },
        ]);
        setInput('');
      }
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputVal, // Store actual user input for UI
      uiHidden: isToolResult,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!isToolResult) {
      setInput('');
    }
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min timeout for AGENT tasks

    try {
      let finalPrompt = inputVal;
      if (messages.length === 0 && chatMode === 'AGENT' && !isToolResult) {
        finalPrompt = `${DEFAULT_RULE_PROMPT}\n\n## User Request\n${inputVal}`;
      }

      const messageHistory = [
        ...messages.filter((m) => !m.uiHidden),
        { role: userMessage.role, content: finalPrompt }, // Use finalPrompt for AI context
      ].map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch(`${baseUrl}/v1/chat/accounts/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          modelId: currentModel === 'AUTO' ? 'auto' : currentModel.toLowerCase(),
          providerId: currentProvider || undefined,
          accountId: selectedAccount?.id || undefined,
          messages: messageHistory,
          conversationId: conversationIdRef.current || undefined,
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
        const assistantMsg = { ...result.message, id: crypto.randomUUID() };
        setMessages((prev) => [...prev, assistantMsg]);

        // Update metadata
        const metadata = result.metadata || {};
        if (metadata.conversation_id) {
          setCurrentConversationId(metadata.conversation_id);
          conversationIdRef.current = metadata.conversation_id;
        }
        if (metadata.accountId && !selectedAccount) {
          const foundAccount = accounts.find((a) => a.id === metadata.accountId);
          if (foundAccount) setSelectedAccount(foundAccount);
        }

        // Robust token extraction
        const usage = result.usage || {};
        const totalTokens =
          usage.total_tokens ?? metadata.total_token ?? metadata.total_tokens ?? 0;

        if (totalTokens > 0) {
          setTokenCount(totalTokens);
        }
      } else {
        logDebug('handleSendMessage: Backend returned success=false');
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Error: ${result.error || 'Unknown error'}`,
          },
        ]);
      }
    } catch (err: any) {
      logDebug('handleSendMessage: Error', { message: err.message, stack: err.stack });
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Error: ${err.message || 'Connection failed.'}`,
        },
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
    if (isLoading) {
      if (key.escape) {
        logDebug('handleInputKeyDown: ESC pressed during loading, aborting...');
        abortControllerRef.current?.abort();
        setIsLoading(false);
      }
      return;
    }

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
      if (key.upArrow) {
        setSelectedCommandIdx((prev) => (prev > 0 ? prev - 1 : 3));
        return;
      }
      if (key.downArrow) {
        setSelectedCommandIdx((prev) => (prev < 3 ? prev + 1 : 0));
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
            thinkingTime={thinkingTime}
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

                const isNewSelected = selectedCommandIdx === 3;

                const isModeMatch =
                  (input === '/' && isModeSelected) ||
                  (input.length > 1 && '/mode'.startsWith(input));
                const isChatModeMatch =
                  (input === '/' && isChatModeSelected) ||
                  (input.length > 1 && '/chat-mode'.startsWith(input));
                const isConfigMatch =
                  (input === '/' && isConfigSelected) ||
                  (input.length > 1 && '/config'.startsWith(input));
                const isNewMatch =
                  (input === '/' && isNewSelected) ||
                  (input.length > 1 && '/new'.startsWith(input));

                const modeLabel = `/mode(${currentModel})`;
                const chatModeLabel = `/chat-mode(${chatMode})`;
                const configLabel = `/config(${configPath})`;
                const newLabel = `/new`;

                const labels = [modeLabel, chatModeLabel, configLabel, newLabel];
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
                    <Box>
                      <Text color={isNewMatch ? 'green' : 'gray'}>{newLabel}</Text>
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
              tokenCount={tokenCount}
            />
          )}
        </>
      )}
    </Box>
  );
};

export default AgentInterface;
