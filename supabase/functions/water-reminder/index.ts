// Wasser-Erinnerung: verschickt Push-Benachrichtigungen an Sianas Geräte.
// Aufruf 1: stündlich durch pg_cron (Header x-cron-secret) → fällige Erinnerungen laut public.water_push_due().
// Aufruf 2: aus der App «Test senden» (Authorization: Bearer <Login>) → Test an die eigenen Geräte.
import webpush from "npm:web-push@3.6.7";
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });

const TEXT: Record<string, { title: string; body: string }> = {
  flasche: { title: "💧 Wasserflasche bereit?", body: "Hallo Siana! Ist deine Wasserflasche gefüllt und bereit?" },
  trinken: { title: "💧 Zeit zum Trinken!", body: "Hey Siana, hast du schon Wasser getrunken?" },
  test: { title: "💧 Test vom Kätzchen", body: "So sieht die Wasser-Erinnerung aus. Miau!" },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Target = { endpoint: string; p256dh: string; auth: string; hour: number; kind: string };

async function secrets() {
  const rows = await sql<{ name: string; decrypted_secret: string }[]>`
    select name, decrypted_secret from vault.decrypted_secrets
    where name in ('water_cron_secret', 'vapid_public_key', 'vapid_private_key')`;
  return Object.fromEntries(rows.map((r) => [r.name, r.decrypted_secret])) as Record<string, string>;
}

async function userFromToken(auth: string | null): Promise<string | null> {
  if (!auth?.startsWith("Bearer ")) return null;
  const url = Deno.env.get("SUPABASE_URL")!;
  // öffentlicher Schlüssel (steht auch in der App); dient nur zum Prüfen des Logins
  const key = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_XQqu5cQRsg5OPuJ5Ft0dng_yNG8Vhiz";
  const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: auth } });
  if (!res.ok) return null;
  const u = (await res.json()) as { id?: string };
  return u.id ?? null;
}

async function send(targets: Target[]) {
  let sent = 0, removed = 0, failed = 0;
  for (const t of targets) {
    const text = TEXT[t.kind] ?? TEXT.trinken!;
    const payload = JSON.stringify({ ...text, tag: `wasser-${t.hour}`, url: `/?wasser=${t.hour}` });
    try {
      await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, { TTL: 3600, urgency: "high" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await sql`delete from public.push_subscriptions where endpoint = ${t.endpoint}`;
        removed++;
      } else {
        failed++;
        console.error("push failed", code, (e as Error).message);
      }
    }
  }
  return { sent, removed, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    const s = await secrets();
    if (!s.vapid_public_key || !s.vapid_private_key) return json({ error: "VAPID-Schlüssel fehlen" }, 500);
    webpush.setVapidDetails("https://daheim-five.vercel.app", s.vapid_public_key, s.vapid_private_key);

    const cron = req.headers.get("x-cron-secret");
    if (cron) {
      if (!s.water_cron_secret || cron !== s.water_cron_secret) return json({ error: "forbidden" }, 403);
      const targets = await sql<Target[]>`select * from public.water_push_due()`;
      return json({ due: targets.length, ...(await send(targets)) });
    }

    const user = await userFromToken(req.headers.get("authorization"));
    if (!user) return json({ error: "Nicht angemeldet" }, 401);
    const targets = await sql<Target[]>`
      select endpoint, p256dh, auth, 0 as hour, 'test' as kind from public.push_subscriptions where user_id = ${user}`;
    if (targets.length === 0) return json({ error: "Auf deinen Geräten ist der Wasser-Wecker nicht eingeschaltet." }, 404);
    return json(await send(targets));
  } catch (e) {
    console.error(e);
    return json({ error: "Fehler beim Senden" }, 500);
  }
});
