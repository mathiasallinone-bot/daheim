
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create table public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);
grant select on public.families to authenticated;
grant select on public.family_members to authenticated;
grant all on public.families, public.family_members to service_role;
alter table public.families enable row level security;
alter table public.family_members enable row level security;

create or replace function public.is_family_member(_family_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.family_members where family_id = _family_id and user_id = auth.uid())
$$;

create policy "members read family" on public.families for select to authenticated using (public.is_family_member(id));
create policy "members read members" on public.family_members for select to authenticated using (public.is_family_member(family_id));

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  day date not null,
  task_key text not null,
  stars int not null default 0,
  completed_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (family_id, day, task_key)
);
create table public.laundry_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  day date not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (family_id, day)
);
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  stars_required int not null check (stars_required between 1 and 10000),
  created_at timestamptz not null default now()
);
create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  reward_name text not null,
  stars int not null check (stars > 0),
  redeemed_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create table public.recurring_tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  interval_days int not null default 28 check (interval_days > 0),
  last_done date not null,
  next_due date not null,
  created_at timestamptz not null default now()
);
create table public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  weekday int check (weekday between 1 and 7),
  on_date date,
  start_time time not null,
  end_time time,
  title text not null check (char_length(title) between 1 and 80),
  kind text not null default 'termin' check (kind in ('lektion','mgs','termin')),
  created_at timestamptz not null default now(),
  check ((weekday is null) <> (on_date is null))
);

grant select, insert, delete on public.task_completions to authenticated;
grant select, insert on public.laundry_requests to authenticated;
grant select, insert, update, delete on public.rewards to authenticated;
grant select, insert on public.reward_redemptions to authenticated;
grant select on public.recurring_tasks to authenticated;
grant select, insert, delete on public.schedule_entries to authenticated;
grant all on public.task_completions, public.laundry_requests, public.rewards, public.reward_redemptions, public.recurring_tasks, public.schedule_entries to service_role;

alter table public.task_completions enable row level security;
alter table public.laundry_requests enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.recurring_tasks enable row level security;
alter table public.schedule_entries enable row level security;

create policy "fam select" on public.task_completions for select to authenticated using (public.is_family_member(family_id));
create policy "fam insert" on public.task_completions for insert to authenticated with check (public.is_family_member(family_id));
create policy "fam delete" on public.task_completions for delete to authenticated using (public.is_family_member(family_id) and task_key <> 'trockenfutter');
create policy "fam select" on public.laundry_requests for select to authenticated using (public.is_family_member(family_id));
create policy "fam insert" on public.laundry_requests for insert to authenticated with check (public.is_family_member(family_id));
create policy "fam all" on public.rewards for all to authenticated using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
create policy "fam select" on public.reward_redemptions for select to authenticated using (public.is_family_member(family_id));
create policy "fam insert" on public.reward_redemptions for insert to authenticated with check (public.is_family_member(family_id));
create policy "fam select" on public.recurring_tasks for select to authenticated using (public.is_family_member(family_id));
create policy "fam select" on public.schedule_entries for select to authenticated using (public.is_family_member(family_id));
create policy "fam insert" on public.schedule_entries for insert to authenticated with check (public.is_family_member(family_id));
create policy "fam delete" on public.schedule_entries for delete to authenticated using (public.is_family_member(family_id));

-- Server-side star values; client cannot choose them
create or replace function public.set_completion_stars()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.completed_by := auth.uid();
  if new.task_key = 'kleider-zusammenlegen' then
    if not exists (select 1 from public.laundry_requests where family_id = new.family_id and day = new.day) then
      raise exception 'Keine offene Wäsche-Aufgabe für diesen Tag';
    end if;
    new.stars := 10;
  elsif new.task_key = 'trockenfutter' then
    new.stars := 5;
  elsif new.task_key in ('rucksack','kleider-bereitlegen','zaehne-morgen','zaehne-abend','haarewaschen') then
    new.stars := 2;
  else
    raise exception 'Unbekannte Aufgabe';
  end if;
  return new;
end $$;
create trigger trg_completion_stars before insert on public.task_completions for each row execute function public.set_completion_stars();

create or replace function public.star_balance(_family_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when public.is_family_member(_family_id) then
    coalesce((select sum(stars) from public.task_completions where family_id = _family_id),0)
    - coalesce((select sum(stars) from public.reward_redemptions where family_id = _family_id),0)
  else 0 end::int
$$;

create or replace function public.check_redemption()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.redeemed_by := auth.uid();
  if public.star_balance(new.family_id) < new.stars then
    raise exception 'Nicht genügend Sterne';
  end if;
  return new;
end $$;
create trigger trg_redemption before insert on public.reward_redemptions for each row execute function public.check_redemption();

create or replace function public.create_family(_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  insert into public.families(name, created_by) values (coalesce(nullif(trim(_name),''),'Familie'), auth.uid()) returning id into fid;
  insert into public.family_members(family_id, user_id) values (fid, auth.uid());
  insert into public.recurring_tasks(family_id, title, interval_days, last_done, next_due) values
    (fid, 'Katzentoiletten gründlich reinigen', 28, '2026-10-24', '2026-11-21'),
    (fid, 'Filter des Katzenbrunnens wechseln', 28, '2026-10-15', '2026-11-12');
  return fid;
end $$;

create or replace function public.join_family(_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select id into fid from public.families where invite_code = trim(_code);
  if fid is null then raise exception 'Einladungscode ungültig'; end if;
  insert into public.family_members(family_id, user_id) values (fid, auth.uid()) on conflict do nothing;
  return fid;
end $$;

create or replace function public.complete_recurring(_id uuid)
returns public.recurring_tasks language plpgsql security definer set search_path = public as $$
declare r public.recurring_tasks; today date := (now() at time zone 'Europe/Zurich')::date;
begin
  select * into r from public.recurring_tasks where id = _id;
  if r.id is null or not public.is_family_member(r.family_id) then raise exception 'Kein Zugriff'; end if;
  update public.recurring_tasks set last_done = today, next_due = today + interval_days where id = _id returning * into r;
  return r;
end $$;

revoke execute on function public.create_family(text), public.join_family(text), public.complete_recurring(uuid), public.star_balance(uuid), public.is_family_member(uuid) from anon, public;
grant execute on function public.create_family(text), public.join_family(text), public.complete_recurring(uuid), public.star_balance(uuid), public.is_family_member(uuid) to authenticated;
