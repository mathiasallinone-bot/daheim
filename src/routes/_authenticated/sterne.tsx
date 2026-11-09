import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { friendlyError, useBalance, useInvalidate } from "@/lib/data";
import { useFamily } from "@/lib/family-context";
import { formatCH } from "@/lib/plan";
import { showKittenClip } from "@/components/StarKitten";
import { REDEEM_CLIP } from "@/lib/kitten-video";
import { TaskCalendarDialog } from "@/components/TaskCalendarDialog";

export const Route = createFileRoute("/_authenticated/sterne")({
  head: () => ({
    meta: [
      { title: "Sterne & Belohnungen – Daheim" },
      { name: "description", content: "Sianas Sternestand, Verlauf und von den Eltern festgelegte Belohnungen." },
      { property: "og:title", content: "Sterne & Belohnungen – Daheim" },
      { property: "og:description", content: "Sternestand, Verlauf und Belohnungen." },
    ],
  }),
  component: StarsPage,
});

const LABELS: Record<string, string> = {
  rucksack: "Rucksack bereitgemacht",
  "rucksack-auspacken": "Rucksack ausgepackt",
  "kleider-bereitlegen": "Kleider bereitgelegt",
  "zaehne-morgen": "Zähne geputzt (Morgen)",
  "zaehne-abend": "Zähne geputzt (Abend)",
  haarewaschen: "Haare gewaschen",
  "haare-morgen": "Haare gekämmt (Morgen)",
  "haare-abend": "Haare gekämmt (Abend)",
  "buch-lesen": "Buch gelesen",
  hausaufgaben: "Hausaufgaben erledigt",
  "hausaufgaben-einpacken": "Hausaufgaben eingepackt",
  "schwimmsachen-bereit": "Schwimmsachen bereitgemacht",
  "schwimmsachen-einpacken": "Schwimmsachen eingepackt",
  "kleider-zusammenlegen": "Kleider zusammengelegt",
  trockenfutter: "Trockenfutter aufgefüllt",
  abfall: "Abfall runtergebracht",
  katzenklo: "Katzentoiletten geputzt",
  wochenbonus: "🏆 Wochenbonus – ganze Woche geschafft",
  fruehaufsteher: "🌅 Frühaufsteher-Woche",
  "hausaufgaben-bonus": "📝 Hausaufgaben schon am Montag",
  abzug: "📋 Abzug – 5× Abschluss vergessen",
};

