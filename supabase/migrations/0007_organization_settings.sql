-- ============================================================
-- Migration 0007: Organization Settings
-- ============================================================

-- ORGANIZATION SETTINGS
-- Global branding/marketing config, one row per organization.
-- Kept separate from the `organizations` table itself so that
-- core identity (name, id) stays lean, while presentation/marketing
-- settings — which will grow over time — live in their own table.
create table organization_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade unique,

  logo_url text,
  primary_color text,       -- e.g. '#aa3bff', for report/branding theming
  website_url text,
  contact_phone text,
  whatsapp_url text,

  -- Social links kept as JSONB since the exact platforms
  -- (Instagram, Facebook, TikTok, X, etc.) will vary and grow
  -- e.g. {"instagram": "https://...", "facebook": "https://..."}
  social_links jsonb not null default '{}'::jsonb,

  -- Default marketing copy shown on reports, editable without code changes
  marketing_tagline text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_org_settings_org on organization_settings(organization_id);

alter table organization_settings enable row level security;