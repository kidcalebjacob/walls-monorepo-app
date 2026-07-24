"use client";

/** Apollo enrich UI is CRM-specific; PartnerHub only needs company search/select. */
export function CompanySearchApolloEnrich(_props: {
  onSuccess?: (payload: { companyName?: string }) => void;
  onClose?: () => void;
}) {
  return null;
}
