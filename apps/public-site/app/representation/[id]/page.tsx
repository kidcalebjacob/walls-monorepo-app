import { createClient } from "@walls/supabase/server";
import TalentDetailPage from "@/components/representationPage/talent-detail-page";
import { normalizeContractType } from "@/lib/representation/contract-type";
import { fetchTalentBySlugOrId } from "@/lib/representation/fetch-talent-by-slug-or-id";
import { fetchRelatedTalents } from "@/lib/representation/fetch-related-talents";
import {
  getInstagramUsernameFromAccounts,
  normalizeInstagramUsername,
} from "@/lib/representation/instagram-username";
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildPersonJsonLd,
  buildRepresentationActionJsonLd,
  buildRepresentationDescription,
  buildRepresentationKeywords,
  buildRepresentationPageUrl,
  buildRepresentationTitle,
  buildWebPageJsonLd,
  representationCanonicalPath,
} from "@/lib/representation/representation-seo";
import type { TalentDetail } from "@/lib/representation/types";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export type { TalentDetail };

async function getTalent(idOrSlug: string): Promise<TalentDetail | null> {
  const supabase = await createClient();
  const talent = await fetchTalentBySlugOrId(supabase, idOrSlug);

  if (!talent) return null;

  let name = "";
  let about: string | null = talent.bio_short || null;
  let category: string | null = null;

  if (talent.profile_id) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        name,
        profile_categories!profiles_category_id_fkey(name)
      `,
      )
      .eq("id", talent.profile_id)
      .limit(1);

    if (profileError) {
      console.error("getTalent profile:", profileError);
    } else if (profile?.[0]) {
      const row = profile[0];
      name = row.name || "";
      category =
        (row as { profile_categories?: { name?: string } | null })
          .profile_categories?.name || null;
    }
  }

  if (!name) {
    name =
      [talent.first_name, talent.last_name].filter(Boolean).join(" ") ||
      "Creator";
  }

  const { data: socialAccounts } = talent.profile_id
    ? await supabase
        .from("social_accounts")
        .select(
          "platform, username, url, followers, avg_likes, avg_comments, avg_views, engagement_rate",
        )
        .eq("profile_id", talent.profile_id)
    : { data: [] };

  const accounts = socialAccounts || [];
  const instagram_username = getInstagramUsernameFromAccounts(accounts);

  return {
    id: talent.id,
    name,
    about,
    avatar_url: talent.avatar_url,
    city: talent.city,
    country: talent.country,
    category,
    slug: talent.slug || null,
    instagram_username,
    walls_email: talent.walls_email,
    contract_type: normalizeContractType(talent.contract_type),
    socialAccounts: accounts,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const talent = await getTalent(id);

  if (!talent) {
    return { title: "Talent Not Found | WALLS Entertainment" };
  }

  const name = talent.name;
  const pageUrl = buildRepresentationPageUrl(talent, id);
  const imageUrl =
    talent.avatar_url ||
    "https://www.wallsentertainment.com/images/og-image.png";
  const title = buildRepresentationTitle(talent);
  const description = buildRepresentationDescription(talent);

  return {
    title,
    description,
    keywords: buildRepresentationKeywords(talent),
    openGraph: {
      type: "profile",
      url: pageUrl,
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 800,
          alt: `${name} - WALLS Entertainment representation certification`,
        },
      ],
      siteName: "WALLS Entertainment",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    alternates: {
      canonical: pageUrl,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function TalentDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const talent = await getTalent(id);

  if (!talent) {
    notFound();
  }

  const supabase = await createClient();
  const relatedTalents = await fetchRelatedTalents(supabase, talent.id);

  const pageUrl = buildRepresentationPageUrl(talent, id);
  const canonicalHandle = representationCanonicalPath(talent, id);

  const normalizedParam =
    normalizeInstagramUsername(id) || id.trim().toLowerCase();
  const normalizedCanonical =
    normalizeInstagramUsername(canonicalHandle) ||
    canonicalHandle.toLowerCase();

  if (normalizedParam !== normalizedCanonical) {
    redirect(`/representation/${canonicalHandle}`);
  }

  const jsonLdScripts = [
    buildWebPageJsonLd(talent, pageUrl),
    buildPersonJsonLd(talent, pageUrl),
    buildRepresentationActionJsonLd(talent, pageUrl),
    buildFaqJsonLd(talent),
    buildBreadcrumbJsonLd(talent, pageUrl),
  ];

  return (
    <>
      {jsonLdScripts.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <TalentDetailPage
        talent={talent}
        canonicalHandle={canonicalHandle}
        relatedTalents={relatedTalents}
      />
    </>
  );
}
