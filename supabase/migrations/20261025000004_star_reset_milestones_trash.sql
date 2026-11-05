ALTER TABLE public.families ADD COLUMN IF NOT EXISTS stars_reset_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.laundry_requests ADD COLUMN IF NOT EXISTS part text NOT NULL DEFAULT 'abend';
ALTER TABLE public.laundry_requests ALTER COLUMN part SET DEFAULT (CASE WHEN extract(hour FROM (now() AT TIME ZONE 'Europe/Zurich')) < 12 THEN 'morgen' ELSE 'abend' END);
ALTER TABLE public.laundry_requests ADD CONSTRAINT laundry_part_check CHECK (part IN ('morgen','abend'));

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

CREATE OR REPLACE FUNCTION public.star_balance(_family_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.is_family_member(_family_id) THEN
    coalesce((SELECT sum(c.stars) FROM public.task_completions c, public.families f
      WHERE c.family_id = _family_id AND f.id = _family_id AND c.created_at >= f.stars_reset_at),0)
    - coalesce((SELECT sum(r.stars) FROM public.reward_redemptions r, public.families f
      WHERE r.family_id = _family_id AND f.id = _family_id AND r.created_at >= f.stars_reset_at),0)
  ELSE 0 END::int
$$;