import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { useAuthStore } from './stores/authStore';
import './index.css';
import './i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

/**
 * Session bootstrap.
 *
 * A persisted JWT is only trusted once the API has confirmed it against the
 * Neon-backed `users` table. Until that check settles, the app stays on the
 * login screen so protected routes never flash for a stale session.
 */
const SessionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const [isRestoring, setIsRestoring] = React.useState(true);

  useEffect(() => {
    let cancelled = false;

    restoreSession()
      .catch(() => {
        /* restoreSession already handles its own failure path */
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, [restoreSession]);

  if (isRestoring) {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-mono text-xs text-muted-foreground tracking-widest">
            ESTABLISHING SECURE SESSION…
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionGate>
          <App />
        </SessionGate>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
