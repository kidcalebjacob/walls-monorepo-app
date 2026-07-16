/** Auth and product apps live on the portal domain, not the marketing site. */
export const KENOO_PORTAL_URL =
  process.env.NEXT_PUBLIC_WALLS_AGENCY_URL ?? "https://portal.kenoo.io";

/** @deprecated Use KENOO_PORTAL_URL */
export const WALLS_AGENCY_PORTAL_URL = KENOO_PORTAL_URL;
