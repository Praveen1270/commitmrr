create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('github', 'dodo')),
  mode text not null default 'test',
  external_account_id text,
  encrypted_secret text,
  config jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  unique (user_id, provider)
);

create table if not exists public.github_repositories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  github_id bigint not null,
  owner text not null,
  name text not null,
  full_name text not null,
  html_url text not null,
  is_private boolean not null default false,
  is_tracked boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, github_id)
);

create table if not exists public.daily_commit_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  repository_id uuid not null references public.github_repositories(id) on delete cascade,
  metric_date date not null,
  commit_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, repository_id, metric_date)
);

create table if not exists public.daily_revenue_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('dodo', 'stripe')),
  metric_date date not null,
  currency text not null default 'USD',
  gross_amount_minor integer not null default 0,
  net_amount_minor integer not null default 0,
  payment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, metric_date, currency)
);

create table if not exists public.insight_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date_range_start date not null,
  date_range_end date not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.share_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null,
  summary text not null,
  snapshot jsonb not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.provider_connections enable row level security;
alter table public.github_repositories enable row level security;
alter table public.daily_commit_metrics enable row level security;
alter table public.daily_revenue_metrics enable row level security;
alter table public.insight_runs enable row level security;
alter table public.share_reports enable row level security;

drop policy if exists "profiles are owned by users" on public.profiles;
create policy "profiles are owned by users" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "provider connections are owned by users" on public.provider_connections;
create policy "provider connections are owned by users" on public.provider_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "repositories are owned by users" on public.github_repositories;
create policy "repositories are owned by users" on public.github_repositories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "commit metrics are owned by users" on public.daily_commit_metrics;
create policy "commit metrics are owned by users" on public.daily_commit_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "revenue metrics are owned by users" on public.daily_revenue_metrics;
create policy "revenue metrics are owned by users" on public.daily_revenue_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "insight runs are owned by users" on public.insight_runs;
create policy "insight runs are owned by users" on public.insight_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "share reports are owned by users" on public.share_reports;
create policy "share reports are owned by users" on public.share_reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "public share reports are readable" on public.share_reports;
create policy "public share reports are readable" on public.share_reports
  for select using (is_public = true);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
exception
  when others then
    raise warning 'handle_new_user failed for auth user %: %', new.id, sqlerrm;
    return new;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;
grant all on public.profiles to service_role;
grant select, insert, update on public.profiles to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
