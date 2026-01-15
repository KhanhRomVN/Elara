import { Plus, User, MoreHorizontal } from 'lucide-react';
import { Account, HistoryItem, Provider } from '../types';
import claudeIcon from '../../../assets/provider_icons/claude.svg';
import deepseekIcon from '../../../assets/provider_icons/deepseek.svg';

import mistralIcon from '../../../assets/provider_icons/mistral.svg';
import kimiIcon from '../../../assets/provider_icons/kimi.svg';
import qwenIcon from '../../../assets/provider_icons/qwen.svg';
import cohereIcon from '../../../assets/provider_icons/cohere.svg';
import groqIcon from '../../../assets/provider_icons/groq.svg';
import { GroqSidebarSettings } from './GroqSidebarSettings';

interface SidebarProps {
  sidebarWidth: number;
  selectedProvider: Provider | string;
  startNewChat: () => void;
  history: HistoryItem[];
  activeChatId: string | null;
  loadConversation: (id: string) => void;
  account: Account | null;
  groqSettings: any;
  setGroqSettings: (settings: any) => void;
}

export const Sidebar = ({
  sidebarWidth,
  selectedProvider,
  startNewChat,
  history,
  activeChatId,
  loadConversation,
  account,
  groqSettings,
  setGroqSettings,
}: SidebarProps) => {
  return (
    <div
      className="flex flex-col h-full border-r bg-muted/10 shrink-0"
      style={{ width: sidebarWidth }}
    >
      <div className="flex flex-col h-full p-4 gap-4 overflow-hidden">
        {/* Top Sidebar: Provider Icon */}
        <div className="flex items-center gap-2 px-2 pb-4 border-b shrink-0">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-background border shadow-sm">
            <img
              src={
                selectedProvider === 'Claude'
                  ? claudeIcon
                  : selectedProvider === 'Mistral'
                    ? mistralIcon
                    : selectedProvider === 'Kimi'
                      ? kimiIcon
                      : selectedProvider === 'Qwen'
                        ? qwenIcon
                        : selectedProvider === 'Cohere'
                          ? cohereIcon
                          : selectedProvider === 'Groq'
                            ? groqIcon
                            : deepseekIcon
              }
              alt="Provider"
              className="w-5 h-5"
            />
          </div>
          <span className="font-bold text-lg">{selectedProvider || 'P'}</span>
        </div>

        <button
          onClick={startNewChat}
          className="flex items-center gap-2 w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4 text-white" />
          <span className="font-medium text-white">New Chat</span>
        </button>

        {selectedProvider === 'Groq' ? (
          <GroqSidebarSettings settings={groqSettings} onSettingsChange={setGroqSettings} />
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 py-2">Recents</p>
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => loadConversation(item.id)}
                className={`w-full text-left px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground text-sm truncate transition-colors flex items-center gap-2 ${
                  activeChatId === item.id ? 'bg-accent' : ''
                }`}
              >
                <span className="truncate">{item.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* User Info (Bottom Sidebar) */}
        <div className="mt-auto border-t pt-4 flex items-center gap-3 shrink-0">
          {account ? (
            <>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {account.picture ? (
                  <img src={account.picture} className="w-full h-full object-cover" />
                ) : (
                  <User className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{account.name || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{account.email}</p>
              </div>
            </>
          ) : (
            <>
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-muted-foreground">No Account</p>
              </div>
            </>
          )}
          <button className="text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
