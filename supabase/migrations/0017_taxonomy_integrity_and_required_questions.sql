-- A question may be classified at any point in the taxonomy, but its
-- selected IDs must form one real, contiguous path.
create or replace function validate_question_taxonomy()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.skill_id is not null and new.lesson_id is null then
    raise exception 'A skill requires a lesson.';
  end if;
  if new.lesson_id is not null and new.chapter_id is null then
    raise exception 'A lesson requires a chapter.';
  end if;
  if new.chapter_id is not null and new.category_id is null then
    raise exception 'A chapter requires a category.';
  end if;
  if new.category_id is not null and new.subject_id is null then
    raise exception 'A category requires a subject.';
  end if;
  if new.subject_id is not null and new.exam_id is null then
    raise exception 'A subject requires an assessment type.';
  end if;

  if new.subject_id is not null and not exists (
    select 1 from subjects where id = new.subject_id and exam_id = new.exam_id
  ) then raise exception 'Subject does not belong to the selected assessment type.'; end if;
  if new.category_id is not null and not exists (
    select 1 from categories where id = new.category_id and subject_id = new.subject_id
  ) then raise exception 'Category does not belong to the selected subject.'; end if;
  if new.chapter_id is not null and not exists (
    select 1 from chapters where id = new.chapter_id and category_id = new.category_id
  ) then raise exception 'Chapter does not belong to the selected category.'; end if;
  if new.lesson_id is not null and not exists (
    select 1 from lessons where id = new.lesson_id and chapter_id = new.chapter_id
  ) then raise exception 'Lesson does not belong to the selected chapter.'; end if;
  if new.skill_id is not null and not exists (
    select 1 from skills where id = new.skill_id and lesson_id = new.lesson_id
  ) then raise exception 'Skill does not belong to the selected lesson.'; end if;
  return new;
end;
$$;

drop trigger if exists questions_validate_taxonomy on questions;
create trigger questions_validate_taxonomy
before insert or update of exam_id, subject_id, category_id, chapter_id, lesson_id, skill_id
on questions for each row execute function validate_question_taxonomy();

alter table module_questions add column if not exists required boolean not null default true;
