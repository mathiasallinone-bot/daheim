import { useEffect, useState } from "react";
import { GREETING_CLIP, shouldGreet, starClip } from "@/lib/kitten-video";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DateNav, DayBadges, dayTitle } from "@/components/DayParts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { RecurringCard } from "@/components/RecurringCard";
import { TaskList } from "@/components/TaskList";
import { HomeworkCard } from "@/components/HomeworkCard";
import { WaterCard } from "@/components/WaterReminder";
import { ClosureCounter, RewardHint } from "@/components/Rewards";
import { DayCloseDialog, primeSpeech } from "@/components/DayCloseDialog";
import { useConfirmUndo } from "@/components/ConfirmUndo";
import {
  friendlyError,
  useBalance,
  useCompletions,
  useInvalidate,
  useLaundry,
  useRecurring,
  starReason,
} from "@/lib/data";
import { showDanceKitten, showKittenClip, showStarKitten } from "@/components/StarKitten";
import { primeDanceMusic } from "@/components/DanceKitten";
import { useFamily } from "@/lib/family-context";
import { HAIR_SELF_STARS, LAUNDRY_EVERY, LITTER_EVERY, LITTER_SPECIAL, READING_EVERY, TRASH_STARS, CLOSURE_LIMIT, READING_BONUS, isLitterSpecial, isReadingBonusDay, WEEK_BONUS_STARS, addDays, formatCH, isRecurringDue, isValidISO, tasksFor, todayZurich, weekday } from "@/lib/plan";

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: (s: Record<string, unknown>): { d?: string } => (isValidISO(s["d"]) ? { d: s["d"] } : {}),
  head: () => ({
    meta: [
      { title: "Heute – Daheim Familienplaner" },
      { name: "description", content: "Tagesübersicht mit Aufgaben, Sternen und Schnellaktionen für die Familie." },
      { property: "og:title", content: "Heute – Daheim Familienplaner" },
      { property: "og:description", content: "Tagesübersicht mit Aufgaben, Sternen und Schnellaktionen." },
    ],
  }),
  component: TodayPage,
});

const GREET_KEY = "daheim-kitten-greeted";

