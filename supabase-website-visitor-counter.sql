-- Adventure Builder website visitor counter
-- Run once in the Supabase SQL editor before deploying the counter.

create table if not exists public.website_visits (
  visitor_key text not null,
  path text not null,
  visit_count bigint not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (visitor_key, path)
);

alter table public.website_visits enable row level security;

create or replace function public.record_website_visit(p_path text, p_visitor_key text)
returns table(total_views bigint, unique_visitors bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_path is null or length(p_path) > 500 or p_visitor_key is null or length(p_visitor_key) > 200 then
    raise exception 'Invalid visit data';
  end if;

  insert into public.website_visits(visitor_key, path, visit_count, first_seen, last_seen)
  values (p_visitor_key, p_path, 1, now(), now())
  on conflict (visitor_key, path)
  do update set visit_count = public.website_visits.visit_count + 1,
                last_seen = now();

  return query
  select coalesce(sum(v.visit_count),0)::bigint,
         count(distinct v.visitor_key)::bigint
  from public.website_visits v;
end;
$$;

revoke all on function public.record_website_visit(text,text) from public;
grant execute on function public.record_website_visit(text,text) to anon, authenticated;
