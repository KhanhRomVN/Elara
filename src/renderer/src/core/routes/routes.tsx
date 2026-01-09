import { RouteObject } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import DashboardPage from '../../features/dashboard';
import AccountsPage from '../../features/accounts';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        path: '',
        element: <DashboardPage />,
      },
      {
        path: 'accounts',
        element: <AccountsPage />,
      },
      {
        path: 'analytics',
        element: (
          <div className="p-6">
            <h1 className="text-2xl font-bold">Analytics</h1>
          </div>
        ),
      },
    ],
  },
];
