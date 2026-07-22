-- Seed the Kenoo Mail app (inbox / Gmail workflows).
-- Run manually against Supabase when enabling portal grants for mail.kenoo.io.

INSERT INTO apps (slug, name, subdomain, is_active, icon_url)
VALUES (
  'mail',
  'Mail',
  'mail',
  true,
  'https://assets.wallsentertainment.com/logo-variations/black-logo.png'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  subdomain = EXCLUDED.subdomain,
  is_active = EXCLUDED.is_active;
