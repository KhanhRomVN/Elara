import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, MessageSquare, Terminal, BookOpen, Boxes } from 'lucide-react';
import { cn } from '../../shared/lib/utils';

const Sidebar = () => {
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
    },
  ];

  return (
    <div className="fixed left-0 top-0 w-72 h-full bg-sidebar border-r border-border p-4 flex flex-col">
      <div className="mb-8 px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-primary">Elara</h1>
          <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-primary/10 text-primary border border-primary/20">
            v1.1.0
          </span>
        </div>
      </div>

      <nav className="space-y-2 flex-1">
        {navItems.map((item) => {
          if (item.disabled) {
            return (
              <div
                key={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md',
                  'text-muted-foreground/50 cursor-not-allowed opacity-50',
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.title}
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
                  'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.title}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto px-4 py-4 text-xs text-muted-foreground">v0.1.0</div>
    </div>
  );
};

export default Sidebar;
