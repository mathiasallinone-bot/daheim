import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { DateNav, DayBadges } from "@/components/DayParts";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { friendlyError, useCompletions, useInvalidate, useSchedule } from "@/lib/data";
import { useFamily } from "@/lib/family-context";
import {
  addDays, dayStatus, formatCH, isValidISO, mondayOf, schoolLessons, tasksFor, thursdayActivity, todayZurich, weekday, weekdayName, weekdayShort,
  type Lesson,
} from "@/lib/plan";
import { weekTileLabel } from "@/lib/week-label";

export const Route = createFileRoute("/_authenticated/woche")({
  validateSearch: (s: Record<string, unknown>): { d?: string } => (isValidISO(s["d"]) ? { d: s["d"] } : {}),
  head: () => ({
    meta: [
      { title: "Wochenplan – Daheim" },
      { name: "description", content: "Sianas Wochenstundenplan mit Terminen, MGS und Schulferien." },
      { property: "og:title", content: "Wochenplan – Daheim" },
      { property: "og:description", content: "Sianas Wochenstundenplan mit Terminen, MGS und Schulferien." },
    ],
  }),
  component: WeekPage,
});

type Entry = { id: string; weekday: number | null; on_date: string | null; start_time: string; end_time: string | null; title: string; kind: string };
type Item = { id: string; time: string; title: string; kind: string; auto?: boolean };

function itemsFor(iso: string, entries: Entry[]): Item[] {
  const st = dayStatus(iso);
  const items: Item[] = [];
  for (const e of entries) {
    const matchDate = e.on_date === iso;
    const matchWeekly = e.weekday === weekday(iso) && st.kind !== "ferien";
    if (!matchDate && !matchWeekly) continue;
    if (matchWeekly && st.kind === "halbtag" && e.start_time >= "12:00") continue;
    items.push({ id: e.id, time: `${e.start_time.slice(0, 5)}${e.end_time ? `–${e.end_time.slice(0, 5)}` : ""}`, title: e.title, kind: e.kind });
  }
  // Stundenplan (Schule) automatisch; Donnerstag hat eigene Einträge unten
  const wd = weekday(iso);
  if (wd !== 4) {
    const lessons = schoolLessons(iso);
    const am = lessons.filter((l) => l.from < "12:00");
    const pm = lessons.filter((l) => l.from >= "12:00");
    const sub = (ls: Lesson[]) => (ls.some((l) => l.subject !== "GU") ? ` (inkl. ${ls.filter((l) => l.subject !== "GU").map((l) => l.subject).join(", ")})` : "");
    if (am.length) items.push({ id: "auto-am", time: `${am[0]!.from}–${am[am.length - 1]!.to}`, title: `Schule${sub(am)}`, kind: "schule", auto: true });
    if (pm.length) items.push({ id: "auto-pm", time: `${pm[0]!.from}–${pm[pm.length - 1]!.to}`, title: `Schule${sub(pm)}`, kind: "schule", auto: true });
    else if (am.length) items.push({ id: "auto-frei", time: "ab 12:00", title: "Nachmittag frei", kind: "frei", auto: true });
  }
  const act = thursdayActivity(iso);
  if (act === "schwimmen") items.push({ id: "auto-swim", time: "Vormittag", title: "Schwimmen (Gruppe A) · Nachmittag frei", kind: "swim", auto: true });
  if (act === "turnen") {
    items.push({ id: "auto-turn", time: "Vormittag", title: "Turnen (Gruppe A)", kind: "lektion", auto: true });
    items.push({ id: "auto-mgs", time: "Nachmittag", title: "MGS", kind: "mgs", auto: true });
  }
  return items.sort((a, b) => a.time.localeCompare(b.time));
}

const KIND_CLS: Record<string, string> = {
  lektion: "bg-secondary text-secondary-foreground",
  mgs: "bg-done-soft text-done",
  termin: "bg-accent text-accent-foreground",
  swim: "bg-swim-soft text-swim",
  schule: "bg-muted text-muted-foreground",
  frei: "bg-done-soft text-done",
};
const KIND_LABEL: Record<string, string> = { lektion: "Lektion", mgs: "MGS", termin: "Termin", swim: "Schwimmen", schule: "Schule", frei: "Frei" };

