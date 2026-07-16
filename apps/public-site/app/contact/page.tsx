import type { Metadata } from "next";

import ContactPage from "@/components/kenoo/contact-page";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the Kenoo team about sales, partnerships, or a product walkthrough.",

};

export default function Page() {
  return <ContactPage />;
}
