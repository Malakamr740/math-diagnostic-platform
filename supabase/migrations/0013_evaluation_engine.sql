-- ============================================================
-- Migration 0013: Evaluation Engine — grading function
-- ============================================================

-- Grades every ungraded answer in an attempt by comparing it against
-- the real correct answer (MCQ: matching choice; TRUE_FALSE/GRID_IN:
-- stored correct answer_data), then marks the attempt completed.
-- This is the ONLY place correctness is computed — it runs entirely
-- server-side so the correct answer is never exposed to the browser.
create or replace function grade_attempt(
  p_attempt_id uuid,
  p_resume_token uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_answer record;
begin
  if not verify_attempt_token(p_attempt_id, p_resume_token) then
    raise exception 'Invalid attempt or resume token.';
  end if;

  for v_answer in
    select sa.id, sa.question_id, sa.answer_data, q.points, at.code as answer_type_code
    from student_answers sa
    join questions q on q.id = sa.question_id
    join answer_types at on at.id = q.answer_type_id
    where sa.attempt_id = p_attempt_id
  loop
    declare
      v_is_correct boolean := false;
    begin
      if v_answer.answer_type_code = 'MCQ' then
        select exists (
          select 1 from question_choices
          where question_id = v_answer.question_id
            and is_correct = true
            and id::text = v_answer.answer_data->>'choice_id'
        ) into v_is_correct;

      elsif v_answer.answer_type_code = 'TRUE_FALSE' then
        select exists (
          select 1 from question_correct_answers
          where question_id = v_answer.question_id
            and (answer_data->>'value')::boolean = (v_answer.answer_data->>'value')::boolean
        ) into v_is_correct;

      elsif v_answer.answer_type_code = 'GRID_IN' then
        select exists (
          select 1 from question_correct_answers qca
          where qca.question_id = v_answer.question_id
            and abs(
              (qca.answer_data->>'value')::numeric - (v_answer.answer_data->>'value')::numeric
            ) <= coalesce((qca.answer_data->>'tolerance')::numeric, 0)
        ) into v_is_correct;
      end if;

      update student_answers
      set is_correct = v_is_correct,
          points_earned = case when v_is_correct then v_answer.points else 0 end,
          updated_at = now()
      where id = v_answer.id;
    end;
  end loop;

  update attempts
  set status = 'completed',
      completed_at = now()
  where id = p_attempt_id;
end;
$$;

grant execute on function grade_attempt(uuid, uuid) to anon;