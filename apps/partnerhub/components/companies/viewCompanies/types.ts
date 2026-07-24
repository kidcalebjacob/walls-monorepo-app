export type FundingEvent = {
  id: string;
  type: string | null;
  amount: string | null;
  currency: string | null;
  date: string | null;
  investors: string | null;
  newsUrl: string | null;
};

export type Suborganization = {
  id: string;
  name: string;
  website: string | null;
};

export type Technology = {
  name: string;
  category: string | null;
};

export type CompanyDetail = {
  id: string;
  name: string;
  logoUrl: string | null;
  website: string | null;
  domain: string | null;
  industry: string | null;
  employeeCount: number | null;
  annualRevenuePrinted: string | null;
  totalFundingPrinted: string | null;
  overview: string | null;
  foundingYear: number | null;
  country: string | null;
  city: string | null;
  phone: string | null;
  linkedin: string;
  twitter: string;
  facebook: string;
  departmentalHeadCount: Record<string, number>;
  technologies: Technology[];
  suborganizations: Suborganization[];
  fundingEvents: FundingEvent[];
};

export const COMPANY_DETAIL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "finance", label: "Finance" },
  { id: "team", label: "Team" },
  { id: "technology", label: "Technology" },
] as const;

export type CompanyDetailTabId = (typeof COMPANY_DETAIL_TABS)[number]["id"];

export type CompanyPartnership = {
  id: string;
  talentName: string;
  talentAvatar: string | null;
  talentCategory: string | null;
  talentCountry: string | null;
  platform: string | null;
  contentCount: number;
  lastPostedAt: string | null;
  contentUrl: string | null;
};

export type CompanyPerson = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  department: string | null;
  photoUrl: string | null;
  linkedinUrl: string | null;
  country: string | null;
};

export type CompanyDbRow = {
  id: string;
  name: string | null;
  logo_url: string | null;
  website: string | null;
  domain: string | null;
  industry: string | null;
  employee_count: number | null;
  annual_revenue_printed: string | null;
  total_funding_printed: string | null;
  overview: string | null;
  founding_year: number | null;
  country: string | null;
  city: string | null;
  phone: string | null;
};
