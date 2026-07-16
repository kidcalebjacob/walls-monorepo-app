import Link from "next/link";
import {
  Building2,
  Handshake,
  Mail,
  Megaphone,
  Search,
  Users,
} from "lucide-react";

const sections = [
  {
    href: "/agents/crm/people",
    label: "People",
    description: "Contacts and leads in your pipeline",
    icon: Users,
  },
  {
    href: "/agents/crm/leads",
    label: "Lead search",
    description: "Search and enrich people via Apollo",
    icon: Search,
  },
  {
    href: "/agents/crm/companies",
    label: "Companies",
    description: "Accounts, relationships, and enrichment",
    icon: Building2,
  },
  {
    href: "/agents/crm/deals",
    label: "Deals",
    description: "Pipeline, contracts, and invoices",
    icon: Handshake,
  },
  {
    href: "/agents/crm/pitches",
    label: "Pitches",
    description: "Pitch lists and outreach packages",
    icon: Megaphone,
  },
  {
    href: "/agents/crm/sequences",
    label: "Sequences",
    description: "Multi-step email sequences",
    icon: Mail,
  },
] as const;

export default function CrmHomePage() {
  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          CRM
        </h1>
        <p className="mt-2 max-w-xl text-sm text-neutral-500">
          Manage people, companies, deals, pitches, and sequences for your
          WALLS account.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="group rounded-2xl border border-neutral-200 bg-kenoo-white p-5 transition hover:border-neutral-300 hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full border border-neutral-200 p-2.5 transition group-hover:border-neutral-300">
                  <Icon className="h-4 w-4 text-neutral-600" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {section.label}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {section.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
