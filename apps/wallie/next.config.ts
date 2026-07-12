import type { NextConfig } from "next";

import {
  getAppDirFromConfigMeta,
  loadMonorepoEnv,
} from "@walls/config/load-root-env";

const appDir = getAppDirFromConfigMeta(import.meta.url);
const monorepoRoot = loadMonorepoEnv(appDir);

const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_WALLS_AGENCY_URL: process.env.NEXT_PUBLIC_WALLS_AGENCY_URL,
  NEXT_PUBLIC_PORTAL_URL: process.env.NEXT_PUBLIC_PORTAL_URL,
  NEXT_PUBLIC_WALLIE_URL: process.env.NEXT_PUBLIC_WALLIE_URL,
  NEXT_PUBLIC_WALLIE_API_URL: process.env.NEXT_PUBLIC_WALLIE_API_URL,
  NEXT_PUBLIC_WALLIE_USE_REMOTE_API: process.env.NEXT_PUBLIC_WALLIE_USE_REMOTE_API,
};

const supabaseHostname = (() => {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  env: publicEnv,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.wallsentertainment.com",
        pathname: "/**",
      },
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media.licdn.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "static.licdn.com",
        pathname: "/**",
      },
    ],
  },
  transpilePackages: [
    "@walls/auth",
    "@walls/config",
    "@walls/supabase",
    "@walls/ui",
    "@walls/utils",
    "@walls/wallie-core",
  ],
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
