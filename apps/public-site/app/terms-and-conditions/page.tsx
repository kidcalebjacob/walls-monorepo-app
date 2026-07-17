import type { Metadata } from "next";

import TermsPage from "@/components/kenoo/terms-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing your use of the Kenoo product suite, including CRM, AI, ads, finance, health, and integrations.",
};

export default function Page() {
  return <TermsPage />;
}
