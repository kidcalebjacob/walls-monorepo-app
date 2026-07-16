import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { createWallsMetadata } from "@walls/config/metadata";
import { AppHeaderVisibilityProvider } from "@walls/ui/private-app-chrome";
import { AccountSwitcher } from "@/components/account-switcher";
import { AppSidebarLayout } from "@/components/app-sidebar-layout";
import { AppTopChrome } from "@/components/app-top-chrome";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-hidden bg-background antialiased`}
    >
      <body className="h-screen overflow-hidden bg-kenoo-white text-foreground">
        <div className="h-full overscroll-none overflow-hidden">
          <Providers>
            <AppHeaderVisibilityProvider autoHideOnScroll>
              <AppTopChrome
                dashboardPath="/"
                documentationPath="/documentation"
                leftContent={<AccountSwitcher />}
              />
              <AppSidebarLayout>{children}</AppSidebarLayout>
            </AppHeaderVisibilityProvider>
          </Providers>
        </div>
      </body>
    </html>
  );
}