function WeekPage() {
  const fam = useFamily();
  const today = todayZurich();
  const { d } = Route.useSearch();
  const day = d ?? today;
  const mon = mondayOf(day);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const navigate = useNavigate({ from: "/woche" });
  const go = (iso: string) => navigate({ search: iso === today ? {} : { d: iso } });

  const sched = useSchedule(fam.id);
  const comps = useCompletions(fam.id, mon, addDays(mon, 6));
  const entries = (sched.data ?? []) as Entry[];

  return (
    <div className="space-y-5">
      <DateNav
        label={`${formatCH(mon)} – ${formatCH(addDays(mon, 6))}`}
        sub="Diese Woche"
        isToday={mon === mondayOf(today)}
        onPrev={() => go(addDays(mon, -7))}
        onNext={() => go(addDays(mon, 7))}
        onToday={() => go(today)}
        prevLabel="Vorherige Woche"
        nextLabel="Nächste Woche"
      />

      {sched.isPending ? (
        <LoadingState />
      ) : sched.isError ? (
        <ErrorState error={sched.error} onRetry={() => sched.refetch()} />
      ) : (
        <>
          <div
            role="group"
            aria-label="Tag der Woche wählen (Pfeiltasten links/rechts)"
            className="grid grid-cols-7 gap-1 sm:gap-2"
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              go(addDays(day, e.key === "ArrowLeft" ? -1 : 1));
            }}
          >
            {days.map((iso) => {
              const st = dayStatus(iso);
              const n = itemsFor(iso, entries).filter((it) => it.kind !== "schule" && it.kind !== "frei").length;
              const tasks = tasksFor(iso);
              const done = tasks.filter((t) => comps.data?.some((c) => c.day === iso && c.task_key === t.key)).length;
              const sel = iso === day;
              const act = thursdayActivity(iso);
              const free = st.kind === "ferien" || st.kind === "halbtag";
              const icon = act === "schwimmen" ? "🏊" : act === "turnen" ? "🤸" : free ? "🎄" : null;
              const allDone = tasks.length > 0 && done === tasks.length;
              const label = weekTileLabel({ iso, today, activity: act, free, entries: n, done, total: tasks.length });
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => go(iso)}
                  aria-pressed={sel}
                  aria-label={label}
                  className={`flex min-h-16 min-w-0 flex-col items-center gap-0.5 rounded-2xl border-2 px-0.5 py-1.5 sm:min-h-24 sm:gap-1 sm:p-2 ${
                    sel ? "border-primary bg-card shadow-card" : "border-transparent"
                  } ${free ? "bg-holiday-soft" : st.kind === "wochenende" ? "bg-muted" : "bg-card"}`}
                >
                  <span aria-hidden className="text-xs font-bold sm:text-sm">{weekdayShort(iso)}</span>
                  <span aria-hidden className={`text-sm sm:text-base ${iso === today ? "rounded-full bg-primary px-1.5 text-primary-foreground sm:px-2" : ""}`}>
                    {iso.slice(8)}<span className="hidden sm:inline">.{iso.slice(5, 7)}.</span>
                  </span>
                  <span aria-hidden className="flex h-5 items-center gap-0.5 text-sm leading-none">
                    {icon}
                    {!icon && n > 0 && <span className="size-2 rounded-full bg-primary sm:hidden" />}
                    {allDone && <span className="text-done sm:hidden">✓</span>}
                  </span>
                  {n > 0 && <span aria-hidden className="hidden text-xs text-muted-foreground sm:block">{n} Einträge</span>}
                  {tasks.length > 0 && <span aria-hidden className="hidden text-xs text-muted-foreground sm:block">✓ {done}/{tasks.length}</span>}
                </button>
              );
            })}
          </div>

          <section className="space-y-3 rounded-3xl bg-card p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-semibold">{weekdayName(day)}, {formatCH(day)}</h2>
              <Link to="/" search={day === today ? {} : { d: day }} className="rounded-xl bg-secondary px-4 py-3 font-semibold text-secondary-foreground">
                Aufgaben öffnen
              </Link>
            </div>
            <DayBadges iso={day} />
            <DayList iso={day} entries={entries} />
          </section>

          <AddEntry familyId={fam.id} day={day} />
        </>
      )}
    </div>
  );
}

