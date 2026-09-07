-- ============================================================
-- Migration 0001: Organizations + Taxonomy
-- ============================================================

-- ORGANIZATIONS
-- Even though v1 has exactly one org, every future feature
-- (multi-tenant, branding, marketing settings) hangs off this table.
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  website_url text,
  phone text,
  whatsapp_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- TAXONOMY: EXAMS
-- Top level: SAT, ACT, EST, Custom, etc.
create table exams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SUBJECTS (belongs to an exam)
-- e.g. "Mathematics" under SAT
create table subjects (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CATEGORIES (belongs to a subject)
-- e.g. "Algebra", "Advanced Math", "Problem Solving"
create table categories (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CHAPTERS (belongs to a category)
create table chapters (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- LESSONS (belongs to a chapter)
create table lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references chapters(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SKILLS (belongs to a lesson)
-- Finest-grained taxonomy level; used for skill-level performance reporting
create table skills (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes for the foreign keys we'll filter/join on constantly
create index idx_exams_org on exams(organization_id);
create index idx_subjects_exam on subjects(exam_id);
create index idx_categories_subject on categories(subject_id);
create index idx_chapters_category on chapters(category_id);
create index idx_lessons_chapter on lessons(chapter_id);
create index idx_skills_lesson on skills(lesson_id);

-- ============================================================
-- Row Level Security: enable now, add real policies once auth exists (Stage 3)
-- ============================================================
-- Enabling RLS with NO policies means: nobody can read/write via the
-- public API (anon/publishable key) until we explicitly allow it.
-- This is the safe default — it blocks everything rather than
-- accidentally exposing data while auth isn't built yet.

alter table organizations enable row level security;
alter table exams enable row level security;
alter table subjects enable row level security;
alter table categories enable row level security;
alter table chapters enable row level security;
alter table lessons enable row level security;
alter table skills enable row level security;