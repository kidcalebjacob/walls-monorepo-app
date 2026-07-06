import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { createWallsMetadata } from "@walls/config/metadata";
import { PrivateAppChrome } from "@walls/ui/private-app-chrome";
import { AppSidebar } from "@/components/app-sidebar";
import { Providers } from "@/components/providers";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = createWallsMetadata({
  title: {
    default: "AdPilot",
    template: "%s | AdPilot",
  },
  description: "WALLS AdPilot — campaign management and ad operations.",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-app="adpilot"
      className={`${geistSans.variable} ${geistMono.variable} h-full bg-background antialiased`}
    >
      <body className="min-h-full bg-walls-white text-foreground">
        <Providers>
          <AppSidebar />
          <div className="relative min-h-full bg-walls-white">
            <PrivateAppChrome
              dashboardPath="/"
              settingsPath="/settings"
              documentationPath="/documentation"
            />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
