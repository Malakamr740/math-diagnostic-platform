-- ============================================================
-- Migration 0028: Question Sets / Test Collections
-- ============================================================

create table if not exists question_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  exam_id uuid references exams(id) on delete set null,
  title text not null,
  source_year text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_question_sets_org on question_sets(organization_id);
create index if not exists idx_question_sets_exam on question_sets(exam_id);

alter table questions
  add column if not exists question_set_id uuid references question_sets(id) on delete set null,
  add column if not exists source_item_number integer;

create index if not exists idx_questions_set on questions(question_set_id);

alter table question_sets enable row level security;

create policy "Teachers can manage question sets" on question_sets for all
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

-- Function to convert a whole question set into a published/draft assessment with one click
create or replace function convert_question_set_to_assessment(
  p_set_id uuid,
  p_assessment_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_exam_id uuid;
  v_set_title text;
  v_assessment_id uuid;
  v_module_id uuid;
  v_q record;
  v_order int := 0;
begin
  select organization_id into v_org_id
  from profiles
  where id = auth.uid() and role in ('admin', 'teacher');

  if v_org_id is null then
    raise exception 'Unauthorized.';
  end if;

  select exam_id, title into v_exam_id, v_set_title
  from question_sets
  where id = p_set_id and organization_id = v_org_id;

  if v_set_title is null then
    raise exception 'Question set not found.';
  end if;

  -- 1. Create Assessment
  insert into assessments (organization_id, exam_id, name, description, status)
  values (
    v_org_id,
    v_exam_id,
    coalesce(p_assessment_name, v_set_title),
    'Auto-generated from ' || v_set_title,
    'draft'
  )
  returning id into v_assessment_id;

  -- 2. Create Default Module
  insert into modules (assessment_id, name, display_order, timing_enabled, time_limit_minutes)
  values (
    v_assessment_id,
    'Section 1: Complete Test',
    0,
    true,
    75
  )
  returning id into v_module_id;

  -- 3. Link All Questions In Order
  for v_q in
    select id from questions
    where question_set_id = p_set_id and organization_id = v_org_id
    order by coalesce(source_item_number, 9999), created_at asc
  loop
    insert into module_questions (module_id, question_id, display_order, required)
    values (v_module_id, v_q.id, v_order, true);
    v_order := v_order + 1;
  end loop;

  return v_assessment_id;
end;
$$;

grant execute on function convert_question_set_to_assessment(uuid, text) to authenticated;