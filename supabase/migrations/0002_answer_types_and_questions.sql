-- ============================================================
-- Migration 0002: Answer Types + Questions + Choices
-- ============================================================

-- ANSWER TYPES (lookup table)
-- Starts with MCQ, TRUE_FALSE, GRID_IN — but adding a new type later
-- is just an INSERT here, not a schema change or code rewrite.
create table answer_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,        -- e.g. 'MCQ', 'TRUE_FALSE', 'GRID_IN'
  label text not null,              -- e.g. 'Multiple Choice'
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into answer_types (code, label, description) values
  ('MCQ', 'Multiple Choice', 'Single correct answer from a list of choices'),
  ('TRUE_FALSE', 'True / False', 'Two-option true or false question'),
  ('GRID_IN', 'Numeric / Grid-In', 'Free-form numeric answer, no choices given');

-- QUESTIONS
-- The core table. Content itself lives in content_blocks (JSONB) —
-- see the note below on why.
create table questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  -- Taxonomy (all optional individually, since a question might only
  -- be tagged down to "category" level, not necessarily to "skill")
  exam_id uuid references exams(id) on delete set null,
  subject_id uuid references subjects(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  chapter_id uuid references chapters(id) on delete set null,
  lesson_id uuid references lessons(id) on delete set null,
  skill_id uuid references skills(id) on delete set null,

  difficulty text not null default 'medium'
    check (difficulty in ('easy', 'medium', 'hard')),

  points numeric not null default 1,
  estimated_time_seconds integer not null default 60,

  answer_type_id uuid not null references answer_types(id),

  -- Structured content: an ordered array of blocks.
  -- Example: [{"type":"text","value":"Solve for x:"},
  --           {"type":"math","latex":"x^2 + 3 = 12"}]
  content_blocks jsonb not null default '[]'::jsonb,

  explanation_blocks jsonb not null default '[]'::jsonb,

  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CHOICES
-- Used by MCQ (and later, multiple-select). One row per choice.
-- Not every answer_type uses this table (e.g. GRID_IN won't have rows here).
create table question_choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  content_blocks jsonb not null default '[]'::jsonb,  -- choice text/math, same block format as questions
  is_correct boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- CORRECT ANSWERS (for answer types that don't use choices, e.g. GRID_IN)
-- Kept generic so future types (short text, ordering, matching) can
-- store their "correct answer shape" here without a new table each time.
create table question_correct_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  -- e.g. for GRID_IN: {"value": 42, "tolerance": 0.01}
  -- for TRUE_FALSE:   {"value": true}
  answer_data jsonb not null,
  created_at timestamptz not null default now()
);

-- Indexes for common filters (search/filter by taxonomy, status, difficulty)
create index idx_questions_org on questions(organization_id);
create index idx_questions_exam on questions(exam_id);
create index idx_questions_subject on questions(subject_id);
create index idx_questions_category on questions(category_id);
create index idx_questions_chapter on questions(chapter_id);
create index idx_questions_lesson on questions(lesson_id);
create index idx_questions_skill on questions(skill_id);
create index idx_questions_status on questions(status);
create index idx_questions_difficulty on questions(difficulty);
create index idx_choices_question on question_choices(question_id);
create index idx_correct_answers_question on question_correct_answers(question_id);

-- RLS: enabled now, real policies added in Stage 3 once auth/roles exist
alter table answer_types enable row level security;
alter table questions enable row level security;
alter table question_choices enable row level security;
alter table question_correct_answers enable row level security;