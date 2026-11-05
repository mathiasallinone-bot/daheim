-- Stündlicher Aufruf der Edge Function «water-reminder».
-- Voraussetzung (einmalig, nicht im Repo): Vault-Secrets vapid_public_key, vapid_private_key, water_cron_secret.
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'water-reminder',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://iliwobmtvlgbffcsejwf.supabase.co/functions/v1/water-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'water_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);
