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
begin
  if not verify_attempt_token(p_attempt_id, p_resume_token) then
    raise exception 'Invalid attempt or resume token.';
  end if;

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