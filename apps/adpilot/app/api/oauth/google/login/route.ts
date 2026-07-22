import { startGoogleAdsOAuthLogin } from "@/lib/start-google-ads-oauth";

/** Google Ads OAuth entry: https://adpilot.kenoo.io/api/oauth/google/login */
export async function GET() {
  return startGoogleAdsOAuthLogin();
}
