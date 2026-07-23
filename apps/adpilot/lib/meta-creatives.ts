import { createAdminClient } from "@walls/supabase/admin";

import { type AdDataScope, adScopeFields } from "@/lib/ad-scope";
import { META_PROVIDER } from "@/lib/connections";
import {
  fetchMetaAdImagesByHash,
  fetchMetaVideoDetails,
  type MetaAdImage,
} from "@/lib/meta-graph";

export type MetaAdCreative = {
  id?: string;
  name?: string;
  title?: string;
  body?: string;
  object_type?: string;
  call_to_action_type?: string;
  link_url?: string;
  thumbnail_url?: string;
  image_hash?: string;
  image_url?: string;
  video_id?: string;
  effective_object_story_id?: string;
  object_story_spec?: MetaObjectStorySpec;
  asset_feed_spec?: MetaAssetFeedSpec;
};

type MetaChildAttachment = {
  image_hash?: string;
  video_id?: string;
  picture?: string;
  link?: string;
  name?: string;
  description?: string;
};

type MetaObjectStorySpec = {
  link_data?: {
    message?: string;
    caption?: string;
    link?: string;
    picture?: string;
    image_hash?: string;
    child_attachments?: MetaChildAttachment[];
  };
  video_data?: {
    video_id?: string;
    message?: string;
    title?: string;
    image_url?: string;
    image_hash?: string;
    call_to_action?: { type?: string; value?: { link?: string } };
  };
  photo_data?: {
    image_hash?: string;
    url?: string;
    caption?: string;
  };
};

type MetaAssetFeedSpec = {
  images?: Array<{ hash?: string; url?: string }>;
  videos?: Array<{ video_id?: string; thumbnail_url?: string; url?: string }>;
  titles?: Array<{ text?: string }>;
  bodies?: Array<{ text?: string }>;
  call_to_action_types?: string[];
  link_urls?: Array<{ website_url?: string; display_url?: string }>;
};

export type ParsedCreativeAsset = {
  assetType: "image" | "video";
  assetKey: string;
  ordinal: number;
  imageHash: string | null;
  imageUrl: string | null;
  videoId: string | null;
  videoThumbnailUrl: string | null;
  title: string | null;
  body: string | null;
};

export type ParsedCreative = {
  creativeId: string | null;
  creativeName: string | null;
  creativeType: string;
  title: string | null;
  body: string | null;
  caption: string | null;
  message: string | null;
  ctaType: string | null;
  linkUrl: string | null;
  destinationUrl: string | null;
  thumbnailUrl: string | null;
  imageHash: string | null;
  imageUrl: string | null;
  videoId: string | null;
  effectiveObjectStoryId: string | null;
  objectStorySpec: MetaObjectStorySpec | null;
  assetFeedSpec: MetaAssetFeedSpec | null;
  raw: MetaAdCreative;
  assets: ParsedCreativeAsset[];
};

/** Ad fields (including creative expansion) to request from the Graph API. */
export const AD_CREATIVE_FIELDS =
  "id,name,status,adset_id,campaign_id,creative{id,name,title,body,object_type,call_to_action_type,link_url,thumbnail_url,image_hash,image_url,video_id,effective_object_story_id,object_story_spec,asset_feed_spec}";

function firstText(items: Array<{ text?: string }> | undefined): string | null {
  if (!items?.length) return null;
  const match = items.find((item) => item.text?.trim());
  return match?.text?.trim() ?? null;
}

function pushAsset(
  assets: ParsedCreativeAsset[],
  seen: Set<string>,
  asset: Omit<ParsedCreativeAsset, "ordinal" | "assetKey"> & { assetKey: string },
) {
  if (seen.has(asset.assetKey)) return;
  seen.add(asset.assetKey);
  assets.push({ ...asset, ordinal: assets.length });
}

