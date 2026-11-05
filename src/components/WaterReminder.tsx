import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import kitten from "@/assets/kitten.png";
import { Button } from "@/components/ui/button";
import { useConfirmUndo } from "@/components/ConfirmUndo";
import { friendlyError, useAnswerWater, useWaterChecks } from "@/lib/data";
import { useFamily } from "@/lib/family-context";
import { schoolEnd, todayZurich, waterSlots, WATER_TEXT, type WaterSlot } from "@/lib/plan";
import {
  disableWaterAlarm, enableWaterAlarm, needsHomeScreen, pushActive, pushSupported, sendTestPush, waterOnThisDevice,
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
  const slot = on && checks.isSuccess ? dueWaterSlot(today, hour, answered) : null;
  const key = slot ? `${today}-${slot.hour}` : "";
  const visible = !!slot && snoozedUntil(key) <= Date.now();
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
          onClick={() => answer.mutate({ day: today, hour: slot.hour, kind: slot.kind }, {
            onSuccess: () => { close(); toast.success(slot.kind === "flasche" ? "Super, Flasche ist bereit! 💧" : "Prima getrunken! 💧"); },
          })}>
          {text.yes}
        </Button>
        <Button size="lg" variant="secondary" className="h-14 rounded-2xl text-lg" onClick={() => { snooze(key); close(); }}>
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
  const [push, setPush] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [askUndo, undoDialog] = useConfirmUndo();
  const { hour } = zurichClock();

  useEffect(() => {
    void pushActive().then(setPush);
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
      setPush(await pushActive());
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
        <span className="font-semibold">🔔 Wecker auf diesem Gerät: {on ? (push ? "an (mit Benachrichtigung)" : "an (bei offener App)") : "aus"}</span>
        <Button size="sm" variant={on ? "outline" : "default"} className="h-11 rounded-xl" disabled={busy} onClick={() => void toggle()}>
          {on ? "Ausschalten" : "Einschalten"}
        </Button>
        {on && push && (
          <Button size="sm" variant="ghost" className="h-11 rounded-xl" disabled={busy} onClick={() => void test()}>
            Test senden
          </Button>
        )}
      </div>
      {!on && (pushSupported() || needsHomeScreen()) && (
        <p className="text-xs text-muted-foreground">
          Auf Sianas Gerät einschalten. {needsHomeScreen() ? "iPhone/iPad: zuerst über Teilen → «Zum Home-Bildschirm» hinzufügen, dann gibt es Benachrichtigungen auch bei geschlossener App." : "Dann klingelt das Kätzchen auch, wenn die App geschlossen ist."}
        </p>
      )}
      {undoDialog}
    </section>
  );
}
