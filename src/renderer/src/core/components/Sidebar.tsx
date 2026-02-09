import React, { memo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  BookOpen,
  Boxes,
  Cloud as CloudSync,
  ArrowDownToLine,
  FoldHorizontal,
  UnfoldHorizontal,
  Cpu,
  Share2,
  Bot,
  Layers,
  Settings,
  Palette,
  WifiOff,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '../../shared/lib/utils';
import { toast } from 'sonner';
import AppIcon from '../../assets/icon.png';
import { useBackendConnection } from '../contexts/BackendConnectionContext';
import ThemeDrawer from '../theme/components/ThemeDrawer';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

const Sidebar = memo(({ isCollapsed, setIsCollapsed }: SidebarProps) => {
  const { isConnected, currentUrl } = useBackendConnection();
  const [version, setVersion] = React.useState<string | null>(null);
  const [remoteVersion, setRemoteVersion] = React.useState<string | null>(null);
  const [isChecking, setIsChecking] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [updateType, setUpdateType] = React.useState<'app' | 'resource' | 'none'>('none');
  const [isThemeDrawerOpen, setIsThemeDrawerOpen] = React.useState(false);

  const navItems = [
    {
      title: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      disabled: false,
      color: '#0ea5e9', // Sky Blue
    },
    {
      title: 'Accounts',
      href: '/accounts',
      icon: Users,
      color: '#10b981', // Emerald
    },
    {
      title: 'Models',
      href: '/models',
      icon: Boxes,
      color: '#f59e0b', // Amber
    },
    {
      title: 'Playground',
      href: '/playground',
      icon: MessageSquare,
      color: '#8b5cf6', // Violet
    },
    {
      title: 'Tutorial',
      href: '/tutorial',
      icon: BookOpen,
      disabled: false,
      color: '#f97316', // Orange
    },
    {
      title: 'Skills',
      href: '/skills',
      icon: Cpu,
      disabled: true,
      color: '#64748b', // Slate
    },
    {
      title: 'MCP',
      href: '/mcp',
      icon: Share2,
      disabled: true,
      color: '#f43f5e', // Rose
    },
    {
      title: 'Agents',
      href: '/agents',
      icon: Bot,
      disabled: true,
      color: '#14b8a6', // Teal
    },
    {
      title: 'Extended',
      href: '/extended',
      icon: Layers,
      disabled: false,
      color: '#6366f1', // Indigo
    },
    {
      title: 'Settings',
      href: '/settings',
      icon: Settings,
      disabled: false,
      color: '#94a3b8', // Slate
    },
  ];

  /* -------------------------------------------------------------------------------------------------
   * Version Checking Logic
   * -----------------------------------------------------------------------------------------------*/
  const fetchVersion = async () => {
    try {
      const {
        currentVersion,
        updateAvailable,
        remoteVersion: backendRemote,
        updateType: type,
      } = await window.api.version.checkForUpdates();

      setVersion(currentVersion);

      if (updateAvailable && backendRemote) {
        setRemoteVersion(backendRemote);
        setUpdateType(type);
      } else if (backendRemote) {
        setRemoteVersion(backendRemote);
      }
    } catch (error) {
      console.error('Failed to fetch version:', error);
    }
  };

  React.useEffect(() => {
    fetchVersion();
  }, []);

  const handleUpdateCheck = async () => {
    setIsChecking(true);
    try {
      await fetchVersion();
      const { updateAvailable, remoteVersion, updateType } =
        await window.api.version.checkForUpdates();
      if (updateAvailable && remoteVersion) {
        setRemoteVersion(remoteVersion);
        setUpdateType(updateType);
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleUpdate = async () => {
    if (!remoteVersion || isUpdating) return;

    if (version && remoteVersion <= version) {
      // Optional: show toast
    }

    const toastId = toast.loading('Updating provider resources...');
    setIsUpdating(true);
    try {
      const result = await window.api.version.performUpdate(remoteVersion);
      if (result.success) {
        setVersion(remoteVersion);
        toast.success('Update successful! Please restart the app.', { id: toastId });
      } else {
        toast.error(`Update failed: ${result.message}`, { id: toastId });
      }
    } catch (error) {
      console.error('Update failed:', error);
      toast.error('Update failed during execution.', { id: toastId });
    } finally {
      setIsUpdating(false);
    }
  };

  const hasUpdate = version && remoteVersion && remoteVersion !== version;

  /* -------------------------------------------------------------------------------------------------
   * Render
   * -----------------------------------------------------------------------------------------------*/
  return (
    <div
      className={cn(
        'flex flex-col h-screen fixed left-0 top-0 bg-card/50 backdrop-blur-xl border-r border-border transition-[width] duration-300 ease-in-out z-50 will-change-[width]',
        isCollapsed ? 'w-[60px]' : 'w-72',
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'h-16 flex items-center border-b border-border/50 transition-[padding] duration-300 overflow-hidden shrink-0',
          isCollapsed ? 'justify-center px-0' : 'px-4 justify-between',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2 overflow-hidden whitespace-nowrap',
            isCollapsed && 'hidden',
          )}
        >
          {/* Logo container tailored to match Zentri's look but using Elara's icon */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
            <img src={AppIcon} alt="Elara" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-xl tracking-tight opacity-100 transition-opacity duration-300 text-foreground">
            Elara
          </span>
        </div>

        {isCollapsed && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 animate-in fade-in zoom-in duration-300 overflow-hidden">
            <img src={AppIcon} alt="Elara" className="w-full h-full object-cover" />
          </div>
        )}

        {!isCollapsed && (
          <div className="flex items-center gap-1 opacity-100 transition-opacity duration-300">
            <button
              onClick={() => setIsThemeDrawerOpen(true)}
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-md transition-colors"
              title="Theme Settings"
            >
              <Palette className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              title="Collapse Sidebar"
            >
              <FoldHorizontal className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          'flex-1 py-4 space-y-1',
          isCollapsed ? 'overflow-visible px-2' : 'overflow-y-auto custom-scrollbar',
        )}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={(e) => item.disabled && e.preventDefault()}
            end={item.href === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 py-3 text-sm font-medium rounded-none transition-all relative group',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                isCollapsed ? 'justify-center px-0 mx-0 w-full mb-1' : 'px-4 mb-1',
                item.disabled && 'opacity-50 cursor-not-allowed grayscale pointer-events-none',
              )
            }
            style={({ isActive }) => ({
              background: isActive
                ? `linear-gradient(to right, ${item.color}15, transparent)`
                : undefined,
            })}
          >
            {({ isActive }) => (
              <>
                {/* Active Indicator Bar */}
                {isActive && !isCollapsed && (
                  <div
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-l-lg"
                    style={{ backgroundColor: item.color }}
                  />
                )}

                <item.icon
                  className={cn(
                    'w-5 h-5 flex-shrink-0 transition-colors',
                    isActive && isCollapsed && 'drop-shadow-md',
                  )}
                  style={{ color: isActive ? item.color : undefined }}
                />

                {!isCollapsed && (
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.title}
                  </span>
                )}

                {/* Tooltip for Collapsed State */}
                {isCollapsed && (
                  <div className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-popover border border-border text-popover-foreground text-xs font-medium rounded-md shadow-lg z-[100] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {item.title} {item.disabled && '(Disabled)'}
                    <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-popover border-l border-b border-border rotate-45 transform" />
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Connection / Update Status Footer */}
      {!isCollapsed && (!isConnected || (hasUpdate && updateType === 'app')) && (
        <div className="px-4 mb-3">
          {/* Connection Lost Alert */}
          {!isConnected && (
            <div className="p-3 rounded-xl border bg-destructive/5 border-destructive/20 shadow-lg shadow-destructive/5 animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 text-destructive mb-1">
                <WifiOff className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Disconnected</span>
              </div>
              <p className="text-[10px] text-muted-foreground break-all leading-tight">
                Cannot reach {currentUrl}
              </p>
            </div>
          )}

          {/* App Update Available Alert */}
          {hasUpdate && updateType === 'app' && isConnected && (
            <div className="p-3 rounded-xl border bg-primary/5 border-primary/20 shadow-lg shadow-primary/5 animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 text-primary mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">New Version</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-muted-foreground">
                  v{remoteVersion} is available.
                </span>
                <a
                  href="https://github.com/KhanhRomVN/Elara/releases"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full text-center py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all"
                >
                  Update Now
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsed Alert Indicators */}
      {isCollapsed && !isConnected && (
        <div className="mb-2 px-2 flex justify-center">
          <div
            className="w-10 h-10 rounded-md bg-destructive/10 text-destructive flex items-center justify-center animate-pulse"
            title="Connection Lost"
          >
            <WifiOff className="w-5 h-5" />
          </div>
        </div>
      )}

      {isCollapsed && hasUpdate && updateType === 'app' && isConnected && (
        <div className="mb-2 px-2 flex justify-center">
          <a
            href="https://github.com/KhanhRomVN/Elara/releases"
            target="_blank"
            rel="noreferrer"
            className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center animate-pulse"
            title={`Update Available: v${remoteVersion}`}
          >
            <AlertCircle className="w-5 h-5" />
          </a>
        </div>
      )}

      {/* Settings/Collapse Footer (Only in Collapsed Mode OR Version info in Open Mode) */}
      <div
        className={cn(
          'mt-auto transition-all duration-300',
          isCollapsed
            ? 'p-2 flex flex-col items-center gap-2'
            : 'px-4 py-3 border-t border-border/50',
        )}
      >
        {isCollapsed ? (
          <>
            <button
              onClick={() => setIsThemeDrawerOpen(true)}
              className="w-10 h-10 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted transition-all"
            >
              <Palette className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsCollapsed(false)}
              className="w-10 h-10 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <UnfoldHorizontal className="w-5 h-5" />
            </button>
          </>
        ) : (
          // Full Footer with Version and Resource Updates
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-default select-none">
              {version?.startsWith('v') ? version : `v${version || '...'}`}
            </span>

            <div className="flex items-center gap-1">
              {/* Resource Update Button */}
              {hasUpdate && updateType === 'resource' && (
                <button
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className={cn(
                    'p-1.5 rounded-md text-primary hover:bg-primary/10 transition-all',
                    isUpdating && 'animate-spin opacity-50',
                  )}
                  title={`Update resources to ${remoteVersion}`}
                >
                  {isUpdating ? (
                    <Loader2 className="w-4 h-4" />
                  ) : (
                    <ArrowDownToLine className="w-4 h-4" />
                  )}
                </button>
              )}

              <button
                onClick={handleUpdateCheck}
                disabled={isChecking}
                className={cn(
                  'p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-all',
                  isChecking && 'animate-spin text-primary',
                )}
                title={isChecking ? 'Checking...' : 'Check for updates'}
              >
                <CloudSync className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ThemeDrawer isOpen={isThemeDrawerOpen} onClose={() => setIsThemeDrawerOpen(false)} />
    </div>
  );
});

export default Sidebar;