function StarsPage() {
  const fam = useFamily();
  const inv = useInvalidate();
  const balance = useBalance(fam.id);
  const rewards = useQuery({
    queryKey: ["rewards", fam.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("rewards").select("*").eq("family_id", fam.id).order("stars_required");
      if (error) throw error;
      return data;
    },
  });
  const history = useQuery({
    queryKey: ["history", fam.id],
    queryFn: async () => {
      const [c, r, f] = await Promise.all([
        supabase.from("task_completions").select("day,task_key,stars,created_at").eq("family_id", fam.id).order("day"),
        supabase.from("reward_redemptions").select("id,reward_name,stars,created_at").eq("family_id", fam.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("families").select("stars_reset_at").eq("id", fam.id).single(),
      ]);
      const resetAt = f.data?.stars_reset_at ?? "";
      if (c.error) throw c.error;
      if (r.error) throw r.error;
      const groups = new Map<string, { key: string; count: number; stars: number; days: Set<string> }>();
      for (const x of c.data) {
        if (["tagesabschluss", "morgenabschluss", "abendabschluss"].includes(x.task_key)) continue;
        if (x.created_at < resetAt) x.stars = 0;
        const g = groups.get(x.task_key) ?? { key: x.task_key, count: 0, stars: 0, days: new Set<string>() };
        g.count++; g.stars += x.stars; g.days.add(x.day);
        groups.set(x.task_key, g);
      }
      return {
        since: c.data[0]?.day ?? "9999-12-31",
        tasks: [...groups.values()].sort((a, b) => b.stars - a.stars || b.count - a.count),
        redemptions: r.data.filter((x) => x.created_at >= resetAt),
      };
    },
  });
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openGroup = history.data?.tasks.find((t) => t.key === openKey);

  const [name, setName] = useState("");
  const [stars, setStars] = useState("20");
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rewards").insert({ family_id: fam.id, name: name.trim(), stars_required: Number(stars) });
      if (error) throw error;
    },
    onSuccess: () => { inv("rewards"); setName(""); toast.success("Belohnung gespeichert"); },
    onError: (e) => toast.error("Nicht gespeichert", { description: friendlyError(e) }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rewards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv("rewards"),
    onError: (e) => toast.error(friendlyError(e)),
  });
  const redeem = useMutation({
    mutationFn: async (r: { name: string; stars_required: number }) => {
      const { error } = await supabase.from("reward_redemptions").insert({ family_id: fam.id, reward_name: r.name, stars: r.stars_required });
      if (error) throw error;
    },
    onSuccess: (_d, r) => { inv("balance", "history"); toast.success(`«${r.name}» eingelöst 🎉`); showKittenClip(REDEEM_CLIP); },
    onError: (e) => toast.error("Nicht eingelöst", { description: friendlyError(e) }),
  });

  const bal = balance.data ?? 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-star-soft p-6 text-center shadow-card">
        <p className="text-muted-foreground">Sianas Sterne</p>
        <p className="font-display text-6xl font-semibold">⭐ {balance.isPending ? "…" : balance.isError ? "–" : bal}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Belohnungen</h2>
        {rewards.isPending ? <LoadingState /> : rewards.isError ? <ErrorState error={rewards.error} onRetry={() => rewards.refetch()} /> : rewards.data.length === 0 ? (
          <EmptyState>Noch keine Belohnungen. Eltern können unten welche festlegen.</EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rewards.data.map((r) => {
              const enough = bal >= r.stars_required;
              return (
                <article key={r.id} className="space-y-3 rounded-3xl bg-card p-5 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xl font-semibold">{r.name}</h3>
                      <p className="text-muted-foreground">{r.stars_required} ⭐ benötigt</p>
                    </div>
                    <ConfirmDelete what={r.name} label="Belohnung löschen" disabled={del.isPending} onConfirm={() => del.mutate(r.id)} />
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="lg" variant={enough ? "default" : "outline"} disabled={!enough || redeem.isPending} className="h-13 w-full rounded-2xl">
                        {enough ? "Einlösen (Eltern)" : `Noch ${r.stars_required - bal} ⭐`}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>«{r.name}» einlösen?</AlertDialogTitle>
                        <AlertDialogDescription>Es werden {r.stars_required} Sterne abgezogen.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="h-12">Abbrechen</AlertDialogCancel>
                        <AlertDialogAction className="h-12" onClick={() => redeem.mutate(r)}>Einlösen</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </article>
              );
            })}
          </div>
        )}
        <div className="space-y-3 rounded-3xl bg-card p-5 shadow-card">
          <h3 className="text-lg font-semibold">Neue Belohnung (Eltern)</h3>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Input placeholder="Name der Belohnung" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="h-12 text-base" />
            <Input type="number" inputMode="numeric" min={1} value={stars} onChange={(e) => setStars(e.target.value)} className="h-12 text-base" aria-label="Benötigte Sterne" />
          </div>
          <Button size="lg" className="h-13 w-full rounded-2xl" disabled={!name.trim() || !(Number(stars) > 0) || add.isPending} onClick={() => add.mutate()}>
            Belohnung speichern
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Verlauf</h2>
        {history.isPending ? <LoadingState /> : history.isError ? <ErrorState error={history.error} onRetry={() => history.refetch()} /> : history.data.tasks.length === 0 && history.data.redemptions.length === 0 ? (
          <EmptyState>Noch keine Sterne gesammelt.</EmptyState>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Zeile antippen, um im Kalender zu sehen, wann die Aufgabe erledigt war.</p>
            <ul className="divide-y rounded-3xl bg-card shadow-card">
              {history.data.tasks.map((t) => (
                <li key={t.key}>
                  <button type="button" onClick={() => setOpenKey(t.key)} className="flex min-h-16 w-full items-center justify-between gap-3 px-5 py-3 text-left active:bg-muted">
                    <span>
                      <span className="block font-semibold">{LABELS[t.key] ?? t.key}</span>
                      <span className="block text-sm text-muted-foreground">{t.count}× erledigt</span>
                    </span>
                    <span className={`font-bold ${t.stars < 0 ? "text-holiday" : "text-done"}`}>{t.stars > 0 ? `+${t.stars} ⭐` : t.stars < 0 ? `−${-t.stars} ⭐` : "0 ⭐"}</span>
                  </button>
                </li>
              ))}
              {history.data.redemptions.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span>Eingelöst: {x.reward_name} · {formatCH(x.created_at.slice(0, 10))}</span>
                  <span className="font-bold text-holiday">-{x.stars} ⭐</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {openGroup && history.data && (
          <TaskCalendarDialog open onOpenChange={(o) => !o && setOpenKey(null)} title={LABELS[openGroup.key] ?? openGroup.key}
            taskKey={openGroup.key} doneDays={openGroup.days} since={history.data.since} />
        )}
      </section>

      <section className="space-y-2 rounded-3xl bg-muted p-5">
        <h2 className="text-lg font-semibold">Familie «{fam.name}» · weitere Geräte</h2>
        <p className="text-sm text-muted-foreground">Ein zweiter Elternteil registriert sich selbst und tritt mit diesem Einladungscode bei:</p>
        <p className="font-mono text-2xl tracking-widest">{fam.invite_code}</p>
      </section>
    </div>
  );
}
