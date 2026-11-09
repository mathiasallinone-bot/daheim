-- Belohnungssystem v2 (09.11.2026)
-- * Neue Zusatzaufgabe «katzenklo»: jedes 5. Mal 1 Stern; vom 9.–15.11.2026 jedes Mal 6 Sterne (Aktionswoche)
-- * Buch lesen: wenn der Stern fällig ist, zufällig etwa jedes 3. Mal 2 statt 1 Stern
-- * Versteckt: «fruehaufsteher» (Sonntag, 1 Stern): an allen 7 Tagen die Morgen-Aufgaben rechtzeitig abgehakt
--   (Schultage vor 08:00, Wochenende/Ferien vor 10:00)
-- * Versteckt: «hausaufgaben-bonus» (1 Stern): Hausaufgaben schon am Montag erledigt
-- * Abschlüsse merken: «morgenabschluss», «abendabschluss» (nur am selben Tag)
-- * «abzug» (−1 Stern): je 5 vergessene Abschlüsse (Morgen ab 10.11., Abend ab 09.11.)

-- Morgen-Aufgaben eines Tages (muss zu morningTasks() in src/lib/plan.ts passen)
create or replace function public.expected_morning(_d date)
returns text[] language sql immutable set search_path = public as $$
  select array['zaehne-morgen']
    || case when _d >= date '2026-10-29' then array['haare-morgen'] else array[]::text[] end
    || case when public.is_swim_day(_d) then array['schwimmsachen-bereit'] else array[]::text[] end
$$;

-- Bis wann die Morgen-Aufgaben erledigt sein müssen (Zürcher Ortszeit)
create or replace function public.morning_deadline(_d date)
returns timestamp language sql immutable set search_path = public as $$
  select _d + case when extract(isodow from _d) >= 6 or _d between date '2026-12-25' and date '2027-01-10'
                   then time '10:00' else time '08:00' end
$$;

create or replace function public.fruehaufsteher_ok(_family_id uuid, _sunday date)
returns boolean language sql stable security definer set search_path = public as $$
  select extract(isodow from _sunday) = 7 and not exists (
    select 1 from generate_series(_sunday - 6, _sunday, interval '1 day') g(d), unnest(public.expected_morning(g.d::date)) k
    where not exists (
      select 1 from public.task_completions c
      where c.family_id = _family_id and c.day = g.d::date and c.task_key = k
        and (c.created_at at time zone 'Europe/Zurich') < public.morning_deadline(g.d::date)))
$$;

-- Vergessene Abschlüsse bis gestern
create or replace function public.closure_misses(_family_id uuid, _today date default (now() at time zone 'Europe/Zurich')::date)
returns int language sql stable security definer set search_path = public as $$
  with y as (select _today - 1 as d)
  select (
    (select count(*) from y, generate_series(date '2026-11-10', y.d, interval '1 day') g(d)
      where not exists (select 1 from public.task_completions c where c.family_id = _family_id and c.day = g.d::date and c.task_key = 'morgenabschluss'))
  + (select count(*) from y, generate_series(date '2026-11-09', y.d, interval '1 day') g(d)
      where not exists (select 1 from public.task_completions c where c.family_id = _family_id and c.day = g.d::date
                        and c.task_key in ('abendabschluss','tagesabschluss')))
  )::int
$$;

create or replace function public.closure_penalties_due(_family_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select public.closure_misses(_family_id) / 5
       - (select count(*) from public.task_completions where family_id = _family_id and task_key = 'abzug')::int
$$;

CREATE OR REPLACE FUNCTION public.set_completion_stars()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d date; missing int; reset_at timestamptz; n int; today date := (now() AT TIME ZONE 'Europe/Zurich')::date;
BEGIN
  new.completed_by := coalesce(auth.uid(), new.completed_by);
  SELECT stars_reset_at INTO reset_at FROM public.families WHERE id = new.family_id;
  IF new.task_key IN ('kleider-zusammenlegen','buch-lesen','katzenklo') THEN
    IF new.task_key = 'kleider-zusammenlegen' AND NOT EXISTS (SELECT 1 FROM public.laundry_requests WHERE family_id = new.family_id AND day = new.day) THEN
      RAISE EXCEPTION 'Keine offene Wäsche-Aufgabe für diesen Tag';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(new.family_id::text || new.task_key));
    SELECT count(*) + 1 INTO n FROM public.task_completions
      WHERE family_id = new.family_id AND task_key = new.task_key AND created_at >= reset_at;
    new.stars := CASE WHEN n % (CASE WHEN new.task_key = 'kleider-zusammenlegen' THEN 10 ELSE 5 END) = 0 THEN 1 ELSE 0 END;
    IF new.task_key = 'buch-lesen' AND new.stars = 1 AND random() < 1.0 / 3 THEN
      new.stars := 2;  -- Doppelstern (zufällig)
    END IF;
    IF new.task_key = 'katzenklo' AND new.day BETWEEN date '2026-11-09' AND date '2026-11-15' THEN
      new.stars := 6;  -- Aktionswoche
    END IF;
  ELSIF new.task_key = 'abfall' THEN
    new.stars := 1;
  ELSIF new.task_key IN ('trockenfutter','tagesabschluss') THEN
    IF new.task_key = 'tagesabschluss' AND public.homework_missing_for_close(new.family_id, new.day) THEN
      RAISE EXCEPTION 'Hausaufgaben noch nicht fertig – Tag kann nicht abgeschlossen werden';
    END IF;
    new.stars := 0;
  ELSIF new.task_key IN ('morgenabschluss','abendabschluss') THEN
    IF new.day <> today THEN RAISE EXCEPTION 'Abschluss nur am selben Tag'; END IF;
    new.stars := 0;
  ELSIF new.task_key = 'fruehaufsteher' THEN
    IF NOT public.fruehaufsteher_ok(new.family_id, new.day) THEN RAISE EXCEPTION 'Frühaufsteher-Stern nicht verdient'; END IF;
    new.stars := 1;
  ELSIF new.task_key = 'hausaufgaben-bonus' THEN
    IF extract(isodow from new.day) <> 1 OR NOT EXISTS (
      SELECT 1 FROM public.task_completions c WHERE c.family_id = new.family_id AND c.day = new.day AND c.task_key = 'hausaufgaben'
        AND (c.created_at AT TIME ZONE 'Europe/Zurich')::date = new.day) THEN
      RAISE EXCEPTION 'Hausaufgaben-Bonus nicht verdient';
    END IF;
    new.stars := 1;
  ELSIF new.task_key = 'abzug' THEN
    IF public.closure_penalties_due(new.family_id) <= 0 THEN RAISE EXCEPTION 'Kein Abzug fällig'; END IF;
    new.stars := -1;
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
    IF new.day > today THEN RAISE EXCEPTION 'Woche noch nicht vorbei'; END IF;
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

