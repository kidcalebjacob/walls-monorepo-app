export type KenooModule = {
  id: string;
  name: string;
  headline: string;
  description: string;
};

export const KENOO_MODULES: KenooModule[] = [
  {
    id: "crm",
    name: "CRM",
    headline: "Relationships, clearly organized",
    description:
      "Pipelines, contacts, and context in one place so you always know who needs attention next.",
  },
  {
    id: "projects",
    name: "Projects",
    headline: "Work that stays clear",
    description:
      "Milestones, owners, and status updates that keep plans aligned with what’s actually happening.",
  },
  {
    id: "calendar",
    name: "Calendar",
    headline: "Time in one place",
    description:
      "Meetings, deadlines, and operations on a shared schedule instead of scattered across tools.",
  },
  {
    id: "finance",
    name: "Finance",
    headline: "Money you can follow",
    description:
      "Invoices, cash flow, and ledger views designed to stay readable and easy to trust.",
  },
  {
    id: "workflows",
    name: "Workflows",
    headline: "Automation that fits your process",
    description:
      "Build the flows your business already uses, with controls that stay easy to understand.",
  },
  {
    id: "ai",
    name: "AI",
    headline: "Helpful when you need it",
    description:
      "An assistant that drafts, routes, and highlights what matters without crowding the workspace.",
  },
];
