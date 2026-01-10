import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const MainLayout = () => {
  return (
    <div className="flex min-h-screen bg-sidebar-background">
      <Sidebar />
      <div className="flex-1 pl-72 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 min-h-0 bg-background rounded-xl overflow-hidden m-4 shadow-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