function TodayPage() {
  const fam = useFamily();
  const today = todayZurich();
  const { d } = Route.useSearch();
  const day = d ?? today;
  const navigate = useNavigate({ from: "/" });
  const go = (iso: string) => navigate({ search: iso === today ? {} : { d: iso } });

  const comps = useCompletions(fam.id, day, day);
  const laundry = useLaundry(fam.id);
  const balance = useBalance(fam.id);
  const recurring = useRecurring(fam.id);
  const [closing, setClosing] = useState(false);
  const [closingMorning, setClosingMorning] = useState(false);
  const inv = useInvalidate();

  useEffect(() => {
    if (day !== today) return;
    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Zurich" }).format(new Date()));
    try {
      if (!shouldGreet(hour, localStorage.getItem(GREET_KEY), today)) return;
      localStorage.setItem(GREET_KEY, today);
    } catch { return; }
    showKittenClip(GREETING_CLIP);
  }, [day, today]);

  const laundryMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("laundry_requests").insert({ family_id: fam.id, day });
      if (error && error.code !== "23505") throw error;
      return !error;
    },
    onSuccess: (created) => {
      inv("laundry");
      if (created)
        toast.success("Aufgabe «Kleider zusammenlegen» erstellt", { description: `Für ${formatCH(day)} · ${new Date().getHours() < 12 ? "beim Morgen" : "am Nachmittag/Abend"}` });
      else toast.info("Für diesen Tag gibt es die Aufgabe bereits.");
    },
    onError: (e) => toast.error("Nicht gespeichert", { description: friendlyError(e) }),
  });

  const [askUndo, undoDialog] = useConfirmUndo();
  const undoMut = useMutation({
    mutationFn: async (v: { kind: "completion" | "laundry"; id: string }) => {
      const { error } = v.kind === "completion"
        ? await supabase.rpc("undo_completion", { _id: v.id })
        : await supabase.from("laundry_requests").delete().eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Wieder auf offen gesetzt"); return inv("completions", "balance", "history", "laundry"); },
    onError: (e) => toast.error("Nicht zurückgenommen", { description: friendlyError(e) }),
  });

  const extraMut = useMutation({
    mutationFn: async (key: string) => {
      const { data, error } = await supabase.from("task_completions").insert({ family_id: fam.id, day, task_key: key }).select("stars").single();
      if (error && error.code !== "23505") throw error;
      if (data && key === "buch-lesen" && data.stars >= READING_BONUS.stars && isReadingBonusDay(day, todayZurich()))
        showDanceKitten(data.stars, `🎉 Extra-Bonus fürs Lesen! Hier kommen ${data.stars} Sterne für dich, Siana!`);
      else if (data && data.stars > 0) showStarKitten(starReason(key, data.stars), starClip(key, data.stars));
      return { created: !error, stars: data?.stars ?? 0 };
    },
    onSuccess: ({ created, stars }) => {
      inv("completions", "balance", "history");
      if (!created) toast.info("Heute schon eingetragen – morgen wieder möglich.");
      else if (!stars) toast.success("Eingetragen – danke, Siana!");
    },
    onError: (e) => toast.error("Nicht gespeichert", { description: friendlyError(e) }),
  });

  const byKey = new Map((comps.data ?? []).map((c) => [c.task_key, c]));
  const isSunday = weekday(day) === 7;
  const tasks = tasksFor(day);
  const morning = tasks.filter((t) => t.part === "morgen");
  const evening = tasks.filter((t) => t.part === "abend");
  const closed = byKey.has("tagesabschluss");
  // Offen bis erledigt; erledigt bleibt sichtbar, bis der Tag abgeschlossen ist.
  const openLaundry = (laundry.data ?? []).filter((l) => l.day <= day && (!l.done || (l.doneOn === day && !closed)));
  const morningLaundry = openLaundry.filter((l) => l.part === "morgen");
  const eveningLaundry = openLaundry.filter((l) => l.part !== "morgen");
  const doneCount = tasks.filter((t) => byKey.has(t.key)).length + openLaundry.filter((l) => l.done).length;
  const total = tasks.length + openLaundry.length;
  const EXTRAS = [
    { key: "trockenfutter", label: "🐱 Trockenfutter aufgefüllt", info: "bei Bedarf, max. 1× pro Tag" },
    { key: "buch-lesen", label: "📖 Buch gelesen", info: isReadingBonusDay(day, today) ? "🎁 Heute mit Überraschung!" : `max. 1× pro Tag · jedes ${READING_EVERY}. Mal +1 ⭐ – manchmal mehr ✨` },
    {
      key: "katzenklo",
      label: "🧹 Katzentoiletten geputzt",
      info: isLitterSpecial(day) ? `Spezialwoche: jedes Mal +${LITTER_SPECIAL.stars} ⭐ · max. 1× pro Tag` : `max. 1× pro Tag · jedes ${LITTER_EVERY}. Mal +1 ⭐`,
    },
    { key: "abfall", label: "🗑️ Abfall runtergebracht", info: `max. 1× pro Tag · +${TRASH_STARS} ⭐` },
  ];
  const todayLaundry = (laundry.data ?? []).find((l) => l.day === day);
  const due = (recurring.data ?? []).filter((r) => isRecurringDue(r.next_due, day));

  return (
    <div className="space-y-5">
      <DateNav
        label={dayTitle(day)}
        sub="Heute"
        isToday={day === today}
        onPrev={() => go(addDays(day, -1))}
        onNext={() => go(addDays(day, 1))}
        onToday={() => go(today)}
        prevLabel="Vorheriger Tag"
        nextLabel="Nächster Tag"
      />
      <DayBadges iso={day} />
      {day === today && <RewardHint />}

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <section aria-live="polite" className="rounded-3xl bg-card p-4 shadow-card sm:p-5">
          <p className="text-sm text-muted-foreground">Sianas Fortschritt</p>
          <p className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
            {comps.isPending ? "…" : `${doneCount} von ${total}`}
          </p>
          <Progress value={total ? (doneCount / total) * 100 : 0} className="mt-3 h-3" />
        </section>
        <section aria-live="polite" className="rounded-3xl bg-star-soft p-4 shadow-card sm:p-5">
          <p className="text-sm text-muted-foreground">Sternestand</p>
          <p className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
            ⭐ {balance.isPending ? "…" : balance.isError ? "–" : balance.data}
          </p>
          <p className="mt-2 hidden text-sm text-muted-foreground sm:block">Gesamt für alle Tage</p>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Sianas Aufgaben</h2>
        {comps.isPending || laundry.isPending ? (
          <LoadingState />
        ) : comps.isError ? (
          <ErrorState error={comps.error} onRetry={() => comps.refetch()} />
        ) : total === 0 ? (
          <EmptyState>Heute keine Aufgaben – geniesst den Tag! 🌿</EmptyState>
        ) : (
          <>
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-muted-foreground [&[data-state=open]>svg]:rotate-180">
                ⓘ Wie gibt es Sterne? <ChevronDown className="size-4 transition-transform" aria-hidden />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="px-2 pb-1 text-sm text-muted-foreground">
                  Tägliche Aufgaben geben keine Einzelsterne: Ist Mo–So alles erledigt, gibt es am Sonntagabend {WEEK_BONUS_STARS} ⭐. Haarewaschen selber gemacht: +{HAIR_SELF_STARS} ⭐. Wer regelmässig und früh dran ist, findet ab und zu geheime Spezial-Sterne ✨. Wer {CLOSURE_LIMIT}× vergisst, den Morgen oder den Tag abzuschliessen, verliert 1 ⭐.
                </p>
              </CollapsibleContent>
            </Collapsible>
            {morning.length > 0 && (
              <div className="space-y-3 rounded-3xl bg-muted/50 p-4">
                <h3 className="text-xl font-semibold">🌅 Morgen</h3>
                <TaskList familyId={fam.id} day={day} tasks={morning} byKey={byKey} laundry={morningLaundry} />
                <Button size="lg" variant="secondary" className="h-14 w-full rounded-2xl text-lg" onClick={() => { primeSpeech(); setClosingMorning(true); }}>
                  ☀️ Morgen abschliessen
                </Button>
              </div>
            )}
            <div className="space-y-3 rounded-3xl bg-muted/50 p-4">
              <h3 className="text-xl font-semibold">🌙 Nachmittag & Abend</h3>
              <HomeworkCard familyId={fam.id} day={day} />
              <TaskList familyId={fam.id} day={day} tasks={evening} byKey={byKey} laundry={morning.length > 0 ? eveningLaundry : openLaundry} />
            </div>
          </>
        )}
        {day === today && <ClosureCounter familyId={fam.id} />}
        {total > 0 && !comps.isPending && (
          <Button size="lg" className="h-16 w-full rounded-2xl text-xl" onClick={() => { primeSpeech(); setClosing(true); }}>
            {isSunday ? "🏁 Woche abschliessen" : "✅ Tag abschliessen"}
          </Button>
        )}
      </section>
      <WaterCard day={day} />

      <DayCloseDialog mode="morgen" onNavigate={(iso) => void go(iso)} open={closingMorning} onOpenChange={setClosingMorning} familyId={fam.id} day={day} tasks={morning} byKey={byKey} laundry={morningLaundry} />
      <DayCloseDialog onNavigate={(iso) => void go(iso)} open={closing} onOpenChange={setClosing} familyId={fam.id} day={day} tasks={tasks} byKey={byKey} laundry={openLaundry} />

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Zusatzaufgaben</h2>
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            variant="secondary"
            className="h-auto min-h-20 flex-col gap-1 whitespace-normal rounded-2xl px-3 text-base sm:text-lg"
            disabled={laundryMut.isPending || undoMut.isPending}
            onClick={() => {
              if (!todayLaundry) return laundryMut.mutate();
              if (day !== today) return toast.info("Für diesen Tag gibt es die Aufgabe bereits.");
              if (todayLaundry.done) return toast.info("Zuerst «Kleider zusammenlegen» zurücknehmen.");
              askUndo("Wäsche hängt", 0, () => undoMut.mutate({ kind: "laundry", id: todayLaundry.id }));
            }}
          >
            <span>👚 Wäsche hängt</span>
            <span className="text-xs font-normal opacity-80 sm:text-sm">{todayLaundry ? `✓ Am ${formatCH(day)} eingetragen${day === today ? " · antippen zum Zurücknehmen" : ""}` : `erstellt «Kleider zusammenlegen» · jedes ${LAUNDRY_EVERY}. Mal +1 ⭐`}</span>
          </Button>
          {EXTRAS.map((x) => {
            const c = byKey.get(x.key);
            return (
              <Button key={x.key} size="lg" variant={c ? "outline" : "secondary"} aria-pressed={!!c}
                className="h-auto min-h-20 flex-col gap-1 whitespace-normal rounded-2xl px-3 text-base sm:text-lg"
                disabled={extraMut.isPending || undoMut.isPending || comps.isPending || (!!c && day !== today)}
                onClick={() => { if (!c && x.key === "buch-lesen" && isReadingBonusDay(day, today)) primeDanceMusic(); return c ? askUndo(x.label.slice(x.label.indexOf(" ") + 1), c.stars, () => undoMut.mutate({ kind: "completion", id: c.id })) : extraMut.mutate(x.key); }}>
                <span>{x.label}</span>
                <span className="text-xs font-normal opacity-80 sm:text-sm">{c ? `✓ Am ${formatCH(day)} erledigt${day === today ? " · antippen zum Zurücknehmen" : ""}` : x.info}</span>
              </Button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Fällige Arbeiten</h2>
        {recurring.isPending ? (
          <LoadingState />
        ) : recurring.isError ? (
          <ErrorState error={recurring.error} onRetry={() => recurring.refetch()} />
        ) : due.length === 0 ? (
          <EmptyState>Keine regelmässigen Arbeiten fällig.</EmptyState>
        ) : (
          due.map((r) => <RecurringCard key={r.id} task={r} today={today} />)
        )}
      </section>
      {undoDialog}
    </div>
  );
}
