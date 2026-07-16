import type { Metadata } from "next";

import PricingPage from "@/components/kenoo/pricing-page";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Straightforward Kenoo plans for teams that want a full business OS.",

};

export default function Page() {
  return <PricingPage />;
}
