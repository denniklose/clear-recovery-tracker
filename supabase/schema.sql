-- Clear V1 schema
-- Run this once in the Supabase SQL Editor for the project used by the app.
-- The browser only receives the anon key; the service-role key is not needed by this app.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recovery_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_segment_id text,
  substance text not null default '',
  clean_start_date date not null,
  daily_spend numeric(10, 2),
  motivation text not null default '',
  onboarding_completed boolean not null default false,
  sound_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.recovery_segments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  substance text not null,
  start_date date not null,
  end_date date,
  daily_spend numeric(10, 2),
  motivation text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.daily_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  segment_id text not null references public.recovery_segments(id) on delete cascade,
  hard_day boolean not null default false,
  is_clean boolean not null default false,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, segment_id, checkin_date)
);

-- Backfill columns when this schema is applied to a project that already has
-- the V1 tables. Existing legacy check-ins without a segment are kept in a
-- per-user legacy counter before the composite key is installed.
alter table public.recovery_settings
  add column if not exists active_segment_id text;

alter table public.recovery_segments
  add column if not exists daily_spend numeric(10, 2),
  add column if not exists motivation text not null default '';

alter table public.daily_checkins
  add column if not exists checked_at timestamptz;

insert into public.recovery_segments (id, user_id, substance, start_date, daily_spend, motivation)
select
  'legacy-' || checkins.user_id::text,
  checkins.user_id,
  coalesce(settings.substance, ''),
  coalesce(settings.clean_start_date, min(checkins.checkin_date)),
  settings.daily_spend,
  coalesce(settings.motivation, '')
from public.daily_checkins as checkins
left join public.recovery_settings as settings on settings.user_id = checkins.user_id
where checkins.segment_id is null
group by checkins.user_id, settings.substance, settings.clean_start_date, settings.daily_spend, settings.motivation
on conflict (id) do nothing;

update public.daily_checkins
set segment_id = 'legacy-' || user_id::text
where segment_id is null;

alter table public.daily_checkins
  drop constraint if exists daily_checkins_segment_id_fkey;

alter table public.daily_checkins
  add constraint daily_checkins_segment_id_fkey
  foreign key (segment_id) references public.recovery_segments(id) on delete cascade;

alter table public.daily_checkins
  alter column segment_id set not null;

alter table public.daily_checkins
  drop constraint if exists daily_checkins_pkey;

alter table public.daily_checkins
  add constraint daily_checkins_pkey primary key (user_id, segment_id, checkin_date);

create index if not exists recovery_segments_user_id_idx
  on public.recovery_segments (user_id);

create index if not exists daily_checkins_user_id_idx
  on public.daily_checkins (user_id);

create index if not exists daily_checkins_segment_id_idx
  on public.daily_checkins (segment_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists recovery_settings_set_updated_at on public.recovery_settings;
create trigger recovery_settings_set_updated_at
before update on public.recovery_settings
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.recovery_settings enable row level security;
alter table public.recovery_settings force row level security;
alter table public.recovery_segments enable row level security;
alter table public.recovery_segments force row level security;
alter table public.daily_checkins enable row level security;
alter table public.daily_checkins force row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated
with check ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists recovery_settings_select_own on public.recovery_settings;
create policy recovery_settings_select_own on public.recovery_settings
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists recovery_settings_insert_own on public.recovery_settings;
create policy recovery_settings_insert_own on public.recovery_settings
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists recovery_settings_update_own on public.recovery_settings;
create policy recovery_settings_update_own on public.recovery_settings
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists recovery_segments_select_own on public.recovery_segments;
create policy recovery_segments_select_own on public.recovery_segments
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists recovery_segments_insert_own on public.recovery_segments;
create policy recovery_segments_insert_own on public.recovery_segments
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists recovery_segments_update_own on public.recovery_segments;
create policy recovery_segments_update_own on public.recovery_segments
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists daily_checkins_select_own on public.daily_checkins;
create policy daily_checkins_select_own on public.daily_checkins
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists daily_checkins_insert_own on public.daily_checkins;
create policy daily_checkins_insert_own on public.daily_checkins
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists daily_checkins_update_own on public.daily_checkins;
create policy daily_checkins_update_own on public.daily_checkins
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Anonymous device subscriptions are intentionally server-only. The browser
-- never receives the service-role key and these tables have no anon policies.
create table if not exists public.push_subscriptions (
  device_id text primary key,
  device_token_hash text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  timezone text not null default 'Europe/Berlin',
  daily_enabled boolean not null default true,
  level_up_enabled boolean not null default true,
  last_daily_local_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_events (
  device_id text not null references public.push_subscriptions(device_id) on delete cascade,
  event_key text not null,
  kind text not null,
  streak smallint not null default 0,
  milestone boolean not null default false,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (device_id, event_key)
);

create index if not exists push_subscriptions_daily_idx
  on public.push_subscriptions (daily_enabled, last_daily_local_date);

create index if not exists push_events_created_at_idx
  on public.push_events (created_at);

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
alter table public.push_events enable row level security;
alter table public.push_events force row level security;
