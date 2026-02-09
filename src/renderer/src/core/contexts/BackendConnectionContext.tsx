import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getApiBaseUrl } from '../../utils/apiUrl';

interface BackendConnectionContextType {
  isConnected: boolean;
  isChecking: boolean;
  checkConnection: () => Promise<void>;
  currentUrl: string;
}

const BackendConnectionContext = createContext<BackendConnectionContextType | undefined>(undefined);

const CHECK_INTERVAL = 5000; // Check every 5 seconds
const HEALTH_ENDPOINT = '/health';

export const BackendConnectionProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(true); // Assume connected initially to avoid flash
  const [isChecking, setIsChecking] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(getApiBaseUrl());

  const checkConnection = async () => {
    // Always get the latest URL potentially changed by settings
    const url = getApiBaseUrl();
    setCurrentUrl(url);

    setIsChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${url}${HEALTH_ENDPOINT}`, {
        signal: controller.signal,
        method: 'GET',
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setIsConnected(data.status === 'ok');
      } else {
        setIsConnected(false);
      }
    } catch (e) {
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Listen for storage changes (in case settings update URL)
  useEffect(() => {
    const handleStorageChange = () => {
      checkConnection();
    };
    window.addEventListener('storage', handleStorageChange);
    // Custom event for internal updates
    window.addEventListener('elara-api-url-changed', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('elara-api-url-changed', handleStorageChange);
    };
  }, []);

  return (
    <BackendConnectionContext.Provider
      value={{ isConnected, isChecking, checkConnection, currentUrl }}
    >
      {children}
    </BackendConnectionContext.Provider>
  );
};

export const useBackendConnection = () => {
  const context = useContext(BackendConnectionContext);
  if (context === undefined) {
    throw new Error('useBackendConnection must be used within a BackendConnectionProvider');
  }
  return context;
};
