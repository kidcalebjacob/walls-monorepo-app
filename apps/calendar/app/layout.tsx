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
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSans.variable} h-full overflow-hidden bg-background antialiased`}
    >
      <body className="h-screen overflow-hidden bg-kenoo-white text-kenoo-ink">
        <div className="h-full overflow-hidden overscroll-none">
          <Providers>
            <main
              data-app-scroll-container
              className="h-full min-h-0 overflow-y-auto overscroll-none bg-kenoo-white"
            >
              {children}
            </main>
          </Providers>
        </div>
      </body>
    </html>
  );
}
