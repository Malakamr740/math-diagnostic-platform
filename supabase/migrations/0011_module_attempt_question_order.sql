-- ============================================================
-- Migration 0011: Store per-attempt question order (for shuffling)
-- ============================================================
-- When a module has shuffle_questions enabled, we need the shuffled
-- order to stay CONSTANT for the rest of that attempt (even across
-- page refreshes) — otherwise a refresh would show questions in a
-- different order and look like answers got mixed up.
alter table module_attempts
  add column question_order jsonb;
-- question_order will store an ordered array of question_ids,
-- e.g. ["uuid1", "uuid2", "uuid3"] — generated once when the module starts.