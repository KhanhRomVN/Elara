import { RouterProvider, createHashRouter } from 'react-router-dom';
import { routes } from './core/routes/routes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './core/theme/ThemeProvider';
import { useCommandRegistration } from './features/commands/useCommandRegistration';
import { Toaster } from 'sonner';

function App() {
  const router = createHashRouter(routes);
  const queryClient = new QueryClient();

  // Register commands on app startup
  useCommandRegistration();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="syfer-theme">
        <RouterProvider router={router} />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
