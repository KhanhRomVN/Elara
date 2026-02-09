import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { cn } from '../../shared/lib/utils';

const MainLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-sidebar-background">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <div
        className={cn(
          'flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300',
          isCollapsed ? 'pl-[60px]' : 'pl-72',
        )}
      >
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
