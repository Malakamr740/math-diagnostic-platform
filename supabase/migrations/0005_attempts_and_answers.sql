-- ============================================================
-- Migration 0005: Attempts + Module Attempts + Student Answers
-- ============================================================

-- ATTEMPTS
-- One row per student per assessment "sitting". Since students don't
-- log in (per your earlier decision), we identify an attempt via a
-- unique resume token instead of a user_id.
create table attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,

  -- Unique, unguessable token used in the resume link (e.g. ?attempt=xxxx)
  -- so a student can close the tab and come back without an account.
  resume_token uuid not null default gen_random_uuid() unique,

  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),

  started_at timestamptz not null default now(),
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- REGISTRATION RESPONSES
-- The student's answers to the dynamic registration form, tied to
-- this specific attempt. One row per attempt (not per field) —
-- all field answers live together in one JSONB object.
create table registration_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade unique,

  -- e.g. {"full_name": "Jane Doe", "email": "jane@example.com", "grade_level": "Grade 10"}
  -- Keys match registration_fields.field_key
  responses jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- MODULE ATTEMPTS
-- Tracks per-module timing/progress within one attempt.
create table module_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  module_id uuid not null references modules(id) on delete cascade,

  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'submitted')),

  started_at timestamptz,
  submitted_at timestamptz,
  elapsed_seconds integer not null default 0,  -- recorded even if module has no time limit

  timed_out boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (attempt_id, module_id)  -- one record per module per attempt
);

-- STUDENT ANSWERS
-- One row per question answered within a module attempt.
-- Saved incrementally as the student answers — not just on submit —
-- so a refresh doesn't lose progress.
create table student_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  module_attempt_id uuid not null references module_attempts(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,

  -- Generic structure so it works for any current/future answer type:
  -- MCQ:      {"choice_id": "uuid-of-selected-choice"}
  -- TRUE_FALSE: {"value": true}
  -- GRID_IN:  {"value": 42}
  answer_data jsonb not null default '{}'::jsonb,

  is_correct boolean,          -- null until graded
  points_earned numeric,       -- null until graded

  time_spent_seconds integer not null default 0,
  answered_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (module_attempt_id, question_id)  -- one answer record per question per module attempt
);

-- Indexes
create index idx_attempts_assessment on attempts(assessment_id);
create index idx_attempts_org on attempts(organization_id);
create index idx_attempts_resume_token on attempts(resume_token);
create index idx_module_attempts_attempt on module_attempts(attempt_id);
create index idx_module_attempts_module on module_attempts(module_id);
create index idx_student_answers_attempt on student_answers(attempt_id);
create index idx_student_answers_module_attempt on student_answers(module_attempt_id);
create index idx_student_answers_question on student_answers(question_id);

-- RLS: enabled now, real policies in Stage 3.
-- Note: students access these WITHOUT logging in, via resume_token —
-- so their RLS policies will look different from teacher policies
-- (token-based access, not auth.uid()-based). We'll design that
-- carefully in Stage 3 since it's the most security-sensitive part
-- of the whole app.
alter table attempts enable row level security;
alter table registration_responses enable row level security;
alter table module_attempts enable row level security;
alter table student_answers enable row level security;