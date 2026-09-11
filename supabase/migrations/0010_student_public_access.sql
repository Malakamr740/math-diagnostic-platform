-- ============================================================
-- Migration 0010: Public (student) read access + secure attempt creation
-- ============================================================

-- Students can view a published assessment's basic info (name,
-- description, instructions) without logging in.
create policy "Public can view published assessments"
  on assessments for select
  using (status = 'published');

-- Students need to see the registration form fields for the org
-- running the assessment. Not sensitive data, safe to expose publicly.
create policy "Public can view active registration fields"
  on registration_fields for select
  using (is_active = true);

-- ============================================================
-- Secure function: starts a new attempt + saves registration answers
-- ============================================================
-- Runs with elevated privilege (security definer) so it can insert
-- into attempts/registration_responses on the student's behalf,
-- without needing to open those tables to direct public writes.
-- This is safer than a public INSERT policy because this function
-- controls exactly what can be inserted and validates the assessment
-- is actually published first.
create or replace function start_attempt(
  p_assessment_id uuid,
  p_registration_data jsonb
)
returns table(attempt_id uuid, resume_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_attempt_id uuid;
  v_resume_token uuid;
begin
  -- Confirm the assessment exists and is actually published —
  -- prevents starting attempts on draft/archived assessments.
  select organization_id into v_org_id
  from assessments
  where id = p_assessment_id and status = 'published';

  if v_org_id is null then
    raise exception 'Assessment not found or not currently available.';
  end if;

  insert into attempts (assessment_id, organization_id)
  values (p_assessment_id, v_org_id)
  returning id, attempts.resume_token into v_attempt_id, v_resume_token;

  insert into registration_responses (attempt_id, responses)
  values (v_attempt_id, p_registration_data);

  return query select v_attempt_id, v_resume_token;
end;
$$;

-- Allow anonymous (not-logged-in) users to call this function
grant execute on function start_attempt(uuid, jsonb) to anon;