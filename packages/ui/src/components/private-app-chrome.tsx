"use client";

import UserProfileButton, {
  type UserProfileButtonProps,
} from "./user-profile-button";

export type PrivateAppChromeProps = UserProfileButtonProps;

/** Profile control — position via parent (e.g. absolute overlay in app shell). */
export function PrivateAppChrome(props: PrivateAppChromeProps) {
  return <UserProfileButton {...props} />;
}

export { UserProfileButton, type UserProfileButtonProps };
