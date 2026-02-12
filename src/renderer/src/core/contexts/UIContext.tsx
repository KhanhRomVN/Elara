import React, { createContext, useContext, useState, ReactNode } from 'react';

interface UIContextType {
  isMainSidebarCollapsed: boolean;
  setIsMainSidebarCollapsed: (collapsed: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [isMainSidebarCollapsed, setIsMainSidebarCollapsed] = useState(() => {
    return localStorage.getItem('elara_main_sidebar_collapsed') === 'true';
  });

  const handleSetCollapsed = (collapsed: boolean) => {
    setIsMainSidebarCollapsed(collapsed);
    localStorage.setItem('elara_main_sidebar_collapsed', String(collapsed));
  };

  return (
    <UIContext.Provider
      value={{
        isMainSidebarCollapsed,
        setIsMainSidebarCollapsed: handleSetCollapsed,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
