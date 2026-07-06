"use client";

import * as React from "react";

type AppSidebarContextValue = {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isHoverExpanded: boolean;
  setIsHoverExpanded: React.Dispatch<React.SetStateAction<boolean>>;
};

const AppSidebarContext = React.createContext<AppSidebarContextValue | null>(
  null,
);

export function AppSidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isHoverExpanded, setIsHoverExpanded] = React.useState(false);

  const value = React.useMemo(
    () => ({
      isCollapsed,
      setIsCollapsed,
      isHoverExpanded,
      setIsHoverExpanded,
    }),
    [isCollapsed, isHoverExpanded],
  );

  return (
    <AppSidebarContext.Provider value={value}>
      {children}
    </AppSidebarContext.Provider>
  );
}

export function useAppSidebar() {
  const context = React.useContext(AppSidebarContext);
  if (!context) {
    throw new Error("useAppSidebar must be used within AppSidebarProvider");
  }
  return context;
}
