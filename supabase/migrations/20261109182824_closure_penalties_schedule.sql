-- Bucht jede Nacht fällige Abzüge (5 vergessene Abschlüsse = −1 ⭐); 02:30 UTC = 03:30/04:30 Zürich
select cron.schedule('closure-penalties', '30 2 * * *',
  $$select public.apply_closure_penalties(id) from public.families$$);
