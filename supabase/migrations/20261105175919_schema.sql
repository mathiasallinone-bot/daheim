-- Daheim: vollständiges Datenbankschema (Stand 05.11.2026, entspricht 1:1 der Lovable-Datenbank).
-- Eingespielt am 05.11.2026 über den Supabase-Connector. Spätere Änderungen immer als neue, zusätzliche Migration.

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

-- 0001: «selber gemacht» beim Haarewaschen
ALTER TABLE public.task_completions ADD COLUMN IF NOT EXISTS self_done boolean NOT NULL DEFAULT false;

-- 0003: Schwimmtage (Donnerstagsrotation)
CREATE OR REPLACE FUNCTION public.is_swim_day(_d date)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT extract(isodow from _d) = 4 AND _d >= date '2026-10-29'
     AND NOT (_d BETWEEN date '2026-12-24' AND date '2027-01-10')
     AND ((_d - date '2026-10-29') / 7) % 2 = 0
$$;

-- 0004: Sterne-Reset, Wäsche morgens/abends, Meilenstein-Sterne
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS stars_reset_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.laundry_requests ADD COLUMN IF NOT EXISTS part text NOT NULL DEFAULT 'abend';
ALTER TABLE public.laundry_requests ALTER COLUMN part SET DEFAULT (CASE WHEN extract(hour FROM (now() AT TIME ZONE 'Europe/Zurich')) < 12 THEN 'morgen' ELSE 'abend' END);
ALTER TABLE public.laundry_requests ADD CONSTRAINT laundry_part_check CHECK (part IN ('morgen','abend'));

