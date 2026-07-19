export type KenooModule = {
  id: string;
  name: string;
  headline: string;
  description: string;
};

/** Product apps that ship in the monorepo (excludes portal, settings, admin). */
export const KENOO_MODULES: KenooModule[] = [
  {
    id: "crm",
    name: "CRM",
    headline: "Relationships, clearly organized",
    description:
      "People, companies, deals, pitches, and sequences in one place so you always know who needs attention next.",
  },
  {
    id: "projects",
    name: "Projects",
    headline: "Work that stays clear",
    description:
      "Task boards, timelines, and project overviews that keep plans aligned with what’s actually shipping.",
  },
  {
    id: "calendar",
    name: "Calendar",
    headline: "Time in one place",
    description:
      "Events, tasks, and deal deadlines on a shared schedule instead of scattered across tools.",
  },
  {
    id: "ledger",
    name: "Ledger",
    headline: "Money you can follow",
    description:
      "Balances, forecasts, transactions, recipients, and invoices designed to stay readable and easy to trust.",
  },
  {
    id: "wallie",
    name: "Wallie",
    headline: "Helpful when you need it",
    description:
      "An AI assistant for research, outreach, and drafts—ready in chat without crowding the rest of your workspace.",
  },
  {
    id: "adpilot",
    name: "AdPilot",
    headline: "Ads you can operate",
    description:
      "Meta campaign sync, spend, and automation controls so advertising stays visible alongside the rest of the business.",
  },
  {
    id: "health",
    name: "Health",
    headline: "Energy for the long run",
    description:
      "Meals, activities, and goals—optional wellness tracking that stays separate from your core ops stack.",
  },
];
