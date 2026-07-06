"use client";

import UserProfileButton, {
  type UserProfileButtonProps,
} from "./user-profile-button";

export type PrivateAppChromeProps = UserProfileButtonProps;

/**
 * Fixed top-right profile slot shared across private apps (AdPilot, portal tools, etc.).
 */
export function PrivateAppChrome(props: PrivateAppChromeProps) {
  return (
    <div className="pointer-events-none fixed top-0 right-0 z-50 flex items-center p-4 pr-6">
      <div className="pointer-events-auto">
        <UserProfileButton {...props} />
      </div>
    </div>
  );
}

export { UserProfileButton, type UserProfileButtonProps };