CREATE OR REPLACE FUNCTION public.star_balance(_family_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.is_family_member(_family_id) THEN
    coalesce((SELECT sum(c.stars) FROM public.task_completions c, public.families f
      WHERE c.family_id = _family_id AND f.id = _family_id AND c.created_at >= f.stars_reset_at),0)
    - coalesce((SELECT sum(r.stars) FROM public.reward_redemptions r, public.families f
      WHERE r.family_id = _family_id AND f.id = _family_id AND r.created_at >= f.stars_reset_at),0)
  ELSE 0 END::int
$$;

-- 0005: tägliche Routinen für den Wochenbonus
CREATE OR REPLACE FUNCTION public.expected_routines(_d date)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE wd int := extract(isodow from _d); r text[] := '{}';
BEGIN
  r := r || ARRAY['zaehne-morgen','zaehne-abend'];
  IF _d >= date '2026-10-29' THEN r := r || ARRAY['haare-morgen','haare-abend']; END IF;
  IF wd <= 5 THEN r := r || ARRAY['rucksack-auspacken']; END IF;
  IF wd = 7 OR wd <= 4 THEN r := r || ARRAY['rucksack','kleider-bereitlegen']; END IF;
  IF wd = 7 OR public.is_swim_day(_d) THEN r := r || ARRAY['haarewaschen']; END IF;
  IF public.is_swim_day(_d) THEN r := r || ARRAY['schwimmsachen-bereit']; END IF;
  IF public.is_swim_day(_d + 1) THEN r := r || ARRAY['schwimmsachen-einpacken']; END IF;
  RETURN r;
END $$;

-- 0006: Hausaufgaben-Sperre am Donnerstag und Zurücknehmen
CREATE OR REPLACE FUNCTION public.homework_missing_for_close(_family_id uuid, _d date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT extract(isodow from _d) = 4
    AND NOT ((_d + 1) BETWEEN date '2026-12-25' AND date '2027-01-10')
    AND (
      NOT EXISTS (SELECT 1 FROM public.task_completions WHERE family_id = _family_id AND day = _d - 3 AND task_key = 'hausaufgaben')
      OR NOT EXISTS (SELECT 1 FROM public.task_completions WHERE family_id = _family_id AND day = _d - 3 AND task_key = 'hausaufgaben-einpacken')
    )
$$;

CREATE OR REPLACE FUNCTION public.set_completion_stars()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d date; missing int; reset_at timestamptz; n int;
BEGIN
  new.completed_by := auth.uid();
  SELECT stars_reset_at INTO reset_at FROM public.families WHERE id = new.family_id;
  IF new.task_key IN ('kleider-zusammenlegen','buch-lesen') THEN
    IF new.task_key = 'kleider-zusammenlegen' AND NOT EXISTS (SELECT 1 FROM public.laundry_requests WHERE family_id = new.family_id AND day = new.day) THEN
      RAISE EXCEPTION 'Keine offene Wäsche-Aufgabe für diesen Tag';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(new.family_id::text || new.task_key));
    SELECT count(*) + 1 INTO n FROM public.task_completions
      WHERE family_id = new.family_id AND task_key = new.task_key AND created_at >= reset_at;
    new.stars := CASE WHEN n % (CASE WHEN new.task_key = 'buch-lesen' THEN 5 ELSE 10 END) = 0 THEN 1 ELSE 0 END;
  ELSIF new.task_key = 'abfall' THEN
    new.stars := 1;
  ELSIF new.task_key IN ('trockenfutter','tagesabschluss') THEN
    IF new.task_key = 'tagesabschluss' AND public.homework_missing_for_close(new.family_id, new.day) THEN
      RAISE EXCEPTION 'Hausaufgaben noch nicht fertig – Tag kann nicht abgeschlossen werden';
    END IF;
    new.stars := 0;
  ELSIF new.task_key = 'haarewaschen' THEN
    new.stars := CASE WHEN new.self_done THEN 1 ELSE 0 END;
  ELSIF new.task_key IN ('hausaufgaben','hausaufgaben-einpacken') THEN
    IF extract(isodow from new.day) <> 1 THEN RAISE EXCEPTION 'Hausaufgaben werden pro Woche (Montag) gespeichert'; END IF;
    IF new.task_key = 'hausaufgaben-einpacken' AND NOT EXISTS (
      SELECT 1 FROM public.task_completions WHERE family_id = new.family_id AND day = new.day AND task_key = 'hausaufgaben') THEN
      RAISE EXCEPTION 'Zuerst Hausaufgaben erledigen';
    END IF;
    new.stars := 0;
  ELSIF new.task_key IN ('rucksack','rucksack-auspacken','kleider-bereitlegen','zaehne-morgen','zaehne-abend','haare-morgen','haare-abend','schwimmsachen-bereit','schwimmsachen-einpacken') THEN
    new.stars := 0;
  ELSIF new.task_key = 'wochenbonus' THEN
    IF extract(isodow from new.day) <> 7 THEN RAISE EXCEPTION 'Wochenbonus nur am Sonntag'; END IF;
    IF new.day > (now() AT TIME ZONE 'Europe/Zurich')::date THEN RAISE EXCEPTION 'Woche noch nicht vorbei'; END IF;
    missing := 0;
    FOR i IN 0..6 LOOP
      d := new.day - 6 + i;
      SELECT missing + count(*) INTO missing FROM unnest(public.expected_routines(d)) k
        WHERE NOT EXISTS (SELECT 1 FROM public.task_completions c WHERE c.family_id = new.family_id AND c.day = d AND c.task_key = k);
    END LOOP;
    IF missing > 0 THEN RAISE EXCEPTION 'Woche nicht vollständig (% offen)', missing; END IF;
    new.stars := 1;
  ELSE
    RAISE EXCEPTION 'Unbekannte Aufgabe';
  END IF;
  RETURN new;
END $$;

CREATE OR REPLACE FUNCTION public.undo_completion(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.task_completions; today date := (now() AT TIME ZONE 'Europe/Zurich')::date; target date; sun date; missing int; d date;
BEGIN
  SELECT * INTO r FROM public.task_completions WHERE id = _id;
  IF NOT FOUND OR NOT public.is_family_member(r.family_id) THEN RAISE EXCEPTION 'Nicht gefunden'; END IF;
  IF r.task_key IN ('wochenbonus','tagesabschluss') THEN RAISE EXCEPTION 'Kann nicht zurückgenommen werden'; END IF;
  IF r.task_key IN ('hausaufgaben','hausaufgaben-einpacken') THEN
    IF r.day <> today - (extract(isodow from today)::int - 1) THEN RAISE EXCEPTION 'Nur für die laufende Woche'; END IF;
    IF r.task_key = 'hausaufgaben' AND EXISTS (SELECT 1 FROM public.task_completions WHERE family_id = r.family_id AND day = r.day AND task_key = 'hausaufgaben-einpacken') THEN
      RAISE EXCEPTION 'Zuerst «Hausaufgaben einpacken» zurücknehmen';
    END IF;
    target := today;
  ELSIF r.task_key = 'kleider-zusammenlegen' THEN
    IF (r.created_at AT TIME ZONE 'Europe/Zurich')::date <> today THEN RAISE EXCEPTION 'Nur heute zurücknehmbar'; END IF;
    target := today;
  ELSE
    IF r.day <> today THEN RAISE EXCEPTION 'Nur heute zurücknehmbar'; END IF;
    target := r.day;
  END IF;

  DELETE FROM public.task_completions WHERE id = _id;

  -- (a) Tagesabschluss entfernen, wenn danach eine Pflichtaufgabe fehlt
  IF r.task_key = ANY(public.expected_routines(target)) OR r.task_key = 'kleider-zusammenlegen'
     OR public.homework_missing_for_close(r.family_id, target)
     OR EXISTS (SELECT 1 FROM unnest(public.expected_routines(target)) k
        WHERE NOT EXISTS (SELECT 1 FROM public.task_completions c WHERE c.family_id = r.family_id AND c.day = target AND c.task_key = k)) THEN
    IF r.task_key = ANY(public.expected_routines(target)) OR r.task_key IN ('kleider-zusammenlegen','hausaufgaben','hausaufgaben-einpacken') THEN
      DELETE FROM public.task_completions WHERE family_id = r.family_id AND day = target AND task_key = 'tagesabschluss';
    END IF;
  END IF;

  -- (b) Wochenbonus entfernen, wenn die Woche nicht mehr vollständig ist
  sun := r.day + (7 - extract(isodow from r.day)::int);
  IF EXISTS (SELECT 1 FROM public.task_completions WHERE family_id = r.family_id AND day = sun AND task_key = 'wochenbonus') THEN
    missing := 0;
    FOR i IN 0..6 LOOP
      d := sun - 6 + i;
      SELECT missing + count(*) INTO missing FROM unnest(public.expected_routines(d)) k
        WHERE NOT EXISTS (SELECT 1 FROM public.task_completions c WHERE c.family_id = r.family_id AND c.day = d AND c.task_key = k);
    END LOOP;
    IF missing > 0 THEN
      DELETE FROM public.task_completions WHERE family_id = r.family_id AND day = sun AND task_key = 'wochenbonus';
    END IF;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.undo_completion(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.undo_completion(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.homework_missing_for_close(uuid, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.homework_missing_for_close(uuid, date) TO authenticated;

DROP POLICY IF EXISTS "fam delete" ON public.task_completions;
CREATE POLICY "fam delete" ON public.task_completions FOR DELETE TO authenticated
  USING (public.is_family_member(family_id) AND task_key <> ALL (ARRAY['wochenbonus','tagesabschluss']));

GRANT DELETE ON public.laundry_requests TO authenticated;
CREATE POLICY "fam delete" ON public.laundry_requests FOR DELETE TO authenticated
  USING (public.is_family_member(family_id) AND NOT EXISTS (
    SELECT 1 FROM public.task_completions c WHERE c.family_id = laundry_requests.family_id AND c.day = laundry_requests.day AND c.task_key = 'kleider-zusammenlegen'));