-- Versteckte Boni sofort vergeben, sobald sie verdient sind
create or replace function public.grant_hidden_bonuses()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if extract(isodow from new.day) = 7 and new.task_key = any(public.expected_morning(new.day))
     and public.fruehaufsteher_ok(new.family_id, new.day) then
    insert into public.task_completions(family_id, day, task_key, completed_by)
    values (new.family_id, new.day, 'fruehaufsteher', new.completed_by) on conflict do nothing;
  end if;
  if new.task_key = 'hausaufgaben' and extract(isodow from new.day) = 1
     and (new.created_at at time zone 'Europe/Zurich')::date = new.day then
    insert into public.task_completions(family_id, day, task_key, completed_by)
    values (new.family_id, new.day, 'hausaufgaben-bonus', new.completed_by) on conflict do nothing;
  end if;
  return null;
end $$;
create trigger trg_hidden_bonuses after insert on public.task_completions
  for each row execute function public.grant_hidden_bonuses();

-- Abzüge buchen (intern; von der App und nachts per Cron aufgerufen)
create or replace function public.apply_closure_penalties(_family_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; who uuid;
begin
  select created_by into who from public.families where id = _family_id;
  while public.closure_penalties_due(_family_id) > 0 loop
    insert into public.task_completions(family_id, day, task_key, completed_by)
    values (_family_id, (now() at time zone 'Europe/Zurich')::date - 1 - n, 'abzug', coalesce(auth.uid(), who));
    n := n + 1;
  end loop;
  return n;
end $$;

-- Für die App: Abzüge buchen und Stand der vergessenen Abschlüsse liefern
create or replace function public.closure_status(_family_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare booked int; m int;
begin
  if not public.is_family_member(_family_id) then raise exception 'Kein Zugriff'; end if;
  booked := public.apply_closure_penalties(_family_id);
  m := public.closure_misses(_family_id);
  return json_build_object('counter', m % 5, 'limit', 5, 'new_penalties', booked);
end $$;

CREATE OR REPLACE FUNCTION public.undo_completion(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.task_completions; today date := (now() AT TIME ZONE 'Europe/Zurich')::date; target date; sun date; missing int; d date;
BEGIN
  SELECT * INTO r FROM public.task_completions WHERE id = _id;
  IF NOT FOUND OR NOT public.is_family_member(r.family_id) THEN RAISE EXCEPTION 'Nicht gefunden'; END IF;
  IF r.task_key IN ('wochenbonus','tagesabschluss','fruehaufsteher','hausaufgaben-bonus','abzug','morgenabschluss','abendabschluss') THEN
    RAISE EXCEPTION 'Kann nicht zurückgenommen werden';
  END IF;
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
  IF r.task_key = ANY(public.expected_routines(target)) OR r.task_key IN ('kleider-zusammenlegen','hausaufgaben','hausaufgaben-einpacken') THEN
    DELETE FROM public.task_completions WHERE family_id = r.family_id AND day = target AND task_key = 'tagesabschluss';
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

  -- (c) versteckte Boni entfernen, wenn sie nicht mehr verdient sind
  IF NOT public.fruehaufsteher_ok(r.family_id, sun) THEN
    DELETE FROM public.task_completions WHERE family_id = r.family_id AND day = sun AND task_key = 'fruehaufsteher';
  END IF;
  IF r.task_key = 'hausaufgaben' THEN
    DELETE FROM public.task_completions WHERE family_id = r.family_id AND day = r.day AND task_key = 'hausaufgaben-bonus';
  END IF;
END $$;

ALTER POLICY "fam delete" ON public.task_completions
  USING (public.is_family_member(family_id) AND task_key <> ALL (ARRAY['wochenbonus','tagesabschluss','fruehaufsteher','hausaufgaben-bonus','abzug','morgenabschluss','abendabschluss']));

revoke execute on function public.fruehaufsteher_ok(uuid, date), public.closure_misses(uuid, date), public.closure_penalties_due(uuid),
  public.apply_closure_penalties(uuid), public.closure_status(uuid), public.grant_hidden_bonuses() from anon, public;
grant execute on function public.closure_status(uuid) to authenticated;
