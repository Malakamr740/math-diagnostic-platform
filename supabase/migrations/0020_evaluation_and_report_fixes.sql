-- Fix points override handling in grade_attempt and calculate_attempt_results
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
    select sa.id, sa.question_id, sa.answer_data,
           coalesce(mq.points_override, q.points) as effective_points,
           at.code as answer_type_code
    from student_answers sa
    join module_attempts ma on ma.id = sa.module_attempt_id
    join module_questions mq on mq.module_id = ma.module_id and mq.question_id = sa.question_id
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
          points_earned = case when v_is_correct then v_answer.effective_points else 0 end,
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

-- Enhanced get_attempt_report function including recommended courses & org branding
create or replace function get_attempt_report(
  p_attempt_id uuid,
  p_resume_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_org_id uuid;
  v_level_id uuid;
begin
  if not verify_attempt_token(p_attempt_id, p_resume_token) then
    raise exception 'Invalid attempt or resume token.';
  end if;

  select organization_id, level_id into v_org_id, v_level_id
  from attempt_results where attempt_id = p_attempt_id;

  select jsonb_build_object(
    'overall', (
      select jsonb_build_object(
        'total_questions', ar.total_questions,
        'correct_count', ar.correct_count,
        'incorrect_count', ar.incorrect_count,
        'points_earned', ar.points_earned,
        'points_possible', ar.points_possible,
        'percentage', ar.percentage,
        'calculated_at', ar.calculated_at,
        'level', (
          select jsonb_build_object(
            'id', l.id,
            'name', l.name,
            'description', l.description,
            'recommendation', l.recommendation
          )
          from levels l where l.id = ar.level_id
        )
      )
      from attempt_results ar
      where ar.attempt_id = p_attempt_id
    ),
    'courses', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'description', c.description,
          'image_url', c.image_url,
          'registration_url', c.registration_url,
          'whatsapp_url', c.whatsapp_url,
          'phone', c.phone
        ) order by lc.display_order
      ), '[]'::jsonb)
      from level_courses lc
      join courses c on c.id = lc.course_id
      where lc.level_id = v_level_id and c.is_active = true
    ),
    'org_settings', (
      select jsonb_build_object(
        'marketing_tagline', os.marketing_tagline,
        'contact_phone', os.contact_phone,
        'whatsapp_url', os.whatsapp_url,
        'website_url', os.website_url
      )
      from organization_settings os
      where os.organization_id = v_org_id
    ),
    'breakdowns', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'type', ab.breakdown_type,
          'label', ab.breakdown_label,
          'total_questions', ab.total_questions,
          'correct_count', ab.correct_count,
          'points_earned', ab.points_earned,
          'points_possible', ab.points_possible,
          'percentage', ab.percentage,
          'classification', ab.classification
        )
        order by ab.breakdown_type, ab.breakdown_label
      ), '[]'::jsonb)
      from attempt_breakdowns ab
      where ab.attempt_id = p_attempt_id
    )
  ) into v_result;

  if v_result is null or v_result->'overall' is null then
    raise exception 'Results not yet available for this attempt.';
  end if;

  return v_result;
end;
$$;

grant execute on function get_attempt_report(uuid, uuid) to anon;