'use client';

import PartnerHubHeader from '../header/partnerhub-header';
import PartnerHubSidebar from './partnerhub-sidebar';

export default function PartnerHubSidebarWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-gray-50 overflow-hidden">
      <PartnerHubHeader />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden">
        <PartnerHubSidebar />
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-none bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
