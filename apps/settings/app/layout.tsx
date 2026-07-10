import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { createWallsMetadata } from "@walls/config/metadata";
import { ClientLayout } from "@/components/settings/client-layout";
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
    default: "Settings",
    template: "%s | WALLS",
  },
  description: "WALLS account settings and preferences.",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-app="settings"
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-hidden bg-background antialiased`}
    >
      <body className="h-screen overflow-hidden bg-walls-white text-foreground">
        <div className="h-full overscroll-none overflow-hidden">
          <Providers>
            <ClientLayout>{children}</ClientLayout>
          </Providers>
        </div>
      </body>
    </html>
  );
}
