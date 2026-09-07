-- ============================================================
-- Migration 0006: Levels + Courses + Evaluation Rules
-- ============================================================

-- LEVELS
-- Teacher-configurable performance bands, e.g. "Foundation: 0-39%"
create table levels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  name text not null,               -- e.g. "Foundation"
  min_percentage numeric not null,  -- e.g. 0
  max_percentage numeric not null,  -- e.g. 39
  description text,
  recommendation text,

  display_order integer not null default 0,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (min_percentage >= 0 and max_percentage <= 100),
  check (min_percentage <= max_percentage)
);

-- COURSES
-- Marketing/recommendation content shown based on a student's level.
create table courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  name text not null,
  description text,
  image_url text,
  registration_url text,
  google_form_url text,
  phone text,
  whatsapp_url text,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- LEVEL <-> COURSE LINK
-- A level can recommend one or more courses (many-to-many, in case
-- a teacher wants to offer alternatives for the same level later).
create table level_courses (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references levels(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  display_order integer not null default 0,

  unique (level_id, course_id)
);

-- EVALUATION RULES
-- Configurable strong/average/weak thresholds, per organization.
-- Kept as flexible key-value config rather than fixed columns, since
-- your spec explicitly says these shouldn't be permanently hard-coded
-- and more rule types may be needed later.
create table evaluation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  rule_key text not null,     -- e.g. 'strong_threshold_percent', 'weak_threshold_percent'
  rule_value jsonb not null,  -- e.g. 75  (stored as JSON so it can hold numbers, strings, or objects)
  description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, rule_key)
);

-- Indexes
create index idx_levels_org on levels(organization_id);
create index idx_courses_org on courses(organization_id);
create index idx_level_courses_level on level_courses(level_id);
create index idx_level_courses_course on level_courses(course_id);
create index idx_evaluation_rules_org on evaluation_rules(organization_id);

-- RLS: enabled now, real policies in Stage 3
alter table levels enable row level security;
alter table courses enable row level security;
alter table level_courses enable row level security;
alter table evaluation_rules enable row level security;