-- Seed the internal Kenoo Console app (system-wide staff tools).
-- Run manually against Supabase when deploying console.kenoo.io.

INSERT INTO apps (slug, name, subdomain, is_active, icon_url)
VALUES (
  'console',
  'Console',
  'console',
  true,
  'https://assets.wallsentertainment.com/logo-variations/black-logo.png'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  subdomain = EXCLUDED.subdomain,
  is_active = EXCLUDED.is_active;
