-- ============================================================
-- Migration 0008: Profiles + Roles
-- ============================================================

-- PROFILES
-- Extends Supabase's built-in auth.users with app-specific info:
-- which organization someone belongs to, and their role.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,

  full_name text,
  role text not null default 'teacher'
    check (role in ('admin', 'teacher')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_org on profiles(organization_id);

-- Auto-create a profile row whenever someone signs up via Supabase Auth.
-- Without this trigger, you'd have to manually insert a profiles row
-- every time a new teacher account is created — easy to forget, and a
-- security gap if a user exists in auth.users but has no role/org.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, organization_id, full_name, role)
  values (
    new.id,
    (select id from organizations limit 1), -- v1: single org, auto-assign
    new.raw_user_meta_data ->> 'full_name',
    'teacher'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

alter table profiles enable row level security;

-- A logged-in user can always read their own profile
-- (needed so the app can check "am I admin or teacher?" after login)
create policy "Users can read their own profile"
  on profiles for select
  using (auth.uid() = id);