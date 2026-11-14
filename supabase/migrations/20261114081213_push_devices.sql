-- Gerätenamen und Zustell-Status pro Benachrichtigungs-Anmeldung (für die Anzeige in der App)
alter table public.push_subscriptions
  add column if not exists device text,
  add column if not exists last_sent_at timestamptz,
  add column if not exists last_error text;

create or replace function public.set_push_device(_endpoint text, _device text)
returns void language sql security definer set search_path = public as $$
  update public.push_subscriptions set device = left(_device, 40)
  where endpoint = _endpoint and user_id = auth.uid()
$$;

-- Liste für die Familie; statt der Adresse nur ein Hash, damit die App «dieses Gerät» erkennt
create or replace function public.push_devices(_family_id uuid)
returns table(id text, device text, created_at timestamptz, last_sent_at timestamptz, last_error text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_family_member(_family_id) then raise exception 'Kein Zugriff'; end if;
  return query
    select encode(sha256(convert_to(s.endpoint, 'UTF8')), 'hex'), s.device, s.created_at, s.last_sent_at, s.last_error
    from public.push_subscriptions s where s.family_id = _family_id order by s.created_at;
end $$;

revoke execute on function public.set_push_device(text, text), public.push_devices(uuid) from anon, public;
grant execute on function public.set_push_device(text, text), public.push_devices(uuid) to authenticated;
