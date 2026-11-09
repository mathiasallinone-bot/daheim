-- Einmaliger Extra-Bonus: Buch lesen am 9.11.2026 gibt zusätzlich +2 Sterne (nur am selben Tag eingetragen).
-- Eigener BEFORE-Trigger; läuft nach trg_completion_stars (alphabetische Reihenfolge).
create or replace function public.special_day_bonus()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.task_key = 'buch-lesen' and new.day = date '2026-11-09'
     and (now() at time zone 'Europe/Zurich')::date = date '2026-11-09' then
    new.stars := new.stars + 2;
  end if;
  return new;
end $$;
create trigger trg_completion_stars_zbonus before insert on public.task_completions
  for each row execute function public.special_day_bonus();
revoke execute on function public.special_day_bonus() from anon, public;
