import { createContext, useContext, useState, ReactNode } from 'react';

interface ConsoleSidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
  isHoverExpanded: boolean;
  setIsHoverExpanded: (value: boolean) => void;
}

const ConsoleSidebarContext = createContext<ConsoleSidebarContextType | undefined>(undefined);

export function ConsoleSidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);

  return (
    <ConsoleSidebarContext.Provider value={{ isCollapsed, setIsCollapsed, isHoverExpanded, setIsHoverExpanded }}>
      {children}
    </ConsoleSidebarContext.Provider>
  );
}

export function useConsoleSidebar() {
  const context = useContext(ConsoleSidebarContext);
  if (context === undefined) {
    throw new Error('useConsoleSidebar must be used within a ConsoleSidebarProvider');
  }
  return context;
}
