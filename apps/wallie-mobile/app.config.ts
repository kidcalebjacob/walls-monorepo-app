import path from "node:path";
import { config as loadDotenv } from "dotenv";

const monorepoRoot = path.resolve(__dirname, "../..");
loadDotenv({ path: path.join(monorepoRoot, ".env.local") });
loadDotenv({ path: path.join(monorepoRoot, ".env") });

const wallieApiUrl = process.env.NEXT_PUBLIC_WALLIE_API_URL ?? "";
const wallieWebUrl =
  process.env.NEXT_PUBLIC_WALLIE_URL ?? "https://wallie.walls.agency";
const wallieMobileWebUrl = process.env.NEXT_PUBLIC_WALLIE_MOBILE_WEB_URL ?? "";

export default {
  expo: {
    name: "Wallie",
    slug: "wallie-mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "wallie",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    platforms: ["ios", "android"],
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.wallsentertainment.wallie",
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsLocalNetworking: true,
        },
        NSBonjourServices: ["_expo._tcp"],
        NSLocalNetworkUsageDescription:
          "Expo Dev Launcher uses the local network to discover and connect to development servers running on your computer.",
        NSMicrophoneUsageDescription:
          "Wallie uses the microphone so you can talk to your AI assistant.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.wallsentertainment.wallie",
      permissions: ["RECORD_AUDIO"],
      softwareKeyboardLayoutMode: "resize",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-dev-client",
      "./plugins/withIosBuildFixes.js",
    ],
    experiments: {
      typedRoutes: true,
    },
    updates: {
      enabled: false,
    },
    extra: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      wallieApiUrl: wallieApiUrl.replace(/\/+$/, ""),
      wallieWebUrl: wallieWebUrl.replace(/\/+$/, ""),
      wallieMobileWebUrl: wallieMobileWebUrl.replace(/\/+$/, ""),
    },
  },
};
