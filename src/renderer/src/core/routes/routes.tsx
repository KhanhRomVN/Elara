import { RouteObject } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import AccountsPage from '../../features/accounts';
import { PlaygroundWithTabs } from '../../features/playground/components/PlaygroundWithTabs';
import CommandsPage from '../../features/commands';
import TutorialPage from '../../features/tutorial';
import SkillsPage from '../../features/skills';
import MCPPage from '../../features/mcp';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        path: '',
        element: <AccountsPage />,
      },
      {
        path: 'accounts',
        element: <AccountsPage />,
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
        path: 'skills',
        element: <SkillsPage />,
      },
      {
        path: 'mcp',
        element: <MCPPage />,
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
