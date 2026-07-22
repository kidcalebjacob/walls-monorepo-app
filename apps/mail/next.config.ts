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
  NEXT_PUBLIC_MAIL_URL: process.env.NEXT_PUBLIC_MAIL_URL,
  NEXT_PUBLIC_MAIL_APP_SLUG: process.env.NEXT_PUBLIC_MAIL_APP_SLUG,
  NEXT_PUBLIC_SETTINGS_URL: process.env.NEXT_PUBLIC_SETTINGS_URL,
  NEXT_PUBLIC_CRM_URL: process.env.NEXT_PUBLIC_CRM_URL,
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
  typescript: {
    // Legacy walls-app mail UI still has React 19 RefObject / TipTap strictness nits.
    // Keep the app runnable while those props are cleaned up.
    ignoreBuildErrors: true,
  },
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
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.gstatic.com",
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
  ],
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
