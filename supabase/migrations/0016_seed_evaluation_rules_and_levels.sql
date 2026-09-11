-- Seed primary organization
insert into organizations (id, name, website_url)
values ('a0000000-0000-0000-0000-000000000001', 'Primary Academy', 'https://example.com')
on conflict (id) do nothing;

-- Seed organization settings
insert into organization_settings (organization_id, primary_color, marketing_tagline)
values ('a0000000-0000-0000-0000-000000000001', '#2563eb', 'Master your skills with targeted practice')
on conflict (organization_id) do nothing;

-- Seed default dynamic registration fields
insert into registration_fields (organization_id, label, field_key, field_type, is_required, display_order)
values
  ('a0000000-0000-0000-0000-000000000001', 'Full Name', 'full_name', 'text', true, 1),
  ('a0000000-0000-0000-0000-000000000001', 'Email Address', 'email', 'email', true, 2),
  ('a0000000-0000-0000-0000-000000000001', 'Phone / WhatsApp Number', 'phone', 'phone', false, 3)
on conflict do nothing;

-- Seed evaluation rules (strong & weak thresholds)
insert into evaluation_rules (organization_id, rule_key, rule_value, description)
values
  ('a0000000-0000-0000-0000-000000000001', 'strong_threshold_percent', '75'::jsonb, 'Threshold percentage for strong skills'),
  ('a0000000-0000-0000-0000-000000000001', 'weak_threshold_percent', '50'::jsonb, 'Threshold percentage for weak skills')
on conflict (organization_id, rule_key) do nothing;

-- Seed performance levels
insert into levels (organization_id, name, min_percentage, max_percentage, description, recommendation, display_order)
values
  ('a0000000-0000-0000-0000-000000000001', 'Foundation', 0, 49.99, 'Developing initial conceptual understanding.', 'We recommend reviewing core fundamentals and starting with foundational practice sets.', 1),
  ('a0000000-0000-0000-0000-000000000001', 'Intermediate', 50, 74.99, 'Good command of core concepts with room for consistency.', 'Focus on medium and timed problem sets to boost accuracy.', 2),
  ('a0000000-0000-0000-0000-000000000001', 'Advanced', 75, 100, 'Excellent mastery across evaluated topics.', 'Proceed to advanced mock exams and time-strategy mastery.', 3)
on conflict do nothing;