import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { createWallsMetadata } from "@walls/config/metadata";
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
    default: "Mail",
    template: "%s | Mail",
  },
  description: "Kenoo Mail — inbox, compose, and Gmail workflows.",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-app="mail"
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-hidden bg-kenoo-white antialiased`}
    >
      <body className="h-screen overflow-hidden bg-kenoo-white text-foreground">
        <div className="h-full overflow-hidden overscroll-none">
          <Providers>
            <main
              data-app-scroll-container
              className="h-full min-h-0 overflow-hidden overscroll-none bg-kenoo-white"
            >
              {children}
            </main>
          </Providers>
        </div>
      </body>
    </html>
  );
}
