import { startStravaOAuthLogin } from "@/lib/start-strava-oauth";

export async function GET() {
  return startStravaOAuthLogin();
}
