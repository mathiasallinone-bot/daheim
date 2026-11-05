import { supabase } from "@/integrations/supabase/client";

/** Öffentlicher VAPID-Schlüssel (der private liegt nur im Supabase Vault). */
export const VAPID_PUBLIC_KEY = "BHqqVxbnvhB4lYSEzQ9dfDbEWgyNiz18TEZ9z6v4Uly4k-_ewM364P2QQaKjiGNT-qWLdz0jCO_LtlCZZXivfXw";

/** Wasser-Wecker auf diesem Gerät eingeschaltet (Overlay in der App + Benachrichtigungen). */
export const WATER_DEVICE_KEY = "daheim-water-device";

export function waterOnThisDevice(): boolean {
  try {
    return localStorage.getItem(WATER_DEVICE_KEY) === "1";
  } catch {
    return false;
  }
}
function setWaterOnThisDevice(on: boolean) {
  try {
    if (on) localStorage.setItem(WATER_DEVICE_KEY, "1");
    else localStorage.removeItem(WATER_DEVICE_KEY);
  } catch {
    /* Gerätespeicher optional */
  }
  window.dispatchEvent(new Event("daheim-water-device"));
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iPhone/iPad: Benachrichtigungen gibt es nur, wenn die App auf dem Home-Bildschirm liegt. */
export function needsHomeScreen(): boolean {
  if (typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export function registerServiceWorker() {
  if (!pushSupported() || !import.meta.env.PROD) return;
  navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("[sw]", e));
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushResult = { push: boolean; reason?: string };

/** Wecker auf diesem Gerät einschalten; versucht zusätzlich Benachrichtigungen zu abonnieren. */
export async function enableWaterAlarm(familyId: string): Promise<PushResult> {
  setWaterOnThisDevice(true);
  if (!pushSupported()) return { push: false, reason: "Dieser Browser kann keine Benachrichtigungen empfangen." };
  if (needsHomeScreen()) return { push: false, reason: "Für Benachrichtigungen zuerst «Zum Home-Bildschirm» hinzufügen und die App von dort öffnen." };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { push: false, reason: "Benachrichtigungen wurden nicht erlaubt (in den Geräte-Einstellungen änderbar)." };
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!j.endpoint || !j.keys?.p256dh || !j.keys.auth) return { push: false, reason: "Gerät konnte nicht angemeldet werden." };
  const { error } = await supabase.rpc("save_push_subscription", {
    _family_id: familyId,
    _endpoint: j.endpoint,
    _p256dh: j.keys.p256dh,
    _auth: j.keys.auth,
  });
  if (error) throw error;
  return { push: true };
}

export async function disableWaterAlarm() {
  setWaterOnThisDevice(false);
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.rpc("remove_push_subscription", { _endpoint: sub.endpoint });
  await sub.unsubscribe();
}

export async function pushActive(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription());
}

/** Test-Benachrichtigung an alle eigenen Geräte (über die Supabase-Funktion). */
export async function sendTestPush(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("water-reminder", { body: { test: true } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const body = ctx ? await ctx.json().catch(() => null) : null;
    throw new Error((body as { error?: string } | null)?.error ?? error.message);
  }
  const r = data as { sent?: number };
  return r.sent ? "Test gesendet – gleich sollte die Benachrichtigung erscheinen." : "Kein Gerät erreicht.";
}
