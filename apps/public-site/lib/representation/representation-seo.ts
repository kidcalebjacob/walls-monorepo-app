import {
  AGENCY_NAME,
  AGENCY_SHORT,
  buildFaqItems,
  contractTypeLabel,
  defaultAboutText,
  normalizeContractType,
  representationStatusPhrasePresent,
} from "@/lib/representation/contract-type";
import {
  representationDisplayHandle,
  representationPathSegment,
} from "@/lib/representation/instagram-username";
import type { TalentDetail } from "@/lib/representation/types";

type TalentSeoFields = Pick<
  TalentDetail,
  "name" | "about" | "category" | "contract_type" | "instagram_username"
>;

function instagramHandleLabel(
  instagramUsername: string | null | undefined
): string | null {
  return representationDisplayHandle(instagramUsername);
}

export function representationCanonicalPath(
  talent: Pick<TalentDetail, "instagram_username" | "slug" | "id">,
  fallback: string
): string {
  if (talent.instagram_username) {
    return representationPathSegment(talent.instagram_username, fallback);
  }
  return talent.slug || talent.id || fallback;
}

export function buildRepresentationPageUrl(
  talent: Pick<TalentDetail, "instagram_username" | "slug" | "id">,
  fallback: string
): string {
  return `https://www.wallsentertainment.com/representation/${representationCanonicalPath(talent, fallback)}`;
}

export function buildRepresentationTitle(talent: TalentSeoFields): string {
  const { name, instagram_username } = talent;
  const handle = instagramHandleLabel(instagram_username);
  return handle ? `${name} (${handle})` : name;
}

export function buildRepresentationDescription(talent: TalentSeoFields): string {
  const { name, about, category, contract_type, instagram_username } = talent;
  const contractType = contract_type ?? normalizeContractType(null);
  const role = category || "content creator";
  const status = representationStatusPhrasePresent(contractType);
  const handle = instagramHandleLabel(instagram_username);
  const subject = handle ? `${name} (${handle})` : name;
  const whoRepresentsLead = handle
    ? `Who represents ${name} (${handle})? `
    : `Who represents ${name}? `;

  if (about?.trim()) {
    const snippet = about.trim().slice(0, 100);
    const suffix = about.length > 100 ? "…" : "";
    return `${whoRepresentsLead}Official WALLS certification: ${subject} ${status} by ${AGENCY_NAME}. ${snippet}${suffix} Verify representation at wallsentertainment.com/representation/${handle || name}.`;
  }

  if (contractType === "released") {
    return `${whoRepresentsLead}Official WALLS representation record: ${subject} ${status} by ${AGENCY_NAME}. Certified page on file with ${AGENCY_SHORT}.`;
  }

  const repWord =
    contractType === "exclusive" ? "exclusively" : "non-exclusively";
  return `${whoRepresentsLead}Official certification: ${subject} is a ${role} ${repWord} represented by ${AGENCY_NAME} for brand partnerships, sponsorships, and collaborations. Contact ${AGENCY_SHORT} to book ${handle || name}.`;
}

export function buildRepresentationKeywords(
  talent: Pick<
    TalentDetail,
    "name" | "category" | "contract_type" | "instagram_username"
  >
): string[] {
  const { name, category, contract_type, instagram_username } = talent;
  const contractType = contract_type ?? normalizeContractType(null);
  const role = category || "Content Creator";
  const repLabel = contractTypeLabel(contractType).toLowerCase();

  const handle = instagramHandleLabel(instagram_username);
  const bareHandle = instagram_username || "";

  const base = [
    name,
    ...(handle && bareHandle
      ? [
          handle,
          bareHandle,
          `who represents ${handle}`,
          `who represents ${bareHandle}`,
          `who manages ${handle}`,
          `who is ${handle} represented by`,
          `who is ${handle} managed by`,
          `${handle} representation`,
          `${handle} talent agency`,
          `${handle} manager`,
          `${handle} agency`,
          `${handle} WALLS Entertainment`,
          `${handle} brand deals`,
          `${handle} sponsorships`,
          `is ${handle} represented by WALLS`,
          `is ${handle} with WALLS Entertainment`,
          `${bareHandle} representation`,
          `${bareHandle} WALLS Entertainment`,
          `${bareHandle} talent agency`,
          `${name} ${handle}`,
          `${handle} ${name}`,
        ]
      : []),
    `who represents ${name}`,
    `who manages ${name}`,
    `who is ${name} represented by`,
    `who is ${name} managed by`,
    `${name} representation`,
    `${name} talent agency`,
    `${name} manager`,
    `${name} management`,
    `${name} agency`,
    `${name} brand deals`,
    `${name} sponsorships`,
    `${name} partnerships`,
    `${name} contact`,
    `${name} booking`,
    `${name} influencer agency`,
    `${name} representation certification`,
    `${name} ${repLabel} representation`,
    AGENCY_SHORT,
    AGENCY_NAME,
    "WEG",
    role,
    "talent management",
    "influencer management",
    "creator management",
    "certification of representation",
  ];

  if (contractType === "released") {
    return [
      ...base,
      `${name} former representation`,
      `${name} released representation`,
    ];
  }

  return base;
}

