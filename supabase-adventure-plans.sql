-- Adventure Builder unified Trip Planner (website + app)
create table if not exists public.adventure_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  title text not null default 'Adventure',
  plan_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, plan_id)
);
alter table public.adventure_plans enable row level security;
drop policy if exists "Users read own adventure plans" on public.adventure_plans;
create policy "Users read own adventure plans" on public.adventure_plans for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Users insert own adventure plans" on public.adventure_plans;
create policy "Users insert own adventure plans" on public.adventure_plans for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "Users update own adventure plans" on public.adventure_plans;
create policy "Users update own adventure plans" on public.adventure_plans for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Users delete own adventure plans" on public.adventure_plans;
create policy "Users delete own adventure plans" on public.adventure_plans for delete to authenticated using ((select auth.uid())=user_id);
grant select,insert,update,delete on public.adventure_plans to authenticated;
