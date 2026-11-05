import { createFileRoute } from "@tanstack/react-router";
import { RecurringCard } from "@/components/RecurringCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { useRecurring } from "@/lib/data";
import { useFamily } from "@/lib/family-context";
import { todayZurich } from "@/lib/plan";

export const Route = createFileRoute("/_authenticated/arbeiten")({
  head: () => ({
    meta: [
      { title: "Regelmässige Arbeiten – Daheim" },
      { name: "description", content: "Wiederkehrende Haushaltsarbeiten mit letzter Erledigung und nächster Fälligkeit." },
      { property: "og:title", content: "Regelmässige Arbeiten – Daheim" },
      { property: "og:description", content: "Wiederkehrende Haushaltsarbeiten mit Fälligkeiten." },
    ],
  }),
  component: WorkPage,
});

function WorkPage() {
  const fam = useFamily();
  const q = useRecurring(fam.id);
  const today = todayZurich();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Regelmässige Arbeiten</h1>
      <p className="text-muted-foreground">Erscheinen ab Fälligkeit auf «Heute» und bleiben dort, bis sie erledigt sind.</p>
      {q.isPending ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState>Keine regelmässigen Arbeiten vorhanden.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data.map((r) => <RecurringCard key={r.id} task={r} today={today} />)}
        </div>
      )}
    </div>
  );
}
