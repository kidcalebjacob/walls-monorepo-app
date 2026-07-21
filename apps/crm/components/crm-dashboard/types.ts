export type DashboardAvatar = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

export type DashboardDealCard = {
  id: string;
  dealName: string;
  company: string;
  amount: number;
  amountDisplay: string;
  stage: string;
  createdAt: string | null;
  avatars: DashboardAvatar[];
  isWon: boolean;
  isLost: boolean;
  stageOrder: number;
  probability: number | null;
  dealStageId?: string;
};

export type StageFunnelRow = {
  id: string;
  name: string;
  amount: number;
  weightedAmount: number;
  dealCount: number;
  orderIndex: number;
  isWon: boolean;
  isLost: boolean;
};

export type CalendarEventMarker = {
  id: string;
  date: Date;
  label: string;
  dealId?: string;
  avatarUrl?: string | null;
  avatarName?: string;
  colorIndex: number;
};

export type FeaturedContact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  company: string;
  photoUrl?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  facebookUrl?: string | null;
  githubUrl?: string | null;
  lastContacted?: string | null;
  source?: string | null;
};

export type DashboardKpis = {
  wonAmountThisMonth: number;
  wonDealsThisMonth: number;
  wonWeekDeltaPct: number | null;
  newContactsThisWeek: number;
  newContactsToday: number;
  tasksThisWeek: number;
  tasksToday: number;
  pipelineTotal: number;
  pipelineWeighted: number;
};

export type CrmDashboardData = {
  kpis: DashboardKpis;
  recentDeals: DashboardDealCard[];
  funnel: StageFunnelRow[];
  calendarEvents: CalendarEventMarker[];
  featuredContact: FeaturedContact | null;
};
