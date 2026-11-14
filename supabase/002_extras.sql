-- Our Trips: bookings, shared budget and packing list.
-- Run once in Supabase, after 001_core.sql: SQL Editor > New query > paste > Run.

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind text not null default 'other'
    check (kind in ('flight', 'stay', 'train', 'bus', 'ferry', 'car', 'tour', 'restaurant', 'other')),
  title text not null check (char_length(title) between 1 and 200),
  provider text check (char_length(provider) <= 120),
  reference text check (char_length(reference) <= 120),
  starts_on date not null,
  start_time time,
  ends_on date,
  end_time time,
  start_place text check (char_length(start_place) <= 300),
  end_place text check (char_length(end_place) <= 300),
  notes text not null default '' check (char_length(notes) <= 5000),
  cost numeric(12, 2) check (cost >= 0),
  currency text check (currency ~ '^[A-Z]{3}$'),
  home_cost numeric(12, 2) check (home_cost >= 0),
  paid_by uuid references public.profiles (id) on delete set null,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create index bookings_trip_idx on public.bookings (trip_id, starts_on);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  spent_on date not null,
  description text not null check (char_length(description) between 1 and 200),
  category text not null default 'other'
    check (category in ('food', 'transport', 'stay', 'activities', 'shopping', 'other')),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  home_amount numeric(12, 2) not null check (home_amount >= 0),
  paid_by uuid references public.profiles (id) on delete set null,
  -- 'shared' is split evenly between the travellers; 'personal' isn't.
  split text not null default 'shared' check (split in ('shared', 'personal')),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index expenses_trip_idx on public.expenses (trip_id, spent_on);

-- The planned spend for each budget category, in the trip's home currency.
create table public.budget_lines (
  trip_id uuid not null references public.trips (id) on delete cascade,
  category text not null
    check (category in ('food', 'transport', 'stay', 'activities', 'shopping', 'other')),
  planned numeric(12, 2) not null check (planned >= 0),
  primary key (trip_id, category)
);

create table public.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 200),
  -- Empty means it's shared. Otherwise it's that traveller's own item.
  owner uuid references public.profiles (id) on delete cascade,
  packed boolean not null default false,
  position double precision not null default 1000,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index packing_items_trip_idx on public.packing_items (trip_id, position);

------------------------------------------------------------------------------
-- Record who last changed a row, and when
------------------------------------------------------------------------------

create function public.touch_row()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger bookings_touch before insert or update on public.bookings
  for each row execute function public.touch_row();
create trigger expenses_touch before insert or update on public.expenses
  for each row execute function public.touch_row();
create trigger packing_items_touch before insert or update on public.packing_items
  for each row execute function public.touch_row();

------------------------------------------------------------------------------
-- Access rules: only the trip's travellers can see or change these
------------------------------------------------------------------------------

revoke all on public.bookings, public.expenses, public.budget_lines, public.packing_items from anon, authenticated;
grant select, insert, update, delete on public.bookings, public.expenses, public.budget_lines, public.packing_items to authenticated;

alter table public.bookings enable row level security;
alter table public.expenses enable row level security;
alter table public.budget_lines enable row level security;
alter table public.packing_items enable row level security;

create policy "Members manage bookings" on public.bookings
  for all to authenticated
  using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

create policy "Members manage expenses" on public.expenses
  for all to authenticated
  using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

create policy "Members manage the budget" on public.budget_lines
  for all to authenticated
  using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

create policy "Members manage packing" on public.packing_items
  for all to authenticated
  using (public.is_trip_member(trip_id))
  with check (public.is_trip_member(trip_id));

------------------------------------------------------------------------------
-- Live updates
------------------------------------------------------------------------------

alter publication supabase_realtime
  add table public.bookings, public.expenses, public.budget_lines, public.packing_items;

notify pgrst, 'reload schema';
