
-- Adventure Builder Accident Assistance V1
-- Run once in Supabase SQL Editor.
create table if not exists public.accident_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  record_ref text not null,
  record_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, record_id)
);
create index if not exists accident_records_user_updated_idx on public.accident_records(user_id, updated_at desc);
alter table public.accident_records enable row level security;
drop policy if exists "Users read own accident records" on public.accident_records;
create policy "Users read own accident records" on public.accident_records for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users create own accident records" on public.accident_records;
create policy "Users create own accident records" on public.accident_records for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users update own accident records" on public.accident_records;
create policy "Users update own accident records" on public.accident_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users delete own accident records" on public.accident_records;
create policy "Users delete own accident records" on public.accident_records for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.accident_records from anon;
grant select,insert,update,delete on public.accident_records to authenticated;
