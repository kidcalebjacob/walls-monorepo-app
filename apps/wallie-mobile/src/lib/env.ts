import Constants from "expo-constants";

type WallieMobileExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  wallieApiUrl?: string;
  wallieWebUrl?: string;
  wallieMobileWebUrl?: string;
};

const WALLIE_PRODUCTION_WEB_URL = "https://wallie.walls.agency";

function isLocalhostUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function getExtra(): WallieMobileExtra {
  return (Constants.expoConfig?.extra ?? {}) as WallieMobileExtra;
}

export function getSupabaseUrl(): string {
  const url = getExtra().supabaseUrl;
  if (!url) {
    throw new Error(
      "Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL in the root .env.local.",
    );
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = getExtra().supabaseAnonKey;
  if (!key) {
    throw new Error(
      "Missing Supabase anon key. Set NEXT_PUBLIC_SUPABASE_ANON_KEY in the root .env.local.",
    );
  }
  return key;
}

/** Hetzner wallie-api base URL (POST /). */
export function getWallieApiUrl(): string {
  const url = getExtra().wallieApiUrl;
  if (!url) {
    throw new Error(
      "Missing Wallie API URL. Set NEXT_PUBLIC_WALLIE_API_URL in the root .env.local.",
    );
  }
  return url;
}

function resolveLocalhostForDevice(url: string): string {
  const port = (() => {
    try {
      return new URL(url).port || "3003";
    } catch {
      return "3003";
    }
  })();

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest
      ?.debuggerHost;

  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      const lanUrl = `http://${host}:${port}`;
      if (__DEV__) {
        console.log("[wallie-mobile] voice using LAN Wallie URL:", lanUrl);
      }
      return lanUrl;
    }
  }

  if (__DEV__) {
    console.log(
      "[wallie-mobile] voice using production Wallie URL:",
      WALLIE_PRODUCTION_WEB_URL,
    );
  }
  return WALLIE_PRODUCTION_WEB_URL;
}

/** Wallie Next.js app — transcribe + TTS routes (not on Hetzner wallie-api). */
export function getWallieWebUrl(): string {
  const extra = getExtra();
  const mobileOverride = extra.wallieMobileWebUrl?.trim();
  if (mobileOverride) {
    return normalizeUrl(mobileOverride);
  }

  const configured = extra.wallieWebUrl?.trim();
  if (!configured) {
    throw new Error(
      "Missing Wallie web URL. Set NEXT_PUBLIC_WALLIE_URL in the root .env.local.",
    );
  }

  if (Constants.isDevice && isLocalhostUrl(configured)) {
    return normalizeUrl(resolveLocalhostForDevice(configured));
  }

  return normalizeUrl(configured);
}
