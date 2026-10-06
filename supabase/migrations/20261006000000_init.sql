-- King of Wordor: schema, row-level security, leaderboards, account deletion.
--
-- Security model, in one line: CLIENTS NEVER WRITE SCORES. The rounds table has
-- no insert/update/delete policy for anon or authenticated, so RLS refuses every
-- client write. Only the submit-round Edge Function writes, with the service
-- role, after replaying the round server-side (src/core/verify.ts).

-- ------------------------------------------------------------------ profiles
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 16),
  house       text not null default 'crimson'
              check (house in ('crimson', 'azure', 'forest', 'violet')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- names and colours are shown on the ladders, so they are readable
create policy profiles_read on public.profiles
  for select to anon, authenticated using (true);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- -------------------------------------------------------------------- rounds
create table public.rounds (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  mode           text not null check (mode in ('solo', 'daily')),
  day            date,
  difficulty     text not null check (difficulty in ('squire', 'knight', 'warlord')),
  seed           bigint not null check (seed >= 0),
  score          integer not null check (score >= 0),
  words          integer not null check (words >= 0),
  -- what the client claimed; kept for the audit trail, never shown
  claimed_score  integer not null,
  mismatch       boolean not null default false,
  events         jsonb not null,
  created_at     timestamptz not null default now(),
  constraint rounds_daily_has_day check ((mode = 'daily') = (day is not null)),
  constraint rounds_daily_is_knight check (mode <> 'daily' or difficulty = 'knight')
);

-- one siege per player per day, enforced by the database, not by the client
create unique index rounds_one_daily on public.rounds (user_id, day) where mode = 'daily';
create index rounds_daily_board on public.rounds (day, score desc) where mode = 'daily';

alter table public.rounds enable row level security;

-- a player can see their own history; nobody can write through the API
create policy rounds_read_own on public.rounds
  for select to authenticated using (user_id = auth.uid());

-- -------------------------------------------------------------- leaderboards
-- The four ladders from the brief: day, week, month, year. All rank the daily
-- siege - same seed and same difficulty for everyone, so the comparison is
-- fair. Day = that siege's score; week/month/year = the SUM of the sieges in
-- the period, which rewards coming back every day.
--
-- SECURITY DEFINER so it can aggregate across players while exposing only
-- name, house and score - never user ids, events or the audit columns.
-- is_me is computed here from auth.uid(), so a player can find their own row.
create function public.leaderboard(period text, anchor date, lim integer default 50)
returns table (rank bigint, name text, house text, score bigint, sieges bigint, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      case period
        when 'day'   then anchor
        when 'week'  then date_trunc('week',  anchor)::date
        when 'month' then date_trunc('month', anchor)::date
        when 'year'  then date_trunc('year',  anchor)::date
      end as lo,
      case period
        when 'day'   then anchor
        when 'week'  then (date_trunc('week',  anchor) + interval '6 days')::date
        when 'month' then (date_trunc('month', anchor) + interval '1 month - 1 day')::date
        when 'year'  then (date_trunc('year',  anchor) + interval '1 year - 1 day')::date
      end as hi
  ),
  totals as (
    select r.user_id, sum(r.score)::bigint as score, count(*)::bigint as sieges
    from public.rounds r, bounds b
    where r.mode = 'daily' and r.day between b.lo and b.hi
    group by r.user_id
  )
  select
    rank() over (order by t.score desc) as rank,
    p.name, p.house, t.score, t.sieges,
    -- lets the client highlight its own row without ever seeing a user id
    coalesce(t.user_id = auth.uid(), false) as is_me
  from totals t
  join public.profiles p on p.id = t.user_id
  order by t.score desc, p.name
  limit greatest(1, least(lim, 200));
$$;

revoke all on function public.leaderboard(text, date, integer) from public;
grant execute on function public.leaderboard(text, date, integer) to anon, authenticated;

-- --------------------------------------------------------- account deletion
-- Google Play's User Data policy requires an in-app deletion path. Deleting the
-- auth user cascades to profiles and from there to rounds.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
