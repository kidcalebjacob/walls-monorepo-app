export function getDefaultPostLoginUrl(): string {
  const configured = process.env.NEXT_PUBLIC_ADPILOT_URL?.replace(/\/$/, "");
  if (configured) return configured;

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3001";
  }

  return "https://adpilot.kenoo.io";
}