/** Normalize a Meta creative into flat fields + a deduped list of media assets. */
export function parseCreative(creative: MetaAdCreative | null | undefined): ParsedCreative | null {
  if (!creative) return null;

  const spec = creative.object_story_spec ?? null;
  const feed = creative.asset_feed_spec ?? null;

  const assets: ParsedCreativeAsset[] = [];
  const seen = new Set<string>();

  const addImage = (hash?: string | null, url?: string | null, title?: string | null, body?: string | null) => {
    if (!hash && !url) return;
    pushAsset(assets, seen, {
      assetType: "image",
      assetKey: hash ? `image:${hash}` : `image-url:${url}`,
      imageHash: hash ?? null,
      imageUrl: url ?? null,
      videoId: null,
      videoThumbnailUrl: null,
      title: title ?? null,
      body: body ?? null,
    });
  };

  const addVideo = (
    videoId?: string | null,
    thumbnailUrl?: string | null,
    title?: string | null,
    body?: string | null,
  ) => {
    if (!videoId) return;
    pushAsset(assets, seen, {
      assetType: "video",
      assetKey: `video:${videoId}`,
      imageHash: null,
      imageUrl: null,
      videoId,
      videoThumbnailUrl: thumbnailUrl ?? null,
      title: title ?? null,
      body: body ?? null,
    });
  };

  // Top-level creative media
  addVideo(creative.video_id, creative.thumbnail_url);
  addImage(creative.image_hash, creative.image_url);

  // object_story_spec variants
  if (spec?.video_data) {
    addVideo(
      spec.video_data.video_id,
      spec.video_data.image_url,
      spec.video_data.title,
      spec.video_data.message,
    );
    addImage(spec.video_data.image_hash, spec.video_data.image_url);
  }
  if (spec?.link_data) {
    addImage(spec.link_data.image_hash, spec.link_data.picture);
    for (const child of spec.link_data.child_attachments ?? []) {
      addVideo(child.video_id, child.picture, child.name, child.description);
      addImage(child.image_hash, child.picture, child.name, child.description);
    }
  }
  if (spec?.photo_data) {
    addImage(spec.photo_data.image_hash, spec.photo_data.url, null, spec.photo_data.caption);
  }

  // asset_feed_spec (dynamic / Advantage+ creative)
  for (const image of feed?.images ?? []) {
    addImage(image.hash, image.url);
  }
  for (const video of feed?.videos ?? []) {
    addVideo(video.video_id, video.thumbnail_url);
  }

  const hasVideo = assets.some((asset) => asset.assetType === "video");
  const imageCount = assets.filter((asset) => asset.assetType === "image").length;
  const isCarousel = (spec?.link_data?.child_attachments?.length ?? 0) > 1;
  const isDynamic = Boolean(feed);

  let creativeType = "unknown";
  if (isDynamic) creativeType = "dynamic";
  else if (isCarousel) creativeType = "carousel";
  else if (hasVideo) creativeType = "video";
  else if (imageCount > 0) creativeType = "image";
  else if (creative.body || creative.title) creativeType = "text";

  const linkUrl =
    creative.link_url ??
    spec?.link_data?.link ??
    spec?.video_data?.call_to_action?.value?.link ??
    firstText(
      (feed?.link_urls ?? []).map((item) => ({ text: item.website_url })),
    ) ??
    null;

  return {
    creativeId: creative.id ?? null,
    creativeName: creative.name ?? null,
    creativeType,
    title: creative.title ?? spec?.video_data?.title ?? firstText(feed?.titles) ?? null,
    body: creative.body ?? spec?.link_data?.message ?? firstText(feed?.bodies) ?? null,
    caption: spec?.link_data?.caption ?? spec?.photo_data?.caption ?? null,
    message: spec?.link_data?.message ?? spec?.video_data?.message ?? null,
    ctaType:
      creative.call_to_action_type ??
      spec?.video_data?.call_to_action?.type ??
      feed?.call_to_action_types?.[0] ??
      null,
    linkUrl,
    destinationUrl: linkUrl,
    thumbnailUrl: creative.thumbnail_url ?? null,
    imageHash: creative.image_hash ?? spec?.link_data?.image_hash ?? null,
    imageUrl: creative.image_url ?? null,
    videoId: creative.video_id ?? spec?.video_data?.video_id ?? null,
    effectiveObjectStoryId: creative.effective_object_story_id ?? null,
    objectStorySpec: spec,
    assetFeedSpec: feed,
    raw: creative,
    assets,
  };
}

type PersistCreativeInput = {
  scope: AdDataScope;
  connectionId: string;
  accountId: string;
  accessToken: string;
  adEntityId: string;
  providerAdId: string;
  parsed: ParsedCreative;
};

/**
 * Upsert a creative and its assets, resolving durable image permalinks and
 * playable video source URLs. Failures here are swallowed by the caller so a
 * creative issue never aborts the wider sync.
 */
