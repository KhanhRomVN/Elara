import { useRef, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { ConversationTab } from '../types';
interface TabBarProps {
  tabs: ConversationTab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  providersList?: any[];
}

export const TabBar = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onNewTab,
  providersList = [],
}: TabBarProps) => {
  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (activeTabId && tabRefs.current[activeTabId]) {
      tabRefs.current[activeTabId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeTabId]);

  return (
    <div className="flex items-center h-12 bg-card/30 border-b overflow-x-auto no-scrollbar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          ref={(el) => (tabRefs.current[tab.id] = el)}
          onClick={() => onTabClick(tab.id)}
          className={cn(
            'group flex items-center gap-1.5 px-3 h-full cursor-pointer select-none transition-all min-w-[120px] max-w-[200px] border-r border-border/50',
            activeTabId === tab.id
              ? 'bg-background text-foreground border-t border-t-primary'
              : 'bg-transparent text-muted-foreground hover:bg-muted/50 border-t border-t-transparent',
          )}
        >
          {tab.selectedProvider && (
            <div className="w-4 h-4 shrink-0 flex items-center justify-center">
              {(() => {
                const provider = providersList.find(
                  (p) =>
                    p.provider_name === tab.selectedProvider ||
                    (p.provider_id || '').toLowerCase() ===
                      (tab.selectedProvider || '').toLowerCase(),
                );
                return provider?.icon ? (
                  <img src={provider.icon} alt={tab.selectedProvider} className="w-4 h-4" />
                ) : null;
              })()}
            </div>
          )}
          <span className="text-sm truncate flex-1">{tab.title || 'New Chat'}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id);
            }}
            className={cn(
              'shrink-0 rounded-sm hover:bg-muted p-0.5 transition-opacity',
              activeTabId === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
            disabled={tabs.length === 1}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <button
        onClick={onNewTab}
        className="shrink-0 px-3 h-full hover:bg-muted transition-colors border-r border-border/50"
        title="New Tab"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
};
