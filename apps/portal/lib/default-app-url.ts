import { resolveAppHref } from "@walls/auth";

export function getDefaultPostLoginUrl(): string {
  return resolveAppHref({
    slug: "adpilot",
    subdomain: "adpilot",
    platformBase: "",
  });
}