export async function persistAdCreative(input: PersistCreativeInput): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { parsed } = input;

  // Resolve durable image permalinks for all image hashes on this creative.
  const hashes = parsed.assets
    .map((asset) => asset.imageHash)
    .filter((hash): hash is string => Boolean(hash));

  let imagesByHash = new Map<string, MetaAdImage>();
  if (hashes.length > 0) {
    try {
      imagesByHash = await fetchMetaAdImagesByHash(
        input.accountId,
        input.accessToken,
        hashes,
      );
    } catch {
      // Non-fatal: fall back to temporary URLs.
    }
  }

  const primaryPermalink = parsed.imageHash
    ? (imagesByHash.get(parsed.imageHash)?.permalink_url ?? null)
    : null;

  const creativeRow = {
    ...adScopeFields(input.scope),
    account_connection_id: input.connectionId,
    ad_entity_id: input.adEntityId,
    provider: META_PROVIDER,
    provider_ad_id: input.providerAdId,
    creative_id: parsed.creativeId,
    creative_name: parsed.creativeName,
    creative_type: parsed.creativeType,
    title: parsed.title,
    body: parsed.body,
    caption: parsed.caption,
    message: parsed.message,
    cta_type: parsed.ctaType,
    link_url: parsed.linkUrl,
    destination_url: parsed.destinationUrl,
    thumbnail_url: parsed.thumbnailUrl,
    image_hash: parsed.imageHash,
    image_url: parsed.imageUrl,
    image_permalink_url: primaryPermalink,
    video_id: parsed.videoId,
    effective_object_story_id: parsed.effectiveObjectStoryId,
    object_story_spec: parsed.objectStorySpec,
    asset_feed_spec: parsed.assetFeedSpec,
    raw_creative: parsed.raw,
    assets_synced_at: now,
    last_synced_at: now,
    updated_at: now,
  };

  const { data: creativeUpsert, error: creativeError } = await admin
    .from("ad_creatives")
    .upsert(creativeRow, { onConflict: "account_connection_id,provider_ad_id" })
    .select("id")
    .single();

  if (creativeError) throw creativeError;
  const adCreativeId = creativeUpsert.id as string;

  // Resolve video source URLs (playable) for each video asset, dedup by id.
  const videoIds = Array.from(
    new Set(
      parsed.assets
        .map((asset) => asset.videoId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const videoDetails = new Map(
    await Promise.all(
      videoIds.map(async (videoId) => {
        const details = await fetchMetaVideoDetails(videoId, input.accessToken);
        return [videoId, details] as const;
      }),
    ),
  );

  let primaryVideoSource: string | null = null;
  let primaryVideoPermalink: string | null = null;
  let primaryVideoThumbnail: string | null = null;

  for (const asset of parsed.assets) {
    const image = asset.imageHash ? imagesByHash.get(asset.imageHash) : undefined;
    const video = asset.videoId ? videoDetails.get(asset.videoId) : undefined;

    if (asset.videoId && video) {
      if (!primaryVideoSource && video.source) primaryVideoSource = video.source;
      if (!primaryVideoPermalink && video.permalink_url) {
        primaryVideoPermalink = video.permalink_url;
      }
      if (!primaryVideoThumbnail) {
        primaryVideoThumbnail = video.picture ?? asset.videoThumbnailUrl ?? null;
      }
    }

    const assetRow = {
      ...adScopeFields(input.scope),
      ad_creative_id: adCreativeId,
      ad_entity_id: input.adEntityId,
      asset_type: asset.assetType,
      asset_key: asset.assetKey,
      ordinal: asset.ordinal,
      image_hash: asset.imageHash,
      image_url: asset.imageUrl,
      permalink_url: image?.permalink_url ?? null,
      video_id: asset.videoId,
      video_source_url: video?.source ?? null,
      video_thumbnail_url: video?.picture ?? asset.videoThumbnailUrl,
      width: image?.width ?? null,
      height: image?.height ?? null,
      duration_seconds: video?.length ?? null,
      title: asset.title,
      body: asset.body,
      transcript_status: asset.assetType === "video" ? "pending" : "not_applicable",
      raw_payload: { image: image ?? null, video: video ?? null },
      updated_at: now,
    };

    const { error: assetError } = await admin
      .from("ad_creative_assets")
      .upsert(assetRow, { onConflict: "ad_creative_id,asset_key" });

    if (assetError) throw assetError;
  }

  if (primaryVideoSource || primaryVideoPermalink || primaryVideoThumbnail) {
    await admin
      .from("ad_creatives")
      .update({
        video_source_url: primaryVideoSource,
        video_permalink_url: primaryVideoPermalink,
        video_thumbnail_url: primaryVideoThumbnail,
        updated_at: now,
      })
      .eq("id", adCreativeId);
  }
}

/** Best available preview URL for UI display (prefers video poster, then durable image). */
export function pickCreativeThumbnailUrl(creative: {
  video_thumbnail_url?: string | null;
  thumbnail_url?: string | null;
  image_permalink_url?: string | null;
  image_url?: string | null;
} | null | undefined): string | null {
  if (!creative) return null;
  return (
    creative.video_thumbnail_url ??
    creative.thumbnail_url ??
    creative.image_permalink_url ??
    creative.image_url ??
    null
  );
}

export type CreativeAssetRow = {
  id: string;
  asset_type: string;
  ordinal: number;
  image_url?: string | null;
  permalink_url?: string | null;
  video_source_url?: string | null;
  video_thumbnail_url?: string | null;
  title?: string | null;
  body?: string | null;
};

export type CreativeRowForPreview = {
  creative_type?: string | null;
  title?: string | null;
  body?: string | null;
  thumbnail_url?: string | null;
  image_url?: string | null;
  image_permalink_url?: string | null;
  video_thumbnail_url?: string | null;
  video_source_url?: string | null;
  ad_creative_assets?: CreativeAssetRow[] | null;
};

export type AdCreativeMediaItem = {
  id: string;
  assetType: "image" | "video";
  ordinal: number;
  imageUrl: string | null;
  videoSourceUrl: string | null;
  posterUrl: string | null;
  title: string | null;
  body: string | null;
};

export type AdCreativePreview = {
  creativeType: string | null;
  title: string | null;
  body: string | null;
  thumbnailUrl: string | null;
  media: AdCreativeMediaItem[];
};

function pickImageDisplayUrl(
  permalinkUrl?: string | null,
  imageUrl?: string | null,
  fallback?: string | null,
): string | null {
  return permalinkUrl ?? imageUrl ?? fallback ?? null;
}

/** Build a lightbox-ready preview from a synced creative row + child assets. */
export function buildAdCreativePreview(
  row: CreativeRowForPreview,
): AdCreativePreview | null {
  const media: AdCreativeMediaItem[] = [];
  const childAssets = [...(row.ad_creative_assets ?? [])].sort(
    (left, right) => left.ordinal - right.ordinal,
  );

  for (const asset of childAssets) {
    if (asset.asset_type === "video") {
      // Keep it a video item even when the raw MP4 source is restricted - the
      // lightbox falls back to Meta's ad preview player using the poster.
      media.push({
        id: asset.id,
        assetType: "video",
        ordinal: asset.ordinal,
        imageUrl: null,
        videoSourceUrl: asset.video_source_url ?? null,
        posterUrl: asset.video_thumbnail_url ?? row.video_thumbnail_url ?? null,
        title: asset.title ?? null,
        body: asset.body ?? null,
      });
      continue;
    }

    const imageUrl = pickImageDisplayUrl(
      asset.permalink_url,
      asset.image_url,
      asset.video_thumbnail_url,
    );
    if (imageUrl) {
      media.push({
        id: asset.id,
        assetType: "image",
        ordinal: asset.ordinal,
        imageUrl,
        videoSourceUrl: null,
        posterUrl: null,
        title: asset.title ?? null,
        body: asset.body ?? null,
      });
    }
  }

  // Fallback when child assets weren't synced but parent creative has media refs.
  if (media.length === 0) {
    const isVideoCreative =
      row.creative_type === "video" ||
      Boolean(row.video_source_url) ||
      Boolean(row.video_thumbnail_url);

    if (isVideoCreative) {
      media.push({
        id: "primary-video",
        assetType: "video",
        ordinal: 0,
        imageUrl: null,
        videoSourceUrl: row.video_source_url ?? null,
        posterUrl: row.video_thumbnail_url ?? row.thumbnail_url ?? null,
        title: row.title ?? null,
        body: row.body ?? null,
      });
    }

    // Avoid duplicating the video poster as a standalone image slide.
    const primaryImage = isVideoCreative
      ? pickImageDisplayUrl(row.image_permalink_url, row.image_url)
      : pickImageDisplayUrl(row.image_permalink_url, row.image_url, row.thumbnail_url);
    if (primaryImage) {
      media.push({
        id: "primary-image",
        assetType: "image",
        ordinal: media.length,
        imageUrl: primaryImage,
        videoSourceUrl: null,
        posterUrl: null,
        title: row.title ?? null,
        body: row.body ?? null,
      });
    }
  }

  if (media.length === 0) return null;

  return {
    creativeType: row.creative_type ?? null,
    title: row.title ?? null,
    body: row.body ?? null,
    thumbnailUrl: pickCreativeThumbnailUrl(row),
    media,
  };
}
