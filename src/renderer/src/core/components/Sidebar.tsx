import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, MessageSquare } from 'lucide-react';
import { cn } from '../../shared/lib/utils';

const Sidebar = () => {
  const navItems = [
    {
      title: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
    },
    {
      title: 'Accounts',
      href: '/accounts',
      icon: Users,
    },
    {
      title: 'Playground',
      href: '/playground',
      icon: MessageSquare,
    },
  ];

  return (
    <div className="fixed left-0 top-0 w-72 h-full bg-sidebar border-r border-border p-4 flex flex-col">
      <div className="mb-8 px-4 py-2">
        <h1 className="text-xl font-bold tracking-tight text-primary">Elara</h1>
      </div>

      <nav className="space-y-2 flex-1">
        {navItems.map((item) => (
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
        ))}
      </nav>

      <div className="mt-auto px-4 py-4 text-xs text-muted-foreground">v0.1.0</div>
    </div>
  );
};

export default Sidebar;
