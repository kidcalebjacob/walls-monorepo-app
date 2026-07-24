export type PublicApp = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  href: string;
};

const ADMIN_APP_SLUG = process.env.NEXT_PUBLIC_ADMIN_APP_SLUG ?? "admin";
const CONSOLE_APP_SLUG = process.env.NEXT_PUBLIC_CONSOLE_APP_SLUG ?? "console";
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "kenoo.io";

const HIDDEN_SLUGS = new Set([ADMIN_APP_SLUG, CONSOLE_APP_SLUG]);

type AppsRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  subdomain: string | null;
  url_redirect: string | null;
};

function iconForApp(slug: string, iconUrl: string | null): string {
  if (iconUrl) return iconUrl;
  return `https://assets.wallsentertainment.com/walls-app-icons/${slug}.svg`;
}

function hrefForApp(app: AppsRow): string {
  const subdomain = app.subdomain?.trim();
  if (subdomain) {
    return `https://${subdomain.replace(/^\.+|\.+$/g, "")}.${ROOT_DOMAIN}`;
  }

  const redirect = app.url_redirect?.trim();
  if (redirect && /^https?:\/\//i.test(redirect)) {
    return redirect.replace(/\/$/, "");
  }

  return process.env.NEXT_PUBLIC_WALLS_AGENCY_URL ?? "https://portal.kenoo.io";
}

export function mapAppsRows(rows: AppsRow[]): PublicApp[] {
  return rows
    .filter((row) => !HIDDEN_SLUGS.has(row.slug))
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      icon: iconForApp(row.slug, row.icon_url),
      href: hrefForApp(row),
    }));
}

export const PUBLIC_APPS_SELECT =
  "id, slug, name, description, icon_url, subdomain, url_redirect";