export function buildPersonJsonLd(talent: TalentDetail, pageUrl: string) {
  const contractType = talent.contract_type ?? normalizeContractType(null);
  const defaultDesc = defaultAboutText(
    talent.name,
    talent.category || "Content Creator",
    contractType
  );
  const handle = instagramHandleLabel(talent.instagram_username);
  const igAccount = talent.socialAccounts.find(
    (s) => s.platform?.toLowerCase() === "instagram"
  );
  const instagramUrl =
    igAccount?.url ||
    (talent.instagram_username
      ? `https://www.instagram.com/${talent.instagram_username}/`
      : undefined);

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: talent.name,
    ...(handle
      ? {
          alternateName: [handle, talent.instagram_username].filter(
            (v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i
          ),
        }
      : {}),
    ...(handle
      ? {
          identifier: {
            "@type": "PropertyValue",
            propertyID: "Instagram",
            name: "Instagram",
            value: handle,
          },
        }
      : {}),
    image: talent.avatar_url || undefined,
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    jobTitle: talent.category || "Content Creator",
    description: talent.about || defaultDesc,
    worksFor:
      contractType === "released"
        ? undefined
        : {
            "@type": "Organization",
            name: AGENCY_NAME,
            url: "https://www.wallsentertainment.com",
            description:
              "Global talent management, sports, entertainment, and advisory company.",
          },
    memberOf:
      contractType === "released"
        ? undefined
        : {
            "@type": "Organization",
            name: AGENCY_NAME,
            url: "https://www.wallsentertainment.com",
          },
    sameAs: Array.from(
      new Set(
        [
          instagramUrl,
          ...talent.socialAccounts.map((s) => s.url).filter(Boolean),
        ].filter(Boolean)
      )
    ),
    ...(talent.city || talent.country
      ? {
          homeLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: talent.city || undefined,
              addressCountry: talent.country || undefined,
            },
          },
        }
      : {}),
  };
}

export function buildFaqJsonLd(talent: TalentDetail) {
  const category = talent.category || "content creator";
  const contractType = talent.contract_type ?? normalizeContractType(null);
  const items = buildFaqItems(
    talent.name,
    category,
    contractType,
    talent.instagram_username
  );

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildBreadcrumbJsonLd(talent: TalentDetail, pageUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://www.wallsentertainment.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Representation",
        item: "https://www.wallsentertainment.com/representation",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: instagramHandleLabel(talent.instagram_username) || talent.name,
        item: pageUrl,
      },
    ],
  };
}

export function buildRepresentationActionJsonLd(
  talent: TalentDetail,
  pageUrl: string
) {
  const contractType = talent.contract_type ?? normalizeContractType(null);
  const status = representationStatusPhrasePresent(contractType);

  return {
    "@context": "https://schema.org",
    "@type": "RepresentativeAction",
    agent: {
      "@type": "Organization",
      name: AGENCY_NAME,
      url: "https://www.wallsentertainment.com",
    },
    object: {
      "@type": "Person",
      name: talent.name,
      url: pageUrl,
    },
    description: (() => {
      const handle = instagramHandleLabel(talent.instagram_username);
      const subject = handle ? `${handle} (${talent.name})` : talent.name;
      return `Official WALLS certification: ${subject} ${status} by ${AGENCY_NAME} for brand partnerships and collaborations.`;
    })(),
  };
}

/** WebPage schema reinforces @handle + certification intent for search. */
export function buildWebPageJsonLd(talent: TalentDetail, pageUrl: string) {
  const handle = instagramHandleLabel(talent.instagram_username);
  const title = buildRepresentationTitle(talent);
  const description = buildRepresentationDescription(talent);

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: pageUrl,
    inLanguage: "en-US",
    isPartOf: {
      "@type": "WebSite",
      name: AGENCY_SHORT,
      url: "https://www.wallsentertainment.com",
    },
    about: {
      "@type": "Person",
      name: talent.name,
      ...(handle ? { alternateName: handle } : {}),
    },
    keywords: buildRepresentationKeywords(talent).slice(0, 20).join(", "),
  };
}
