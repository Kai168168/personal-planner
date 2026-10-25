-- Run once in your own Supabase project's SQL Editor.
-- Only the authenticated owner can read or modify their planner document.
begin;
create table if not exists public.planner_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint planner_payload_shape check (
    jsonb_typeof(payload) = 'object'
    and payload ->> 'version' = '1'
    and jsonb_typeof(payload -> 'tasks') = 'array'
    and jsonb_typeof(payload -> 'expenses') = 'array'
  )
);
alter table public.planner_states enable row level security;
revoke all on public.planner_states from anon;
grant select, insert, update, delete on public.planner_states to authenticated;
drop policy if exists "Owners manage their own planner" on public.planner_states;
create policy "Owners manage their own planner" on public.planner_states
for all to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create or replace function public.planner_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists planner_touch_updated_at on public.planner_states;
create trigger planner_touch_updated_at before update on public.planner_states
for each row execute function public.planner_touch_updated_at();
commit;
