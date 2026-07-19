export type SuiteCapability = {
  id: string;
  title: string;
  description: string;
  href: string;
  orb: {
    from: string;
    mid: string;
    to: string;
    glow: string;
  };
};

export type SuiteFeature = {
  id: string;
  name: string;
  capabilities: SuiteCapability[];
};

export type KenooSuite = {
  id: string;
  name: string;
  description: string;
  dot: string;
  features: SuiteFeature[];
};

/**
 * Home showcase suites / angles.
 * Organized by situation (Business, Finance, Health)—not by a fixed app count.
 * Capabilities reflect what the product can actually do today.
 */
export const KENOO_SUITES: KenooSuite[] = [
  {
    id: "business",
    name: "Business",
    description:
      "Relationships, delivery, schedule, ads, and AI—everything that keeps the company moving.",
    dot: "#0b6eff",
    features: [
      {
        id: "relationships",
        name: "Relationships",
        capabilities: [
          {
            id: "people",
            title: "People",
            description:
              "A clear record of every relationship—roles, history, and next steps.",
            href: "/product#business",
            orb: {
              from: "#0b6eff",
              mid: "#5a9fff",
              to: "#083d8f",
              glow: "rgba(11,110,255,0.65)",
            },
          },
          {
            id: "companies",
            title: "Companies",
            description:
              "Accounts connected to deals, projects, and invoices—not a disconnected list.",
            href: "/product#business",
            orb: {
              from: "#0066b2",
              mid: "#30a1f4",
              to: "#0a3a66",
              glow: "rgba(0,102,178,0.65)",
            },
          },
          {
            id: "deals",
            title: "Deals",
            description:
              "Stages that stay readable so wins and blockers are never buried.",
            href: "/product#business",
            orb: {
              from: "#1a6dff",
              mid: "#4d9fff",
              to: "#0a3d8c",
              glow: "rgba(11,110,255,0.7)",
            },
          },
        ],
      },
      {
        id: "outreach",
        name: "Outreach",
        capabilities: [
          {
            id: "sequences",
            title: "Sequences",
            description:
              "Structured follow-ups that stay human, not spammy automation.",
            href: "/product#business",
            orb: {
              from: "#30a1f4",
              mid: "#7cc8ff",
              to: "#0b6eff",
              glow: "rgba(48,161,244,0.65)",
            },
          },
          {
            id: "pitches",
            title: "Pitches",
            description:
              "Keep proposals and talking points tied to the right account.",
            href: "/product#business",
            orb: {
              from: "#6eadc0",
              mid: "#a8d8e4",
              to: "#2f6b7a",
              glow: "rgba(110,173,192,0.65)",
            },
          },
          {
            id: "drafts",
            title: "Drafts",
            description:
              "AI-assisted outreach that stays on-brand—you decide what sends.",
            href: "/product#business",
            orb: {
              from: "#111111",
              mid: "#4a4a4a",
              to: "#000000",
              glow: "rgba(17,17,17,0.55)",
            },
          },
        ],
      },
      {
        id: "delivery",
        name: "Delivery",
        capabilities: [
          {
            id: "tasks",
            title: "Tasks",
            description:
              "Boards and owners so work stays clear from backlog to done.",
            href: "/product#business",
            orb: {
              from: "#f08a5d",
              mid: "#ffb08a",
              to: "#a84a28",
              glow: "rgba(240,138,93,0.7)",
            },
          },
          {
            id: "timelines",
            title: "Timelines",
            description:
              "See how work stacks across weeks without a separate planning tool.",
            href: "/product#business",
            orb: {
              from: "#e07a4d",
              mid: "#f5a882",
              to: "#8c3a1e",
              glow: "rgba(224,122,77,0.65)",
            },
          },
          {
            id: "milestones",
            title: "Milestones",
            description:
              "Connect ambition to what’s actually shipping.",
            href: "/product#business",
            orb: {
              from: "#ff9a6b",
              mid: "#ffc4a3",
              to: "#c45a30",
              glow: "rgba(255,154,107,0.65)",
            },
          },
        ],
      },
      {
        id: "schedule",
        name: "Schedule",
        capabilities: [
          {
            id: "meetings",
            title: "Meetings",
            description:
              "A shared calendar for ops, delivery, and client time in one view.",
            href: "/product#business",
            orb: {
              from: "#e2f85c",
              mid: "#f0ff9a",
              to: "#8a9a20",
              glow: "rgba(226,248,92,0.6)",
            },
          },
          {
            id: "deadlines",
            title: "Deadlines",
            description:
              "Tasks and deal dates beside events so nothing slips quietly.",
            href: "/product#business",
            orb: {
              from: "#ceff00",
              mid: "#e8ff80",
              to: "#6a8a00",
              glow: "rgba(206,255,0,0.55)",
            },
          },
          {
            id: "capacity",
            title: "Capacity",
            description:
              "Protect focus blocks and still see what the week demands.",
            href: "/product#business",
            orb: {
              from: "#e0ea00",
              mid: "#f2ff66",
              to: "#7a8200",
              glow: "rgba(224,234,0,0.55)",
            },
          },
        ],
      },
      {
        id: "advertising",
        name: "Advertising",
        capabilities: [
          {
            id: "campaigns",
            title: "Campaigns",
            description:
              "Meta campaigns, ad sets, and creatives organized the way media teams think.",
            href: "/product#business",
            orb: {
              from: "#1a7ae0",
              mid: "#6eb4ff",
              to: "#0a3d70",
              glow: "rgba(26,122,224,0.65)",
            },
          },
          {
            id: "spend",
            title: "Spend",
            description:
              "Performance and budgets in one view—not buried in another silo.",
            href: "/product#business",
            orb: {
              from: "#0b6eff",
              mid: "#4d9aff",
              to: "#062a66",
              glow: "rgba(11,110,255,0.65)",
            },
          },
          {
            id: "automation",
            title: "Automation",
            description:
              "Preview or apply campaign rules with controls that stay understandable.",
            href: "/product#business",
            orb: {
              from: "#30a1f4",
              mid: "#7cc8ff",
              to: "#0b6eff",
              glow: "rgba(48,161,244,0.6)",
            },
          },
        ],
      },
    ],
  },
  {
    id: "finance",
    name: "Finance",
    description:
      "Invoices, cash flow, forecasts, and payouts—money you can follow without spreadsheet gymnastics.",
    dot: "#8dcf76",
    features: [
      {
        id: "invoices",
        name: "Invoices",
        capabilities: [
          {
            id: "billing",
            title: "Billing",
            description:
              "Send clear invoices connected to the work that earned them.",
            href: "/product#finance",
            orb: {
              from: "#8dcf76",
              mid: "#b8e8a4",
              to: "#3d7a2e",
              glow: "rgba(141,207,118,0.65)",
            },
          },
          {
            id: "collections",
            title: "Collections",
            description:
              "Know what’s outstanding without digging through exports.",
            href: "/product#finance",
            orb: {
              from: "#75b85f",
              mid: "#a4d890",
              to: "#2b5b00",
              glow: "rgba(117,184,95,0.65)",
            },
          },
          {
            id: "receipts",
            title: "Receipts",
            description:
              "A clean trail from quote to paid, ready when you need it.",
            href: "/product#finance",
            orb: {
              from: "#a8e090",
              mid: "#d0f5c0",
              to: "#4a8a38",
              glow: "rgba(168,224,144,0.6)",
            },
          },
        ],
      },
      {
        id: "ledger",
        name: "Ledger",
        capabilities: [
          {
            id: "balances",
            title: "Balances",
            description:
              "See what’s available without another opaque finance export.",
            href: "/product#finance",
            orb: {
              from: "#2b5b00",
              mid: "#5a9a30",
              to: "#0f2800",
              glow: "rgba(43,91,0,0.6)",
            },
          },
          {
            id: "transactions",
            title: "Transactions",
            description:
              "Movement that stays readable—who, what, and when.",
            href: "/product#finance",
            orb: {
              from: "#8dcf76",
              mid: "#b5e6a0",
              to: "#456828",
              glow: "rgba(141,207,118,0.65)",
            },
          },
          {
            id: "trust",
            title: "Trust",
            description:
              "Numbers that feel accountable for operators, not only accountants.",
            href: "/product#finance",
            orb: {
              from: "#6eadc0",
              mid: "#9ed0dc",
              to: "#2f5a66",
              glow: "rgba(110,173,192,0.65)",
            },
          },
        ],
      },
      {
        id: "forecast",
        name: "Forecast",
        capabilities: [
          {
            id: "ahead",
            title: "Look ahead",
            description:
              "See what’s coming in and going out before the month surprises you.",
            href: "/product#finance",
            orb: {
              from: "#8dcf76",
              mid: "#b8e8a4",
              to: "#3d7a2e",
              glow: "rgba(141,207,118,0.65)",
            },
          },
          {
            id: "planning",
            title: "Planning",
            description:
              "Forecast views built for how the business actually runs.",
            href: "/product#finance",
            orb: {
              from: "#75b85f",
              mid: "#a4d890",
              to: "#2b5b00",
              glow: "rgba(117,184,95,0.65)",
            },
          },
          {
            id: "runway",
            title: "Runway",
            description:
              "A simple read on obligations and headroom—no spreadsheet gymnastics.",
            href: "/product#finance",
            orb: {
              from: "#a8e090",
              mid: "#d0f5c0",
              to: "#4a8a38",
              glow: "rgba(168,224,144,0.6)",
            },
          },
        ],
      },
      {
        id: "payouts",
        name: "Payouts",
        capabilities: [
          {
            id: "recipients",
            title: "Recipients",
            description:
              "Payout recipients managed alongside the rest of the ledger.",
            href: "/product#finance",
            orb: {
              from: "#2b5b00",
              mid: "#5a9a28",
              to: "#0a1a00",
              glow: "rgba(43,91,0,0.6)",
            },
          },
          {
            id: "transfers",
            title: "Transfers",
            description:
              "Move money with a clear trail from intent to completion.",
            href: "/product#finance",
            orb: {
              from: "#8dcf76",
              mid: "#b5e6a0",
              to: "#456828",
              glow: "rgba(141,207,118,0.6)",
            },
          },
          {
            id: "controls",
            title: "Controls",
            description:
              "Finance actions that stay understandable—no black-box steps.",
            href: "/product#finance",
            orb: {
              from: "#6eadc0",
              mid: "#9ed0dc",
              to: "#2f5a66",
              glow: "rgba(110,173,192,0.6)",
            },
          },
        ],
      },
    ],
  },
  {
    id: "health",
    name: "Health",
    description:
      "Meals, activities, and goals—optional wellness that supports the work without competing for attention.",
    dot: "#5bb8a8",
    features: [
      {
        id: "meals",
        name: "Meals",
        capabilities: [
          {
            id: "nutrition",
            title: "Nutrition",
            description:
              "Log meals and stay aware of intake without turning it into a chore.",
            href: "/product#health",
            orb: {
              from: "#5bb8a8",
              mid: "#8fd4c8",
              to: "#2a6e64",
              glow: "rgba(91,184,168,0.6)",
            },
          },
          {
            id: "calories",
            title: "Calories",
            description:
              "A clear daily read so energy goals stay grounded in reality.",
            href: "/product#health",
            orb: {
              from: "#3d9a8c",
              mid: "#6ec4b6",
              to: "#1e524a",
              glow: "rgba(61,154,140,0.6)",
            },
          },
          {
            id: "habits",
            title: "Habits",
            description:
              "Simple patterns you can keep—not another complicated diet app.",
            href: "/product#health",
            orb: {
              from: "#7ecfc0",
              mid: "#b0e8dc",
              to: "#3a7a70",
              glow: "rgba(126,207,192,0.55)",
            },
          },
        ],
      },
      {
        id: "activities",
        name: "Activities",
        capabilities: [
          {
            id: "workouts",
            title: "Workouts",
            description:
              "Track activity and sync from providers when you want the fuller picture.",
            href: "/product#health",
            orb: {
              from: "#5bb8a8",
              mid: "#8fd4c8",
              to: "#2a6e64",
              glow: "rgba(91,184,168,0.6)",
            },
          },
          {
            id: "movement",
            title: "Movement",
            description:
              "See how the week actually moved—not just what you planned.",
            href: "/product#health",
            orb: {
              from: "#4aa89a",
              mid: "#7ecfc0",
              to: "#245850",
              glow: "rgba(74,168,154,0.6)",
            },
          },
          {
            id: "sync",
            title: "Sync",
            description:
              "Optional connections so logs don’t depend on manual entry alone.",
            href: "/product#health",
            orb: {
              from: "#6eadc0",
              mid: "#9fd0dc",
              to: "#3d7a8a",
              glow: "rgba(110,173,192,0.55)",
            },
          },
        ],
      },
      {
        id: "goals",
        name: "Goals",
        capabilities: [
          {
            id: "targets",
            title: "Targets",
            description:
              "Set goals that stay visible next to meals and activity.",
            href: "/product#health",
            orb: {
              from: "#3d9a8c",
              mid: "#6ec4b6",
              to: "#1e524a",
              glow: "rgba(61,154,140,0.6)",
            },
          },
          {
            id: "progress",
            title: "Progress",
            description:
              "A calm dashboard for how you’re tracking—not a guilt meter.",
            href: "/product#health",
            orb: {
              from: "#5bb8a8",
              mid: "#a0ddd2",
              to: "#2a6e64",
              glow: "rgba(91,184,168,0.55)",
            },
          },
          {
            id: "balance",
            title: "Balance",
            description:
              "Wellness that supports the work—not another product competing for attention.",
            href: "/product#health",
            orb: {
              from: "#7ecfc0",
              mid: "#b0e8dc",
              to: "#3a7a70",
              glow: "rgba(126,207,192,0.55)",
            },
          },
        ],
      },
    ],
  },
];
