import { Button } from "@/components/ui/button";
import { TaskRow } from "@/components/DayParts";
import { useToggleTask } from "@/lib/data";
import { toast } from "sonner";
import { useConfirmUndo } from "@/components/ConfirmUndo";
import { HAIR_SELF_STARS, TASK_STARS, formatCH, todayZurich, type TaskDef } from "@/lib/plan";

export type Completion = { id: string; task_key: string; stars: number; self_done: boolean };
export type LaundryItem = { id: string; day: string; done: boolean; part?: string; doneId?: string | null; doneOn?: string | null; doneStars?: number };

export function TaskList({
  familyId,
  day,
  tasks,
  byKey,
  laundry,
}: {
  familyId: string;
  day: string;
  tasks: TaskDef[];
  byKey: Map<string, Completion>;
  laundry: LaundryItem[];
}) {
  const toggle = useToggleTask(familyId);
  const busy = (k: string) => toggle.isPending && toggle.variables?.key === k;
  const [ask, confirmDialog] = useConfirmUndo();
  const today = todayZurich();

  return (
    <div className="space-y-3">
      {tasks.map((t) => {
        const c = byKey.get(t.key);
        if (t.key === "haarewaschen" && !c) {
          return (
            <div key={t.key} className="rounded-2xl border-2 border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>{t.emoji}</span>
                <span className="flex-1 text-lg font-semibold">{t.title}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="secondary" className="h-14 rounded-xl text-base" disabled={busy(t.key)}
                  onClick={() => toggle.mutate({ day, key: t.key, done: false })}>
                  Mit Hilfe
                </Button>
                <Button className="h-14 rounded-xl text-base" disabled={busy(t.key)}
                  onClick={() => toggle.mutate({ day, key: t.key, done: false, selfDone: true },
                    {})}>
                  Selber gemacht · +{HAIR_SELF_STARS} ⭐
                </Button>
              </div>
            </div>
          );
        }
        return (
          <TaskRow
            key={t.key}
            title={t.title}
            emoji={t.emoji}
            stars={c ? c.stars : TASK_STARS}
            done={!!c}
            hint={t.key === "haarewaschen" ? undefined : "Offen – zählt für den Wochenbonus"}
            pending={busy(t.key)}
            onToggle={() => {
              if (!c) return toggle.mutate({ day, key: t.key, done: false });
              if (day !== today) return toast.info("Zurücknehmen geht nur am heutigen Tag.");
              ask(t.title, c.stars, () => toggle.mutate({ day, key: t.key, done: true, id: c.id }));
            }}
          />
        );
      })}
      {laundry.map((l) => (
        <TaskRow
          key={l.id}
          title="Kleider zusammenlegen"
          emoji="🧺"
          stars={0}
          done={l.done}
          hint={l.day < day ? `Offen seit ${formatCH(l.day)} · jedes 10. Mal +1 ⭐` : "Jedes 10. Mal +1 ⭐"}
          pending={busy("kleider-zusammenlegen")}
          onToggle={() => {
            if (!l.done) return toggle.mutate({ day: l.day, key: "kleider-zusammenlegen", done: false });
            if (l.doneOn !== today || !l.doneId) return toast.info("Zurücknehmen geht nur am selben Tag.");
            const id = l.doneId;
            ask("Kleider zusammenlegen", l.doneStars ?? 0, () => toggle.mutate({ day: l.day, key: "kleider-zusammenlegen", done: true, id }));
          }}
        />
      ))}
      {confirmDialog}
    </div>
  );
}
