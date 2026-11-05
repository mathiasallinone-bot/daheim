import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MorningVideoStage } from "@/components/MorningVideoStage";
import { supabase } from "@/integrations/supabase/client";
import { HomeworkCard, useHomework } from "@/components/HomeworkCard";
import { TaskList, type Completion, type LaundryItem } from "@/components/TaskList";
import { useCompletions, useInvalidate } from "@/lib/data";
import {
  WEEK_BONUS_STARS, addDays, formatCH, isSchoolFree, isWeekComplete, tasksFor, todayZurich, weekDaysEnding, weekday, weekdayShort, type TaskDef,
} from "@/lib/plan";

const SOUND_KEY = "daheim-kitten-sound";
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

let player: HTMLAudioElement | null = null;

/** iOS/Safari: Ton muss einmal in einer Nutzer-Geste "entsperrt" werden. */
export function primeSpeech() {
  if (typeof window === "undefined") return;
  player ??= new Audio();
  player.src = SILENT_WAV;
  void player.play().catch(() => {});
}

export function DayCloseDialog({
  open, onOpenChange, familyId, day, tasks, byKey, laundry, onNavigate, mode = "tag",
}: {
  onNavigate: (iso: string) => void;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  familyId: string;
  day: string;
  tasks: TaskDef[];
  byKey: Map<string, Completion>;
  laundry: LaundryItem[];
  mode?: "morgen" | "tag";
}) {
  const morning = mode === "morgen";
  const isSunday = !morning && weekday(day) === 7;
  const week = useCompletions(familyId, addDays(day, -6), day);
  const inv = useInvalidate();
  const [sound, setSound] = useState(false);
  useEffect(() => setSound(localStorage.getItem(SOUND_KEY) === "1"), []);

  const homework = useHomework(familyId, day);
  // Donnerstagabend: unfertige Hausaufgaben zählen wie eine offene Pflichtaufgabe.
  const homeworkBlocks = !morning && homework.blocksClose;
  const dayDone = tasks.every((t) => byKey.has(t.key)) && laundry.every((l) => l.done) && !homeworkBlocks;
  const doneSet = new Set((week.data ?? []).map((c) => `${c.day}|${c.task_key}`));
  const weekDone = isSunday && isWeekComplete(day, doneSet);
  const bonusBooked = doneSet.has(`${day}|wochenbonus`);
  const [showKitten, setShowKitten] = useState(false);
  const previousDone = useRef(dayDone);
  useEffect(() => {
    if (open) setShowKitten(true);
    else setShowKitten(false);
    previousDone.current = dayDone;
  }, [open]);

  useEffect(() => {
    if (open && dayDone && !previousDone.current) setShowKitten(true);
    previousDone.current = dayDone;
  }, [open, dayDone]);

  // Tagesabschluss merken: erledigte Wäsche verschwindet danach.
  const closedRef = useRef(false);
  useEffect(() => {
    if (morning || !open || !showKitten || !dayDone || closedRef.current || byKey.has("tagesabschluss") || day > todayZurich()) return;
    closedRef.current = true;
    void (async () => {
      await supabase.from("task_completions").insert({ family_id: familyId, day, task_key: "tagesabschluss" });
      await inv("completions", "laundry");
      closedRef.current = false;
    })();
  }, [morning, open, showKitten, dayDone, byKey, day, familyId, inv]);

  // Wochenbonus sicher buchen; Datenbank prüft die Woche selbst nochmals.
  const claiming = useRef(false);
  useEffect(() => {
    if (!open || !weekDone || bonusBooked || claiming.current || day > todayZurich()) return;
    claiming.current = true;
    void (async () => {
      await supabase.from("task_completions").insert({ family_id: familyId, day, task_key: "wochenbonus" });
      await inv("completions", "balance", "history");
      claiming.current = false;
    })();
  }, [open, weekDone, bonusBooked, day, familyId, inv]);

  const toggleSound = () => {
    const n = !sound;
    setSound(n);
    localStorage.setItem(SOUND_KEY, n ? "1" : "0");
  };

  const leave = (iso?: string) => {
    setShowKitten(false);
    onOpenChange(false);
    if (iso) onNavigate(iso);
  };

  const title = morning ? "Morgen abschliessen" : isSunday ? "Woche abschliessen" : "Tag abschliessen";

  return (
    <>
    <Dialog open={open && !showKitten} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription>{formatCH(day)} · offene Aufgaben kannst du hier direkt abhaken.</DialogDescription>
        </DialogHeader>

        <Button variant="ghost" onClick={toggleSound} className="h-12 justify-start gap-2 rounded-xl">
          {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          {sound ? "Kätzchen spricht (Ton an)" : "Ton aus – antippen zum Einschalten"}
        </Button>

        {!showKitten && (
          <Button size="lg" className="h-14 rounded-2xl text-lg" onClick={() => setShowKitten(true)}>
            🐱 Kätzchen nochmals zeigen
          </Button>
        )}

        {isSunday && (
          <div className="grid grid-cols-7 gap-1">
            {weekDaysEnding(day).map((d) => {
              const ok = tasksFor(d).every((t) => doneSet.has(`${d}|${t.key}`));
              return (
                <div key={d} className={`rounded-xl p-2 text-center text-sm ${ok ? "bg-done-soft text-done" : "bg-muted text-muted-foreground"}`}>
                  <div className="font-semibold">{weekdayShort(d)}</div>
                  <div>{ok ? "✓" : "–"}</div>
                </div>
              );
            })}
          </div>
        )}
        {isSunday && !weekDone && week.data && (
          <p className="text-sm text-muted-foreground">Für den Wochenbonus ({WEEK_BONUS_STARS} ⭐) müssen Mo–So alle täglichen Aufgaben erledigt sein.</p>
        )}

        {!morning && <HomeworkCard familyId={familyId} day={day} />}
        <TaskList familyId={familyId} day={day} tasks={tasks} byKey={byKey} laundry={laundry} />
        {!dayDone && <p className="text-center text-muted-foreground">Noch nicht alles erledigt – du schaffst das! 💪</p>}
      </DialogContent>
    </Dialog>
        {open && showKitten && (
          <MorningVideoStage
            key={`${mode}-${dayDone}-${weekDone}`}
            schoolFree={isSchoolFree(day)}
            morning={morning}
            done={dayDone}
            sound={sound}
            onToggleSound={toggleSound}
            onReview={() => setShowKitten(false)}
            onLeave={() => leave(morning ? undefined : todayZurich())}
            onNext={() => leave(addDays(day, 1))}
            weekDone={weekDone}
            bonusBooked={bonusBooked}
            laundryOpen={laundry.some((l) => !l.done)}
          />
        )}
    </>
  );
}
