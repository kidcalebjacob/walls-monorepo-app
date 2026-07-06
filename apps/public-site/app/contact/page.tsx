"use client";

import { useInView } from "react-intersection-observer";

import { ContactForm } from "@/components/contactPage/contact-page";
import { PublicHeader } from "@/components/public-header";
import FooterContainer from "@/components/footer-container";

export default function ContactPage() {
  const { ref, inView } = useInView({
    threshold: 0,
    initialInView: true,
  });

  return (
    <main className="min-h-screen w-full bg-gray-50">
      <div ref={ref} className="absolute top-0 h-1 w-full" />
      <PublicHeader inView={inView} />

      <div className="mx-auto max-w-7xl px-4 pt-28 pb-16 md:px-6">
        <ContactForm />
      </div>

      <FooterContainer />
    </main>
  );
}
