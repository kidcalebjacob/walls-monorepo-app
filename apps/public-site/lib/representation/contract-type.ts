const AGENCY_NAME = "WALLS Entertainment Group";
const AGENCY_SHORT = "WALLS Entertainment";

export type RepresentationContractType =
  | "exclusive"
  | "non-exclusive"
  | "released";

/** DB default typo and roster normalization. */
export function normalizeContractType(
  raw: string | null | undefined
): RepresentationContractType {
  const value = (raw || "exclusive").toLowerCase().trim();
  if (value === "exlcusive" || value === "exclusive") return "exclusive";
  if (value === "non-exclusive") return "non-exclusive";
  if (value === "released") return "released";
  return "exclusive";
}

export function contractTypeLabel(
  contractType: RepresentationContractType
): string {
  switch (contractType) {
    case "exclusive":
      return "Exclusive";
    case "non-exclusive":
      return "Non-exclusive";
    case "released":
      return "Released";
  }
}

export function representationStatusPhrase(
  contractType: RepresentationContractType
): string {
  switch (contractType) {
    case "exclusive":
      return "exclusively represented";
    case "non-exclusive":
      return "non-exclusively represented";
    case "released":
      return "no longer represented";
  }
}

export function representationStatusPhrasePresent(
  contractType: RepresentationContractType
): string {
  switch (contractType) {
    case "exclusive":
      return "is exclusively represented";
    case "non-exclusive":
      return "is non-exclusively represented";
    case "released":
      return "is no longer represented";
  }
}

export const CERTIFICATION_EYEBROW = "Certification of Representation";

export function certificationNotice(
  contractType: RepresentationContractType
): string {
  const status = representationStatusPhrase(contractType);
  if (contractType === "released") {
    return `This is the official WALLS Entertainment representation record for talent who ${status} by ${AGENCY_NAME}. This page is issued and maintained by the WALLS executive arm and confirms representation history on file.`;
  }
  return `This is the official WALLS Entertainment certification of representation. ${AGENCY_NAME} certifies that the talent named on this page ${status} by our agency. This page is issued and maintained by the WALLS executive arm; if this URL exists, the certification is active on file.`;
}

export function heroRepresentationLine(
  contractType: RepresentationContractType
): string {
  switch (contractType) {
    case "exclusive":
      return `Exclusively represented by ${AGENCY_NAME} for brand partnerships, sponsorships, and collaborations.`;
    case "non-exclusive":
      return `Non-exclusively represented by ${AGENCY_NAME} for brand partnerships, sponsorships, and collaborations.`;
    case "released":
      return `No longer represented by ${AGENCY_NAME}. This page documents representation history on file.`;
  }
}

export function defaultAboutText(
  name: string,
  category: string,
  contractType: RepresentationContractType
): string {
  const role = category.toLowerCase();
  if (contractType === "released") {
    return `${name} is a ${role} whose representation with ${AGENCY_NAME} has been released. This certification page reflects the official record on file with WALLS Entertainment.`;
  }
  const rep =
    contractType === "exclusive" ? "exclusively" : "non-exclusively";
  return `${name} is a ${role} ${rep} represented by ${AGENCY_NAME} for brand partnerships, sponsored content, and collaborations worldwide.`;
}

export function whoRepresentsBody(
  name: string,
  contractType: RepresentationContractType
): { lead: string; inquiry: string } {
  if (contractType === "released") {
    return {
      lead: `${name} ${representationStatusPhrasePresent(contractType)} by ${AGENCY_NAME} (${AGENCY_SHORT}). This is the official representation record maintained by WALLS Entertainment. If you are searching for who previously managed ${name} or historical representation details, you have found the certified page on file.`,
      inquiry: `New partnership and sponsorship inquiries for ${name} are not managed through ${AGENCY_NAME} while representation status is released. For questions about this record or WALLS Entertainment, contact our team.`,
    };
  }

  const repWord =
    contractType === "exclusive" ? "exclusively" : "non-exclusively";
  return {
    lead: `${name} ${representationStatusPhrasePresent(contractType)} by ${AGENCY_NAME} (${AGENCY_SHORT}). WALLS is a global talent management, sports, entertainment, and advisory company. If you are searching for who manages ${name}, who represents ${name}, or how to book ${name} for a brand deal, you have found the official certification of representation.`,
    inquiry: `Partnership, sponsorship, and representation inquiries for ${name} are handled ${repWord} through the ${AGENCY_NAME} team, not through direct social DMs.`,
  };
}

