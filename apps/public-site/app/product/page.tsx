import type { Metadata } from "next";

import ProductPage from "@/components/kenoo/product-page";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Explore Kenoo modules: CRM, projects, calendar, finance, workflows, and AI in one business OS.",

};

export default function Page() {
  return <ProductPage />;
}
