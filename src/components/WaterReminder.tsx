import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import kitten from "@/assets/kitten.png";
import { Button } from "@/components/ui/button";
import { useConfirmUndo } from "@/components/ConfirmUndo";
import { friendlyError, useAnswerWater, useWaterChecks } from "@/lib/data";
import { useFamily } from "@/lib/family-context";
import { schoolEnd, todayZurich, waterSlots, WATER_TEXT, type WaterSlot } from "@/lib/plan";
import {
  disableWaterAlarm, enableWaterAlarm, needsHomeScreen, pushStatus, pushSupported, sendTestPush, syncPush, thisDeviceId,
  waterOnThisDevice, type PushStatus,
} from "@/lib/push";

/** Stunde und Minute in Zürich. */
export function zurichClock(now: Date = new Date()): { hour: number; minute: number } {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return { hour: get("hour"), minute: get("minute") };
}

/** Wie lange eine Erinnerung nach ihrer Zeit noch erscheint (Stunden). */
export const WATER_WINDOW_HOURS = 2;

/** Die jetzt fällige, noch nicht beantwortete Erinnerung (oder null). */
export function dueWaterSlot(day: string, hour: number, answered: Set<number>): WaterSlot | null {
  const due = waterSlots(day).filter((s) => s.hour <= hour && hour < s.hour + WATER_WINDOW_HOURS && !answered.has(s.hour));
  return due.at(-1) ?? null;
}

const SNOOZE_KEY = "daheim-water-snooze";
const WATER_DEMO_EVENT = "daheim-water-demo";

/** Zeigt das Wasser-Kätzchen sofort (Vorschau, ohne zu speichern). */
export function showWaterDemo() {
  window.dispatchEvent(new Event(WATER_DEMO_EVENT));
}
const SNOOZE_MIN = 10;

function snoozedUntil(key: string): number {
  try {
    const s = JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? "null") as { key: string; until: number } | null;
    return s && s.key === key ? s.until : 0;
  } catch {
    return 0;
  }
}
function snooze(key: string) {
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify({ key, until: Date.now() + SNOOZE_MIN * 60_000 }));
  } catch {
    /* optional */
  }
}

function useDeviceOn() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () => setOn(waterOnThisDevice());
    read();
    window.addEventListener("daheim-water-device", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("daheim-water-device", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return on;
}

/** Wecker-Overlay: erscheint zur Erinnerungszeit, solange die App offen ist (nur auf eingeschalteten Geräten). */
export function WaterReminderHost() {
  const fam = useFamily();
  const on = useDeviceOn();
  const [tick, setTick] = useState(0);
  const today = todayZurich();
  const checks = useWaterChecks(fam.id, today);
  const answer = useAnswerWater(fam.id);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    void syncPush(fam.id).catch(() => {});
  }, [fam.id]);
  // Vorschau: Knopf «Kätzchen zeigen» oder Antippen der Test-Benachrichtigung (?wasser=0)
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    const show = () => setDemo(true);
    window.addEventListener(WATER_DEMO_EVENT, show);
    try {
      if (new URLSearchParams(window.location.search).get("wasser") === "0") show();
    } catch {
      /* optional */
    }
    return () => window.removeEventListener(WATER_DEMO_EVENT, show);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    const vis = () => document.visibilityState === "visible" && setTick((n) => n + 1);
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const { hour } = zurichClock();
  const answered = new Set((checks.data ?? []).map((c) => c.hour));
  const real = on && checks.isSuccess ? dueWaterSlot(today, hour, answered) : null;
  const realVisible = !!real && snoozedUntil(`${today}-${real.hour}`) <= Date.now();
  const slot: WaterSlot | null = realVisible ? real : demo ? { hour: -1, kind: "trinken" } : null;
  const isDemo = !realVisible && demo;
  const key = slot ? `${today}-${slot.hour}` : "";
  const visible = !!slot;
  void tick;

  useEffect(() => {
    if (!visible) return;
    try {
      navigator.vibrate?.([300, 150, 300, 150, 300]);
    } catch {
      /* optional */
    }
    audio.current ??= new Audio("/media/wasser-wecker.mp3");
    audio.current.currentTime = 0;
    void audio.current.play().catch(() => {});
  }, [visible, key]);

  if (!visible || !slot || typeof document === "undefined") return null;
  const text = WATER_TEXT[slot.kind];
  const close = () => {
    audio.current?.pause();
    if (isDemo) {
      setDemo(false);
      try {
        const u = new URL(window.location.href);
        u.searchParams.delete("wasser");
        window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
      } catch {
        /* optional */
      }
    }
    setTick((n) => n + 1);
  };

  return createPortal(
    <div role="alertdialog" aria-modal="true" aria-labelledby="water-title" aria-describedby="water-q"
      className="fixed inset-0 z-[120] flex h-dvh w-full flex-col items-center justify-center gap-5 bg-swim-soft p-6 text-center">
      <div className="relative">
        <img src={kitten} alt="" className="kitten-breathe w-48 max-w-[55vw]" />
        <span aria-hidden className="absolute -right-6 top-2 animate-bounce text-6xl">💧</span>
      </div>
      <h2 id="water-title" className="font-display text-3xl font-bold text-swim">{text.title}</h2>
      <p id="water-q" className="kitten-bubble max-w-md rounded-3xl bg-card px-6 py-4 font-display text-2xl font-semibold shadow-card">
        {text.question}
      </p>
      <div className="flex w-full max-w-md flex-col gap-3">
        <Button size="lg" className="h-16 rounded-2xl bg-swim text-xl text-white hover:bg-swim/90" disabled={answer.isPending}
          onClick={() => isDemo
            ? (close(), toast.success("So sieht die Erinnerung aus – Prima getrunken! 💧"))
            : answer.mutate({ day: today, hour: slot.hour, kind: slot.kind }, {
                onSuccess: () => { close(); toast.success(slot.kind === "flasche" ? "Super, Flasche ist bereit! 💧" : "Prima getrunken! 💧"); },
              })}>
          {text.yes}
        </Button>
        <Button size="lg" variant="secondary" className="h-14 rounded-2xl text-lg" onClick={() => { if (!isDemo) snooze(key); close(); }}>
          ⏰ Gleich ({SNOOZE_MIN} Min.)
        </Button>
      </div>
    </div>,
    document.body,
  );
}

