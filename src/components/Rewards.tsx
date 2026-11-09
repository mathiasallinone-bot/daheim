import { useEffect, useState } from "react";
import { toast } from "sonner";
import kitten from "@/assets/kitten.png";
import { Button } from "@/components/ui/button";
import { showKittenClip, showStarKitten } from "@/components/StarKitten";
import { REWARD_HINT_CLIPS, starClip } from "@/lib/kitten-video";
import { starReason, useClosureStatus, useInvalidate, useSpecialRewards } from "@/lib/data";
import { CLOSURE_LIMIT, todayZurich } from "@/lib/plan";

const HINT_KEY = "daheim-reward-hint";
const SEEN_KEY = "daheim-special-seen";

function readSeen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return new Set();
  }
}
function writeSeen(ids: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-60)));
  } catch {
    /* Gerätespeicher optional */
  }
}

/** Einmal pro Tag: Hinweis auf geheime Spezial-Belohnungen (ohne die Regeln zu verraten). */
export function RewardHint() {
  const today = todayZurich();
  const [show, setShow] = useState(false);
  const [clip] = useState(() => REWARD_HINT_CLIPS[Math.floor(Math.random() * REWARD_HINT_CLIPS.length)]!);
  useEffect(() => {
    try {
      setShow(localStorage.getItem(HINT_KEY) !== today);
    } catch {
      setShow(true);
    }
  }, [today]);
  // Kätzchen spricht den Hinweis einmal; wartet, falls gerade die Begrüssung läuft.
  useEffect(() => {
    if (!show) return;
    let tries = 0;
    const t = setInterval(() => {
      if (showKittenClip(clip) || ++tries > 20) clearInterval(t);
    }, 1500);
    return () => clearInterval(t);
  }, [show, clip]);
  if (!show) return null;
  const close = () => {
    try {
      localStorage.setItem(HINT_KEY, today);
    } catch {
      /* optional */
    }
    setShow(false);
  };
  return (
    <section aria-live="polite" className="flex items-center gap-3 rounded-3xl bg-star-soft p-4 shadow-card sm:p-5">
      <img src={kitten} alt="" className="kitten-breathe w-16 shrink-0 sm:w-20" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-display text-lg font-semibold leading-snug sm:text-xl">
          Psst, Siana! ✨ Ich habe geheime Spezial-Sterne versteckt.
        </p>
        <p className="text-sm text-muted-foreground sm:text-base">
          Wer seine Aufgaben regelmässig und früh erledigt und jeden Morgen und Abend abschliesst, kann sie entdecken.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="h-11 rounded-xl" onClick={close}>🐾 Okay, ich bin dabei!</Button>
          <Button size="sm" variant="ghost" className="h-11 rounded-xl" onClick={() => showKittenClip(clip)}>▶️ Nochmals anhören</Button>
        </div>
      </div>
    </section>
  );
}

/** Zähler vergessener Abschlüsse – sichtbar für Siana. */
export function ClosureCounter({ familyId }: { familyId: string }) {
  const status = useClosureStatus(familyId);
  const inv = useInvalidate();
  const booked = status.data?.new_penalties ?? 0;
  useEffect(() => {
    if (booked > 0) void inv("balance", "history");
  }, [booked, inv]);
  if (!status.data) return null;
  const n = status.data.counter;
  const limit = status.data.limit || CLOSURE_LIMIT;
  return (
    <p className={`rounded-2xl px-4 py-3 text-sm sm:text-base ${n >= limit - 1 ? "bg-holiday-soft text-holiday" : "bg-muted text-muted-foreground"}`}>
      <span className="font-semibold">📋 Vergessene Abschlüsse: {n} von {limit}</span>
      <span className="block text-xs sm:text-sm">Morgen und Abend abschliessen nicht vergessen – bei {limit} gibt es 1 ⭐ Abzug.</span>
    </p>
  );
}

/** Zeigt neu gebuchte Überraschungs-Sterne und Abzüge einmal pro Gerät. */
export function SpecialRewardsWatcher({ familyId }: { familyId: string }) {
  const specials = useSpecialRewards(familyId);
  useEffect(() => {
    const rows = specials.data;
    if (!rows) return;
    const seen = readSeen();
    if (seen === null) {
      // neues Gerät: Bisheriges nicht nachträglich zeigen
      writeSeen(new Set(rows.map((r) => r.id)));
      return;
    }
    const fresh = rows.filter((r) => !seen.has(r.id));
    if (fresh.length === 0) return;
    for (const r of fresh) seen.add(r.id);
    writeSeen(seen);
    const penalties = fresh.filter((r) => r.task_key === "abzug");
    const bonus = fresh.filter((r) => r.task_key !== "abzug");
    if (penalties.length > 0) {
      toast.warning(`Oh nein! ${CLOSURE_LIMIT}× vergessen abzuschliessen · ${penalties.length > 1 ? `−${penalties.length}` : "−1"} ⭐`, {
        description: "Denk an «Morgen abschliessen» und «Tag abschliessen». Der Zähler beginnt wieder bei 0.",
        duration: 10_000,
      });
    }
    const last = bonus.at(-1);
    if (last) showStarKitten(starReason(last.task_key, last.stars), starClip(last.task_key, last.stars));
  }, [specials.data]);
  return null;
}
