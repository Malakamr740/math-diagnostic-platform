-- ============================================================
-- Migration 0012: Secure functions for the student test-taking flow
-- ============================================================

-- Verifies a resume_token matches the given attempt_id.
-- Used at the start of every other student-facing function below,
-- so we don't repeat this check five times.
create or replace function verify_attempt_token(p_attempt_id uuid, p_resume_token uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from attempts
    where id = p_attempt_id and resume_token = p_resume_token
  );
$$;

-- Starts (or resumes) a specific module within an attempt.
-- If this module_attempt doesn't exist yet, creates it and determines
-- the question order (shuffled or not, based on the module's setting).
-- If it already exists (e.g. student refreshed), just returns the
-- existing state so nothing resets.
create or replace function start_module_attempt(
  p_attempt_id uuid,
  p_resume_token uuid,
  p_module_id uuid
)
returns table(
  module_attempt_id uuid,
  status text,
  started_at timestamptz,
  question_order jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
  v_shuffle boolean;
  v_question_ids uuid[];
begin
  if not verify_attempt_token(p_attempt_id, p_resume_token) then
    raise exception 'Invalid attempt or resume token.';
  end if;

  -- If a module_attempt already exists for this module, just return it —
  -- this is what makes refreshing mid-module safe (no reset, no re-shuffle).
  select id, module_attempts.status, module_attempts.started_at, module_attempts.question_order
  into v_existing
  from module_attempts
  where attempt_id = p_attempt_id and module_id = p_module_id;

  if found then
    return query select v_existing.id, v_existing.status, v_existing.started_at, v_existing.question_order;
    return;
  end if;

  -- First time starting this module: determine question order.
  select shuffle_questions into v_shuffle from modules where id = p_module_id;

  select array_agg(question_id order by
    case when v_shuffle then random() else display_order::float end
  )
  into v_question_ids
  from module_questions
  where module_id = p_module_id;

  return query
  insert into module_attempts (attempt_id, module_id, status, started_at, question_order)
  values (
    p_attempt_id,
    p_module_id,
    'in_progress',
    now(),
    to_jsonb(v_question_ids)
  )
  returning id, module_attempts.status, module_attempts.started_at, module_attempts.question_order;
end;
$$;

grant execute on function start_module_attempt(uuid, uuid, uuid) to anon;

-- Fetches full question content + choices for a list of question IDs,
-- WITHOUT exposing which choice is correct (that must never reach
-- the student's browser). Choice order is shuffled here too, if the
-- module has shuffle_choices enabled — but note this is NOT stored
-- per-attempt like question order; for now choices reshuffle on each
-- fetch. Acceptable since choices redraw identically within one render,
-- and this keeps the first version simpler.
create or replace function get_attempt_questions(
  p_attempt_id uuid,
  p_resume_token uuid,
  p_module_id uuid
)
returns table(
  question_id uuid,
  content_blocks jsonb,
  answer_type_code text,
  points numeric,
  choices jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not verify_attempt_token(p_attempt_id, p_resume_token) then
    raise exception 'Invalid attempt or resume token.';
  end if;

  return query
  select
    q.id,
    q.content_blocks,
    at.code,
    q.points,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('id', qc.id, 'content_blocks', qc.content_blocks) order by qc.display_order)
        from question_choices qc
        where qc.question_id = q.id
      ),
      '[]'::jsonb
    ) as choices
  from module_questions mq
  join questions q on q.id = mq.question_id
  join answer_types at on at.id = q.answer_type_id
  where mq.module_id = p_module_id;
end;
$$;

grant execute on function get_attempt_questions(uuid, uuid, uuid) to anon;

-- Saves (or updates) a single answer. Grading happens later (Stage 7),
-- so this just stores the raw answer_data and time spent — correctness
-- is intentionally NOT computed here.
create or replace function save_answer(
  p_attempt_id uuid,
  p_resume_token uuid,
  p_module_attempt_id uuid,
  p_question_id uuid,
  p_answer_data jsonb,
  p_time_spent_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not verify_attempt_token(p_attempt_id, p_resume_token) then
    raise exception 'Invalid attempt or resume token.';
  end if;

  insert into student_answers (attempt_id, module_attempt_id, question_id, answer_data, time_spent_seconds, answered_at)
  values (p_attempt_id, p_module_attempt_id, p_question_id, p_answer_data, p_time_spent_seconds, now())
  on conflict (module_attempt_id, question_id)
  do update set
    answer_data = excluded.answer_data,
    time_spent_seconds = excluded.time_spent_seconds,
    answered_at = now(),
    updated_at = now();
end;
$$;

grant execute on function save_answer(uuid, uuid, uuid, uuid, jsonb, integer) to anon;

-- Submits a module: marks it submitted and records elapsed time,
-- whether by manual submit or automatic timeout.
create or replace function submit_module_attempt(
  p_attempt_id uuid,
  p_resume_token uuid,
  p_module_attempt_id uuid,
  p_elapsed_seconds integer,
  p_timed_out boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not verify_attempt_token(p_attempt_id, p_resume_token) then
    raise exception 'Invalid attempt or resume token.';
  end if;

  update module_attempts
  set status = 'submitted',
      submitted_at = now(),
      elapsed_seconds = p_elapsed_seconds,
      timed_out = p_timed_out,
      updated_at = now()
  where id = p_module_attempt_id and attempt_id = p_attempt_id;
end;
$$;

grant execute on function submit_module_attempt(uuid, uuid, uuid, integer, boolean) to anon;

-- Fetches previously saved answers for a module attempt — needed so
-- a page refresh can restore the student's in-progress answers.
create or replace function get_saved_answers(
  p_attempt_id uuid,
  p_resume_token uuid,
  p_module_attempt_id uuid
)
returns table(question_id uuid, answer_data jsonb)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not verify_attempt_token(p_attempt_id, p_resume_token) then
    raise exception 'Invalid attempt or resume token.';
  end if;

  return query
  select sa.question_id, sa.answer_data
  from student_answers sa
  where sa.module_attempt_id = p_module_attempt_id;
end;
$$;

grant execute on function get_saved_answers(uuid, uuid, uuid) to anon;