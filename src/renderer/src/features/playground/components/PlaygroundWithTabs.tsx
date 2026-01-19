import { useState, useEffect, useRef, useCallback } from 'react';
import { ConversationTab } from '../types';
import { createDefaultTab, getTabTitle } from '../utils/tabUtils';
import PlaygroundPage from '../index';

export const PlaygroundWithTabs = () => {
  //  Tab management
  const [tabs, setTabs] = useState<ConversationTab[]>(() => [createDefaultTab()]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id || '');

  const getActiveTab = (): ConversationTab => {
    return tabs.find((t) => t.id === activeTabId) || tabs[0];
  };

  const createNewTab = () => {
    const newTab = createDefaultTab();
    const activeTab = getActiveTab();

    // Inherit ONLY provider/model settings, NOT conversation state
    if (activeTab.selectedProvider && activeTab.selectedAccount) {
      newTab.selectedProvider = activeTab.selectedProvider;
      newTab.selectedAccount = activeTab.selectedAccount;
      newTab.claudeModel = activeTab.claudeModel;
      newTab.groqModel = activeTab.groqModel;
      newTab.antigravityModel = activeTab.antigravityModel;
      newTab.geminiModel = activeTab.geminiModel;
      newTab.huggingChatModel = activeTab.huggingChatModel;
      newTab.deepseekModel = activeTab.deepseekModel;
      newTab.groqSettings = { ...activeTab.groqSettings };
      newTab.thinkingEnabled = activeTab.thinkingEnabled;
      newTab.searchEnabled = activeTab.searchEnabled;
    }

    // Ensure new tab starts fresh with no conversation
    newTab.messages = [];
    newTab.activeChatId = null;
    newTab.conversationTitle = '';
    newTab.title = 'New Chat';

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return;

    const tabIndex = tabs.findIndex((t) => t.id === tabId);
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);

    if (tabId === activeTabId) {
      const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
      setActiveTabId(newTabs[newActiveIndex].id);
    }
  };

  const switchTab = (tabId: string) => {
    setActiveTabId(tabId);
  };

  const handleUpdateTab = useCallback((tabId: string, updates: Partial<ConversationTab>) => {
    setTabs((prevTabs) => prevTabs.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab)));
  }, []);

  const activeTab = getActiveTab();

  // Update tab titles - use ref to prevent infinite loops
  const lastSyncedTitleRef = useRef<{ id: string; title: string }>({ id: '', title: '' });
  useEffect(() => {
    const newTitle = getTabTitle(activeTab);
    // Only update if actually different AND we haven't just synced this exact combo
    if (
      newTitle !== activeTab.title &&
      (lastSyncedTitleRef.current.id !== activeTabId ||
        lastSyncedTitleRef.current.title !== newTitle)
    ) {
      lastSyncedTitleRef.current = { id: activeTabId, title: newTitle };
      setTabs((prevTabs) =>
        prevTabs.map((tab) => (tab.id === activeTabId ? { ...tab, title: newTitle } : tab)),
      );
    }
  }, [activeTab.messages.length, activeTab.conversationTitle, activeTabId, activeTab.title]);

  return (
    <div className="h-full flex flex-col bg-background p-4 gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Playground</h2>
        <p className="text-muted-foreground">Experiment with different AI models.</p>
      </div>

      <div className="flex-1 flex overflow-hidden border border-dashed border-zinc-500/25 rounded-lg">
        <PlaygroundPage
          key={activeTabId}
          tabs={tabs}
          activeTabId={activeTabId}
          onTabClick={switchTab}
          onTabClose={closeTab}
          onNewTab={createNewTab}
          onUpdateTab={handleUpdateTab}
        />
      </div>
    </div>
  );
};
