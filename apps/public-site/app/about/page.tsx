import type { Metadata } from "next";

import AboutPage from "@/components/kenoo/about-page";

export const metadata: Metadata = {
  title: "About",
  description:
    "Kenoo is a modern business OS built for clarity, reliability, and everyday ease of use.",

};

export default function Page() {
  return <AboutPage />;
}
