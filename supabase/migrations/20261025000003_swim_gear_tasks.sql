CREATE OR REPLACE FUNCTION public.is_swim_day(_d date)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT extract(isodow from _d) = 4 AND _d >= date '2026-10-29'
     AND NOT (_d BETWEEN date '2026-12-24' AND date '2027-01-10')
     AND ((_d - date '2026-10-29') / 7) % 2 = 0
$$;

CREATE OR REPLACE FUNCTION public.expected_routines(_d date)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE wd int := extract(isodow from _d); r text[] := '{}';
BEGIN
  IF wd <= 5 THEN r := r || ARRAY['zaehne-morgen','rucksack-auspacken','zaehne-abend']; END IF;
  IF wd <= 5 AND _d >= date '2026-10-29' THEN r := r || ARRAY['haare-morgen','haare-abend']; END IF;
  IF wd = 7 OR wd <= 4 THEN r := r || ARRAY['rucksack','kleider-bereitlegen']; END IF;
  IF wd = 7 OR public.is_swim_day(_d) THEN r := r || ARRAY['haarewaschen']; END IF;
  IF public.is_swim_day(_d) THEN r := r || ARRAY['schwimmsachen-bereit']; END IF;
  IF public.is_swim_day(_d + 1) THEN r := r || ARRAY['schwimmsachen-einpacken']; END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.set_completion_stars()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d date; missing int;
BEGIN
  new.completed_by := auth.uid();
  IF new.task_key = 'kleider-zusammenlegen' THEN
    IF NOT EXISTS (SELECT 1 FROM public.laundry_requests WHERE family_id = new.family_id AND day = new.day) THEN
      RAISE EXCEPTION 'Keine offene Wäsche-Aufgabe für diesen Tag';
    END IF;
    new.stars := 10;
  ELSIF new.task_key IN ('trockenfutter','buch-lesen') THEN
    new.stars := 5;
  ELSIF new.task_key = 'haarewaschen' THEN
    new.stars := CASE WHEN new.self_done THEN 2 ELSE 0 END;
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
    new.stars := 7;
  ELSE
    RAISE EXCEPTION 'Unbekannte Aufgabe';
  END IF;
  RETURN new;
END $$;