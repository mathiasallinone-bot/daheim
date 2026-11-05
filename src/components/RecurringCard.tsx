import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError, useInvalidate } from "@/lib/data";
import { addDays, diffDays, formatCH } from "@/lib/plan";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Task = { id: string; title: string; interval_days: number; last_done: string; next_due: string };

export function RecurringCard({ task, today }: { task: Task; today: string }) {
  const inv = useInvalidate();
  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("complete_recurring", { _id: task.id });
      if (error) throw error;
      return data as Task;
    },
    onSuccess: (r) => {
      inv("recurring");
      toast.success("Als erledigt gespeichert", { description: `Nächste Fälligkeit: ${formatCH(r.next_due)}` });
    },
    onError: (e) => toast.error("Nicht gespeichert", { description: friendlyError(e) }),
  });
  const days = diffDays(task.next_due, today);
  const due = days <= 0;
  const doneToday = task.last_done === today;

  return (
    <article className={`rounded-3xl p-5 shadow-card ${due ? "bg-warn-soft" : "bg-card"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-xl font-semibold">{task.title}</h3>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${due ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
          {due ? (days === 0 ? "Heute fällig" : `Seit ${-days} Tag${days === -1 ? "" : "en"} fällig`) : `in ${days} Tag${days === 1 ? "" : "en"}`}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-base">
        <div>
          <dt className="text-sm text-muted-foreground">Zuletzt erledigt</dt>
          <dd className="font-semibold">{formatCH(task.last_done)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Nächste Fälligkeit</dt>
          <dd className="font-semibold">{formatCH(task.next_due)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-sm text-muted-foreground">Alle {task.interval_days} Tage</p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="lg" className="mt-4 h-14 w-full rounded-2xl text-lg" disabled={m.isPending || doneToday}>
            {m.isPending ? "Wird gespeichert…" : doneToday ? "✓ Heute erledigt" : "✓ Erledigt"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>«{task.title}» erledigt?</AlertDialogTitle>
            <AlertDialogDescription>Neue nächste Fälligkeit: {formatCH(addDays(today, task.interval_days))}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12">Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="h-12" onClick={() => m.mutate()}>Ja, erledigt</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
