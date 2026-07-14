import { createContext, useContext, useState, ReactNode } from 'react';

interface AdminSidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
  isHoverExpanded: boolean;
  setIsHoverExpanded: (value: boolean) => void;
}

const AdminSidebarContext = createContext<AdminSidebarContextType | undefined>(undefined);

export function AdminSidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);

  return (
    <AdminSidebarContext.Provider value={{ isCollapsed, setIsCollapsed, isHoverExpanded, setIsHoverExpanded }}>
      {children}
    </AdminSidebarContext.Provider>
  );
}

export function useAdminSidebar() {
  const context = useContext(AdminSidebarContext);
  if (context === undefined) {
    throw new Error('useAdminSidebar must be used within an AdminSidebarProvider');
  }
  return context;
}
