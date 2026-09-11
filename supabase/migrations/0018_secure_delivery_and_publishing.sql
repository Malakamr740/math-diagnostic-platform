-- Secure student delivery and publishing validation.
-- This migration replaces the public RPCs from 0012 with versions that
-- always verify that an attempt, module attempt, module, and question belong
-- to the same published assessment.

create or replace function assert_attempt_module_access(
  p_attempt_id uuid,
  p_resume_token uuid,
  p_module_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not verify_attempt_token(p_attempt_id, p_resume_token) then
    raise exception 'Invalid attempt or resume token.';
  end if;
  if not exists (
    select 1 from attempts a
    join assessments assessment on assessment.id = a.assessment_id
    join modules m on m.assessment_id = assessment.id
    where a.id = p_attempt_id and m.id = p_module_id
      and a.status = 'in_progress' and assessment.status = 'published'
  ) then
    raise exception 'This module is not available for this attempt.';
  end if;
end;
$$;

create or replace function start_module_attempt(p_attempt_id uuid, p_resume_token uuid, p_module_id uuid)
returns table(module_attempt_id uuid, status text, started_at timestamptz, question_order jsonb)
language plpgsql security definer set search_path = public as $$
declare v_existing record; v_shuffle boolean; v_question_ids uuid[];
begin
  perform assert_attempt_module_access(p_attempt_id, p_resume_token, p_module_id);
  select ma.id, ma.status, ma.started_at, ma.question_order into v_existing
  from module_attempts ma where ma.attempt_id = p_attempt_id and ma.module_id = p_module_id;
  if found then
    return query select v_existing.id, v_existing.status, v_existing.started_at, v_existing.question_order;
    return;
  end if;
  select shuffle_questions into v_shuffle from modules where id = p_module_id;
  select array_agg(question_id order by case when v_shuffle then random() else display_order::float end)
  into v_question_ids from module_questions where module_id = p_module_id;
  if coalesce(array_length(v_question_ids, 1), 0) = 0 then
    raise exception 'This module has no questions.';
  end if;
  return query insert into module_attempts (attempt_id, module_id, status, started_at, question_order)
  values (p_attempt_id, p_module_id, 'in_progress', now(), to_jsonb(v_question_ids))
  returning id, module_attempts.status, module_attempts.started_at, module_attempts.question_order;
end;
$$;

-- PostgreSQL does not allow CREATE OR REPLACE to change OUT columns.
-- This function has no database dependants, so replace its response shape safely.
drop function if exists get_attempt_questions(uuid, uuid, uuid);

create function get_attempt_questions(p_attempt_id uuid, p_resume_token uuid, p_module_id uuid)
returns table(question_id uuid, content_blocks jsonb, answer_type_code text, points numeric, required boolean, choices jsonb)
language plpgsql security definer set search_path = public as $$
begin
  perform assert_attempt_module_access(p_attempt_id, p_resume_token, p_module_id);
  return query
  select q.id, q.content_blocks, answer_type.code, coalesce(mq.points_override, q.points), mq.required,
    coalesce((select jsonb_agg(jsonb_build_object('id', qc.id, 'content_blocks', qc.content_blocks) order by qc.display_order)
      from question_choices qc where qc.question_id = q.id), '[]'::jsonb)
  from module_questions mq
  join questions q on q.id = mq.question_id and q.status = 'published'
  join answer_types answer_type on answer_type.id = q.answer_type_id
  where mq.module_id = p_module_id
  order by array_position((select array_agg(order_item.question_id::uuid) from jsonb_array_elements_text(
    (select question_order from module_attempts where attempt_id = p_attempt_id and module_id = p_module_id)
  ) as order_item(question_id)), q.id);
end;
$$;

create or replace function save_answer(
  p_attempt_id uuid, p_resume_token uuid, p_module_attempt_id uuid,
  p_question_id uuid, p_answer_data jsonb, p_time_spent_seconds integer
) returns void
language plpgsql security definer set search_path = public as $$
declare v_module_id uuid;
begin
  if not verify_attempt_token(p_attempt_id, p_resume_token) then raise exception 'Invalid attempt or resume token.'; end if;
  select module_id into v_module_id from module_attempts
  where id = p_module_attempt_id and attempt_id = p_attempt_id and status = 'in_progress';
  if v_module_id is null or not exists (
    select 1 from module_questions where module_id = v_module_id and question_id = p_question_id
  ) then raise exception 'Question is not available in this module.'; end if;
  insert into student_answers (attempt_id, module_attempt_id, question_id, answer_data, time_spent_seconds, answered_at)
  values (p_attempt_id, p_module_attempt_id, p_question_id, coalesce(p_answer_data, '{}'::jsonb), greatest(p_time_spent_seconds, 0), now())
  on conflict (module_attempt_id, question_id) do update set
    answer_data = excluded.answer_data, time_spent_seconds = excluded.time_spent_seconds,
    answered_at = now(), updated_at = now();
end;
$$;

create or replace function submit_module_attempt(
  p_attempt_id uuid, p_resume_token uuid, p_module_attempt_id uuid,
  p_elapsed_seconds integer, p_timed_out boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare v_module_id uuid; v_started_at timestamptz; v_missing integer;
begin
  if not verify_attempt_token(p_attempt_id, p_resume_token) then raise exception 'Invalid attempt or resume token.'; end if;
  select module_id, started_at into v_module_id, v_started_at from module_attempts
  where id = p_module_attempt_id and attempt_id = p_attempt_id and status = 'in_progress';
  if v_module_id is null then raise exception 'This module attempt cannot be submitted.'; end if;
  if not p_timed_out then
    select count(*) into v_missing from module_questions mq
    where mq.module_id = v_module_id and mq.required and not exists (
      select 1 from student_answers sa where sa.module_attempt_id = p_module_attempt_id
        and sa.question_id = mq.question_id and sa.answer_data <> '{}'::jsonb
    );
    if v_missing > 0 then raise exception '% required question(s) still need an answer.', v_missing; end if;
  end if;
  update module_attempts set status = 'submitted', submitted_at = now(),
    elapsed_seconds = greatest(0, floor(extract(epoch from now() - v_started_at))::integer),
    timed_out = p_timed_out, updated_at = now()
  where id = p_module_attempt_id;
  if not exists (select 1 from modules m where m.assessment_id = (select assessment_id from attempts where id = p_attempt_id)
                 and not exists (select 1 from module_attempts ma where ma.attempt_id = p_attempt_id and ma.module_id = m.id and ma.status = 'submitted')) then
    perform grade_attempt(p_attempt_id, p_resume_token);
    perform calculate_attempt_results(p_attempt_id);
  end if;
end;
$$;

create or replace function publish_assessment(p_assessment_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_org_id uuid; v_empty_modules text; v_unpublished integer;
begin
  select organization_id into v_org_id from profiles where id = auth.uid() and role in ('admin', 'teacher');
  if v_org_id is null or not exists (select 1 from assessments where id = p_assessment_id and organization_id = v_org_id) then
    raise exception 'You do not have permission to publish this assessment.';
  end if;
  if not exists (select 1 from modules where assessment_id = p_assessment_id) then raise exception 'Add at least one module before publishing.'; end if;
  select string_agg(m.name, ', ') into v_empty_modules from modules m
  where m.assessment_id = p_assessment_id and not exists (select 1 from module_questions mq where mq.module_id = m.id);
  if v_empty_modules is not null then raise exception 'Add questions to: %.', v_empty_modules; end if;
  select count(*) into v_unpublished from module_questions mq join modules m on m.id = mq.module_id
  join questions q on q.id = mq.question_id where m.assessment_id = p_assessment_id and q.status <> 'published';
  if v_unpublished > 0 then raise exception 'Publish or remove all draft/archived questions before publishing.'; end if;
  update assessments set status = 'published', updated_at = now() where id = p_assessment_id;
end;
$$;

grant execute on function assert_attempt_module_access(uuid, uuid, uuid) to anon;
grant execute on function start_module_attempt(uuid, uuid, uuid) to anon;
grant execute on function get_attempt_questions(uuid, uuid, uuid) to anon;
grant execute on function save_answer(uuid, uuid, uuid, uuid, jsonb, integer) to anon;
grant execute on function submit_module_attempt(uuid, uuid, uuid, integer, boolean) to anon;
grant execute on function publish_assessment(uuid) to authenticated;
