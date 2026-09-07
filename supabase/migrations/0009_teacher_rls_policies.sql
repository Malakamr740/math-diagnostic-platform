-- ============================================================
-- Migration 0009: RLS Policies for Teacher/Admin-facing tables
-- ============================================================
-- Pattern used throughout: a row is visible/editable if its
-- organization_id matches the logged-in user's own organization_id.

-- Small helper to avoid repeating the subquery everywhere.
-- STABLE means Postgres can cache the result within one query.
create or replace function current_user_org_id()
returns uuid
language sql
stable
as $$
  select organization_id from profiles where id = auth.uid();
$$;

-- ORGANIZATIONS
create policy "Teachers can view their own organization"
  on organizations for select
  using (id = current_user_org_id());

create policy "Teachers can update their own organization"
  on organizations for update
  using (id = current_user_org_id());

-- ORGANIZATION SETTINGS
create policy "Teachers can manage their org settings"
  on organization_settings for all
  using (organization_id = current_user_org_id())
  with check (organization_id = current_user_org_id());

-- TAXONOMY (exams, subjects, categories, chapters, lessons, skills)
create policy "Teachers can manage exams" on exams for all
  using (organization_id = current_user_org_id())
  with check (organization_id = current_user_org_id());

create policy "Teachers can manage subjects" on subjects for all
  using (exam_id in (select id from exams where organization_id = current_user_org_id()))
  with check (exam_id in (select id from exams where organization_id = current_user_org_id()));

create policy "Teachers can manage categories" on categories for all
  using (subject_id in (
    select s.id from subjects s
    join exams e on e.id = s.exam_id
    where e.organization_id = current_user_org_id()
  ))
  with check (subject_id in (
    select s.id from subjects s
    join exams e on e.id = s.exam_id
    where e.organization_id = current_user_org_id()
  ));

create policy "Teachers can manage chapters" on chapters for all
  using (category_id in (
    select c.id from categories c
    join subjects s on s.id = c.subject_id
    join exams e on e.id = s.exam_id
    where e.organization_id = current_user_org_id()
  ))
  with check (category_id in (
    select c.id from categories c
    join subjects s on s.id = c.subject_id
    join exams e on e.id = s.exam_id
    where e.organization_id = current_user_org_id()
  ));

create policy "Teachers can manage lessons" on lessons for all
  using (chapter_id in (
    select ch.id from chapters ch
    join categories c on c.id = ch.category_id
    join subjects s on s.id = c.subject_id
    join exams e on e.id = s.exam_id
    where e.organization_id = current_user_org_id()
  ))
  with check (chapter_id in (
    select ch.id from chapters ch
    join categories c on c.id = ch.category_id
    join subjects s on s.id = c.subject_id
    join exams e on e.id = s.exam_id
    where e.organization_id = current_user_org_id()
  ));

create policy "Teachers can manage skills" on skills for all
  using (lesson_id in (
    select l.id from lessons l
    join chapters ch on ch.id = l.chapter_id
    join categories c on c.id = ch.category_id
    join subjects s on s.id = c.subject_id
    join exams e on e.id = s.exam_id
    where e.organization_id = current_user_org_id()
  ))
  with check (lesson_id in (
    select l.id from lessons l
    join chapters ch on ch.id = l.chapter_id
    join categories c on c.id = ch.category_id
    join subjects s on s.id = c.subject_id
    join exams e on e.id = s.exam_id
    where e.organization_id = current_user_org_id()
  ));

-- ANSWER TYPES (global lookup, not org-scoped — all logged-in teachers can read)
create policy "Authenticated users can read answer types"
  on answer_types for select
  using (auth.role() = 'authenticated');

-- QUESTIONS + related tables
create policy "Teachers can manage questions" on questions for all
  using (organization_id = current_user_org_id())
  with check (organization_id = current_user_org_id());

create policy "Teachers can manage question choices" on question_choices for all
  using (question_id in (select id from questions where organization_id = current_user_org_id()))
  with check (question_id in (select id from questions where organization_id = current_user_org_id()));

create policy "Teachers can manage correct answers" on question_correct_answers for all
  using (question_id in (select id from questions where organization_id = current_user_org_id()))
  with check (question_id in (select id from questions where organization_id = current_user_org_id()));

-- ASSESSMENTS + MODULES
create policy "Teachers can manage assessments" on assessments for all
  using (organization_id = current_user_org_id())
  with check (organization_id = current_user_org_id());

create policy "Teachers can manage modules" on modules for all
  using (assessment_id in (select id from assessments where organization_id = current_user_org_id()))
  with check (assessment_id in (select id from assessments where organization_id = current_user_org_id()));

create policy "Teachers can manage module questions" on module_questions for all
  using (module_id in (
    select m.id from modules m
    join assessments a on a.id = m.assessment_id
    where a.organization_id = current_user_org_id()
  ))
  with check (module_id in (
    select m.id from modules m
    join assessments a on a.id = m.assessment_id
    where a.organization_id = current_user_org_id()
  ));

-- REGISTRATION FIELDS
create policy "Teachers can manage registration fields" on registration_fields for all
  using (organization_id = current_user_org_id())
  with check (organization_id = current_user_org_id());

-- LEVELS, COURSES, EVALUATION RULES
create policy "Teachers can manage levels" on levels for all
  using (organization_id = current_user_org_id())
  with check (organization_id = current_user_org_id());

create policy "Teachers can manage courses" on courses for all
  using (organization_id = current_user_org_id())
  with check (organization_id = current_user_org_id());

create policy "Teachers can manage level courses" on level_courses for all
  using (level_id in (select id from levels where organization_id = current_user_org_id()))
  with check (level_id in (select id from levels where organization_id = current_user_org_id()));

create policy "Teachers can manage evaluation rules" on evaluation_rules for all
  using (organization_id = current_user_org_id())
  with check (organization_id = current_user_org_id());

-- ATTEMPTS + STUDENT DATA (read-only for teachers — they view results,
-- but should never edit a student's actual answers)
create policy "Teachers can view attempts" on attempts for select
  using (organization_id = current_user_org_id());

create policy "Teachers can view registration responses" on registration_responses for select
  using (attempt_id in (select id from attempts where organization_id = current_user_org_id()));

create policy "Teachers can view module attempts" on module_attempts for select
  using (attempt_id in (select id from attempts where organization_id = current_user_org_id()));

create policy "Teachers can view student answers" on student_answers for select
  using (attempt_id in (select id from attempts where organization_id = current_user_org_id()));