'use client';

import UserProfileButton from '@/components/user-profile-button';

export default function SettingsProfileBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="flex h-20 items-center justify-end px-5 py-4">
        <div className="pointer-events-auto">
          <UserProfileButton settingsPath="/" dashboardPath="/" />
        </div>
      </div>
    </div>
  );
}
