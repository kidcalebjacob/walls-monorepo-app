import { SiteFooter } from "@/components/kenoo/site-footer";
import { SiteHeader } from "@/components/kenoo/site-header";

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-kenoo-canvas text-kenoo-ink">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
