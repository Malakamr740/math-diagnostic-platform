create or replace function resolve_or_create_taxonomy(
  p_org_id uuid,
  p_exam text,
  p_subject text,
  p_category text,
  p_chapter text,
  p_lesson text,
  p_skill text
)
returns table(
  exam_id uuid,
  subject_id uuid,
  category_id uuid,
  chapter_id uuid,
  lesson_id uuid,
  skill_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam_id uuid;
  v_subject_id uuid;
  v_category_id uuid;
  v_chapter_id uuid;
  v_lesson_id uuid;
  v_skill_id uuid;
begin
  -- 1. Exam / Assessment Type
  if p_exam is not null and trim(p_exam) <> '' then
    select id into v_exam_id from exams
    where organization_id = p_org_id and lower(name) = lower(trim(p_exam))
    limit 1;
    
    if v_exam_id is null then
      insert into exams (organization_id, name)
      values (p_org_id, trim(p_exam))
      returning id into v_exam_id;
    end if;
  end if;

  -- 2. Subject
  if v_exam_id is not null and p_subject is not null and trim(p_subject) <> '' then
    select id into v_subject_id from subjects
    where exam_id = v_exam_id and lower(name) = lower(trim(p_subject))
    limit 1;
    
    if v_subject_id is null then
      insert into subjects (exam_id, name)
      values (v_exam_id, trim(p_subject))
      returning id into v_subject_id;
    end if;
  end if;

  -- 3. Category (Domain)
  if v_subject_id is not null and p_category is not null and trim(p_category) <> '' then
    select id into v_category_id from categories
    where subject_id = v_subject_id and lower(name) = lower(trim(p_category))
    limit 1;
    
    if v_category_id is null then
      insert into categories (subject_id, name)
      values (v_subject_id, trim(p_category))
      returning id into v_category_id;
    end if;
  end if;

  -- 4. Chapter
  if v_category_id is not null and p_chapter is not null and trim(p_chapter) <> '' then
    select id into v_chapter_id from chapters
    where category_id = v_category_id and lower(name) = lower(trim(p_chapter))
    limit 1;
    
    if v_chapter_id is null then
      insert into chapters (category_id, name)
      values (v_category_id, trim(p_chapter))
      returning id into v_chapter_id;
    end if;
  end if;

  -- 5. Lesson
  if v_chapter_id is not null and p_lesson is not null and trim(p_lesson) <> '' then
    select id into v_lesson_id from lessons
    where chapter_id = v_chapter_id and lower(name) = lower(trim(p_lesson))
    limit 1;
    
    if v_lesson_id is null then
      insert into lessons (chapter_id, name)
      values (v_chapter_id, trim(p_lesson))
      returning id into v_lesson_id;
    end if;
  end if;

  -- 6. Skill
  if v_lesson_id is not null and p_skill is not null and trim(p_skill) <> '' then
    select id into v_skill_id from skills
    where lesson_id = v_lesson_id and lower(name) = lower(trim(p_skill))
    limit 1;
    
    if v_skill_id is null then
      insert into skills (lesson_id, name)
      values (v_lesson_id, trim(p_skill))
      returning id into v_skill_id;
    end if;
  end if;

  return query select v_exam_id, v_subject_id, v_category_id, v_chapter_id, v_lesson_id, v_skill_id;
end;
$$;

grant execute on function resolve_or_create_taxonomy(uuid, text, text, text, text, text, text) to authenticated, anon;