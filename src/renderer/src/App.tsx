import { RouterProvider, createHashRouter } from 'react-router-dom';
import { routes } from './core/routes/routes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './core/theme/ThemeProvider';
import { Toaster } from 'sonner';

import { BackendConnectionProvider } from './core/contexts/BackendConnectionContext';
import { UIProvider } from './core/contexts/UIContext';

function App() {
  const router = createHashRouter(routes);
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BackendConnectionProvider>
        <UIProvider>
          <ThemeProvider defaultTheme="dark" storageKey="syfer-theme">
            <RouterProvider router={router} />
            <Toaster />
          </ThemeProvider>
        </UIProvider>
      </BackendConnectionProvider>
    </QueryClientProvider>
  );
}

export default App;
