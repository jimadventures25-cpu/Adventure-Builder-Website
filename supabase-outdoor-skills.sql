-- Adventure Builder Outdoor Skills V1
-- Personal notes and foraging observations only. Static knowledge guides live in the app/site bundle for offline use.
create table if not exists public.outdoor_notes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  note_text text not null check (char_length(note_text) <= 5000),
  location text not null default '',
  note_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.foraging_log (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) <= 160),
  notes text not null default '' check (char_length(notes) <= 5000),
  location text not null default '',
  observed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.outdoor_notes enable row level security;
alter table public.foraging_log enable row level security;
drop policy if exists "Users manage own outdoor notes" on public.outdoor_notes;
create policy "Users manage own outdoor notes" on public.outdoor_notes for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Users manage own foraging log" on public.foraging_log;
create policy "Users manage own foraging log" on public.foraging_log for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
revoke all on public.outdoor_notes, public.foraging_log from anon;
grant select,insert,update,delete on public.outdoor_notes,public.foraging_log to authenticated;
