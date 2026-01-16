import { RouteObject } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import DashboardPage from '../../features/dashboard';
import AccountsPage from '../../features/accounts';
import { ModelsPage } from '../../features/models';
import { PlaygroundWithTabs } from '../../features/playground/components/PlaygroundWithTabs';
import CommandsPage from '../../features/commands';
import TutorialPage from '../../features/tutorial';

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
        path: 'models',
        element: <ModelsPage />,
      },
      {
        path: 'playground',
        element: <PlaygroundWithTabs />,
      },
      {
        path: 'commands',
        element: <CommandsPage />,
      },
      {
        path: 'tutorial',
        element: <TutorialPage />,
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
