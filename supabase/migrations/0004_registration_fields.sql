-- ============================================================
-- Migration 0004: Registration Fields (dynamic student form)
-- ============================================================

-- REGISTRATION FIELDS
-- Defines what fields appear on the student registration form,
-- per organization. Teachers manage these from the UI — no code
-- changes needed to add/remove/reorder fields.
create table registration_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  label text not null,           -- e.g. "Full Name", "Parent Phone"
  field_key text not null,       -- e.g. "full_name" — used as the JSON key when storing responses
  field_type text not null
    check (field_type in ('text', 'email', 'phone', 'number', 'dropdown', 'radio', 'checkbox', 'date', 'textarea')),

  is_required boolean not null default true,

  -- For dropdown/radio/checkbox: the list of options.
  -- e.g. ["Grade 9", "Grade 10", "Grade 11", "Grade 12"]
  -- Null/empty for field types that don't need options (text, email, etc.)
  options jsonb,

  -- Optional extra validation rules beyond required/type,
  -- e.g. {"minLength": 2, "pattern": "^[A-Za-z ]+$"}
  validation_rules jsonb,

  display_order integer not null default 0,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, field_key)  -- field keys must be unique per org
);

create index idx_registration_fields_org on registration_fields(organization_id);

alter table registration_fields enable row level security;