import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dayStatus, formatCH, thursdayActivity, todayZurich, weekdayName } from "@/lib/plan";

export function DateNav({
  label,
  sub,
  onPrev,
  onNext,
  onToday,
  isToday,
  prevLabel,
  nextLabel,
}: {
  label: string;
  sub?: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  isToday: boolean;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-3xl bg-card p-2 shadow-card">
      <Button variant="ghost" aria-label={prevLabel} onClick={onPrev} className="size-14 rounded-2xl">
        <ChevronLeft className="size-7" />
      </Button>
      <button type="button" onClick={onToday} className="flex min-h-14 flex-1 flex-col items-center justify-center rounded-2xl px-2 text-center">
        <span className="font-display text-xl font-semibold leading-tight sm:text-2xl">{label}</span>
        <span className="text-sm text-muted-foreground">{isToday ? sub : "Zurück zu heute antippen"}</span>
      </button>
      <Button variant="ghost" aria-label={nextLabel} onClick={onNext} className="size-14 rounded-2xl">
        <ChevronRight className="size-7" />
      </Button>
    </div>
  );
}

export function dayTitle(iso: string) {
  return `${weekdayName(iso)}, ${formatCH(iso)}`;
}
export const isToday = (iso: string) => iso === todayZurich();

export function DayBadges({ iso, compact }: { iso: string; compact?: boolean }) {
  const st = dayStatus(iso);
  const act = thursdayActivity(iso);
  const cls = compact ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return (
    <div className="flex flex-wrap gap-1.5">
      {st.kind === "ferien" && <span className={`rounded-full bg-holiday-soft font-semibold text-holiday ${cls}`}>🎄 {st.label} – schulfrei</span>}
      {st.kind === "halbtag" && <span className={`rounded-full bg-holiday-soft font-semibold text-holiday ${cls}`}>🎄 {st.label}</span>}
      {st.kind === "wochenende" && <span className={`rounded-full bg-muted text-muted-foreground ${cls}`}>Wochenende – schulfrei</span>}
      {act === "schwimmen" && <span className={`rounded-full bg-swim-soft font-semibold text-swim ${cls}`}>🏊 Schwimmen · Nachmittag frei</span>}
      {act === "turnen" && <span className={`rounded-full bg-done-soft font-semibold text-done ${cls}`}>🤸 Turnen · nachmittags MGS</span>}
      {act && <span className={`rounded-full bg-done-soft text-done ${cls}`}>● Gruppe A</span>}
    </div>
  );
}

export function TaskRow({
  title,
  emoji,
  done,
  stars,
  pending,
  onToggle,
  hint,
  locked,
}: {
  title: string;
  emoji: string;
  done: boolean;
  stars: number;
  pending?: boolean;
  onToggle: () => void;
  hint?: string | undefined;
  locked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending || (locked && done)}
      aria-pressed={done}
      className={`flex min-h-[72px] w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition active:scale-[0.99] disabled:opacity-80 ${
        done ? "border-done bg-done-soft" : "border-border bg-card"
      }`}
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 ${
          done ? "border-done bg-done text-primary-foreground" : "border-muted-foreground/40"
        }`}
      >
        {done && <Check className="size-6" strokeWidth={3} />}
      </span>
      <span className="text-2xl" aria-hidden>{emoji}</span>
      <span className="flex-1">
        <span className={`block text-lg font-semibold ${done ? "text-done" : ""}`}>{title}</span>
        <span className="block text-sm text-muted-foreground">{done ? "Erledigt" : hint ?? "Offen – antippen zum Abhaken"}</span>
      </span>
      {stars > 0 && <span className="rounded-full bg-star-soft px-3 py-1 text-sm font-bold text-foreground">+{stars} ⭐</span>}
    </button>
  );
}
