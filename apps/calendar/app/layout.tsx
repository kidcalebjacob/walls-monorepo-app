import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { createWallsMetadata } from "@walls/config/metadata";
import { AppSidebarLayout } from "@/components/app-sidebar-layout";
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
    default: "Calendar",
    template: "%s | Calendar",
  },
  description:
    "WALLS Calendar — schedule, tasks, and project deadlines in one view.",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-app="calendar"
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-hidden bg-background antialiased`}
    >
      <body className="h-screen overflow-hidden bg-walls-white text-foreground">
        <div className="h-full overscroll-none overflow-hidden">
          <Providers>
            <AppSidebarLayout>{children}</AppSidebarLayout>
          </Providers>
        </div>
      </body>
    </html>
  );
}
