-- ============================================================
-- Migration 0003: Assessments + Modules + Module Questions
-- ============================================================

-- ASSESSMENTS
-- The top-level test, e.g. "SAT Mathematics Diagnostic"
create table assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  exam_id uuid references exams(id) on delete set null,

  name text not null,
  description text,
  instructions text,

  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- MODULES
-- A section within an assessment, e.g. "Module 1: Algebra"
create table modules (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,

  name text not null,
  description text,
  instructions text,

  display_order integer not null default 0,

  timing_enabled boolean not null default true,
  time_limit_minutes integer,  -- null if timing_enabled is false

  shuffle_questions boolean not null default false,
  shuffle_choices boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- If timing is enabled, a time limit must be set.
  -- If timing is disabled, time_limit_minutes should be null.
  check (
    (timing_enabled = true and time_limit_minutes is not null)
    or
    (timing_enabled = false and time_limit_minutes is null)
  )
);

-- MODULE QUESTIONS
-- Join table: which questions belong to which module, in what order.
-- A question can appear in multiple modules/assessments (question bank reuse).
create table module_questions (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,

  display_order integer not null default 0,

  -- Optional override: use a different point value for this question
  -- in this specific module, without changing the question's base points.
  points_override numeric,

  created_at timestamptz not null default now(),

  unique (module_id, question_id)  -- a question can't be added twice to the same module
);

-- Indexes
create index idx_assessments_org on assessments(organization_id);
create index idx_assessments_status on assessments(status);
create index idx_modules_assessment on modules(assessment_id);
create index idx_module_questions_module on module_questions(module_id);
create index idx_module_questions_question on module_questions(question_id);

-- RLS: enabled now, real policies added in Stage 3
alter table assessments enable row level security;
alter table modules enable row level security;
alter table module_questions enable row level security;