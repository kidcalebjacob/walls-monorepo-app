import { useSearchParams } from "next/navigation";

import { sanitizePostLoginRedirect } from "@walls/auth";

export function useRedirectParam(): string | null {
  const params = useSearchParams();
  const raw = params?.get("redirect") ?? null;
  return sanitizePostLoginRedirect(raw);
}
