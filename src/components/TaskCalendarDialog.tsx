import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { addDays, tasksFor, todayZurich, weekday } from "@/lib/plan";

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Kalender: an welchen Tagen eine Aufgabe erledigt war und wann sie fällig, aber offen war. */
export function TaskCalendarDialog({
  open, onOpenChange, title, taskKey, doneDays, since,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  taskKey: string;
  doneDays: Set<string>;
  since: string;
}) {
  const today = todayZurich();
  const [month, setMonth] = useState(today.slice(0, 7));
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number) as [number, number];
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const lead = weekday(first) - 1;
  const days: string[] = [];
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) days.push(d);
  const due = (d: string) => tasksFor(d).some((t) => t.key === taskKey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription>Grün = erledigt · Rot = fällig, aber nicht erledigt</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="size-12 rounded-xl" aria-label="Voriger Monat" onClick={() => shift(-1)}><ChevronLeft className="size-6" /></Button>
          <span className="text-lg font-semibold">{MONTHS[m - 1]} {y}</span>
          <Button variant="ghost" className="size-12 rounded-xl" aria-label="Nächster Monat" onClick={() => shift(1)}><ChevronRight className="size-6" /></Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => <div key={w} className="font-semibold text-muted-foreground">{w}</div>)}
          {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} />)}
          {days.map((d) => {
            const done = doneDays.has(d);
            const missed = !done && d < today && d >= since && due(d);
            return (
              <div key={d} className={`flex aspect-square flex-col items-center justify-center rounded-xl ${
                done ? "bg-done-soft font-bold text-done" : missed ? "bg-holiday-soft text-holiday" : "bg-muted/50 text-muted-foreground"
              } ${d === today ? "ring-2 ring-primary" : ""}`}>
                <span>{Number(d.slice(8))}</span>
                <span className="text-xs leading-none">{done ? "✓" : missed ? "✗" : ""}</span>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