export function buildFaqItems(
  name: string,
  category: string,
  contractType: RepresentationContractType,
  instagramUsername?: string | null
): { question: string; answer: string }[] {
  const role = category.toLowerCase();
  const repPhrase = representationStatusPhrasePresent(contractType);
  const handle = instagramUsername
    ? `@${instagramUsername.replace(/^@/, "").toLowerCase()}`
    : null;

  const handleFaqs =
    handle && contractType !== "released"
      ? [
          {
            question: `Who represents ${handle}?`,
            answer: `${handle} (${name}) ${repPhrase} by ${AGENCY_NAME} (${AGENCY_SHORT}). This is the official certification page to verify ${handle} is on the WALLS Entertainment roster.`,
          },
          {
            question: `Is ${handle} represented by WALLS Entertainment?`,
            answer: `Yes. ${handle} (${name}) is certified ${representationStatusPhrase(contractType)} by ${AGENCY_NAME}. If you are verifying representation for a brand deal, this page confirms their status on file.`,
          },
        ]
      : handle && contractType === "released"
        ? [
            {
              question: `Who represents ${handle}?`,
              answer: `${handle} (${name}) ${repPhrase} by ${AGENCY_NAME}. This certification page is the official WALLS record for ${handle}.`,
            },
          ]
        : [];

  if (contractType === "released") {
    return [
      ...handleFaqs,
      {
        question: `Who represents ${name}?`,
        answer: `${name} ${repPhrase} by ${AGENCY_NAME}. This certification page is the official WALLS record of their representation status.`,
      },
      {
        question: `Was ${name} represented by WALLS Entertainment?`,
        answer: `Yes. ${name} was on the ${AGENCY_NAME} roster. Representation status is currently released, as certified on this page by the WALLS executive arm.`,
      },
      {
        question: `How do I book or partner with ${name}?`,
        answer: `While ${name}'s representation with ${AGENCY_NAME} is released, new brand deals are not booked through WALLS. Contact WALLS Entertainment if you need verification of this representation record.`,
      },
      {
        question: `Is this an official WALLS Entertainment page?`,
        answer: `Yes. This URL is an official certification of representation record issued and maintained by ${AGENCY_NAME}. If this page exists, it reflects the representation status on file with WALLS.`,
      },
    ];
  }

  const repWord =
    contractType === "exclusive" ? "exclusively" : "non-exclusively";
  const managementAnswer =
    contractType === "exclusive"
      ? `${name}'s management and representation are handled exclusively by ${AGENCY_NAME}. All professional inquiries go through the WALLS Entertainment team.`
      : `${name}'s management and representation are handled non-exclusively by ${AGENCY_NAME}. Professional inquiries for WALLS-managed opportunities go through the WALLS Entertainment team.`;

  return [
    ...handleFaqs,
    {
      question: `Who represents ${name}?`,
      answer: `${name} ${repPhrase} by ${AGENCY_NAME} (${AGENCY_SHORT}), which handles brand partnerships, sponsorships, and collaboration inquiries on their behalf. This page certifies that relationship.`,
    },
    {
      question: `Who is ${name}'s manager or talent agency?`,
      answer: managementAnswer,
    },
    {
      question: `How do I book or partner with ${name}?`,
      answer: `To explore brand deals, campaigns, or partnerships with ${name}, contact WALLS Entertainment through our Connect page. The WALLS team manages booking and partnership requests ${repWord} for roster talent.`,
    },
    {
      question: `Is ${name} available for brand deals?`,
      answer: `Yes. ${name} works with brands through ${AGENCY_NAME} under ${repWord} representation. Reach out to WALLS Entertainment to discuss sponsorships, integrations, and campaign opportunities.`,
    },
    {
      question: `Is this an official WALLS Entertainment certification?`,
      answer: `Yes. This page is the official certification of representation for ${name}, issued and maintained by ${AGENCY_NAME}. If this URL exists, ${name} is certified on the WALLS roster with ${contractTypeLabel(contractType).toLowerCase()} representation status.`,
    },
  ];
}

export function footerCertificationText(
  name: string,
  contractType: RepresentationContractType
): string {
  if (contractType === "released") {
    return `${name} is no longer represented by ${AGENCY_NAME}. Official representation record:`;
  }
  const rep = representationStatusPhrase(contractType);
  return `${name} is ${rep} by ${AGENCY_NAME}. Official certification of representation:`;
}

export function imageAltText(
  name: string,
  contractType: RepresentationContractType
): string {
  if (contractType === "released") {
    return `${name}, former WALLS Entertainment representation record`;
  }
  return `${name}, certified ${contractTypeLabel(contractType).toLowerCase()} representation by WALLS Entertainment`;
}

export function showPartnerCta(contractType: RepresentationContractType): boolean {
  return contractType !== "released";
}

export { AGENCY_NAME, AGENCY_SHORT };
