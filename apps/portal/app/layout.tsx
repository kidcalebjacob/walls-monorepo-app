import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Sans } from "next/font/google";

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

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = createWallsMetadata({
  title: {
    default: "Kenoo",
    template: "%s | Kenoo",
  },
  description: "Sign in to Kenoo, your business OS.",
  metadataBase: new URL("https://kenoo.io"),
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-kenoo-canvas text-kenoo-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
