-- Adventure Builder Journal V3 shared website + app migration
-- Run once in Supabase SQL Editor.
alter table public.stories alter column photo_path drop not null;
alter table public.stories add column if not exists entry_status text not null default 'published';
alter table public.stories add column if not exists trip_id text;
alter table public.stories add column if not exists weather text;
alter table public.stories add column if not exists stats jsonb not null default '{}'::jsonb;
alter table public.stories add column if not exists ratings jsonb not null default '{}'::jsonb;
alter table public.stories add column if not exists memories jsonb not null default '{}'::jsonb;
alter table public.stories add column if not exists tags text[] not null default '{}'::text[];
alter table public.stories add column if not exists media_paths jsonb not null default '[]'::jsonb;
alter table public.stories add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if not exists (select 1 from pg_constraint where conname='stories_entry_status_check') then
    alter table public.stories add constraint stories_entry_status_check check (entry_status in ('draft','published'));
  end if;
end $$;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('journal-media','journal-media',false,6291456,array['image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/webm','audio/mpeg','audio/mp4','audio/x-m4a'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Journal owners upload their media" on storage.objects;
create policy "Journal owners upload their media" on storage.objects for insert to authenticated
with check (bucket_id='journal-media' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists "Journal owners and public readers view media" on storage.objects;
create policy "Journal owners and public readers view media" on storage.objects for select to public
using (bucket_id='journal-media' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(
  select 1 from public.stories s where s.visibility='public' and s.entry_status='published' and s.media_paths ? storage.objects.name
)));

drop policy if exists "Journal owners delete their media" on storage.objects;
create policy "Journal owners delete their media" on storage.objects for delete to authenticated
using (bucket_id='journal-media' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Existing stories RLS remains in force; drafts are still private unless owned.
drop policy if exists "Public stories and own stories can be read" on public.stories;
create policy "Public stories and own stories can be read" on public.stories for select to public
using ((visibility='public' and entry_status='published') or (select auth.uid())=user_id);
