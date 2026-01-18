import { useState, useRef, useEffect } from 'react';

import { providers as localProvidersConfig } from '../../config/providers';

import { GroqModelSelector } from './components/GroqModelSelector';
import { AntigravityModelSelector } from './components/AntigravityModelSelector';
import { GeminiModelSelector } from './components/GeminiModelSelector';
import { HuggingChatModelSelector } from './components/HuggingChatModelSelector';
import { LMArenaModelSelector } from './components/LMArenaModelSelector';
import { CustomSelect } from './components/CustomSelect';
import { AccountAvatar } from '../accounts/components/AccountAvatar';
import { getStaticModels } from '../../config/static-models';

import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { InputArea } from './components/InputArea';
import { WelcomeScreen } from './components/WelcomeScreen';
import { TabBar } from './components/TabBar';
import { ConversationTab } from './types';
import { usePlaygroundLogic } from './hooks/usePlaygroundLogic';

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
    providersList,
    streamEnabled,
    setStreamEnabled,
  } = usePlaygroundLogic({ activeTab, activeTabId, onUpdateTab });

  // Sidebar Resize State (UI only)
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
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
                    const localConfig = localProvidersConfig.find(
                      (lp) =>
                        lp.id === p.provider_name ||
                        lp.id.toLowerCase() === p.provider_id.toLowerCase(),
                    );
                    return {
                      value: p.provider_name,
                      label: p.provider_name,
                      icon: localConfig?.icon,
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
                    {selectedProvider === 'Groq' && selectedAccount && (
                      <div className="space-y-4">
                        <GroqModelSelector
                          value={groqModel}
                          onChange={setGroqModel}
                          models={groqModelsList}
                        />
                      </div>
                    )}
                    {selectedProvider === 'Antigravity' && selectedAccount && (
                      <AntigravityModelSelector
                        value={antigravityModel}
                        onChange={setAntigravityModel}
                        models={antigravityModelsList}
                      />
                    )}
                    {selectedProvider === 'Gemini' && selectedAccount && (
                      <GeminiModelSelector
                        value={geminiModel}
                        onChange={setGeminiModel}
                        models={geminiModelsList}
                      />
                    )}
                    {selectedProvider === 'HuggingChat' && selectedAccount && (
                      <div className="w-[300px]">
                        <HuggingChatModelSelector
                          value={huggingChatModel}
                          onChange={setHuggingChatModel}
                          models={huggingChatModelsList}
                          placeholder="Select Model"
                          disabled={huggingChatModelsList.length === 0}
                        />
                      </div>
                    )}
                    {selectedProvider === 'LMArena' && selectedAccount && (
                      <div className="w-[300px]">
                        <LMArenaModelSelector
                          value={groqModel}
                          onChange={setGroqModel}
                          models={groqModels}
                          placeholder="Select Model"
                          disabled={groqModels.length === 0}
                        />
                      </div>
                    )}
                    {selectedProvider === 'Claude' && (
                      <CustomSelect
                        value={claudeModel}
                        onChange={setClaudeModel}
                        options={getStaticModels('Claude').map((m) => ({
                          value: m.id,
                          label: m.name,
                        }))}
                        placeholder="Select Claude Model"
                      />
                    )}
                    {selectedProvider === 'DeepSeek' && (
                      <div className="w-[300px]">
                        <CustomSelect
                          value={deepseekModel}
                          onChange={setDeepseekModel}
                          options={getStaticModels('DeepSeek').map((m) => ({
                            value: m.id,
                            label: m.name,
                          }))}
                          placeholder="Select DeepSeek Model"
                        />
                      </div>
                    )}
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
          />
        ) : (
          <>
            <div className="h-14 border-b flex items-center justify-between px-4 bg-background/50 backdrop-blur-sm sticky top-0 z-10">
              <div className="max-w-[200px] text-xs font-medium text-muted-foreground mr-2 flex items-center gap-1 truncate">
                {selectedProvider === 'HuggingChat' && huggingChatModel}
              </div>
              <div className="font-medium truncate flex-1 text-center">
                {conversationTitle || 'New Chat'}
              </div>
              <div className="w-24 text-right text-xs text-muted-foreground mr-2">
                {(tokenCount + accumulatedUsage + inputTokenCount).toLocaleString()} tokens
              </div>
            </div>

            <ChatArea messages={messages} loading={loading} isStreaming={isStreaming} />

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
            />
          </>
        )}
      </div>
    </div>
  );

  if (tabs) {
    return innerContent;
  }

  return (
    <div className="h-full flex flex-col bg-background p-4 gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Playground</h2>
        <p className="text-muted-foreground">Experiment with different AI models.</p>
      </div>
      {innerContent}
    </div>
  );
};

export default PlaygroundPage;
