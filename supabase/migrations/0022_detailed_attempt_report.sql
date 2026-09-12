-- ============================================================
-- Migration 0022: Detailed Attempt Diagnostic Report
-- ============================================================

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
  v_assessment_id uuid;
  v_started_at timestamptz;
  v_completed_at timestamptz;
  v_assessment_name text;
begin
  if not verify_attempt_token(p_attempt_id, p_resume_token) then
    raise exception 'Invalid attempt or resume token.';
  end if;

  select a.organization_id, a.assessment_id, a.started_at, a.completed_at, asm.name
  into v_org_id, v_assessment_id, v_started_at, v_completed_at, v_assessment_name
  from attempts a
  join assessments asm on asm.id = a.assessment_id
  where a.id = p_attempt_id;

  select level_id into v_level_id
  from attempt_results
  where attempt_id = p_attempt_id;

  select jsonb_build_object(
    -- 1. Student and Assessment Metadata
    'student_info', (
      select jsonb_build_object(
        'attempt_id', p_attempt_id,
        'assessment_name', v_assessment_name,
        'started_at', v_started_at,
        'completed_at', v_completed_at,
        'total_time_seconds', coalesce(extract(epoch from (v_completed_at - v_started_at))::integer, 0),
        'registration_responses', (
          select coalesce(responses, '{}'::jsonb)
          from registration_responses
          where attempt_id = p_attempt_id
        )
      )
    ),

    -- 2. Overall Summary Scorecard
    'overall', (
      select jsonb_build_object(
        'total_questions', ar.total_questions,
        'correct_count', ar.correct_count,
        'incorrect_count', ar.incorrect_count,
        'points_earned', ar.points_earned,
        'points_possible', ar.points_possible,
        'percentage', ar.percentage,
        'calculated_at', ar.calculated_at,
        'avg_time_per_question', case
          when ar.total_questions > 0 then round(
            (select coalesce(sum(time_spent_seconds), 0) from student_answers where attempt_id = p_attempt_id)::numeric / ar.total_questions,
            1
          )
          else 0
        end,
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

    -- 3. Taxonomy & Difficulty Breakdowns
    'breakdowns', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'type', ab.breakdown_type,
          'id', ab.breakdown_id,
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
    ),

    -- 4. Question-by-Question Review & Explanations
    'questions', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'question_id', q.id,
          'content_blocks', q.content_blocks,
          'explanation_blocks', q.explanation_blocks,
          'difficulty', q.difficulty,
          'answer_type_code', at.code,
          'points_possible', coalesce(mq.points_override, q.points),
          'points_earned', coalesce(sa.points_earned, 0),
          'is_correct', coalesce(sa.is_correct, false),
          'time_spent_seconds', coalesce(sa.time_spent_seconds, 0),
          'student_answer', coalesce(sa.answer_data, '{}'::jsonb),
          'category_name', (select name from categories where id = q.category_id),
          'lesson_name', (select name from lessons where id = q.lesson_id),
          'skill_name', (select name from skills where id = q.skill_id),
          'choices', coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id', qc.id,
                  'content_blocks', qc.content_blocks,
                  'is_correct', qc.is_correct
                ) order by qc.display_order
              )
              from question_choices qc
              where qc.question_id = q.id
            ),
            '[]'::jsonb
          ),
          'correct_answer_data', (
            select answer_data
            from question_correct_answers
            where question_id = q.id
            limit 1
          )
        )
        order by ma.display_order, mq.display_order
      ), '[]'::jsonb)
      from student_answers sa
      join questions q on q.id = sa.question_id
      join answer_types at on at.id = q.answer_type_id
      join module_attempts ma on ma.id = sa.module_attempt_id
      join module_questions mq on mq.module_id = ma.module_id and mq.question_id = q.id
      where sa.attempt_id = p_attempt_id
    ),

    -- 5. Recommended Next-Step Courses
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

    -- 6. Organization Branding
    'org_settings', (
      select jsonb_build_object(
        'org_name', o.name,
        'marketing_tagline', os.marketing_tagline,
        'contact_phone', coalesce(os.contact_phone, o.phone),
        'whatsapp_url', coalesce(os.whatsapp_url, o.whatsapp_url),
        'website_url', coalesce(os.website_url, o.website_url)
      )
      from organizations o
      left join organization_settings os on os.organization_id = o.id
      where o.id = v_org_id
    )
  ) into v_result;

  if v_result is null or v_result->'overall' is null then
    raise exception 'Results not yet available for this attempt.';
  end if;

  return v_result;
end;
$$;

grant execute on function get_attempt_report(uuid, uuid) to anon;