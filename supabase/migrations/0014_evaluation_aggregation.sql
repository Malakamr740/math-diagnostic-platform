-- ============================================================
-- Migration 0014: Evaluation aggregation — scores & breakdowns
-- ============================================================

-- One row per attempt: overall totals and the assigned level.
create table attempt_results (
  attempt_id uuid primary key references attempts(id) on delete cascade,
  organization_id uuid not null references organizations(id),
  total_questions integer not null,
  correct_count integer not null,
  incorrect_count integer not null,
  points_earned numeric not null,
  points_possible numeric not null,
  percentage numeric not null,
  level_id uuid references levels(id),
  calculated_at timestamptz not null default now()
);

-- Per-module scores, and per-taxonomy/difficulty breakdowns, in one
-- generic table shaped by `breakdown_type`. One table instead of five
-- near-identical ones keeps the report query simple later: one WHERE
-- clause per section instead of five separate joins.
create table attempt_breakdowns (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  breakdown_type text not null check (
    breakdown_type in ('module', 'category', 'chapter', 'lesson', 'skill', 'difficulty')
  ),
  breakdown_id uuid,             -- module_id / category_id / chapter_id / lesson_id / skill_id (null for difficulty)
  breakdown_label text not null, -- resolved name, or the difficulty value itself (e.g. 'hard')
  total_questions integer not null,
  correct_count integer not null,
  points_earned numeric not null,
  points_possible numeric not null,
  percentage numeric not null,
  classification text check (classification in ('strong', 'weak', 'average'))
);

create index idx_attempt_breakdowns_attempt on attempt_breakdowns(attempt_id);
create index idx_attempt_breakdowns_type on attempt_breakdowns(attempt_id, breakdown_type);

alter table attempt_results enable row level security;
alter table attempt_breakdowns enable row level security;

-- Students never get a real Supabase auth session in your flow (resume-token
-- pattern instead) — so student reads go through a security-definer RPC
-- (built in Step 2 below), not a direct-select RLS policy. These policies
-- only cover org staff (admins/teachers) reading through the dashboard.
create policy "org staff can view attempt_results"
  on attempt_results for select
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "org staff can view attempt_breakdowns"
  on attempt_breakdowns for select
  using (
    exists (
      select 1 from attempt_results ar
      where ar.attempt_id = attempt_breakdowns.attempt_id
        and ar.organization_id = (select organization_id from profiles where id = auth.uid())
    )
  );

  -- Computes and stores all breakdowns for an already-graded attempt.
