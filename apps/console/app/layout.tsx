import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { createWallsMetadata } from "@walls/config/metadata";
import { AppHeaderVisibilityProvider } from "@walls/ui/private-app-chrome";
import { AppSidebarLayout } from "@/components/app-sidebar-layout";
import { AppTopChrome } from "@/components/app-top-chrome";
import { ConsoleLayoutClient } from "@/components/console/console-layout-client";
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
    default: "Console",
    template: "%s | Kenoo Console",
  },
  description:
    "Internal Kenoo console — system-wide users, apps, jobs, and teams.",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-app="console"
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-hidden bg-gray-50 antialiased`}
    >
      <body className="h-screen overflow-hidden bg-gray-50 text-foreground">
        <div className="h-full overscroll-none overflow-hidden">
          <Providers>
            <AppHeaderVisibilityProvider autoHideOnScroll>
              <AppTopChrome dashboardPath="/" />
              <ConsoleLayoutClient>
                <AppSidebarLayout>{children}</AppSidebarLayout>
              </ConsoleLayoutClient>
            </AppHeaderVisibilityProvider>
          </Providers>
        </div>
      </body>
    </html>
  );
}
