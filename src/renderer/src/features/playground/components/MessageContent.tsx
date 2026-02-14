import React, { useState } from 'react';
import { CodeBlock } from '../../../core/components/CodeBlock';
import { getFileIconPath, getFolderIconPath } from '../../../shared/utils/fileIconMapper';
import { Copy, Download, Check } from 'lucide-react';
import { ReplaceInFileRenderer, WriteToFileRenderer } from './ToolCalls/ToolCallRenderers';

interface MessageContentProps {
  content: string;
  workspacePath?: string;
  onFileClick?: (path: string) => void;
}

// Language to extension mapping
const EXTENSIONS: Record<string, string> = {
  python: 'py',
  javascript: 'js',
  typescript: 'ts',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  csharp: 'cs',
  go: 'go',
  rust: 'rs',
  ruby: 'rb',
  php: 'php',
  swift: 'swift',
  kotlin: 'kt',
  sql: 'sql',
  html: 'html',
  css: 'css',
  json: 'json',
  yaml: 'yml',
  xml: 'xml',
  markdown: 'md',
  bash: 'sh',
  shell: 'sh',
  plaintext: 'txt',
};

const LANGUAGE_MAP: Record<string, string> = {
  py: 'python',
  js: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  jsx: 'javascript',
  cpp: 'cpp',
  c: 'c',
  java: 'java',
  rs: 'rust',
  go: 'go',
  rb: 'ruby',
  php: 'php',
  cs: 'csharp',
  sh: 'shell',
  md: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
};

// Helper for simple tag extraction
const extractTag = (tagText: string, tagName: string) => {
  const match = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i').exec(tagText);
  return match ? match[1].trim() : '';
};

