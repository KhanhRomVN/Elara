import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Terminal,
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
} from 'lucide-react';
import { cn } from '../../shared/lib/utils';
import { toast } from 'sonner';
import AppIcon from '../../assets/icon.png';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}

const Sidebar = ({ isCollapsed, setIsCollapsed }: SidebarProps) => {
  const [version, setVersion] = React.useState<string | null>(null);
  const [remoteVersion, setRemoteVersion] = React.useState<string | null>(null);
  const [isChecking, setIsChecking] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [updateType, setUpdateType] = React.useState<'app' | 'resource' | 'none'>('none');

  const navItems = [
    {
      title: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      disabled: true,
    },
    {
      title: 'Accounts',
      href: '/accounts',
      icon: Users,
    },
    {
      title: 'Models',
      href: '/models',
      icon: Boxes,
      disabled: true,
    },
    {
      title: 'Playground',
      href: '/playground',
      icon: MessageSquare,
    },
    {
      title: 'Commands',
      href: '/commands',
      icon: Terminal,
    },
    {
      title: 'Tutorial',
      href: '/tutorial',
      icon: BookOpen,
      disabled: false,
    },
    {
      title: 'Skills',
      href: '/skills',
      icon: Cpu,
      disabled: true,
    },
    {
      title: 'MCP',
      href: '/mcp',
      icon: Share2,
      disabled: true,
    },
    {
      title: 'Agents',
      href: '/agents',
      icon: Bot,
      disabled: true,
    },
    {
      title: 'Extended',
      href: '/extended',
      icon: Layers,
      disabled: false,
    },
    {
      title: 'Settings',
      href: '/settings',
      icon: Settings,
      disabled: false,
    },
  ];

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
      // Force check backend update too
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
      console.log('Already on latest version or newer');
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

  return (
    <div
      className={cn(
        'fixed left-0 top-0 h-full bg-sidebar border-r border-border flex flex-col transition-all duration-300',
        isCollapsed ? 'w-[60px] p-2' : 'w-72 p-4',
      )}
    >
      <div className={cn('mb-8', isCollapsed ? 'px-0 py-4 flex justify-center' : 'px-4 py-2')}>
        {isCollapsed ? (
          <div className="flex justify-center w-full">
            <img src={AppIcon} alt="Elara" className="w-10 h-10 object-contain" />
          </div>
        ) : (
          <div className="flex items-center justify-between border-b border-border/50 pb-4 w-full">
            <h1 className="text-3xl font-bold tracking-tight text-primary">Elara</h1>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              <FoldHorizontal className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      <nav className="space-y-2 flex-1">
        {navItems.map((item) => {
          if (item.disabled) {
            return (
              <div
                key={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md relative group',
                  'text-muted-foreground/50 cursor-not-allowed opacity-50',
                  isCollapsed && 'justify-center px-2',
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.title}</span>}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none bg-zinc-900 border border-border">
                    {item.title} (Disabled)
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-colors relative group',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  isCollapsed && 'justify-center px-2',
                )
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span>{item.title}</span>}

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 bg-popover border border-border text-popover-foreground text-xs font-medium rounded shadow-md bg-zinc-900 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                  {item.title}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div
        className={cn(
          'mt-auto border-t border-border/50',
          isCollapsed ? 'pt-4 border-none flex flex-col items-center gap-4' : '',
        )}
      >
        {/* Unfold button at the bottom for collapsed state */}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
            title="Expand Sidebar"
          >
            <UnfoldHorizontal className="w-5 h-5" />
          </button>
        )}

        {!isCollapsed && hasUpdate && updateType === 'app' ? (
          <div className="flex flex-col gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 animate-in slide-in-from-bottom-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-bold text-primary">New Update Available</span>
              <span className="text-xs text-muted-foreground">
                Version {remoteVersion} is available.
              </span>
            </div>
            <a
              href="https://github.com/KhanhRomVN/Elara/releases"
              target="_blank"
              rel="noreferrer"
              className="px-2 py-1.5 text-sm font-medium text-center text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
            >
              Update App
            </a>
          </div>
        ) : (
          // Version/Icons Footer
          !isCollapsed && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors cursor-default">
                {version?.startsWith('v') ? version : `v${version || '...'}`}
              </span>

              <div className="flex items-center gap-1">
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
                    <ArrowDownToLine className="w-4 h-4" />
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
          )
        )}
      </div>
    </div>
  );
};

export default Sidebar;
