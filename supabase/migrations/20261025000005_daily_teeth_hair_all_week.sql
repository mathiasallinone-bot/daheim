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