import {
  Upload,
  StopCircle,
  Loader2,
  X,
  FileText,
  Zap,
  Bot,
  FolderOpen,
  Settings2,
  ArrowUp,
  Search,
  Cpu,
  Check,
  Trash2,
} from 'lucide-react';
import {
  ChangeEvent,
  KeyboardEvent,
  useRef,
  useState,
  useEffect,
  ClipboardEvent,
  DragEvent,
} from 'react';
import { PendingAttachment } from '../types';
import { cn } from '../../../shared/lib/utils';
import { GitCommitButton } from './GitCommitButton';
import { FilePreviewModal } from './FilePreviewModal';
import { MentionDropdown } from './MentionDropdown';
import { getFileIconPath, getFolderIconPath } from '../../../shared/utils/fileIconMapper';

interface InputAreaProps {
  // ... existing props
  onGitCommit?: () => void;
  // ...
  input: string;
  handleInput: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleSend: (overrideContent?: string, hiddenContent?: string, uiHidden?: boolean) => void;
  handleStop?: () => void;
  loading: boolean;
  isStreaming: boolean;
  selectedAccount?: string;
  selectedProvider?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string; // Allow external styling
  thinkingEnabled?: boolean;
  setThinkingEnabled?: (enabled: boolean) => void;
  searchEnabled?: boolean;
  setSearchEnabled?: (enabled: boolean) => void;
  innerClassName?: string;
  onFileSelect?: (files: FileList | File[] | null) => void;
  attachments?: PendingAttachment[];
  onRemoveAttachment?: (index: number) => void;
  streamEnabled?: boolean;
  setStreamEnabled?: (enabled: boolean) => void;
  isConversationActive?: boolean;

  temperature?: number;
  setTemperature?: (val: number) => void;
  isTemperatureSupported?: boolean;
  onToggleSettings?: () => void;
  onNavigateToSettings?: () => void;
  supportsSearch?: boolean;
  supportsUpload?: boolean;
  supportsThinking?: boolean;
  agentMode?: boolean;
  setAgentMode?: (enabled: boolean) => void;
  selectedWorkspacePath?: string;
  handleSelectWorkspace?: () => void;
  handleDeleteWorkspace?: (id: string) => void;
  handleQuickSelectWorkspace?: (path: string) => void;
  availableWorkspaces?: any[];
  isGitRepo?: boolean;
  selectedQuickModel?: {
    providerId: string;
    modelId: string;
    accountId?: string;
  } | null;
  onQuickModelSelect?: (
    model: { providerId: string; modelId: string; accountId?: string } | null,
  ) => void;
  providersList?: any[];
  accounts?: any[];
  isMentionOpen?: boolean;
  setIsMentionOpen?: (val: boolean) => void;
  mentionSearch?: string;
  mentionIndex?: number;
  mentionOptions?: any[];
  mentionMode?: 'initial' | 'file' | 'folder' | 'mcp' | 'skill';
  handleSelectMention?: (option: any) => void;
  selectedMentions?: any[];
  removeMention?: (id: string) => void;
}

