"use client";

import type { FC } from "react";
import { useState } from "react";
import SettingsProfileBar from "@/components/settings/settings-profile-bar";
import { AgentSidebar } from "@/components/settings/agent-sidebar";
import { SidebarContext } from "./sidebar-context";

interface ClientLayoutProps {
  children: React.ReactNode;
}

export const ClientLayout: FC<ClientLayoutProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      <div className="relative flex h-full flex-col bg-kenoo-white overflow-hidden">
        <SettingsProfileBar />
        <div className="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden pt-20 md:pt-0">
          <AgentSidebar />
          <main className="flex-1 min-h-0 overflow-y-auto overscroll-none bg-kenoo-white">
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
};
