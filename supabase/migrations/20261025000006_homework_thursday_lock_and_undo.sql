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