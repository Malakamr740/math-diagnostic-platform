-- ============================================================
-- Migration 0027: Enhanced Diagnostic Analytics & Behavior Metrics
-- ============================================================

-- Function to generate human-readable analytical notes based on test results
create or replace function generate_diagnostic_summary_notes(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notes jsonb := '[]'::jsonb;
  v_percentage numeric;
  v_rushed_count int;
  v_timesink_count int;
  v_easy_missed int;
  v_hard_accuracy numeric;
  v_weakest_domains text;
  v_strongest_domains text;
begin
  select percentage into v_percentage from attempt_results where attempt_id = p_attempt_id;

  -- 1. Check for rushed careless errors (<25 seconds and wrong)
  select count(*) into v_rushed_count
  from student_answers
  where attempt_id = p_attempt_id and not is_correct and time_spent_seconds < 25;

  if v_rushed_count > 0 then
    v_notes := v_notes || jsonb_build_object(
      'type', 'warning',
      'title', 'Rushed / Careless Mistakes Detected',
      'body', format('%s question(s) were missed in under 25 seconds. Slowing down slightly on initial problem reading will immediately salvage points.', v_rushed_count)
    );
  end if;

  -- 2. Check for time-sink questions (>100 seconds and wrong)
  select count(*) into v_timesink_count
  from student_answers
  where attempt_id = p_attempt_id and not is_correct and time_spent_seconds >= 100;

  if v_timesink_count > 0 then
    v_notes := v_notes || jsonb_build_object(
      'type', 'caution',
      'title', 'Pacing & Time Traps',
      'body', format('%s question(s) consumed over 100 seconds each without yielding points. Implementing a 60-second bail-and-flag strategy will protect overall test time.', v_timesink_count)
    );
  end if;

  -- 3. Check foundational hygiene (Easy questions missed)
  select count(*) into v_easy_missed
  from student_answers sa
  join questions q on q.id = sa.question_id
  where sa.attempt_id = p_attempt_id and not sa.is_correct and q.difficulty = 'easy';

  if v_easy_missed > 0 then
    v_notes := v_notes || jsonb_build_object(
      'type', 'critical',
      'title', 'Foundational Knowledge Leaks',
      'body', format('%s foundational / easy questions were answered incorrectly. Review core definitions and arithmetic mechanics before advancing to complex multi-step problems.', v_easy_missed)
    );
  else
    v_notes := v_notes || jsonb_build_object(
      'type', 'success',
      'title', 'Solid Foundational Hygiene',
      'body', '100% accuracy on foundational/easy questions. Core concepts are stable.'
    );
  end if;

  -- 4. Top strengths vs. Priority weaknesses
  select string_agg(breakdown_label, ', ') into v_strongest_domains
  from (
    select breakdown_label from attempt_breakdowns
    where attempt_id = p_attempt_id and breakdown_type = 'category' and classification = 'strong'
    limit 2
  ) t;

  select string_agg(breakdown_label, ', ') into v_weakest_domains
  from (
    select breakdown_label from attempt_breakdowns
    where attempt_id = p_attempt_id and breakdown_type = 'category' and classification = 'weak'
    limit 2
  ) t;

  if v_strongest_domains is not null then
    v_notes := v_notes || jsonb_build_object(
      'type', 'strength',
      'title', 'Primary Areas of Strength',
      'body', format('Demonstrated consistent mastery in: %s.', v_strongest_domains)
    );
  end if;

  if v_weakest_domains is not null then
    v_notes := v_notes || jsonb_build_object(
      'type', 'priority',
      'title', 'Priority Remediation Focus',
      'body', format('Target intensive review and practice on: %s.', v_weakest_domains)
    );
  end if;

  return v_notes;
end;
$$;

-- Replace get_attempt_report with enhanced behavioral stats & diagnostic notes
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

    -- 2. Overall Summary Scorecard with Pacing & Behavioral Metrics
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
        'avg_time_correct', (
          select coalesce(round(avg(time_spent_seconds)::numeric, 1), 0)
          from student_answers where attempt_id = p_attempt_id and is_correct
        ),
        'avg_time_incorrect', (
          select coalesce(round(avg(time_spent_seconds)::numeric, 1), 0)
          from student_answers where attempt_id = p_attempt_id and not is_correct
        ),
        'rushed_mistakes_count', (
          select count(*) from student_answers
          where attempt_id = p_attempt_id and not is_correct and time_spent_seconds < 25
        ),
        'timesink_mistakes_count', (
          select count(*) from student_answers
          where attempt_id = p_attempt_id and not is_correct and time_spent_seconds >= 100
        ),
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

    -- 3. AI / Algorithmic Diagnostic Performance Notes
    'diagnostic_notes', generate_diagnostic_summary_notes(p_attempt_id),

    -- 4. Taxonomy & Difficulty Breakdowns
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
          'classification', ab.classification,
          'avg_time_seconds', (
            select coalesce(round(avg(sa.time_spent_seconds)::numeric, 1), 0)
            from student_answers sa
            join questions q on q.id = sa.question_id
            where sa.attempt_id = p_attempt_id
              and (
                (ab.breakdown_type = 'category' and q.category_id = ab.breakdown_id)
                or (ab.breakdown_type = 'chapter' and q.chapter_id = ab.breakdown_id)
                or (ab.breakdown_type = 'lesson' and q.lesson_id = ab.breakdown_id)
                or (ab.breakdown_type = 'skill' and q.skill_id = ab.breakdown_id)
                or (ab.breakdown_type = 'difficulty' and q.difficulty = ab.breakdown_label)
              )
          )
        )
        order by ab.breakdown_type, ab.percentage asc
      ), '[]'::jsonb)
      from attempt_breakdowns ab
      where ab.attempt_id = p_attempt_id
    ),

    -- 5. Question-by-Question Review & Explanations
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

    -- 6. Recommended Next-Step Courses
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

    -- 7. Organization Branding
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

-- Sync admin RPC with identical shape
create or replace function get_admin_attempt_report(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_org_id uuid;
  v_token uuid;
begin
  select organization_id into v_user_org_id
  from profiles where id = auth.uid() and role in ('admin', 'teacher');

  if v_user_org_id is null then
    raise exception 'Unauthorized: Only staff members can view internal reports.';
  end if;

  select resume_token into v_token
  from attempts where id = p_attempt_id and organization_id = v_user_org_id;

  if v_token is null then
    raise exception 'Attempt not found or unauthorized.';
  end if;

  return get_attempt_report(p_attempt_id, v_token);
end;
$$;

grant execute on function get_admin_attempt_report(uuid) to authenticated;