function DayList({ iso, entries }: { iso: string; entries: Entry[] }) {
  const inv = useInvalidate();
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { inv("schedule"); toast.success("Eintrag gelöscht"); },
    onError: (e) => toast.error(friendlyError(e)),
  });
  const items = itemsFor(iso, entries);
  if (items.length === 0)
    return <EmptyState>{dayStatus(iso).kind === "ferien" ? "Ferien – keine Schule." : "Keine Einträge für diesen Tag. Lektionen und Termine kannst du unten erfassen."}</EmptyState>;
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border p-3 sm:flex-nowrap">
          <span className="w-full shrink-0 text-sm font-semibold text-muted-foreground sm:w-28">{it.time}</span>
          <span className="min-w-0 flex-1 text-lg">{it.title}</span>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${KIND_CLS[it.kind]}`}>{KIND_LABEL[it.kind]}</span>
          {!it.auto && (
            <ConfirmDelete what={it.title} label="Eintrag löschen" disabled={del.isPending} onConfirm={() => del.mutate(it.id)} />
          )}
        </li>
      ))}
    </ul>
  );
}

function AddEntry({ familyId, day }: { familyId: string; day: string }) {
  const inv = useInvalidate();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("");
  const [kind, setKind] = useState<"lektion" | "mgs" | "termin">("lektion");
  const [repeat, setRepeat] = useState(true);
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("schedule_entries").insert({
        family_id: familyId,
        title: title.trim(),
        start_time: start,
        end_time: end || null,
        kind,
        weekday: repeat ? weekday(day) : null,
        on_date: repeat ? null : day,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      inv("schedule");
      setTitle("");
      toast.success("Eintrag gespeichert");
    },
    onError: (e) => toast.error("Nicht gespeichert", { description: friendlyError(e) }),
  });
  return (
    <section className="space-y-3 rounded-3xl border-2 border-dashed border-border bg-muted/40 p-5">
      <h2 className="text-xl font-semibold">🔒 Eintrag erfassen <span className="text-base font-normal text-muted-foreground">· für Eltern</span></h2>
      <label className="block text-sm">Titel
        <Input placeholder="z. B. Mathematik, Zahnarzt" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-12 text-base" maxLength={80} enterKeyHint="done" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">Von<Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 h-12 text-base" /></label>
        <label className="text-sm">Bis<Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 h-12 text-base" aria-invalid={!!end && end <= start} /></label>
      </div>
      {!!end && end <= start && <p role="alert" className="text-sm font-semibold text-destructive">«Bis» liegt vor «Von» – bitte prüfen.</p>}
      <div className="grid grid-cols-3 gap-2">
        {(["lektion", "mgs", "termin"] as const).map((k) => (
          <Button key={k} type="button" variant={kind === k ? "default" : "outline"} className="h-12 rounded-xl" onClick={() => setKind(k)}>
            {KIND_LABEL[k]}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={repeat ? "default" : "outline"} className="h-12 rounded-xl" onClick={() => setRepeat(true)}>
          Jeden {weekdayName(day)}
        </Button>
        <Button type="button" variant={!repeat ? "default" : "outline"} className="h-12 rounded-xl" onClick={() => setRepeat(false)}>
          Nur am {formatCH(day)}
        </Button>
      </div>
      <Button size="lg" className="h-14 w-full rounded-2xl text-lg" disabled={!title.trim() || m.isPending} onClick={() => m.mutate()}>
        {m.isPending ? "Wird gespeichert…" : "Speichern"}
      </Button>
    </section>
  );
}
