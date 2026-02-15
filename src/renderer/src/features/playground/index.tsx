import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModelSelector } from './components/ModelSelector';
import { CustomSelect } from './components/CustomSelect';
import { AccountAvatar } from '../accounts/components/AccountAvatar';

import { Sidebar } from './components/Sidebar';
import { AgentHistorySidebar } from './components/AgentHistorySidebar';
import { ChatArea } from './components/ChatArea';
import { InputArea } from './components/InputArea';
import { WelcomeScreen } from './components/WelcomeScreen';
import { TabBar } from './components/TabBar';
import { SettingsSidebar } from './components/SettingsSidebar';
import { ConversationTab } from './types';
import { usePlaygroundLogic } from './hooks/usePlaygroundLogic';
import { useUI } from '../../core/contexts/UIContext';
import { FileTreeView } from './components/FileTreeView';
import { FilePreviewPanel } from './components/FilePreviewPanel';
import { useGitStatus } from './hooks/useGitStatus';
import { COMMIT_MESSAGE_PROMPT } from './prompts/commit_message';
import { toast } from 'sonner';

export const PlaygroundPage = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onNewTab,
  onUpdateTab,
}: {
  tabs?: ConversationTab[];
  activeTabId?: string;
  onTabClick?: (id: string) => void;
  onTabClose?: (id: string) => void;
  onNewTab?: () => void;
  onUpdateTab?: (id: string, data: Partial<ConversationTab>) => void;
} = {}) => {
  const navigate = useNavigate();
  const activeTab = tabs?.find((t) => t.id === activeTabId);

  const {
    messages,
    input,
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
    providerModels,
    setProviderModels,
    providerModelsList,
    groqSettings,
    setGroqSettings,
    handleInput,
    handleKeyDown,
    handleSend,
    handleStop,
    startNewChat,
    providersList,
    streamEnabled,
    setStreamEnabled,
    agentMode,
    setAgentMode,
    selectedWorkspacePath,
    handleSelectWorkspace,
    handleQuickSelectWorkspace,
    temperature,
    setTemperature,
    availableWorkspaces,
    contextFiles,
    isLoadingContext,
    handleUpdateContextFile,
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
    removeMention,
    handleSelectMention,
  } = usePlaygroundLogic({ activeTab, activeTabId, onUpdateTab });

  const { setIsMainSidebarCollapsed } = useUI();

  // Auto-collapse main sidebar when entering Agent Mode
  useEffect(() => {
    if (agentMode) {
      setIsMainSidebarCollapsed(true);
    }
  }, [agentMode, setIsMainSidebarCollapsed]);

  // Sidebar Resize State (UI only)
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [treeViewWidth, setTreeViewWidth] = useState(240);
  const [previewPanelWidth, setPreviewPanelWidth] = useState(600);
  const [isResizing, setIsResizing] = useState<'sidebar' | 'treeview' | 'preview' | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const treeViewRef = useRef<HTMLDivElement>(null);
  const previewPanelRef = useRef<HTMLDivElement>(null);

  // Git Status
  const { gitStatus, diffStats } = useGitStatus(selectedWorkspacePath);
  const [generatedCommitMessage, setGeneratedCommitMessage] = useState<string | null>(null);
  const [isPushing, setIsPushing] = useState(false);

  // Extract commit msg when assistant responds
  useEffect(() => {
    if (messages.length > 0 && !isStreaming) {
      const lastMsg = messages[messages.length - 1];
      const prevMsg = messages.length > 1 ? messages[messages.length - 2] : null;

      if (
        lastMsg.role === 'assistant' &&
        prevMsg?.role === 'user' &&
        prevMsg.content.includes(COMMIT_MESSAGE_PROMPT)
      ) {
        // Find markdown code block
        const match = lastMsg.content.match(/```(?:[a-zA-Z]*)?\n([\s\S]*?)\n```/);
        if (match) {
          setGeneratedCommitMessage(match[1].trim());
        }
      }
    }
  }, [messages, isStreaming]);

  // Reset preview state when workspace changes
  useEffect(() => {
    if (selectedWorkspacePath) {
      console.log('[Playground] Workspace changed, resetting preview state');
      setPreviewFiles({});
      setActivePreviewFile(null);
      setGeneratedCommitMessage(null);
    }
  }, [selectedWorkspacePath]);

  const handleGitPush = async (message: string) => {
    if (!selectedWorkspacePath) return;
    setIsPushing(true);
    try {
      toast.loading('Committing and pushing...', { id: 'git-push' });
      await window.api.git.commit(selectedWorkspacePath, message);
      await window.api.git.push(selectedWorkspacePath);
      toast.success('Successfully pushed changes!', { id: 'git-push' });
      setGeneratedCommitMessage(null);
    } catch (error: any) {
      console.error('Git Push failed:', error);
      toast.error('Push Error', {
        id: 'git-push',
        description: error.message || 'Failed to push changes.',
      });
    } finally {
      setIsPushing(false);
    }
  };

  const startResizingSidebar = (e: React.MouseEvent) => {
    setIsResizing('sidebar');
    e.preventDefault();
  };

  const startResizingTreeView = (e: React.MouseEvent) => {
    setIsResizing('treeview');
    e.preventDefault();
  };

  const startResizingPreview = (e: React.MouseEvent) => {
    setIsResizing('preview');
    e.preventDefault();
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

  const handleOpenPreviewFile = async (file: any) => {
    if (file.isDirectory) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const correctLanguage = LANGUAGE_MAP[ext] || ext || 'text';

    if (previewFiles[file.path]) {
      console.log('[Playground] File already open, switching tab:', file.path);
      // Fix persisted language if it's wrong (e.g. 'py' instead of 'python')
      if (previewFiles[file.path].language !== correctLanguage) {
        setPreviewFiles((prev: any) => ({
          ...prev,
          [file.path]: { ...prev[file.path], language: correctLanguage },
        }));
      }
      setActivePreviewFile(file.path);
      return;
    }

    console.log('[Playground] Opening new file:', file.path);

    try {
      const fullPath = `${selectedWorkspacePath}/${file.path}`;

      const content = await window.api.commands.readFile(fullPath);
      const newFile = {
        path: file.path,
        name: file.name,
        content,
        language: correctLanguage,
      };

      setPreviewFiles((prev: any) => ({ ...prev, [file.path]: newFile }));
      setActivePreviewFile(file.path);
    } catch (error) {
      console.error('Failed to read file:', error);
      toast.error('Failed to read file content');
    }
  };

  const handleClosePreviewTab = (path: string) => {
    const filePaths = Object.keys(previewFiles);
    const currentIndex = filePaths.indexOf(path);

    if (activePreviewFile === path) {
      if (filePaths.length > 1) {
        const nextPath = filePaths[currentIndex + 1] || filePaths[currentIndex - 1];
        setActivePreviewFile(nextPath);
      } else {
        setActivePreviewFile(null);
      }
    }

    setPreviewFiles((prev: any) => {
      const newFiles = { ...prev };
      delete newFiles[path];
      return newFiles;
    });
  };

  const handleGitCommit = async () => {
    if (!selectedWorkspacePath) return;

    try {
      toast.loading('Preparing Git changes...', { id: 'git-commit' });

      // 1. Git Add .
      await window.api.git.add(selectedWorkspacePath, ['.']);

      // 2. Get staged diff
      const diff = await window.api.git.diff(selectedWorkspacePath, true);

      if (!diff) {
        toast.error('No changes to commit', { id: 'git-commit' });
        return;
      }

      // 3. Prepare AI Prompt
      const fullPrompt = `${COMMIT_MESSAGE_PROMPT}\n\nHere are the staged changes:\n\`\`\`diff\n${diff}\n\`\`\``;

      // 4. Start New Chat & Send
      startNewChat();

      // We need a small delay or use a more robust way to ensure startNewChat finished state updates
      // However, handleSend usually uses the current state.
      // In usePlaygroundLogic, handleSend uses messages from state.
      // Since startNewChat is sync (it just sets state), we can call handleSend.
      setTimeout(() => {
        handleSend(fullPrompt);
        toast.success('Generating commit message...', { id: 'git-commit' });
      }, 0);
    } catch (error: any) {
      console.error('Git Commit Automation failed:', error);
      toast.error('Git Error', {
        id: 'git-commit',
        description: error.message || 'Failed to automate git commit.',
      });
    }
  };

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing === 'sidebar' && sidebarRef.current) {
        const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
        if (newWidth > 150 && newWidth < 600) {
          setSidebarWidth(newWidth);
        }
      } else if (isResizing === 'treeview' && treeViewRef.current) {
        const newWidth = e.clientX - treeViewRef.current.getBoundingClientRect().left;
        if (newWidth > 150 && newWidth < 600) {
          setTreeViewWidth(newWidth);
        }
      } else if (isResizing === 'preview' && previewPanelRef.current) {
        const newWidth = e.clientX - previewPanelRef.current.getBoundingClientRect().left;
        if (newWidth > 300 && newWidth < 1200) {
          setPreviewPanelWidth(newWidth);
        }
      }
    };
    const handleMouseUp = () => {
      setIsResizing(null);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleFileContentChange = (path: string, content: string) => {
    setPreviewFiles((prev: any) => ({
      ...prev,
      [path]: { ...prev[path], content },
    }));
    // Auto-save to disk
    if (selectedWorkspacePath) {
      const fullPath = `${selectedWorkspacePath}/${path}`;
      window.api.commands.writeFile(fullPath, content).catch((err: any) => {
        console.error('Failed to save file:', err);
      });
    }
  };

  const handleUpdateCommitMessage = (message: string) => {
    setGeneratedCommitMessage(message);
  };

  const filteredAccounts = selectedProvider
    ? accounts.filter((acc) => acc.provider_id.toLowerCase() === selectedProvider.toLowerCase())
    : [];

  const account = accounts.find((a) => a.id === selectedAccount);

  // Layout Logic
  const innerContent = (
    <div className="flex-1 flex overflow-hidden relative">
      {/* Left Sidebar - Conditional rendering based on mode and message state */}
      {agentMode && messages.length === 0 ? (
        /* Agent Mode + Welcome Screen: Show Agent History Sidebar */
        <div ref={sidebarRef} className="relative flex-shrink-0" style={{ width: sidebarWidth }}>
          <div className="h-full overflow-y-auto border-r bg-card/30 w-full">
            <AgentHistorySidebar
              width={sidebarWidth}
              currentWorkspaceId={currentWorkspaceId || undefined}
              onSelectSession={(session) => {
                // TODO: Load selected agent session
                console.log('Selected session:', session);
              }}
            />
          </div>
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-primary/10 hover:bg-primary/50 transition-colors z-10"
            onMouseDown={startResizingSidebar}
          />
        </div>
      ) : agentMode && (taskProgress.current || taskProgress.history.length > 0) ? (
        /* Agent Mode + Active Task: Show Task Sidebar */
        <div ref={sidebarRef} className="relative flex-shrink-0" style={{ width: sidebarWidth }}>
          <Sidebar
            sidebarWidth={sidebarWidth}
            selectedProvider={selectedProvider}
            providersList={providersList}
            startNewChat={startNewChat}
            activeChatId={activeChatId}
            account={account}
            groqSettings={groqSettings}
            setGroqSettings={setGroqSettings}
            taskProgress={taskProgress}
          />
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-primary/10 hover:bg-primary/50 transition-colors z-10"
            onMouseDown={startResizingSidebar}
          />
        </div>
      ) : null}

      {/* Workspace TreeView Sidebar (Agent Mode only) */}
      {/* Workspace TreeView Sidebar (Agent Mode only) */}
      {agentMode && selectedWorkspacePath && (
        <div ref={treeViewRef} className="relative flex-shrink-0" style={{ width: treeViewWidth }}>
          <FileTreeView
            workspacePath={selectedWorkspacePath}
            className="h-full"
            gitStatus={gitStatus}
            diffStats={diffStats}
            onFileSelect={handleOpenPreviewFile}
          />
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-primary/10 hover:bg-primary/50 transition-colors z-10"
            onMouseDown={startResizingTreeView}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        {tabs && onTabClick && onTabClose && onNewTab && (
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId || ''}
            onTabClick={onTabClick}
            onTabClose={onTabClose}
            onNewTab={onNewTab}
            providersList={providersList}
          />
        )}

        <div className="flex-1 flex overflow-hidden relative">
          {/* File Preview Panel (Agent Mode only) */}
          {agentMode && activePreviewFile && (
            <div
              ref={previewPanelRef}
              className="relative flex-shrink-0 border-r"
              style={{ width: previewPanelWidth }}
            >
              <FilePreviewPanel
                files={previewFiles}
                activeFilePath={activePreviewFile}
                onCloseTab={handleClosePreviewTab}
                onSetActiveTab={setActivePreviewFile}
                width={previewPanelWidth}
                commitMessage={generatedCommitMessage}
                onPush={handleGitPush}
                isPushing={isPushing}
                onFileContentChange={handleFileContentChange}
                onCommitMessageChange={handleUpdateCommitMessage}
              />
              <div
                className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-primary/10 hover:bg-primary/50 transition-colors z-10"
                onMouseDown={startResizingPreview}
              />
            </div>
          )}

          <div className="flex-1 flex flex-col min-w-0 bg-background relative">
            {messages.length === 0 ? (
              <WelcomeScreen
                dropdowns={
                  <div className="flex flex-wrap gap-4">
                    <CustomSelect
                      value={selectedProvider}
                      onChange={(val) => {
                        setSelectedProvider(val as any);
                        const providerAccounts = accounts.filter((acc) => acc.provider_id === val);
                        if (providerAccounts.length > 0) {
                          setSelectedAccount(providerAccounts[0].id);
                        } else {
                          setSelectedAccount('');
                        }
                      }}
                      options={providersList.map((p) => {
                        return {
                          value: p.provider_name,
                          label: p.provider_name,
                          icon: p.website
                            ? `https://www.google.com/s2/favicons?domain=${new URL(p.website).hostname}&sz=64`
                            : undefined,
                          disabled: !p.is_enabled,
                        };
                      })}
                      placeholder="Select Provider"
                    />
                    {selectedProvider && (
                      <div className="flex flex-row items-center gap-4">
                        <CustomSelect
                          value={selectedAccount}
                          onChange={setSelectedAccount}
                          options={filteredAccounts.map((acc) => ({
                            value: acc.id,
                            label: acc.email,
                            icon: (
                              <AccountAvatar
                                email={acc.email}
                                provider={acc.provider_id}
                                className="w-4 h-4 text-[8px]"
                              />
                            ),
                          }))}
                          placeholder={
                            filteredAccounts.length === 0 ? 'No account' : 'Select Account'
                          }
                          disabled={!selectedProvider || filteredAccounts.length === 0}
                        />
                        {(() => {
                          const providerKey = selectedProvider.toLowerCase();
                          const models = providerModelsList[providerKey] || [];
                          const selectedModel = providerModels[providerKey] || '';

                          const setModel = (val: string) => {
                            setProviderModels((prev) => ({ ...prev, [providerKey]: val }));
                          };

                          if (models.length > 0) {
                            return (
                              <ModelSelector
                                value={selectedModel}
                                onChange={setModel}
                                models={models}
                                placeholder={`Select ${selectedProvider} Model`}
                              />
                            );
                          }

                          return null;
                        })()}
                      </div>
                    )}
                  </div>
                }
                input={input}
                handleInput={handleInput}
                handleKeyDown={handleKeyDown}
                handleSend={handleSend}
                loading={loading}
                isStreaming={isStreaming}
                selectedAccount={selectedAccount}
                selectedProvider={selectedProvider}
                thinkingEnabled={thinkingEnabled}
                setThinkingEnabled={setThinkingEnabled}
                searchEnabled={searchEnabled}
                setSearchEnabled={setSearchEnabled}
                onFileSelect={handleFileSelect}
                attachments={attachments}
                onRemoveAttachment={handleRemoveAttachment}
                streamEnabled={streamEnabled}
                setStreamEnabled={setStreamEnabled}
                supportsSearch={
                  providersList.find(
                    (p) =>
                      p.provider_id === selectedProvider || p.provider_name === selectedProvider,
                  )?.is_search
                }
                supportsUpload={
                  providersList.find(
                    (p) =>
                      p.provider_id === selectedProvider || p.provider_name === selectedProvider,
                  )?.is_upload
                }
                supportsThinking={(() => {
                  const providerKey = selectedProvider.toLowerCase();
                  const models = providerModelsList[providerKey] || [];
                  const selectedModelId = providerModels[providerKey];
                  if (models && selectedModelId) {
                    const model = models.find((m) => m.id === selectedModelId);
                    return model?.is_thinking === true;
                  }
                  return false;
                })()}
                agentMode={agentMode}
                setAgentMode={setAgentMode}
                selectedWorkspacePath={selectedWorkspacePath}
                handleSelectWorkspace={handleSelectWorkspace}
                handleQuickSelectWorkspace={handleQuickSelectWorkspace}
                availableWorkspaces={availableWorkspaces}
                temperature={temperature}
                setTemperature={setTemperature}
                isTemperatureSupported={
                  providersList.find(
                    (p) =>
                      p.provider_id === selectedProvider || p.provider_name === selectedProvider,
                  )?.is_temperature
                }
                onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
                onNavigateToSettings={() => navigate('/settings')}
                isMentionOpen={isMentionOpen}
                setIsMentionOpen={setIsMentionOpen}
                mentionSearch={mentionSearch}
                mentionMode={mentionMode}
                mentionOptions={mentionOptions}
                handleSelectMention={handleSelectMention}
                selectedMentions={selectedMentions}
                removeMention={removeMention}
              />
            ) : (
              <>
                <div className="h-9 border-b flex items-center justify-between px-4 bg-background/50 backdrop-blur-sm sticky top-0 z-10">
                  <div className="flex items-center gap-2 max-w-[300px] truncate">
                    {(() => {
                      const providerData = providersList.find(
                        (p) =>
                          p.provider_name.toLowerCase() === selectedProvider?.toLowerCase() ||
                          p.provider_id?.toLowerCase() === selectedProvider?.toLowerCase(),
                      );
                      const faviconUrl = providerData?.website
                        ? `https://www.google.com/s2/favicons?domain=${new URL(providerData.website).hostname}&sz=64`
                        : null;
                      const modelName = providerModels[selectedProvider?.toLowerCase()] || '';

                      return (
                        <>
                          {faviconUrl && (
                            <img
                              src={faviconUrl}
                              alt="Provider"
                              className="w-3.5 h-3.5 object-contain"
                            />
                          )}
                          <span className="text-[10px] font-bold text-foreground/80 tracking-tight uppercase">
                            {selectedProvider}
                          </span>
                          <span className="text-[10px] text-muted-foreground mx-1">•</span>
                          <span className="text-[10px] font-medium text-muted-foreground truncate">
                            {modelName}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="text-sm font-semibold truncate flex-1 text-center flex items-center justify-center gap-2">
                    {conversationTitle || 'New Chat'}
                    {activeChatId && activeChatId !== 'new-session' && (
                      <span className="text-[9px] font-mono text-muted-foreground bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded uppercase">
                        #{activeChatId.substring(0, 8)}
                      </span>
                    )}
                  </div>
                  <div className="w-24 text-right text-[10px] text-muted-foreground mr-2 font-mono">
                    {(tokenCount + accumulatedUsage + inputTokenCount).toLocaleString()} tokens
                  </div>
                </div>

                <ChatArea
                  messages={messages}
                  loading={loading}
                  isStreaming={isStreaming}
                  agentMode={agentMode}
                  workspacePath={selectedWorkspacePath}
                />

                <InputArea
                  input={input}
                  handleInput={handleInput}
                  handleKeyDown={handleKeyDown}
                  handleSend={handleSend}
                  handleStop={handleStop}
                  loading={loading}
                  isStreaming={isStreaming}
                  selectedAccount={selectedAccount}
                  selectedProvider={selectedProvider}
                  thinkingEnabled={thinkingEnabled}
                  setThinkingEnabled={setThinkingEnabled}
                  searchEnabled={searchEnabled}
                  setSearchEnabled={setSearchEnabled}
                  onFileSelect={handleFileSelect}
                  attachments={attachments}
                  onRemoveAttachment={handleRemoveAttachment}
                  streamEnabled={streamEnabled}
                  setStreamEnabled={setStreamEnabled}
                  supportsSearch={
                    providersList.find(
                      (p) =>
                        p.provider_id === selectedProvider || p.provider_name === selectedProvider,
                    )?.is_search
                  }
                  supportsUpload={
                    providersList.find(
                      (p) =>
                        p.provider_id === selectedProvider || p.provider_name === selectedProvider,
                    )?.is_upload
                  }
                  supportsThinking={(() => {
                    const providerKey = selectedProvider.toLowerCase();
                    const models = providerModelsList[providerKey] || [];
                    const selectedModelId = providerModels[providerKey];
                    if (models && selectedModelId) {
                      const model = models.find((m) => m.id === selectedModelId);
                      return model?.is_thinking === true;
                    }
                    return false;
                  })()}
                  agentMode={agentMode}
                  setAgentMode={setAgentMode}
                  selectedWorkspacePath={selectedWorkspacePath}
                  handleSelectWorkspace={handleSelectWorkspace}
                  handleQuickSelectWorkspace={handleQuickSelectWorkspace}
                  availableWorkspaces={availableWorkspaces}
                  isConversationActive={messages.length > 0}
                  temperature={temperature}
                  setTemperature={setTemperature}
                  isTemperatureSupported={
                    providersList.find(
                      (p) =>
                        p.provider_id === selectedProvider || p.provider_name === selectedProvider,
                    )?.is_temperature
                  }
                  onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
                  onGitCommit={handleGitCommit}
                  isGitRepo={gitStatus.isRepo}
                  selectedQuickModel={selectedQuickModel}
                  onQuickModelSelect={setSelectedQuickModel}
                  providersList={providersList}
                  accounts={accounts}
                  isMentionOpen={isMentionOpen}
                  setIsMentionOpen={setIsMentionOpen}
                  mentionSearch={mentionSearch}
                  mentionMode={mentionMode}
                  mentionOptions={mentionOptions}
                  handleSelectMention={handleSelectMention}
                  selectedMentions={selectedMentions}
                  removeMention={removeMention}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Settings Sidebar (Right) */}
      <SettingsSidebar
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        temperature={temperature ?? 0.7}
        setTemperature={setTemperature}
        isTemperatureSupported={
          providersList.find(
            (p) => p.provider_id === selectedProvider || p.provider_name === selectedProvider,
          )?.is_temperature
        }
        contextFiles={contextFiles}
        isLoadingContext={isLoadingContext}
        onUpdateContextFile={handleUpdateContextFile}
        selectedWorkspacePath={selectedWorkspacePath}
      />
    </div>
  );

  if (tabs) {
    return <div className="flex-1 flex flex-col min-w-0">{innerContent}</div>;
  }

  return <div className="h-full flex flex-col bg-background">{innerContent}</div>;
};

export default PlaygroundPage;
