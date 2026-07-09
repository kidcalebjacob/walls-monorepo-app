import path from "node:path";
import { config as loadDotenv } from "dotenv";

const monorepoRoot = path.resolve(__dirname, "../..");
loadDotenv({ path: path.join(monorepoRoot, ".env.local") });
loadDotenv({ path: path.join(monorepoRoot, ".env") });

const wallieApiUrl = process.env.NEXT_PUBLIC_WALLIE_API_URL ?? "";
const wallieWebUrl =
  process.env.NEXT_PUBLIC_WALLIE_URL ?? "http://localhost:3003";

export default {
  expo: {
    name: "Wallie",
    slug: "wallie-mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "wallie",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.wallsentertainment.wallie",
      infoPlist: {
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
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/favicon.png",
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
    extra: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      wallieApiUrl: wallieApiUrl.replace(/\/+$/, ""),
      wallieWebUrl: wallieWebUrl.replace(/\/+$/, ""),
      eas: {
        projectId: "wallie-mobile-placeholder",
      },
    },
  },
};
