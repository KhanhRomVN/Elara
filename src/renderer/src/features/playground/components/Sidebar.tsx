import { Plus, User } from 'lucide-react';
import { Account, HistoryItem, Provider } from '../types';
import { getFaviconUrl } from '../../../config/providers';
import { GroqSidebarSettings } from './GroqSidebarSettings';
import { AccountAvatar } from '../../accounts/components/AccountAvatar';

interface SidebarProps {
  sidebarWidth: number;
  selectedProvider: Provider | string;
  providersList?: any[];
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
  providersList = [],
  startNewChat,
  history,
  activeChatId,
  loadConversation,
  account,
  groqSettings,
  setGroqSettings,
}: SidebarProps) => {
  const providerData = providersList.find(
    (p) =>
      p.provider_name === selectedProvider ||
      (p.provider_id || '').toLowerCase() === (selectedProvider || '').toString().toLowerCase(),
  );

  const faviconUrl = providerData?.website ? getFaviconUrl(providerData.website) : null;

  return (
    <div
      className="flex flex-col h-full border-r bg-muted/10 shrink-0"
      style={{ width: sidebarWidth }}
    >
      <div className="flex flex-col h-full gap-4 overflow-hidden overflow-x-hidden">
        {/* Top Sidebar: Provider Icon */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-4 border-b shrink-0 h-20">
          {selectedProvider && faviconUrl && (
            <div className="w-8 h-8 flex items-center justify-center">
              <img src={faviconUrl} alt="Provider" className="w-8 h-8 object-contain" />
            </div>
          )}
          <span className="font-semibold text-lg truncate">{selectedProvider || ''}</span>
        </div>

        <div className="px-4 shrink-0">
          <button
            onClick={startNewChat}
            className="flex items-center gap-2 w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4 text-white" />
            <span className="font-medium text-white">New Chat</span>
          </button>
        </div>

        {selectedProvider?.toLowerCase() === 'groq' ? (
          <GroqSidebarSettings settings={groqSettings} onSettingsChange={setGroqSettings} />
        ) : (
          <div className="flex-1 overflow-y-auto px-4 space-y-1">
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
        <div className="mt-auto border-t p-4 flex items-center gap-3 shrink-0">
          {account ? (
            <>
              <AccountAvatar
                email={account.email}
                provider={account.provider_id}
                className="w-7 h-7 text-[10px] rounded-md"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{account.name || 'No username'}</p>
                <p className="text-xs text-muted-foreground truncate">{account.email}</p>
              </div>
            </>
          ) : (
            <>
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <User className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-muted-foreground">No Account</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
