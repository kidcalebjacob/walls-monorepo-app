export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  leadName: string;
  email: string;
  phone: string;
  company: string;
  companyWebsite: string;
  companyLogo?: string;
  companyId?: string;
  apolloAccountId?: string;
  source: string;
  status: string;
  region: string;
  operatingCountries: string[];
  title: string;
  department: string;
  reportingTo: string;
  estimatedValue: number;
  createdAt: string | null;
  createdBy: string;
  linkedin?: string;
  lastContacted?: string | null;
  lastEnriched?: string | null;
  apolloPersonId?: string | null;
  photoURL?: string;
  photo?: string;
  isVerified?: boolean;
}

export interface AgentOption {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export interface Filters {
  status: string;
  source: string;
  createdBy: string;
  searchTerm: string;
  country: string;
  companyId: string;
  verified: string;
}

export interface ImageStates {
  [leadId: string]: {
    profileFailed: boolean;
    companyFailed: boolean;
  };
}

export interface SequencePopupPersonData {
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
}

