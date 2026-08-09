-- Adventure Builder Accident Assistance — Evidence + Sync upgrade
-- Run after supabase-accident-assistance.sql. Safe to run more than once.
create extension if not exists pgcrypto;

create table if not exists public.accident_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  evidence_id text not null,
  evidence_ref text not null,
  kind text not null check (kind in ('photo','video','dashcam','document','other')),
  caption text not null default '',
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  file_size bigint not null default 0,
  storage_path text not null,
  original_preserved boolean not null default true,
  captured_or_added_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id,evidence_id)
);
create index if not exists accident_evidence_record_idx on public.accident_evidence(user_id,record_id,evidence_ref);
alter table public.accident_evidence enable row level security;
drop policy if exists "Users read own accident evidence" on public.accident_evidence;
create policy "Users read own accident evidence" on public.accident_evidence for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Users insert own accident evidence" on public.accident_evidence;
create policy "Users insert own accident evidence" on public.accident_evidence for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "Users update own accident evidence" on public.accident_evidence;
create policy "Users update own accident evidence" on public.accident_evidence for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Users delete own accident evidence" on public.accident_evidence;
create policy "Users delete own accident evidence" on public.accident_evidence for delete to authenticated using ((select auth.uid())=user_id);
revoke all on public.accident_evidence from anon;
grant select,insert,update,delete on public.accident_evidence to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('accident-evidence','accident-evidence',false,104857600,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false;

drop policy if exists "Users upload own accident evidence files" on storage.objects;
create policy "Users upload own accident evidence files" on storage.objects for insert to authenticated
with check (bucket_id='accident-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Users read own accident evidence files" on storage.objects;
create policy "Users read own accident evidence files" on storage.objects for select to authenticated
using (bucket_id='accident-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Users delete own accident evidence files" on storage.objects;
create policy "Users delete own accident evidence files" on storage.objects for delete to authenticated
using (bucket_id='accident-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text);