// Helper Component for Inline File Viewing
const InlineFileViewer: React.FC<{ filePath: string; workspacePath?: string }> = ({
  filePath,
  workspacePath,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    setIsExpanded(true);
    if (content === null) {
      setLoading(true);
      setError(null);
      try {
        let targetPath = filePath.trim();
        // Resolve relative path
        if (workspacePath && !targetPath.startsWith('/') && !targetPath.match(/^[a-zA-Z]:/)) {
          targetPath = `${workspacePath}/${targetPath}`;
          targetPath = targetPath.replace(/([^:])\/+/g, '$1/');
        }

        const fileContent = await window.api.commands.readFile(targetPath);
        setContent(fileContent);
      } catch (err) {
        console.error('Failed to read file inline:', err);
        setError('Failed to read file');
      } finally {
        setLoading(false);
      }
    }
  };

  const iconPath = getFileIconPath(filePath);
  // Determine language from extension
  const ext = filePath.split('.').pop()?.toLowerCase() || 'txt';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    rs: 'rust',
    go: 'go',
    sql: 'sql',
    sh: 'shell',
  };
  const language = languageMap[ext] || 'plaintext';

  return (
    <div className="flex flex-col gap-2 my-1">
      <div className="flex items-center gap-2 text-[13px] font-medium font-mono leading-none">
        <div className={`w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0`} />
        <span className={`text-foreground opacity-80`}>Reading</span>
        <button
          onClick={toggle}
          className="inline-flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-muted bg-muted/40 border border-border/50 rounded text-xs transition-colors group cursor-pointer select-none -my-1"
          title={isExpanded ? 'Collapse' : `Open ${filePath}`}
        >
          <img
            src={iconPath}
            alt="file"
            className="w-3.5 h-3.5 object-contain opacity-80 group-hover:opacity-100"
          />
          <span className="text-foreground/90 group-hover:text-primary transition-colors truncate max-w-[200px]">
            {filePath}
          </span>
          <span className="text-[10px] text-muted-foreground ml-1">{isExpanded ? '▼' : '▶'}</span>
        </button>
      </div>

      {isExpanded && (
        <div className="ml-4 mt-1 border-l-2 border-border pl-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {loading ? (
            <div className="text-xs text-muted-foreground italic py-2">Loading content...</div>
          ) : error ? (
            <div className="text-xs text-red-500 py-2">{error}</div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              {/* Mini Header */}
              <div className="bg-secondary/30 px-3 py-1.5 border-b border-border flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <img src={iconPath} className="w-3 h-3 object-contain" />
                  <span className="text-[10px] font-medium text-foreground uppercase">
                    {language}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => content && navigator.clipboard.writeText(content)}
                    className="text-[10px] hover:text-foreground text-muted-foreground transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <CodeBlock
                code={content || ''}
                language={language}
                showLineNumbers={true}
                readOnly={true}
                maxLines={20}
                disableClick={true}
                className="text-xs"
                editorOptions={{
                  minimap: { enabled: false },
                  lineNumbersMinChars: 3,
                  padding: { top: 8, bottom: 8 },
                  fontSize: 12,
                  renderLineHighlight: 'none',
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const InlineFolderViewer: React.FC<{
  folderPath: string;
  workspacePath?: string;
}> = ({ folderPath, workspacePath }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [files, setFiles] = useState<{ name: string; isDirectory: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const iconPath = getFolderIconPath(isExpanded);

  const toggle = async () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    setIsExpanded(true);
    if (files.length === 0) {
      setLoading(true);
      setError(null);
      try {
        let targetPath = folderPath.trim() || './';
        // Resolve relative path
        if (workspacePath && !targetPath.startsWith('/') && !targetPath.match(/^[a-zA-Z]:/)) {
          // Join without double slashes
          const cleanBase = workspacePath.endsWith('/')
            ? workspacePath.slice(0, -1)
            : workspacePath;
          const cleanSub = targetPath.startsWith('./') ? targetPath.slice(2) : targetPath;
          targetPath = `${cleanBase}/${cleanSub}`;
        }

        const result: any = await window.api.commands.listFiles(targetPath);

        if (Array.isArray(result)) {
          const processedFiles = result.map((p: string) => {
            const isDir = p.endsWith('/');
            const cleanPath = isDir ? p.slice(0, -1) : p;
            const name = cleanPath.split('/').pop() || cleanPath;
            return { name, isDirectory: isDir };
          });
          setFiles(processedFiles);
        } else if (result && result.success) {
          setFiles(result.files || []);
        } else {
          setError(result?.error || 'Failed to list files');
        }
      } catch (err) {
        console.error('Failed to list files inline:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2 my-1">
      <div className="flex items-center gap-2 text-[13px] font-medium font-mono leading-none">
        <div className={`w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0`} />
        <span className={`text-foreground opacity-80`}>Listing</span>
        <button
          onClick={toggle}
          className="inline-flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-muted bg-muted/40 border border-border/50 rounded text-xs transition-colors group cursor-pointer select-none -my-1"
          title={isExpanded ? 'Collapse' : `Open ${folderPath}`}
        >
          <img
            src={iconPath}
            alt="folder"
            className="w-3.5 h-3.5 object-contain opacity-80 group-hover:opacity-100"
          />
          <span className="text-foreground/90 group-hover:text-primary transition-colors truncate max-w-[200px]">
            {folderPath || './'}
          </span>
          <span className="text-[10px] text-muted-foreground ml-1">{isExpanded ? '▼' : '▶'}</span>
        </button>
      </div>

      {isExpanded && (
        <div className="ml-4 mt-1 border-l-2 border-border pl-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {loading ? (
            <div className="text-xs text-muted-foreground italic py-2">Loading content...</div>
          ) : error ? (
            <div className="text-xs text-red-500 py-2">{error}</div>
          ) : (
            <div className="flex flex-col gap-1 py-1 max-h-[300px] overflow-y-auto custom-scrollbar">
              {files.length === 0 ? (
                <div className="text-xs text-muted-foreground italic px-2">Empty directory</div>
              ) : (
                files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-2 py-0.5 hover:bg-muted/50 rounded transition-colors group"
                  >
                    <img
                      src={file.isDirectory ? getFolderIconPath(false) : getFileIconPath(file.name)}
                      className="w-3 h-3 object-contain opacity-70 group-hover:opacity-100"
                    />
                    <span className="text-[11px] text-foreground/80 group-hover:text-foreground">
                      {file.name}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const InlineFileRef: React.FC<{ filePath: string; onClick?: (path: string) => void }> = ({
  filePath,
  onClick,
}) => {
  const iconPath = getFileIconPath(filePath);
  return (
    <span
      onClick={() => onClick?.(filePath)}
      className="inline-flex items-center gap-1 mx-0.5 cursor-pointer hover:opacity-70 transition-opacity align-baseline"
      title={`Open ${filePath}`}
    >
      <img src={iconPath} alt="" className="w-3.5 h-3.5 object-contain" />
      <span className="font-medium underline decoration-border hover:decoration-primary underline-offset-2">
        {filePath}
      </span>
    </span>
  );
};

/**
 * Parses markdown content and renders code blocks with syntax highlighting
 */
export const MessageContent: React.FC<MessageContentProps> = ({
  content,
  workspacePath,
  onFileClick,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownload = (code: string, language: string) => {
    const ext = EXTENSIONS[language.toLowerCase()] || 'txt';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatToolCalls = (text: string) => {
    if (!text) return '';

    // console.log('[formatToolCalls] Input:', text);
    let formatted = text;

    // 1. Dọn dẹp các thẻ metadata và toolcalls không cần hiển thị NGAY LẬP TỨC
    // Bao gồm cả các ký tự xuống dòng xung quanh để tránh tạo khoảng trống lớn
    formatted = formatted.replace(/\n?\s*<temp\s*>([\s\S]*?)(<\/temp>|$)\s*\n?/gi, '\n');
    formatted = formatted.replace(/\n?\s*<read_file\s*>([\s\S]*?)(<\/read_file>|$)\s*\n?/gi, '\n');
    formatted = formatted.replace(
      /\n?\s*<task_progress\s*>([\s\S]*?)(<\/task_progress>|$)\s*\n?/gi,
      '\n',
    );
    formatted = formatted.replace(
      /\n?\s*<(task_name|task|task_done)\s*>([\s\S]*?)(<\/\1>|$)\s*\n?/gi,
      '\n',
    );

    // 2. Unwrap content tags
    // Chỉnh sửa để hỗ trợ cả thẻ chưa đóng (cho streaming)
    formatted = formatted.replace(/<(text|code|language)\s*>([\s\S]*?)(<\/\1>|$)/gi, '$2');

    // 3. Xử lý các tool calls khác
    formatted = formatted.replace(
      /<read_file(?: \/>|\/>|>([\s\S]*?)<\/read_file>)/g,
      (match, inner) => {
        const path = inner ? extractTag(match, 'path') : '';
        return `<inline_file_tag path="${path || 'file'}" />`;
      },
    );

    formatted = formatted.replace(
      /<list_files(?: \/>|\/>|>([\s\S]*?)<\/list_files>)/g,
      (match, inner) => {
        const path = inner ? extractTag(match, 'path') : '';
        return `<inline_folder_tag path="${path || ''}" />`;
      },
    );

    formatted = formatted.replace(
      /<list_file(?: \/>|\/>|>([\s\S]*?)<\/list_file>)/g,
      (match, inner) => {
        const path = inner ? extractTag(match, 'path') : '';
        return `<inline_folder_tag path="${path || ''}" />`;
      },
    );

    formatted = formatted.replace(
      /<search_files(?: \/>|\/>|>([\s\S]*?)<\/search_files>)/g,
      (match) => {
        const regex = extractTag(match, 'regex');
        return `<status_tag text="Searching for \\"${regex}\\"..." />`;
      },
    );

    formatted = formatted.replace(
      /<execute_command(?: \/>|\/>|>([\s\S]*?){1}<\/execute_command>)/g,
      (match) => {
        const command = extractTag(match, 'command');
        return `<status_tag text="Executing: ${command}" />`;
      },
    );

    // Context Operations
    formatted = formatted.replace(
      /<read_workspace_context(?: \/>|\/>|>([\s\S]*?)<\/read_workspace_context>)/g,
      () => `<status_tag text="Reading workspace.md bối cảnh..." />`,
    );

    formatted = formatted.replace(
      /<update_workspace_context(?: \/>|\/>|>([\s\S]*?)<\/update_workspace_context>)/g,
      (match, inner) => {
        const content = inner ? extractTag(match, 'content') || inner : '';
        return `<write_to_file><path>workspace.md</path><content>${content}</content></write_to_file>`;
      },
    );

    formatted = formatted.replace(
      /<read_workspace_rules_context(?: \/>|\/>|>([\s\S]*?)<\/read_workspace_rules_context>)/g,
      () => `<status_tag text="Reading Project Rules (rules)..." />`,
    );

    formatted = formatted.replace(
      /<update_workspace_rules_context(?: \/>|\/>|>([\s\S]*?)<\/update_workspace_rules_context>)/g,
      (match, inner) => {
        const content = inner ? extractTag(match, 'content') || inner : '';
        return `<write_to_file><path>workspace_rules.md</path><content>${content}</content></write_to_file>`;
      },
    );

    formatted = formatted.replace(
      /<read_current_conversation_summary_context(?: \/>|\/>|>([\s\S]*?)<\/read_current_conversation_summary_context>)/g,
      () => `<status_tag text="Reading Conversation Summary..." />`,
    );

    formatted = formatted.replace(
      /<update_current_conversation_summary_context(?: \/>|\/>|>([\s\S]*?)<\/update_current_conversation_summary_context>)/g,
      (match, inner) => {
        const content = inner ? extractTag(match, 'content') || inner : '';
        return `<write_to_file><path>summary.md</path><content>${content}</content></write_to_file>`;
      },
    );

    formatted = formatted.replace(/<tool_result name="(\w+)">([\s\S]*?)<\/tool_result>/g, '');

    // Hide any trailing partial/incomplete XML tags during streaming
    // 1. Remove trailing "<tag" or "<tag " (incomplete tag start)
    formatted = formatted.replace(/<[a-zA-Z0-9_]+[^>]*$/g, '');

    // 2. Remove trailing "<tag>..." if the closing tag "</tag>" is missing at the end
    formatted = formatted.replace(/<([a-zA-Z0-9_]+)>((?!<\/\1>)[\s\S])*$/g, '');

    // Thu dọn các dòng trống dư thừa (max 2 dòng liên tiếp) và trim
    formatted = formatted.replace(/\n{3,}/g, '\n\n').trim();

    // console.log('[formatToolCalls] Output:', formatted);
    return formatted;
  };

  const ToolStatusLine: React.FC<{
    text: string;
    status?: 'pending' | 'running' | 'success' | 'error';
  }> = ({ text, status = 'success' }) => {
    const statusColor = {
      pending: 'bg-muted-foreground/30 text-muted-foreground',
      running: 'bg-yellow-500 text-yellow-500',
      success: 'bg-green-500 text-green-500',
      error: 'bg-red-500 text-red-500',
    };

    const dotColor = statusColor[status].split(' ')[0];
    const textColor = status === 'pending' ? 'text-muted-foreground' : 'text-foreground';

    return (
      <div className="flex items-center gap-1.5 my-0.5 text-[13px] font-medium font-mono leading-none">
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor} flex-shrink-0`} />
        <span className={`${textColor} opacity-80`}>{text}</span>
      </div>
    );
  };

  const parseContent = (text: string) => {
    const parts: React.ReactNode[] = [];
    const combinedRegex =
      /```(\w+)?\n([\s\S]*?)```|(<status_tag text="([\s\S]*?)" \/>)|(<inline_file_tag path="([\s\S]*?)" \/>)|(<inline_folder_tag path="([\s\S]*?)" \/>)|(<replace_in_file>[\s\S]*?<\/replace_in_file>)|(<write_to_file>[\s\S]*?<\/write_to_file>)|<file>([\s\S]*?)<\/file>|(\*\*(.*?)\*\*)/g;

    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = combinedRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = text.substring(lastIndex, match.index);
        parts.push(
          <span key={`text-${key++}`} className="whitespace-pre-wrap">
            {textBefore}
          </span>,
        );
      }

      const fullMatch = match[0];

      if (fullMatch.startsWith('```')) {
        // ... (existing logic for code blocks)
        const rawLanguage = match[1]?.toLowerCase() || 'plaintext';
        const language = LANGUAGE_MAP[rawLanguage] || rawLanguage;
        const code = match[2].trim();
        const blockIndex = key;
        const ext = EXTENSIONS[language.toLowerCase()] || 'txt';
        const iconPath = getFileIconPath(`code.${ext}`);

        parts.push(
          <div
            key={`code-${key++}`}
            className="my-3 rounded-lg overflow-hidden border border-border"
          >
            <div className="bg-secondary/30 px-3 py-1.5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={iconPath} alt={language} className="w-4 h-4 object-contain" />
                <span className="text-xs font-medium text-foreground uppercase">{language}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCopy(code, blockIndex)}
                  className="p-1 hover:bg-background rounded transition-colors"
                  title="Copy code"
                >
                  {copiedIndex === blockIndex ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  )}
                </button>
                <button
                  onClick={() => handleDownload(code, language)}
                  className="p-1 hover:bg-background rounded transition-colors"
                  title="Download code"
                >
                  <Download className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            </div>
            <CodeBlock
              code={code}
              language={language}
              showLineNumbers={false}
              maxLines={30}
              disableClick={true}
              className="rounded-none"
              editorOptions={{
                guides: {
                  indentation: false,
                  bracketPairs: false,
                  highlightActiveIndentation: false,
                },
                renderLineHighlight: 'none',
                cursorStyle: 'line-thin',
                cursorBlinking: 'solid',
                domReadOnly: true,
                selectionHighlight: false,
                occurrencesHighlight: false,
                hover: { enabled: false },
              }}
            />
          </div>,
        );
      } else if (fullMatch.startsWith('<status_tag')) {
        const statusText = match[4];
        parts.push(<ToolStatusLine key={`status-${key++}`} text={statusText} />);
      } else if (fullMatch.startsWith('<inline_file_tag')) {
        const path = match[6];
        parts.push(
          <InlineFileViewer
            key={`file-v-${key++}`}
            filePath={path}
            workspacePath={workspacePath}
          />,
        );
      } else if (fullMatch.startsWith('<inline_folder_tag')) {
        const path = match[8];
        parts.push(
          <InlineFolderViewer
            key={`folder-v-${key++}`}
            folderPath={path}
            workspacePath={workspacePath}
          />,
        );
      } else if (fullMatch.startsWith('<replace_in_file>')) {
        const content = fullMatch;
        const path = extractTag(content, 'path');
        let target = extractTag(content, 'TargetContent');
        let replacement = extractTag(content, 'ReplacementContent');

        // Fallback to diff parsing if standard tags are missing
        if (!target && !replacement) {
          const diff = extractTag(content, 'diff');
          if (diff) {
            const searchMarker = '<<<<<<< SEARCH';
            const separatorMarker = '=======';
            const replaceMarker = />>>>>>> REPLACE|REPLACE|>>>>>>>/;

            const searchStart = diff.indexOf(searchMarker);
            const sepIndex = diff.indexOf(separatorMarker);

            if (searchStart !== -1 && sepIndex !== -1) {
              target = diff.substring(searchStart + searchMarker.length, sepIndex).trim();

              const afterSep = diff.substring(sepIndex + separatorMarker.length);
              const endMatch = afterSep.match(replaceMarker);
              if (endMatch) {
                replacement = afterSep.substring(0, endMatch.index).trim();
              } else {
                replacement = afterSep.trim();
              }
            }
          }
        }

        parts.push(
          <ReplaceInFileRenderer
            key={`replace-${key++}`}
            path={path || 'unknown'}
            replacements={[{ target, replacement }]}
          />,
        );
      } else if (fullMatch.startsWith('<write_to_file>')) {
        const content = fullMatch;
        const path = extractTag(content, 'path');
        const codeContent =
          extractTag(content, 'content') ||
          extractTag(content, 'CodeContent') ||
          extractTag(content, 'code');

        parts.push(
          <WriteToFileRenderer
            key={`write-${key++}`}
            path={path || 'unknown'}
            content={codeContent}
          />,
        );
      } else if (fullMatch.startsWith('<file>')) {
        const filePath = match[11];
        parts.push(
          <InlineFileRef
            key={`file-ref-${key++}`}
            filePath={filePath}
            onClick={workspacePath ? (path) => onFileClick?.(path) : undefined}
          />,
        );
      } else if (fullMatch.startsWith('**')) {
        const boldText = match[13];
        parts.push(
          <strong key={`bold-${key++}`} className="font-bold">
            {boldText}
          </strong>,
        );
      }

      lastIndex = match.index + fullMatch.length;
    }

    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${key++}`} className="whitespace-pre-wrap">
          {text.substring(lastIndex)}
        </span>,
      );
    }

    return parts.length > 0 ? parts : <span className="whitespace-pre-wrap">{text}</span>;
  };

  return <div className="text-sm">{parseContent(formatToolCalls(content))}</div>;
};