export const InputArea = ({
  input,
  handleInput,
  handleKeyDown,
  handleSend,
  handleStop,
  loading,
  isStreaming,
  selectedAccount,
  selectedProvider: _selectedProvider,
  disabled,
  placeholder = 'Type a message...',
  className,
  thinkingEnabled: _thinkingEnabled,
  setThinkingEnabled: _setThinkingEnabled,
  innerClassName,
  onFileSelect,
  attachments,
  onRemoveAttachment,
  streamEnabled,
  setStreamEnabled,
  supportsSearch: _supportsSearch,
  supportsUpload,
  supportsThinking,
  agentMode,
  setAgentMode,
  selectedWorkspacePath,
  handleSelectWorkspace,
  handleDeleteWorkspace,
  handleQuickSelectWorkspace,
  availableWorkspaces = [],
  isConversationActive,
  onGitCommit,
  isGitRepo,

  temperature: _temperature,
  setTemperature: _setTemperature,
  isTemperatureSupported: _isTemperatureSupported,
  onToggleSettings,
  selectedQuickModel,
  onQuickModelSelect,
  providersList = [],
  accounts = [],
  isMentionOpen,
  setIsMentionOpen: _setIsMentionOpen,
  mentionSearch = '',
  mentionIndex = 0,
  mentionOptions = [],
  mentionMode = 'initial',
  handleSelectMention,
  selectedMentions = [],
  removeMention,
}: InputAreaProps) => {
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const canUpload = supportsUpload && selectedAccount;

  const handleUploadClick = () => {
    if (!canUpload) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!canUpload) return;
    if (onFileSelect && e.target.files) {
      onFileSelect(e.target.files);
    }
    // Reset input value to allow selecting same file again
    if (e.target) {
      e.target.value = '';
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!canUpload) return;
    const items = e.clipboardData.items;
    const pastedFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          pastedFiles.push(file);
        }
      }
    }

    if (pastedFiles.length > 0 && onFileSelect) {
      onFileSelect(pastedFiles);
      // Optional: Prevent default paste if it's only images to avoid pasting the binary data as text (though usually textarea handles it fine or ignores)
      // e.preventDefault();
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!canUpload) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (!canUpload) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (onFileSelect) {
        onFileSelect(e.dataTransfer.files);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        workspaceDropdownRef.current &&
        !workspaceDropdownRef.current.contains(event.target as Node)
      ) {
        setIsWorkspaceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allModels = (providersList || []).flatMap((provider) =>
    (provider.models || []).map((m: any) => {
      // Find default account for this provider
      const defaultAccount = accounts.find(
        (acc) => acc.provider_id.toLowerCase() === provider.provider_id.toLowerCase(),
      );

      return {
        ...m,
        providerId: provider.provider_id,
        providerName: provider.provider_name || provider.provider_id,
        accountId: defaultAccount?.id,
        favicon: provider.website
          ? `https://www.google.com/s2/favicons?domain=${new URL(provider.website).hostname}&sz=64`
          : null,
      };
    }),
  );

  const filteredModels = allModels.filter(
    (m) =>
      m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.providerName.toLowerCase().includes(modelSearch.toLowerCase()),
  );

  const formatWorkspacePath = (path: string) => {
    if (!path) return '';
    const parts = path.split(/[/\\]/).filter(Boolean);
    if (parts.length <= 5) return path;
    const lastFive = parts.slice(-5).join('/');
    return `../${lastFive}`;
  };

  return (
    <div className={cn('bg-background relative', className)}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
        accept="image/*, .pdf, .txt, .md, .csv, .json"
      />

      <div
        className={cn(
          'max-w-4xl mx-auto px-6 flex flex-col relative w-full',
          !isConversationActive && 'py-4 gap-2',
          innerClassName,
        )}
      >
        {/* Attachments Preview - Outside Main Input Box */}
        <style>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: hsl(var(--muted-foreground) / 0.3);
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: hsl(var(--muted-foreground) / 0.5);
          }
        `}</style>

        {/* Attachments Preview - Outside Main Input Box */}
        {attachments && attachments.length > 0 && (
          <div className="flex gap-2 pb-2 overflow-x-auto custom-scrollbar">
            {attachments.map((att, index) => (
              <div
                key={att.id}
                onClick={() => setPreviewFile(att.file)}
                className={cn(
                  'relative group shrink-0 w-48 h-14 rounded-lg border bg-muted/20 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all flex items-center p-2',
                  att.status === 'error' && 'border-destructive/50 bg-destructive/10',
                )}
              >
                <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-background/50 flex items-center justify-center shadow-sm relative">
                  {att.file.type.startsWith('image/') ? (
                    <img
                      src={att.previewUrl || URL.createObjectURL(att.file)}
                      alt={att.file.name}
                      className={cn(
                        'w-full h-full object-cover',
                        att.status === 'uploading' && 'opacity-50',
                      )}
                    />
                  ) : (
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  )}

                  {att.status === 'uploading' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col min-w-0 flex-1 ml-2">
                  <span
                    className="text-xs font-medium truncate leading-tight"
                    title={att.file.name}
                  >
                    {att.file.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex items-center justify-between">
                    <span>
                      {att.file.size < 1024
                        ? `${att.file.size} B`
                        : att.file.size < 1024 * 1024
                          ? `${(att.file.size / 1024).toFixed(1)} KB`
                          : `${(att.file.size / (1024 * 1024)).toFixed(1)} MB`}
                    </span>
                    {att.status === 'error' && <span className="text-destructive ml-1">Error</span>}
                  </span>
                </div>

                {onRemoveAttachment && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveAttachment(index);
                    }}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  >
                    <span className="sr-only">Remove</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            'relative border-t bg-background transition-all w-full flex flex-col',
            isConversationActive
              ? 'border-t border-l border-r border-border rounded-t-2xl rounded-b-none shadow-none bg-background'
              : 'border rounded-xl shadow-sm focus-within:ring-1 focus-within:ring-ring bg-muted/20',
            'flex flex-col relative w-full h-full min-h-[44px] bg-muted/20 transition-all duration-300 group',
            agentMode && !selectedQuickModel && 'border-dashed border-primary/40 bg-primary/[0.02]',
            selectedQuickModel &&
              'border-blue-500 ring-1 ring-blue-500/20 bg-blue-500/[0.03] shadow-[0_0_20px_rgba(59,130,246,0.15)]',
            isFocused &&
              !selectedQuickModel &&
              'border-primary ring-4 ring-primary/10 bg-background',
            isFocused &&
              selectedQuickModel &&
              'border-blue-500 ring-4 ring-blue-500/20 bg-background shadow-[0_0_25px_rgba(59,130,246,0.2)]',
            disabled && 'opacity-60 cursor-not-allowed',
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isMentionOpen && handleSelectMention && (
            <MentionDropdown
              isOpen={isMentionOpen}
              options={mentionOptions}
              searchTerm={mentionSearch}
              selectedIndex={mentionIndex}
              mode={mentionMode}
              onSelect={handleSelectMention}
            />
          )}
          {/* Quick Model Continuity Banner */}
          {selectedQuickModel && (
            <div className="absolute -top-7 left-2 flex items-center gap-2 px-2.5 py-1 rounded-t-lg border-x border-t border-blue-500/30 bg-blue-500/5 text-[10px] font-bold text-blue-500 animate-in slide-in-from-bottom-2 fade-in">
              <span className="opacity-70 flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                </span>
                Continue with
              </span>
              <div className="flex items-center gap-1.5 px-1 py-0.5">
                {allModels.find((m) => m.id === selectedQuickModel.modelId)?.favicon && (
                  <img
                    src={allModels.find((m) => m.id === selectedQuickModel.modelId)!.favicon!}
                    className="w-3 h-3 object-contain opacity-70 grayscale hover:grayscale-0 transition-all"
                    alt=""
                  />
                )}
                <span className="max-w-[150px] truncate">
                  {allModels.find((m) => m.id === selectedQuickModel.modelId)?.providerName} /{' '}
                  {allModels.find((m) => m.id === selectedQuickModel.modelId)?.name ||
                    selectedQuickModel.modelId}
                </span>
              </div>
            </div>
          )}
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8" />
                <p className="text-sm font-medium">Drop files here</p>
              </div>
            </div>
          )}

          {/* Selected Mentions Badges */}
          {selectedMentions.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
              {selectedMentions.map((mention) => (
                <div
                  key={mention.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs font-medium text-primary animate-in fade-in zoom-in-95"
                >
                  <img
                    src={
                      mention.type === 'Folder'
                        ? getFolderIconPath(false)
                        : getFileIconPath(mention.label)
                    }
                    alt=""
                    className="w-3.5 h-3.5 object-contain"
                  />
                  <span className="max-w-[150px] truncate" title={mention.path}>
                    {mention.label}
                  </span>
                  <button
                    onClick={() => removeMention?.(mention.id)}
                    className="p-0.5 rounded-full hover:bg-primary/20 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled || loading || isStreaming}
            placeholder={placeholder}
            className="w-full min-h-[80px] border-none bg-transparent px-4 py-3 text-base focus:outline-none focus:ring-0 resize-none custom-scrollbar disabled:opacity-50 disabled:cursor-not-allowed"
            rows={1}
          />

          {/* Bottom Actions Bar */}
          <div className="flex justify-between items-center px-4 pb-3">
            <div className="flex gap-2 items-center">
              {canUpload && (
                <button
                  onClick={handleUploadClick}
                  className="px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
                  title="Upload"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload</span>
                </button>
              )}
              {setStreamEnabled && (
                <button
                  onClick={() => setStreamEnabled(!streamEnabled)}
                  className={cn(
                    'px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium rounded-md transition-colors',
                    streamEnabled
                      ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                  title={streamEnabled ? 'Streaming On' : 'Streaming Off'}
                >
                  <Zap className="h-4 w-4" />
                  <span>Stream</span>
                </button>
              )}
              {supportsThinking && _setThinkingEnabled && (
                <button
                  onClick={() => _setThinkingEnabled(!_thinkingEnabled)}
                  className={cn(
                    'px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium rounded-md transition-colors',
                    _thinkingEnabled
                      ? 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                  title={_thinkingEnabled ? 'Thinking Mode On' : 'Thinking Mode Off'}
                >
                  <Bot className="h-4 w-4" />
                  <span>Think</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isConversationActive && setAgentMode && (
                <div className="flex items-center gap-2">
                  {onToggleSettings && (
                    <button
                      onClick={onToggleSettings}
                      className="h-8 px-2 flex items-center gap-1.5 text-xs font-medium rounded-lg bg-muted/30 border border-border/50 text-muted-foreground hover:text-foreground transition-all hover:bg-muted/50"
                      title="Settings"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div className="flex items-center bg-muted/30 rounded-lg p-0.5 border border-border/50">
                    <button
                      onClick={() => setAgentMode(false)}
                      className={cn(
                        'px-2.5 py-1 text-xs font-medium rounded-md transition-all',
                        !agentMode
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Chat
                    </button>
                    <button
                      onClick={() => setAgentMode(true)}
                      className={cn(
                        'px-2.5 py-1 flex items-center gap-1.5 text-xs font-medium rounded-md transition-all',
                        agentMode
                          ? 'bg-background text-primary shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Bot className="h-3.5 w-3.5" />
                      <span>Agent</span>
                    </button>
                  </div>
                </div>
              )}

              {!isConversationActive && agentMode && handleSelectWorkspace && (
                <div className="relative" ref={workspaceDropdownRef}>
                  <button
                    onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
                    className={cn(
                      'h-8 px-3 flex items-center gap-1.5 rounded-lg border transition-all text-xs font-medium max-w-[150px]',
                      selectedWorkspacePath
                        ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                        : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50 hover:text-foreground',
                      isWorkspaceDropdownOpen && 'ring-2 ring-primary/20 border-primary/30',
                    )}
                    title={selectedWorkspacePath || 'Select Workspace'}
                  >
                    <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">
                      {selectedWorkspacePath
                        ? selectedWorkspacePath.split(/[/\\]/).pop()
                        : 'Select Workspace'}
                    </span>
                  </button>

                  {isWorkspaceDropdownOpen && (
                    <div className="absolute bottom-full mb-2 right-0 w-72 bg-popover text-popover-foreground rounded-xl border shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                      <div className="p-1.5 flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {availableWorkspaces.length > 0 ? (
                          <>
                            <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">
                              Saved Workspaces
                            </div>
                            {availableWorkspaces.map((ws: any) => (
                              <div key={ws.id} className="relative group/ws">
                                <button
                                  onClick={() => {
                                    handleQuickSelectWorkspace?.(ws.path);
                                    setIsWorkspaceDropdownOpen(false);
                                  }}
                                  className={cn(
                                    'flex flex-col items-start px-2 py-2 rounded-lg text-left transition-colors w-full',
                                    selectedWorkspacePath === ws.path
                                      ? 'bg-primary/10 text-primary'
                                      : 'hover:bg-muted text-foreground',
                                  )}
                                >
                                  <span className="text-xs font-medium truncate w-full pr-6">
                                    {ws.name}
                                  </span>
                                  <span
                                    className="text-[10px] text-muted-foreground truncate w-full pr-6"
                                    title={ws.path}
                                  >
                                    {formatWorkspacePath(ws.path)}
                                  </span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteWorkspace?.(ws.id);
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-0 group-hover/ws:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                                  title="Remove from saved"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            <div className="h-px bg-border my-1" />
                          </>
                        ) : (
                          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                            No saved workspaces
                          </div>
                        )}
                        <button
                          onClick={() => {
                            handleSelectWorkspace();
                            setIsWorkspaceDropdownOpen(false);
                          }}
                          className="flex items-center gap-2 px-2 py-2.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
                        >
                          <FolderOpen className="h-4 w-4" />
                          <span>Select new folder...</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {agentMode && onQuickModelSelect && (
                <div className="relative" ref={modelDropdownRef}>
                  <button
                    onClick={() => {
                      if (selectedQuickModel) {
                        onQuickModelSelect(null);
                        setIsModelDropdownOpen(false);
                      } else {
                        setIsModelDropdownOpen(!isModelDropdownOpen);
                        if (!isModelDropdownOpen) setModelSearch('');
                      }
                    }}
                    className={cn(
                      'h-8 px-3 flex items-center gap-2 rounded-lg border transition-all text-[11px] font-bold shadow-sm',
                      selectedQuickModel
                        ? 'bg-blue-600/15 text-blue-600 border-blue-500/40 hover:bg-blue-600/25 ring-2 ring-blue-500/10'
                        : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50 hover:text-foreground',
                    )}
                    title={
                      selectedQuickModel
                        ? `Click to deselect: ${selectedQuickModel.providerId} / ${selectedQuickModel.modelId}`
                        : 'Temporary Model Selection'
                    }
                  >
                    <Cpu className="h-3.5 w-3.5 flex-shrink-0" />
                    {selectedQuickModel && (
                      <span className="truncate max-w-[120px]">
                        {allModels.find((m) => m.id === selectedQuickModel.modelId)?.name ||
                          selectedQuickModel.modelId}
                      </span>
                    )}
                  </button>

                  {isModelDropdownOpen && (
                    <div className="absolute bottom-full mb-2 right-0 w-80 bg-dropdown-background text-popover-foreground rounded-xl border border-dropdown-border shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 flex flex-col">
                      <div className="p-2 border-b border-dropdown-border bg-muted/10">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <input
                            autoFocus
                            type="text"
                            placeholder="Search models..."
                            value={modelSearch}
                            onChange={(e) => setModelSearch(e.target.value)}
                            className="w-full bg-background border-dropdown-border border rounded-md py-1.5 pl-8 pr-3 text-xs focus:ring-1 focus:ring-primary outline-none text-foreground placeholder:text-muted-foreground/50"
                          />
                        </div>
                      </div>

                      <div className="max-h-[350px] overflow-y-auto custom-scrollbar p-1 flex flex-col gap-0.5">
                        {selectedQuickModel && (
                          <button
                            onClick={() => {
                              onQuickModelSelect(null);
                              setIsModelDropdownOpen(false);
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <X className="h-4 w-4" />
                            <span>Reset to Default Model</span>
                          </button>
                        )}

                        {filteredModels.length > 0 ? (
                          <>
                            {/* Group by Provider */}
                            {Array.from(new Set(filteredModels.map((m) => m.providerId))).map(
                              (providerId) => (
                                <div key={providerId} className="mb-1">
                                  <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-muted-foreground/50 tracking-widest flex items-center gap-1.5">
                                    {filteredModels.find((m) => m.providerId === providerId)
                                      ?.favicon && (
                                      <img
                                        src={
                                          filteredModels.find((m) => m.providerId === providerId)!
                                            .favicon!
                                        }
                                        className="w-3 h-3 object-contain"
                                        alt=""
                                      />
                                    )}
                                    {
                                      filteredModels.find((m) => m.providerId === providerId)
                                        ?.providerName
                                    }
                                  </div>
                                  {filteredModels
                                    .filter((m) => m.providerId === providerId)
                                    .map((model) => (
                                      <button
                                        key={model.id}
                                        onClick={() => {
                                          onQuickModelSelect({
                                            providerId: model.providerId,
                                            modelId: model.id,
                                            accountId: model.accountId,
                                          });
                                          setIsModelDropdownOpen(false);
                                        }}
                                        className={cn(
                                          'flex items-center justify-between w-full px-3 py-2 rounded-lg text-left transition-colors relative group',
                                          selectedQuickModel?.modelId === model.id
                                            ? 'bg-primary/10 text-primary'
                                            : 'hover:bg-dropdown-itemHover text-foreground',
                                        )}
                                      >
                                        <div className="flex flex-col min-w-0 pr-6">
                                          <span className="text-[11px] font-bold truncate">
                                            {model.name}
                                          </span>
                                          {model.context_length && (
                                            <span className="text-[9px] text-muted-foreground">
                                              Context: {Math.round(model.context_length / 1024)}k
                                            </span>
                                          )}
                                        </div>
                                        {selectedQuickModel?.modelId === model.id && (
                                          <Check className="h-3.5 w-3.5 flex-shrink-0" />
                                        )}
                                      </button>
                                    ))}
                                </div>
                              ),
                            )}
                          </>
                        ) : (
                          <div className="p-4 text-center text-xs text-muted-foreground italic">
                            No models found matching "{modelSearch}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {agentMode && selectedWorkspacePath && onGitCommit && isGitRepo && (
                <GitCommitButton
                  workspacePath={selectedWorkspacePath}
                  onGenerateMessage={onGitCommit}
                  disabled={disabled || loading || isStreaming}
                />
              )}

              {loading || isStreaming ? (
                handleStop && (
                  <button
                    onClick={handleStop}
                    className="h-8 w-8 text-white flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-700 transition-all shadow-lg"
                    title="Stop generating"
                  >
                    <StopCircle className="h-4 w-4" />
                  </button>
                )
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={disabled || !input.trim()}
                  className={cn(
                    'h-8 w-8 flex items-center justify-center rounded-lg transition-all shadow-sm',
                    input.trim()
                      ? 'bg-primary text-primary-foreground hover:scale-105 active:scale-95'
                      : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed',
                  )}
                  title="Send message"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </div>
  );
};
