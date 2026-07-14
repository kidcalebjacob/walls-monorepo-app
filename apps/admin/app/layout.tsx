import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { createWallsMetadata } from "@walls/config/metadata";
import { AdminLayoutClient } from "@/components/admin/admin-layout-client";
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
    default: "Admin",
    template: "%s | WALLS Admin",
  },
  description: "WALLS agency administration — users, apps, jobs, and teams.",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-app="admin"
      className={`${geistSans.variable} ${geistMono.variable} min-h-full bg-gray-50 antialiased`}
    >
      <body className="min-h-screen bg-gray-50 text-foreground">
        <Providers>
          <AdminLayoutClient>{children}</AdminLayoutClient>
        </Providers>
      </body>
    </html>
  );
}
