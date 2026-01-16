import { X, Plus } from 'lucide-react';
import { cn } from '../../../shared/lib/utils';
import { ConversationTab } from '../types';
import claudeIcon from '../../../assets/provider_icons/claude.svg';
import deepseekIcon from '../../../assets/provider_icons/deepseek.svg';
import mistralIcon from '../../../assets/provider_icons/mistral.svg';
import kimiIcon from '../../../assets/provider_icons/kimi.svg';
import qwenIcon from '../../../assets/provider_icons/qwen.svg';
import cohereIcon from '../../../assets/provider_icons/cohere.svg';
import perplexityIcon from '../../../assets/provider_icons/perplexity.svg';
import groqIcon from '../../../assets/provider_icons/groq.svg';
import geminiIcon from '../../../assets/provider_icons/gemini.svg';
import antigravityIcon from '../../../assets/provider_icons/antigravity.svg';
import huggingChatIcon from '../../../assets/provider_icons/huggingface.svg';

interface TabBarProps {
  tabs: ConversationTab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
}

const getProviderIcon = (provider: string) => {
  const icons: Record<string, string> = {
    Claude: claudeIcon,
    DeepSeek: deepseekIcon,
    Mistral: mistralIcon,
    Kimi: kimiIcon,
    Qwen: qwenIcon,
    Cohere: cohereIcon,
    Perplexity: perplexityIcon,
    Groq: groqIcon,
    Gemini: geminiIcon,
    Antigravity: antigravityIcon,
    HuggingChat: huggingChatIcon,
  };
  return icons[provider];
};

export const TabBar = ({ tabs, activeTabId, onTabClick, onTabClose, onNewTab }: TabBarProps) => {
  return (
    <div className="flex items-center bg-muted/30 border-b overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onTabClick(tab.id)}
          className={cn(
            'group flex items-center gap-1.5 px-3 py-2 cursor-pointer select-none transition-all min-w-[120px] max-w-[200px] border-r border-border/50',
            activeTabId === tab.id
              ? 'bg-background text-foreground'
              : 'bg-transparent text-muted-foreground hover:bg-muted/50',
          )}
        >
          {tab.selectedProvider && (
            <img
              src={getProviderIcon(tab.selectedProvider)}
              alt={tab.selectedProvider}
              className="w-4 h-4 shrink-0"
            />
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
        className="shrink-0 px-3 py-2 hover:bg-muted transition-colors border-r border-border/50"
        title="New Tab"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
};
