import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ConversationTab } from '../types';
import { createDefaultTab, getTabTitle } from '../utils/tabUtils';
import PlaygroundPage from '../index';

export const PlaygroundWithTabs = () => {
  const location = useLocation();
  const navigate = useNavigate();

  //  Tab management
  const [tabs, setTabs] = useState<ConversationTab[]>(() => {
    try {
      const saved = localStorage.getItem('elara_playground_tabs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load tabs', e);
    }
    return [createDefaultTab()];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const savedId = localStorage.getItem('elara_active_tab_id');
    const firstTabId = tabs[0]?.id || '';
    if (savedId && tabs.some((t) => t.id === savedId)) return savedId;
    return firstTabId;
  });

  // Save tabs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('elara_playground_tabs', JSON.stringify(tabs));
  }, [tabs]);

  // Save activeTabId to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('elara_active_tab_id', activeTabId);
  }, [activeTabId]);

  const getActiveTab = (): ConversationTab => {
    return tabs.find((t) => t.id === activeTabId) || tabs[0];
  };

  useEffect(() => {
    const state = location.state as { providerId?: string; accountId?: string } | null;
    const providerId = state?.providerId;
    const accountId = state?.accountId;

    if (providerId && accountId) {
      // Create a NEW tab to ensure checking "Run HTTPS" opens a fresh context with correct settings
      // This avoids issues with component state not syncing on existing tab updates
      const newTab = createDefaultTab();
      newTab.selectedProvider = providerId;
      newTab.selectedAccount = accountId;

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);

      // Clear state to prevent re-triggering
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  const createNewTab = () => {
    const newTab = createDefaultTab();
    const activeTab = getActiveTab();

    // Inherit ONLY provider/model settings, NOT conversation state
    if (activeTab.selectedProvider && activeTab.selectedAccount) {
      newTab.selectedProvider = activeTab.selectedProvider;
      newTab.selectedAccount = activeTab.selectedAccount;
      newTab.providerModels = { ...activeTab.providerModels };
      newTab.providerModelsList = { ...activeTab.providerModelsList };
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
    setTabs((prevTabs) => {
      const nextTabs = prevTabs.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab));
      localStorage.setItem('elara_playground_tabs', JSON.stringify(nextTabs));
      return nextTabs;
    });
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
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 flex overflow-hidden">
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
