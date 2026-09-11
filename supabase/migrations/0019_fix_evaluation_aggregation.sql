-- Replaces the earlier aggregation function with the actual column names
-- used by levels and evaluation_rules.
create or replace function calculate_attempt_results(p_attempt_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid; v_total integer; v_correct integer; v_earned numeric; v_possible numeric;
  v_percentage numeric; v_level_id uuid; v_strong numeric; v_weak numeric;
begin
  select organization_id into v_org_id from attempts where id = p_attempt_id;
  if v_org_id is null then raise exception 'Attempt not found.'; end if;
  delete from attempt_breakdowns where attempt_id = p_attempt_id;
  delete from attempt_results where attempt_id = p_attempt_id;

  select count(*), count(*) filter (where sa.is_correct), coalesce(sum(sa.points_earned), 0),
    coalesce(sum(coalesce(mq.points_override, q.points)), 0)
  into v_total, v_correct, v_earned, v_possible
  from student_answers sa join questions q on q.id = sa.question_id
  join module_attempts ma on ma.id = sa.module_attempt_id
  join module_questions mq on mq.module_id = ma.module_id and mq.question_id = q.id
  where sa.attempt_id = p_attempt_id;
  v_percentage := case when v_possible > 0 then round(v_earned / v_possible * 100, 2) else 0 end;
  select id into v_level_id from levels where organization_id = v_org_id and is_active
    and v_percentage between min_percentage and max_percentage order by min_percentage desc limit 1;
  insert into attempt_results (attempt_id, organization_id, total_questions, correct_count, incorrect_count, points_earned, points_possible, percentage, level_id)
  values (p_attempt_id, v_org_id, v_total, v_correct, v_total - v_correct, v_earned, v_possible, v_percentage, v_level_id);

  select coalesce((select (rule_value #>> '{}')::numeric from evaluation_rules where organization_id = v_org_id and rule_key = 'strong_threshold_percent'), 80),
    coalesce((select (rule_value #>> '{}')::numeric from evaluation_rules where organization_id = v_org_id and rule_key = 'weak_threshold_percent'), 50)
  into v_strong, v_weak;

  with base as (
    select sa.is_correct, sa.points_earned, coalesce(mq.points_override, q.points) as points_possible,
      m.id as module_id, m.name as module_name, q.category_id, q.chapter_id, q.lesson_id, q.skill_id, q.difficulty
    from student_answers sa join questions q on q.id = sa.question_id
    join module_attempts ma on ma.id = sa.module_attempt_id
    join modules m on m.id = ma.module_id
    join module_questions mq on mq.module_id = ma.module_id and mq.question_id = q.id
    where sa.attempt_id = p_attempt_id
  ), grouped as (
    select 'module'::text as kind, module_id as id, module_name as label, is_correct, points_earned, points_possible from base
    union all select 'category', c.id, c.name, b.is_correct, b.points_earned, b.points_possible from base b join categories c on c.id = b.category_id
    union all select 'chapter', c.id, c.name, b.is_correct, b.points_earned, b.points_possible from base b join chapters c on c.id = b.chapter_id
    union all select 'lesson', l.id, l.name, b.is_correct, b.points_earned, b.points_possible from base b join lessons l on l.id = b.lesson_id
    union all select 'skill', s.id, s.name, b.is_correct, b.points_earned, b.points_possible from base b join skills s on s.id = b.skill_id
    union all select 'difficulty', null::uuid, difficulty, is_correct, points_earned, points_possible from base
  ), totals as (
    select kind, id, label, count(*) as total_questions, count(*) filter (where is_correct) as correct_count,
      coalesce(sum(points_earned), 0) as points_earned, coalesce(sum(points_possible), 0) as points_possible
    from grouped group by kind, id, label
  )
  insert into attempt_breakdowns (attempt_id, breakdown_type, breakdown_id, breakdown_label, total_questions, correct_count, points_earned, points_possible, percentage, classification)
  select p_attempt_id, kind, id, label, total_questions, correct_count, points_earned, points_possible,
    case when points_possible > 0 then round(points_earned / points_possible * 100, 2) else 0 end,
    case when points_possible = 0 then 'average'
      when points_earned / points_possible * 100 >= v_strong then 'strong'
      when points_earned / points_possible * 100 <= v_weak then 'weak' else 'average' end
  from totals;
end;
$$;

grant execute on function calculate_attempt_results(uuid) to anon;