/** Übersicht auf «Heute»: Erinnerungszeiten, Antworten und Einstellung für dieses Gerät. */
export function WaterCard({ day }: { day: string }) {
  const fam = useFamily();
  const today = todayZurich();
  const slots = waterSlots(day);
  const checks = useWaterChecks(fam.id, day);
  const answer = useAnswerWater(fam.id);
  const on = useDeviceOn();
  const [push, setPush] = useState<PushStatus | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const devices = usePushDevices(fam.id);
  const [busy, setBusy] = useState(false);
  const [askUndo, undoDialog] = useConfirmUndo();
  const { hour } = zurichClock();

  useEffect(() => {
    void pushStatus().then(setPush);
    void thisDeviceId().then(setMyId);
  }, [on]);

  const done = new Map((checks.data ?? []).map((c) => [c.hour, c]));
  const end = schoolEnd(day);

  async function toggle() {
    setBusy(true);
    try {
      if (on) {
        await disableWaterAlarm();
        toast.success("Wasser-Wecker auf diesem Gerät ausgeschaltet");
      } else {
        const r = await enableWaterAlarm(fam.id);
        if (r.push) toast.success("Wasser-Wecker eingeschaltet – mit Benachrichtigungen 🔔");
        else toast.info("Wasser-Wecker eingeschaltet (nur bei offener App)", { description: r.reason });
      }
      setPush(await pushStatus());
      setMyId(await thisDeviceId());
      void devices.refetch();
    } catch (e) {
      toast.error("Hat nicht geklappt", { description: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  }

  async function enableAgain() {
    setBusy(true);
    try {
      const r = await enableWaterAlarm(fam.id);
      if (r.push) toast.success("Benachrichtigungen eingeschaltet 🔔 – tippe «Test senden» zum Prüfen");
      else toast.info("Noch keine Benachrichtigungen", { description: r.reason });
      setPush(await pushStatus());
      setMyId(await thisDeviceId());
      void devices.refetch();
    } catch (e) {
      toast.error("Hat nicht geklappt", { description: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      toast.success(await sendTestPush());
    } catch (e) {
      toast.error("Test fehlgeschlagen", { description: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-3xl bg-swim-soft p-4 shadow-card sm:p-5">
      <h2 className="text-2xl font-semibold text-swim">💧 Wasser trinken</h2>
      {slots.length === 0 ? (
        <p className="text-muted-foreground">Heute keine Erinnerung – Schule bis {end ?? "–"} Uhr.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {slots.map((s) => {
            const c = done.get(s.hour);
            const canAnswer = !c && day === today && s.hour <= hour;
            const label = `${s.hour}:00 · ${s.kind === "flasche" ? "Flasche bereit" : "Getrunken"}`;
            return (
              <li key={s.hour}>
                <button
                  type="button"
                  disabled={!c && !canAnswer}
                  aria-label={`${label}: ${c ? "erledigt" : "offen"}`}
                  onClick={() =>
                    c
                      ? askUndo(label, 0, () => answer.mutate({ day, hour: s.hour, kind: s.kind, undo: true }))
                      : answer.mutate({ day, hour: s.hour, kind: s.kind })
                  }
                  className={`flex min-h-14 w-full items-center gap-2 rounded-2xl border-2 px-3 py-2 text-left text-sm font-semibold ${
                    c ? "border-swim bg-card text-swim" : canAnswer ? "border-dashed border-swim bg-card" : "border-transparent bg-card/60 text-muted-foreground"
                  }`}
                >
                  <span aria-hidden className="text-xl">{c ? "✅" : s.kind === "flasche" ? "🍶" : "💧"}</span>
                  <span>{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-swim/20 pt-3 text-sm">
        <span className="font-semibold">🔔 Wecker auf diesem Gerät: {on ? (push === "ok" ? "an (mit Benachrichtigung)" : "an (nur bei offener App)") : "aus"}</span>
        <Button size="sm" variant={on ? "outline" : "default"} className="h-11 rounded-xl" disabled={busy} onClick={() => void toggle()}>
          {on ? "Ausschalten" : "Einschalten"}
        </Button>
        {on && push === "ok" && (
          <Button size="sm" variant="ghost" className="h-11 rounded-xl" disabled={busy} onClick={() => void test()}>
            Test senden
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-11 rounded-xl" onClick={showWaterDemo}>
          🐱 Kätzchen zeigen
        </Button>
      </div>
      {on && push && push !== "ok" && <PushHelp status={push} busy={busy} onEnable={() => void enableAgain()} />}
      <DeviceList devices={devices.data} myId={myId} />
      {!on && (pushSupported() || needsHomeScreen()) && (
        <p className="text-xs text-muted-foreground">
          Auf Sianas Gerät einschalten. {needsHomeScreen() ? "iPhone/iPad: zuerst über Teilen → «Zum Home-Bildschirm» hinzufügen, dann gibt es Benachrichtigungen auch bei geschlossener App." : "Dann klingelt das Kätzchen auch, wenn die App geschlossen ist."}
        </p>
      )}
      {undoDialog}
    </section>
  );
}

type PushDevice = { id: string; device: string | null; created_at: string; last_sent_at: string | null; last_error: string | null };

function usePushDevices(familyId: string) {
  return useQuery({
    queryKey: ["push-devices", familyId],
    queryFn: async (): Promise<PushDevice[]> => {
      const { data, error } = await supabase.rpc("push_devices", { _family_id: familyId });
      if (error) throw error;
      return (data ?? []) as PushDevice[];
    },
    staleTime: 60_000,
  });
}

const fmtSent = (iso: string) =>
  new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Welche Geräte Benachrichtigungen bekommen (für Eltern zur Kontrolle). */
function DeviceList({ devices, myId }: { devices: PushDevice[] | undefined; myId: string | null }) {
  if (!devices) return null;
  return (
    <div className="text-sm">
      <p className="font-semibold">📱 Benachrichtigungen gehen an:</p>
      {devices.length === 0 ? (
        <p className="text-muted-foreground">noch kein Gerät</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {devices.map((d) => (
            <li key={d.id} className="flex flex-wrap gap-x-2">
              <span className="font-medium">{d.device ?? "Gerät"}{d.id === myId ? " (dieses Gerät)" : ""}</span>
              <span className="text-muted-foreground">
                {d.last_error ? `⚠️ zuletzt Fehler (${d.last_error})` : d.last_sent_at ? `zuletzt gesendet ${fmtSent(d.last_sent_at)}` : `angemeldet ${fmtSent(d.created_at)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const HELP: Record<Exclude<PushStatus, "ok">, { text: string; button: boolean }> = {
  "ios-browser": {
    text: "Daheim läuft hier im Browser und nicht als App – so erlaubt Apple keine Benachrichtigungen. Das passiert auch, wenn das Symbol auf dem Home-Bildschirm noch von früher stammt. So geht es: 1. Das Daheim-Symbol auf dem Home-Bildschirm löschen. 2. In Safari daheim-five.vercel.app öffnen → Teilen-Knopf → «Zum Home-Bildschirm». 3. Daheim über das neue Symbol öffnen, anmelden und hier «Einschalten» tippen.",
    button: false,
  },
  unsupported: { text: "Dieser Browser kann keine Benachrichtigungen empfangen. Auf iPad/iPhone braucht es iPadOS/iOS 16.4 oder neuer.", button: false },
  denied: {
    text: "Benachrichtigungen sind auf diesem Gerät blockiert. iPad/iPhone: Einstellungen → Mitteilungen → Daheim → «Mitteilungen erlauben» (Ton und Banner einschalten). Android: Einstellungen → Apps → Daheim/Chrome → Benachrichtigungen. Danach hier tippen:",
    button: true,
  },
  ask: { text: "Benachrichtigungen sind auf diesem Gerät noch nicht erlaubt.", button: true },
  "no-sub": { text: "Dieses Gerät ist für Benachrichtigungen nicht (mehr) angemeldet.", button: true },
};

function PushHelp({ status, busy, onEnable }: { status: Exclude<PushStatus, "ok">; busy: boolean; onEnable: () => void }) {
  const h = HELP[status];
  return (
    <div role="status" className="space-y-2 rounded-2xl bg-holiday-soft p-3 text-sm">
      <p><span className="font-semibold">⚠️ Keine Benachrichtigungen bei geschlossener App.</span> {h.text}</p>
      {h.button && (
        <Button size="sm" className="h-11 rounded-xl" disabled={busy} onClick={onEnable}>🔔 Benachrichtigungen einschalten</Button>
      )}
    </div>
  );
}
