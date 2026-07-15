import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ProjectsBoardRedirectPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else if (value != null) {
      qs.set(key, value);
    }
  }
  const query = qs.toString();
  redirect(query ? `/tasks?${query}` : "/tasks");
}
