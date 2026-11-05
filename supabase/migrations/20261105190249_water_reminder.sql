-- Wasser-Erinnerung: Antworten, Geräte für Benachrichtigungen, Zeitplan.
-- Zeiten müssen zu waterSlots() in src/lib/plan.ts passen.

-- Erinnerungszeiten (volle Stunden, Zürich): schulfrei 9/12/15/18, freier Nachmittag 12/15/18, sonst keine.
create or replace function public.water_slots(_d date)
returns int[] language sql immutable set search_path = public as $$
  select case
    when extract(isodow from _d) >= 6 or _d between date '2026-12-25' and date '2027-01-10' then array[9,12,15,18]
    when _d = date '2026-12-24' then array[12,15,18]
    when extract(isodow from _d) in (3,5) then array[12,15,18]
    when extract(isodow from _d) = 4 and public.is_swim_day(_d) then array[12,15,18]
    else array[]::int[]
  end
$$;

-- Antworten von Siana (eine pro Familie, Tag und Uhrzeit)
create table public.water_checks (
  family_id uuid not null references public.families(id) on delete cascade,
  day date not null,
  hour int not null check (hour between 0 and 23),
  kind text not null check (kind in ('flasche','trinken')),
  answered_by uuid not null default auth.uid(),
  answered_at timestamptz not null default now(),
  primary key (family_id, day, hour)
);
alter table public.water_checks enable row level security;
grant select, insert, delete on public.water_checks to authenticated;
create policy "fam select" on public.water_checks for select to authenticated using (public.is_family_member(family_id));
create policy "fam insert" on public.water_checks for insert to authenticated
  with check (public.is_family_member(family_id) and hour = any(public.water_slots(day)));
create policy "fam delete" on public.water_checks for delete to authenticated using (public.is_family_member(family_id));

-- Geräte, die Benachrichtigungen bekommen (Zugriff nur über die Funktionen unten)
create table public.push_subscriptions (
  endpoint text primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

-- Welche Erinnerung schon verschickt wurde (verhindert doppelte Benachrichtigungen)
create table public.water_push_log (
  family_id uuid not null references public.families(id) on delete cascade,
  day date not null,
  hour int not null,
  sent_at timestamptz not null default now(),
  primary key (family_id, day, hour)
);
alter table public.water_push_log enable row level security;

create or replace function public.save_push_subscription(_family_id uuid, _endpoint text, _p256dh text, _auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_family_member(_family_id) then raise exception 'Kein Zugriff'; end if;
  if _endpoint !~ '^https://' or length(_endpoint) > 1000 then raise exception 'Ungültiges Gerät'; end if;
  insert into public.push_subscriptions(endpoint, family_id, user_id, p256dh, auth)
  values (_endpoint, _family_id, auth.uid(), _p256dh, _auth)
  on conflict (endpoint) do update set family_id = excluded.family_id, user_id = excluded.user_id,
    p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end $$;

create or replace function public.remove_push_subscription(_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = _endpoint and user_id = auth.uid()
$$;

-- Fällige Benachrichtigungen jetzt (nur in den ersten 15 Minuten einer Erinnerungsstunde).
-- Merkt sich den Versand, damit jede Erinnerung höchstens einmal verschickt wird.
create or replace function public.water_push_due(_now timestamptz default now())
returns table(endpoint text, p256dh text, auth text, hour int, kind text)
language plpgsql security definer set search_path = public as $$
declare loc timestamp := _now at time zone 'Europe/Zurich'; d date := loc::date; h int := extract(hour from loc); slots int[];
begin
  slots := public.water_slots(d);
  if extract(minute from loc) >= 15 or not (h = any(slots)) then return; end if;
  return query
  with fams as (
    insert into public.water_push_log(family_id, day, hour)
    select distinct s.family_id, d, h from public.push_subscriptions s
    where not exists (select 1 from public.water_checks c where c.family_id = s.family_id and c.day = d and c.hour = h)
    on conflict do nothing
    returning family_id
  )
  select s.endpoint, s.p256dh, s.auth, h, case when h = slots[1] then 'flasche' else 'trinken' end
  from public.push_subscriptions s join fams f on f.family_id = s.family_id;
end $$;

revoke execute on function public.save_push_subscription(uuid, text, text, text), public.remove_push_subscription(text), public.water_push_due(timestamptz) from anon, public;
grant execute on function public.save_push_subscription(uuid, text, text, text), public.remove_push_subscription(text) to authenticated;