-- Called at the end of grade_attempt, after every student_answers row
-- has is_correct/points_earned populated. Safe to re-run (clears prior
-- rows for this attempt first).
create or replace function calculate_attempt_results(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_total int;
  v_correct int;
  v_points_earned numeric;
  v_points_possible numeric;
  v_percentage numeric;
  v_level_id uuid;
  v_strong_threshold numeric;
  v_weak_threshold numeric;
begin
  select organization_id into v_org_id from attempts where id = p_attempt_id;

  delete from attempt_breakdowns where attempt_id = p_attempt_id;
  delete from attempt_results where attempt_id = p_attempt_id;

  -- ---- Overall totals ----
  select
    count(*),
    count(*) filter (where sa.is_correct),
    coalesce(sum(sa.points_earned), 0),
    coalesce(sum(q.points), 0)
  into v_total, v_correct, v_points_earned, v_points_possible
  from student_answers sa
  join questions q on q.id = sa.question_id
  where sa.attempt_id = p_attempt_id;

  v_percentage := case when v_points_possible > 0
    then round((v_points_earned / v_points_possible) * 100, 2)
    else 0
  end;

  -- ---- Level assignment: first level whose range contains the percentage ----
  select id into v_level_id
  from levels
  where organization_id = v_org_id
    and v_percentage >= min_percentage
    and v_percentage <= max_percentage
  order by min_percentage desc
  limit 1;

  insert into attempt_results (
    attempt_id, organization_id, total_questions, correct_count, incorrect_count,
    points_earned, points_possible, percentage, level_id
  ) values (
    p_attempt_id, v_org_id, v_total, v_correct, v_total - v_correct,
    v_points_earned, v_points_possible, v_percentage, v_level_id
  );

  -- ---- Strong/weak thresholds (org-configurable) ----
  select
    coalesce((select (rule_value #>> '{}')::numeric from evaluation_rules
      where organization_id = v_org_id and rule_key = 'strong_threshold_percent'), 80),
    coalesce((select (rule_value #>> '{}')::numeric from evaluation_rules
      where organization_id = v_org_id and rule_key = 'weak_threshold_percent'), 50)
  into v_strong_threshold, v_weak_threshold;

  -- ---- Per-module breakdown ----
  insert into attempt_breakdowns (
    attempt_id, breakdown_type, breakdown_id, breakdown_label,
    total_questions, correct_count, points_earned, points_possible, percentage, classification
  )
  select
    p_attempt_id, 'module', m.id, m.name,
    count(sa.id),
    count(sa.id) filter (where sa.is_correct),
    coalesce(sum(sa.points_earned), 0),
    coalesce(sum(q.points), 0),
    case when coalesce(sum(q.points), 0) > 0
      then round((coalesce(sum(sa.points_earned), 0) / sum(q.points)) * 100, 2)
      else 0
    end,
    case
      when coalesce(sum(q.points), 0) = 0 then 'average'
      when (coalesce(sum(sa.points_earned), 0) / sum(q.points)) * 100 >= v_strong_threshold then 'strong'
      when (coalesce(sum(sa.points_earned), 0) / sum(q.points)) * 100 <= v_weak_threshold then 'weak'
      else 'average'
    end
  from module_attempts ma
  join modules m on m.id = ma.module_id
  join student_answers sa on sa.module_attempt_id = ma.id
  join questions q on q.id = sa.question_id
  where ma.attempt_id = p_attempt_id
  group by m.id, m.name;

  -- ---- Category / chapter / lesson / skill breakdowns (same shape, different join target) ----
  insert into attempt_breakdowns (
    attempt_id, breakdown_type, breakdown_id, breakdown_label,
    total_questions, correct_count, points_earned, points_possible, percentage, classification
  )
  select p_attempt_id, 'category', c.id, c.name,
    count(sa.id), count(sa.id) filter (where sa.is_correct),
    coalesce(sum(sa.points_earned), 0), coalesce(sum(q.points), 0),
    case when sum(q.points) > 0 then round((sum(sa.points_earned) / sum(q.points)) * 100, 2) else 0 end,
    case
      when sum(q.points) = 0 then 'average'
      when (sum(sa.points_earned) / sum(q.points)) * 100 >= v_strong_threshold then 'strong'
      when (sum(sa.points_earned) / sum(q.points)) * 100 <= v_weak_threshold then 'weak'
      else 'average'
    end
  from student_answers sa
  join questions q on q.id = sa.question_id
  join categories c on c.id = q.category_id
  where sa.attempt_id = p_attempt_id
  group by c.id, c.name;

  insert into attempt_breakdowns (
    attempt_id, breakdown_type, breakdown_id, breakdown_label,
    total_questions, correct_count, points_earned, points_possible, percentage, classification
  )
  select p_attempt_id, 'chapter', ch.id, ch.name,
    count(sa.id), count(sa.id) filter (where sa.is_correct),
    coalesce(sum(sa.points_earned), 0), coalesce(sum(q.points), 0),
    case when sum(q.points) > 0 then round((sum(sa.points_earned) / sum(q.points)) * 100, 2) else 0 end,
    case
      when sum(q.points) = 0 then 'average'
      when (sum(sa.points_earned) / sum(q.points)) * 100 >= v_strong_threshold then 'strong'
      when (sum(sa.points_earned) / sum(q.points)) * 100 <= v_weak_threshold then 'weak'
      else 'average'
    end
  from student_answers sa
  join questions q on q.id = sa.question_id
  join chapters ch on ch.id = q.chapter_id
  where sa.attempt_id = p_attempt_id
  group by ch.id, ch.name;

  insert into attempt_breakdowns (
    attempt_id, breakdown_type, breakdown_id, breakdown_label,
    total_questions, correct_count, points_earned, points_possible, percentage, classification
  )
  select p_attempt_id, 'lesson', l.id, l.name,
    count(sa.id), count(sa.id) filter (where sa.is_correct),
    coalesce(sum(sa.points_earned), 0), coalesce(sum(q.points), 0),
    case when sum(q.points) > 0 then round((sum(sa.points_earned) / sum(q.points)) * 100, 2) else 0 end,
    case
      when sum(q.points) = 0 then 'average'
      when (sum(sa.points_earned) / sum(q.points)) * 100 >= v_strong_threshold then 'strong'
      when (sum(sa.points_earned) / sum(q.points)) * 100 <= v_weak_threshold then 'weak'
      else 'average'
    end
  from student_answers sa
  join questions q on q.id = sa.question_id
  join lessons l on l.id = q.lesson_id
  where sa.attempt_id = p_attempt_id
  group by l.id, l.name;

  insert into attempt_breakdowns (
    attempt_id, breakdown_type, breakdown_id, breakdown_label,
    total_questions, correct_count, points_earned, points_possible, percentage, classification
  )
  select p_attempt_id, 'skill', sk.id, sk.name,
    count(sa.id), count(sa.id) filter (where sa.is_correct),
    coalesce(sum(sa.points_earned), 0), coalesce(sum(q.points), 0),
    case when sum(q.points) > 0 then round((sum(sa.points_earned) / sum(q.points)) * 100, 2) else 0 end,
    case
      when sum(q.points) = 0 then 'average'
      when (sum(sa.points_earned) / sum(q.points)) * 100 >= v_strong_threshold then 'strong'
      when (sum(sa.points_earned) / sum(q.points)) * 100 <= v_weak_threshold then 'weak'
      else 'average'
    end
  from student_answers sa
  join questions q on q.id = sa.question_id
  join skills sk on sk.id = q.skill_id
  where sa.attempt_id = p_attempt_id
  group by sk.id, sk.name;

  -- ---- Difficulty breakdown (a value column, not a lookup table) ----
  insert into attempt_breakdowns (
    attempt_id, breakdown_type, breakdown_id, breakdown_label,
    total_questions, correct_count, points_earned, points_possible, percentage, classification
  )
  select p_attempt_id, 'difficulty', null, q.difficulty::text,
    count(sa.id), count(sa.id) filter (where sa.is_correct),
    coalesce(sum(sa.points_earned), 0), coalesce(sum(q.points), 0),
    case when sum(q.points) > 0 then round((sum(sa.points_earned) / sum(q.points)) * 100, 2) else 0 end,
    case
      when sum(q.points) = 0 then 'average'
      when (sum(sa.points_earned) / sum(q.points)) * 100 >= v_strong_threshold then 'strong'
      when (sum(sa.points_earned) / sum(q.points)) * 100 <= v_weak_threshold then 'weak'
      else 'average'
    end
  from student_answers sa
  join questions q on q.id = sa.question_id
  where sa.attempt_id = p_attempt_id
  group by q.difficulty;

end;
$$;

grant execute on function calculate_attempt_results(uuid) to anon;

