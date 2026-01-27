import { useState, useRef, useEffect } from 'react';
import { AnimatedPage } from '../../shared/components/AnimatedPage';
import { useNavigate } from 'react-router-dom';
import { ModelSelector } from './components/ModelSelector';
import { CustomSelect } from './components/CustomSelect';
import { AccountAvatar } from '../accounts/components/AccountAvatar';

import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { InputArea } from './components/InputArea';
import { WelcomeScreen } from './components/WelcomeScreen';
import { TabBar } from './components/TabBar';
import { SettingsSidebar } from './components/SettingsSidebar';
import { ConversationTab } from './types';
import { usePlaygroundLogic } from './hooks/usePlaygroundLogic';
import { LanguageSelector } from './components/LanguageSelector';

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
    history,
    handleSend,
    handleStop,
    handleInput,
    handleKeyDown,
    startNewChat,
    loadConversation,
    providersList,
    streamEnabled,
    setStreamEnabled,
    agentMode,
    setAgentMode,
    selectedWorkspacePath,
    handleSelectWorkspace,
    recentWorkspaces,
    handleQuickSelectWorkspace,
    temperature,
    setTemperature,
    indexingEnabled,
    setIndexingEnabled,
    language,
    setLanguage,
    indexingStatus,
    handleStartIndexing,
  } = usePlaygroundLogic({ activeTab, activeTabId, onUpdateTab });

  // Sidebar Resize State (UI only)
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (sidebarRef.current) {
        const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
        if (newWidth > 150 && newWidth < 600) {
          setSidebarWidth(newWidth);
        }
      }
    };
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const filteredAccounts = selectedProvider
    ? accounts.filter((acc) => acc.provider_id.toLowerCase() === selectedProvider.toLowerCase())
    : [];

  const account = accounts.find((a) => a.id === selectedAccount);

  // Layout Logic
  const innerContent = (
    <div className="flex-1 flex overflow-hidden border border-dashed border-zinc-500/25 rounded-lg relative">
      {/* Sidebar */}
      <div ref={sidebarRef} className="relative flex-shrink-0" style={{ width: sidebarWidth }}>
        <div className="h-full overflow-y-auto border-r bg-muted/10 w-full">
          <Sidebar
            sidebarWidth={sidebarWidth}
            selectedProvider={selectedProvider}
            providersList={providersList}
            history={history}
            activeChatId={activeChatId}
            startNewChat={startNewChat}
            loadConversation={loadConversation}
            account={account || null}
            groqSettings={groqSettings}
            setGroqSettings={setGroqSettings}
          />
        </div>
        {/* Resizer Handle */}
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-10"
          onMouseDown={startResizing}
        />
      </div>

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
                      placeholder={filteredAccounts.length === 0 ? 'No account' : 'Select Account'}
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
                (p) => p.provider_id === selectedProvider || p.provider_name === selectedProvider,
              )?.is_search
            }
            supportsUpload={
              providersList.find(
                (p) => p.provider_id === selectedProvider || p.provider_name === selectedProvider,
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
            recentWorkspaces={recentWorkspaces}
            handleQuickSelectWorkspace={handleQuickSelectWorkspace}
            temperature={temperature}
            setTemperature={setTemperature}
            isTemperatureSupported={
              providersList.find(
                (p) => p.provider_id === selectedProvider || p.provider_name === selectedProvider,
              )?.is_temperature
            }
            onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
            indexingEnabled={indexingEnabled}
            setIndexingEnabled={setIndexingEnabled}
            language={language}
            setLanguage={setLanguage}
            indexingStatus={indexingStatus}
            onStartIndexing={handleStartIndexing}
            onNavigateToSettings={() => navigate('/settings')}
          />
        ) : (
          <>
            <div className="h-10 border-b flex items-center justify-between px-4 bg-background/50 backdrop-blur-sm sticky top-0 z-10">
              <div className="max-w-[150px] text-[10px] font-medium text-muted-foreground mr-2 flex items-center gap-1 truncate uppercase tracking-tight">
                {providerModels[selectedProvider.toLowerCase()]}
              </div>
              <div className="text-sm font-semibold truncate flex-1 text-center">
                {conversationTitle || 'New Chat'}
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
                  (p) => p.provider_id === selectedProvider || p.provider_name === selectedProvider,
                )?.is_search
              }
              supportsUpload={
                providersList.find(
                  (p) => p.provider_id === selectedProvider || p.provider_name === selectedProvider,
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
              recentWorkspaces={recentWorkspaces}
              handleQuickSelectWorkspace={handleQuickSelectWorkspace}
              isConversationActive={messages.length > 0}
              temperature={temperature}
              setTemperature={setTemperature}
              isTemperatureSupported={
                providersList.find(
                  (p) => p.provider_id === selectedProvider || p.provider_name === selectedProvider,
                )?.is_temperature
              }
              onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
              indexingEnabled={indexingEnabled}
              setIndexingEnabled={setIndexingEnabled}
              language={language}
              setLanguage={setLanguage}
              indexingStatus={indexingStatus}
              onStartIndexing={handleStartIndexing}
            />
          </>
        )}
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
      />
    </div>
  );

  if (tabs) {
    return (
      <AnimatedPage
        className="flex-1 flex flex-col min-w-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {innerContent}
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="h-full flex flex-col bg-background p-4 gap-4">
      {innerContent}
    </AnimatedPage>
  );
};

export default PlaygroundPage;
