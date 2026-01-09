import { RouterProvider, createHashRouter } from 'react-router-dom';
import { routes } from './core/routes/routes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './core/theme/ThemeProvider';

function App() {
  const router = createHashRouter(routes);
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="syfer-theme">
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
