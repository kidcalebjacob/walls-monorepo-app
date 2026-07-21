import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { createWallsMetadata } from "@walls/config/metadata";
import { AccountSwitcher } from "@/components/account-switcher";
import { AppSidebarLayout } from "@/components/app-sidebar-layout";
import { AppTopChrome } from "@/components/app-top-chrome";
import { ProjectsHeaderVisibility } from "@/components/projects-header-visibility";
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
    default: "Projects",
    template: "%s | Projects",
  },
  description:
    "WALLS Projects — task boards, timelines, and project management.",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-app="projects"
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-hidden bg-kenoo-white antialiased`}
    >
      <body className="h-screen overflow-hidden bg-kenoo-white text-foreground">
        <div className="h-full overscroll-none overflow-hidden">
          <Providers>
            <ProjectsHeaderVisibility>
              <AppTopChrome
                dashboardPath="/"
                leftContent={<AccountSwitcher />}
              />
              <AppSidebarLayout>{children}</AppSidebarLayout>
            </ProjectsHeaderVisibility>
          </Providers>
        </div>
      </body>
    </html>
  );
}
