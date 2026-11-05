import { toast } from "sonner";
import { TaskRow } from "@/components/DayParts";
import { useConfirmUndo } from "@/components/ConfirmUndo";
import { useCompletions, useToggleTask } from "@/lib/data";
import {
  homeworkBlocksClose, homeworkReminder, homeworkStep, homeworkUrgent, homeworkVisible, mondayOf, todayZurich, type HomeworkStep,
} from "@/lib/plan";

const zurichHour = () =>
  Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Zurich" }).format(new Date()));

/** Hausaufgaben-Stand der Schulwoche (gespeichert auf dem Montag). */
export function useHomework(familyId: string, day: string) {
  const monday = mondayOf(day);
  const comps = useCompletions(familyId, monday, monday);
  const find = (k: string) => comps.data?.find((c) => c.task_key === k);
  const step: HomeworkStep = homeworkStep(!!find("hausaufgaben"), !!find("hausaufgaben-einpacken"));
  const visible = homeworkVisible(day, "abend", day === todayZurich() ? zurichHour() : undefined);
  return {
    monday, comps, step, visible, find,
    /** Donnerstag: offen = Tagesabschluss gesperrt (beim Laden vorsichtshalber gesperrt). */
    blocksClose: visible && (comps.isPending ? homeworkBlocksClose(day, "erledigen") : homeworkBlocksClose(day, step)),
    reminder: visible && !comps.isPending && homeworkReminder(day, step),
  };
}

/** Wöchentliche Hausaufgaben (Mo-Nachmittag bis Fr): Klick 1 = erledigt → «einpacken», Klick 2 = fertig. */
export function HomeworkCard({ familyId, day }: { familyId: string; day: string }) {
  const hw = useHomework(familyId, day);
  const toggle = useToggleTask(familyId);
  const [ask, confirmDialog] = useConfirmUndo();
  if (!hw.visible || hw.comps.isPending || hw.comps.isError) return null;
  const { step, monday } = hw;
  const urgent = homeworkUrgent(day, step);
  const thisWeek = monday === mondayOf(todayZurich());
  const undo = (key: "hausaufgaben" | "hausaufgaben-einpacken", what: string) => {
    if (!thisWeek) { toast.info("Nur in der laufenden Woche zurücknehmbar."); return; }
    ask(what, 0, () => toggle.mutate({ day: monday, key, done: true, id: hw.find(key)?.id }));
  };

  return (
    <div className="space-y-2">
      {hw.reminder && (
        <p role="status" className="rounded-2xl border-2 border-accent bg-accent/30 p-3 text-base font-semibold">
          📚 Denk an deine Hausaufgaben – sie müssen bis Freitag fertig sein!
        </p>
      )}
      {hw.blocksClose && (
        <p role="alert" className="rounded-2xl border-2 border-destructive bg-card p-3 text-base font-semibold text-destructive">
          📚 Heute müssen die Hausaufgaben fertig werden (erledigt und eingepackt) – sonst kann der Tag nicht abgeschlossen werden.
        </p>
      )}
      <div className={urgent ? "rounded-2xl ring-4 ring-accent ring-offset-2 ring-offset-background" : ""}>
        <TaskRow
          title={step === "erledigen" ? "Hausaufgaben erledigen" : "Hausaufgaben einpacken"}
          emoji={step === "erledigen" ? "✏️" : "🎒"}
          stars={0}
          done={step === "fertig"}
          pending={toggle.isPending}
          hint={
            urgent
              ? step === "erledigen" ? "⚠️ Bis Freitag fällig – bitte heute machen!" : "⚠️ Noch nicht eingepackt!"
              : step === "erledigen" ? "Bis Freitag – antippen, wenn gemacht" : "Gemacht ✓ – jetzt in den Rucksack"
          }
          onToggle={() =>
            step === "fertig"
              ? undo("hausaufgaben-einpacken", "Hausaufgaben einpacken")
              : toggle.mutate(
                  { day: monday, key: step === "erledigen" ? "hausaufgaben" : "hausaufgaben-einpacken", done: false },
                  { onSuccess: (r) => r === "done" && toast.success(step === "erledigen" ? "Super! Jetzt noch einpacken 🎒" : "Hausaufgaben eingepackt ✓") },
                )
          }
        />
      </div>
      {step === "einpacken" && (
        <button type="button" className="min-h-11 px-2 text-sm font-semibold text-muted-foreground underline"
          onClick={() => undo("hausaufgaben", "Hausaufgaben erledigen")}>
          Doch noch nicht gemacht? Zurücknehmen
        </button>
      )}
      {confirmDialog}
    </div>
  );
}
