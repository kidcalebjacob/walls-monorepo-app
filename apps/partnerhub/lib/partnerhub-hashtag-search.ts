export type HashtagSearchPlatform = "tiktok" | "youtube" | "instagram";

export function partnershipHashtagHasPlatform(
  platforms: string[] | null | undefined,
  platform: HashtagSearchPlatform,
): boolean {
  if (!platforms?.length) return false;
  const needle = platform.toLowerCase();
  return platforms.some((value) => value?.toLowerCase() === needle);
}
