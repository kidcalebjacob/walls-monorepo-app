import type { Metadata } from "next";

import PrivacyPolicyPage from "@/components/kenoo/privacy-policy-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Kenoo collects, uses, and protects personal information across CRM, calendar, finance, AI, ads, health, and related apps.",
};

export default function Page() {
  return <PrivacyPolicyPage />;
}
