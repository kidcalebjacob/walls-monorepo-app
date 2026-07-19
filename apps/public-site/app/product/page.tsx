import type { Metadata } from "next";

import ProductPage from "@/components/kenoo/product-page";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Explore Kenoo by angle: business, finance, and health—in one business OS.",

};

export default function Page() {
  return <ProductPage />;
}
