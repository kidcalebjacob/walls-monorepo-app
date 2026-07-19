export type KenooModule = {
  id: string;
  name: string;
  headline: string;
  description: string;
};

/** Marketing angles — not a fixed app count. */
export const KENOO_MODULES: KenooModule[] = [
  {
    id: "business",
    name: "Business",
    headline: "Relationships, delivery, and growth",
    description:
      "CRM, projects, calendar, advertising, and AI assist—so pipeline, delivery, and outreach stay in one rhythm.",
  },
  {
    id: "finance",
    name: "Finance",
    headline: "Money you can follow",
    description:
      "Invoices, cash flow, forecasts, and payouts designed to stay readable and easy to trust.",
  },
  {
    id: "health",
    name: "Health",
    headline: "Energy for the long run",
    description:
      "Meals, activities, and goals—optional wellness tracking that stays in its own lane.",
  },
];
