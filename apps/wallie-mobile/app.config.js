const path = require("node:path");
const { config: loadDotenv } = require("dotenv");

const monorepoRoot = path.resolve(__dirname, "../..");
loadDotenv({ path: path.join(monorepoRoot, ".env.local") });
loadDotenv({ path: path.join(monorepoRoot, ".env") });

const wallieApiUrl = process.env.NEXT_PUBLIC_WALLIE_API_URL ?? "";
const wallieWebUrl =
  process.env.NEXT_PUBLIC_WALLIE_URL ?? "https://wallie.walls.agency";
const wallieMobileWebUrl = process.env.NEXT_PUBLIC_WALLIE_MOBILE_WEB_URL ?? "";

module.exports = {
  expo: {
    name: "Wallie",
    slug: "wallie-mobile",
    owner: "walls-entertainment-group-inc",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "wallie",
    userInterfaceStyle: "automatic",
    newArchEnabled: false,
    platforms: ["ios", "android"],
    splash: {
      image: "./assets/icon.png",
      resizeMode: "contain",
      backgroundColor: "#e2f85c",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.wallsentertainment.wallie",
      icon: "./assets/icon.png",
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
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#e2f85c",
      },
      package: "com.wallsentertainment.wallie",
      permissions: ["RECORD_AUDIO"],
      softwareKeyboardLayoutMode: "resize",
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-dev-client",
      "./plugins/withSyncedNativeAssets.js",
      "./plugins/withIosBuildFixes.js",
    ],
    experiments: {
      typedRoutes: true,
    },
    updates: {
      enabled: false,
    },
    extra: {
      eas: {
        projectId: "2f5771db-9a5f-42eb-a50d-b0264ad63d37",
      },
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      wallieApiUrl: wallieApiUrl.replace(/\/+$/, ""),
      wallieWebUrl: wallieWebUrl.replace(/\/+$/, ""),
      wallieMobileWebUrl: wallieMobileWebUrl.replace(/\/+$/, ""),
    },
  },
};
