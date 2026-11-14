-- Our Trips: core tables, access rules and live updates.
-- Run once in Supabase: SQL Editor > New query > paste this file > Run.
--
-- Access model: only signed-in travellers who are members of a trip can see
-- or change it. Anonymous visitors can't read anything.

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  start_date date not null,
  end_date date not null,
  home_currency text not null default 'AUD' check (home_currency ~ '^[A-Z]{3}$'),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 366)
);

create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index trip_members_user_idx on public.trip_members (user_id);

-- A stop is anything on the plan: a sight, a meal, a check-in, a train.
-- A stop with no day is a saved idea that isn't scheduled yet.
create table public.stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day date,
  position double precision not null default 1000,
  title text not null check (char_length(title) between 1 and 200),
  start_time time,
  category text not null default 'sight'
    check (category in ('sight', 'food', 'stay', 'transport', 'activity', 'shopping', 'other')),
  notes text not null default '' check (char_length(notes) <= 5000),
  address text check (char_length(address) <= 500),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index stops_trip_idx on public.stops (trip_id, day, position);

------------------------------------------------------------------------------
-- Helper functions
------------------------------------------------------------------------------

create function public.is_trip_member(p_trip uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip and m.user_id = (select auth.uid())
  );
$$;

create function public.shares_trip_with(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members mine
    join public.trip_members theirs on theirs.trip_id = mine.trip_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user
  );
$$;

-- Every account gets a profile with a display name.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''),
                  split_part(coalesce(new.email, 'traveller'), '@', 1)), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts created before this script ran.
insert into public.profiles (id, display_name)
select id, left(split_part(coalesce(email, 'traveller'), '@', 1), 60)
from auth.users
on conflict (id) do nothing;

-- Whoever creates a trip becomes its first member.
create function public.add_trip_creator()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.trip_members (trip_id, user_id)
  values (new.id, new.created_by)
  on conflict do nothing;
  return new;
end;
$$;

create trigger trips_add_creator
  after insert on public.trips
  for each row execute function public.add_trip_creator();

-- Record who last changed a stop, and when.
create function public.touch_stop()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger stops_touch
  before insert or update on public.stops
  for each row execute function public.touch_stop();

-- Add another traveller to a trip by their account's email address.
create function public.add_trip_member(p_trip uuid, p_email text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_trip_member(p_trip) then
    raise exception 'You are not a member of this trip.' using errcode = '42501';
  end if;

  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No account uses that email address.' using errcode = 'P0002';
  end if;

  insert into public.profiles (id, display_name)
  values (v_user, left(split_part(trim(p_email), '@', 1), 60))
  on conflict (id) do nothing;

  insert into public.trip_members (trip_id, user_id)
  values (p_trip, v_user)
  on conflict do nothing;
end;
$$;

revoke execute on function public.is_trip_member(uuid) from public, anon;
revoke execute on function public.shares_trip_with(uuid) from public, anon;
revoke execute on function public.add_trip_member(uuid, text) from public, anon;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.shares_trip_with(uuid) to authenticated;
grant execute on function public.add_trip_member(uuid, text) to authenticated;

------------------------------------------------------------------------------
-- Access rules
------------------------------------------------------------------------------

-- Grant exactly what the app needs. This works whether or not the project
-- exposes new tables automatically. Row level security below then limits
-- each signed-in person to their own trips.
revoke all on public.profiles, public.trips, public.trip_members, public.stops from anon, authenticated;
grant select on public.profiles, public.trips, public.trip_members, public.stops to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert, delete on public.trips to authenticated;
grant update (name, start_date, end_date, home_currency) on public.trips to authenticated;
grant insert, update, delete on public.stops to authenticated;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.stops enable row level security;

create policy "Read own and fellow travellers' profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_trip_with(id));

create policy "Update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Members read their trips" on public.trips
  for select to authenticated
  using (created_by = (select auth.uid()) or public.is_trip_member(id));

create policy "Create trips as yourself" on public.trips
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "Members update their trips" on public.trips
  for update to authenticated
  using (public.is_trip_member(id))
  with check (public.is_trip_member(id));

create policy "Members delete their trips" on public.trips
  for delete to authenticated
  using (public.is_trip_member(id));

create policy "Members see who is on their trips" on public.trip_members
  for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "Members manage stops" on public.stops
  for all to authenticated
  using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

------------------------------------------------------------------------------
-- Live updates, so a change on one phone shows on the other
------------------------------------------------------------------------------

alter publication supabase_realtime add table public.trips, public.trip_members, public.stops;
