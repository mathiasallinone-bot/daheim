// Pure planning logic (dates as ISO "YYYY-MM-DD", Europe/Zurich calendar days).

export const ROTATION_START = "2026-10-29";
export const XMAS_HALF_DAY = "2026-12-24";
export const XMAS_FROM = "2026-12-25";
export const XMAS_TO = "2027-01-10";
export const SCHOOL_RESTART = "2027-01-11";

export function todayZurich(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function toUTC(iso: string): Date {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number): string {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
}
export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86400000);
}
/** 1 = Montag … 7 = Sonntag */
export function weekday(iso: string): number {
  const w = toUTC(iso).getUTCDay();
  return w === 0 ? 7 : w;
}
export function mondayOf(iso: string): string {
  return addDays(iso, 1 - weekday(iso));
}
export function isValidISO(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUTC(toUTC(s)) === s;
}

export function formatCH(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
const WD = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const WD_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
export const weekdayName = (iso: string) => WD[weekday(iso) - 1];
export const weekdayShort = (iso: string) => WD_SHORT[weekday(iso) - 1];

export type DayStatus =
  | { kind: "schule" }
  | { kind: "halbtag"; label: string }
  | { kind: "ferien"; label: string }
  | { kind: "wochenende" };

export function dayStatus(iso: string): DayStatus {
  if (iso === XMAS_HALF_DAY) return { kind: "halbtag", label: "Weihnachtsferien ab Mittag" };
  if (iso >= XMAS_FROM && iso <= XMAS_TO) return { kind: "ferien", label: "Weihnachtsferien" };
  if (weekday(iso) >= 6) return { kind: "wochenende" };
  return { kind: "schule" };
}
export const isSchoolFree = (iso: string) => {
  const k = dayStatus(iso).kind;
  return k === "ferien" || k === "wochenende";
};

export type ThursdayActivity = "schwimmen" | "turnen";

/** Donnerstagsrotation ab 29.10.2026: Schwimmen, Turnen, Schwimmen … (Gruppe A). */
export function thursdayActivity(iso: string): ThursdayActivity | null {
  if (weekday(iso) !== 4 || iso < ROTATION_START) return null;
  if (dayStatus(iso).kind !== "schule") return null;
  const weeks = diffDays(iso, ROTATION_START) / 7;
  return weeks % 2 === 0 ? "schwimmen" : "turnen";
}
export const isSwimDay = (iso: string) => thursdayActivity(iso) === "schwimmen";

export type TaskKey =
  | "rucksack"
  | "rucksack-auspacken"
  | "kleider-bereitlegen"
  | "zaehne-morgen"
  | "zaehne-abend"
  | "haare-morgen"
  | "haare-abend"
  | "haarewaschen"
  | "schwimmsachen-bereit"
  | "schwimmsachen-einpacken";

export type DayPart = "morgen" | "abend";
export type TaskDef = { key: TaskKey; title: string; emoji: string; part: DayPart };

/** Tägliche Routinen geben keine Einzelsterne. */
export const TASK_STARS = 0;
/** Haarewaschen: nur Sterne, wenn Siana es selber gemacht hat. */
export const HAIR_SELF_STARS = 1;
export const WEEK_BONUS_STARS = 1;
/** Wäsche zusammenlegen: jedes 10. Mal 1 Stern. */
export const LAUNDRY_EVERY = 10;
/** Buch lesen: jedes 5. Mal 1 Stern. */
export const READING_EVERY = 5;
export const TRASH_STARS = 1;
export const FOOD_STARS = 0;
/** Sterne für das n-te Erledigen (1-basiert) einer Meilenstein-Aufgabe. Muss zum DB-Trigger passen. */
export const milestoneStars = (n: number, every: number) => (n > 0 && n % every === 0 ? 1 : 0);
/** Wäsche-Aufgabe: vor 12 Uhr beim Morgen, sonst Nachmittag & Abend. */
export const laundryPart = (zurichHour: number): DayPart => (zurichHour < 12 ? "morgen" : "abend");
/** Haare kämmen zählt ab diesem Tag (keine rückwirkende Lücke für den Wochenbonus). */
export const HAIR_COMB_START = "2026-10-29";

export function tasksFor(iso: string): TaskDef[] {
  const wd = weekday(iso);
  const comb = iso >= HAIR_COMB_START;
  const out: TaskDef[] = [];
  const m = (key: TaskKey, title: string, emoji: string) => out.push({ key, title, emoji, part: "morgen" });
  const a = (key: TaskKey, title: string, emoji: string) => out.push({ key, title, emoji, part: "abend" });
  // Morgen
  m("zaehne-morgen", "Zähneputzen am Morgen", "🪥");
  if (comb) m("haare-morgen", "Haare kämmen am Morgen", "💇");
  if (isSwimDay(iso)) m("schwimmsachen-bereit", "Schwimmsachen bereitmachen", "🩱");
  // Nachmittag & Abend
  if (wd <= 5) a("rucksack-auspacken", "Rucksack auspacken", "📚");
  if (wd === 7 || wd <= 4) {
    a("rucksack", "Rucksack für nächsten Tag bereitmachen", "🎒");
    a("kleider-bereitlegen", "Kleider bereitlegen", "👕");
  }
  if (isSwimDay(addDays(iso, 1))) a("schwimmsachen-einpacken", "Schwimmsachen einpacken (morgen Schwimmen)", "🏊");
  if (wd === 7 || isSwimDay(iso)) a("haarewaschen", "Haare waschen", "🧴");
  a("zaehne-abend", "Zähneputzen am Abend", "🌙");
  if (comb) a("haare-abend", "Haare kämmen am Abend", "💇");
  return out;
}
export const morningTasks = (iso: string) => tasksFor(iso).filter((t) => t.part === "morgen");
export const eveningTasks = (iso: string) => tasksFor(iso).filter((t) => t.part === "abend");

/** Hausaufgaben: kommen am Montag, bis Freitag; gespeichert auf dem Montag der Woche. */
export type HomeworkStep = "erledigen" | "einpacken" | "fertig";
export function homeworkStep(doneHomework: boolean, packed: boolean): HomeworkStep {
  return packed ? "fertig" : doneHomework ? "einpacken" : "erledigen";
}
/** Sichtbar Mo (erst Nachmittag/Abend) bis Fr; in Ferien nicht. `zurichHour` nur für den heutigen Tag angeben. */
export function homeworkVisible(iso: string, part: DayPart = "abend", zurichHour?: number): boolean {
  if (weekday(iso) > 5 || dayStatus(iso).kind === "ferien") return false;
  if (weekday(iso) === 1 && (part === "morgen" || (zurichHour !== undefined && zurichHour < 12))) return false;
  return true;
}
/** Mittwochabend: Erinnerung, solange nicht erledigt UND eingepackt (blockiert nichts). */
export const homeworkReminder = (iso: string, step: HomeworkStep) =>
  step !== "fertig" && weekday(iso) === 3 && dayStatus(addDays(iso, 2)).kind === "schule";
/** Donnerstagabend: Tagesabschluss gesperrt, solange nicht fertig und Freitag Schultag ist. Muss zu homework_missing_for_close passen. */
export const homeworkBlocksClose = (iso: string, step: HomeworkStep) =>
  step !== "fertig" && weekday(iso) === 4 && dayStatus(addDays(iso, 1)).kind === "schule";
/** Ab Donnerstag hervorheben, solange nicht fertig. */
export const homeworkUrgent = (iso: string, step: HomeworkStep) => step !== "fertig" && weekday(iso) >= 4 && weekday(iso) <= 5;

/** Montag bis Sonntag der Woche, die mit `sunday` endet. */
export function weekDaysEnding(sunday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i - 6));
}

/** Wochenbonus: alle Routinen Mo–So erledigt. `done` enthält "YYYY-MM-DD|key". */
export function isWeekComplete(sunday: string, done: Set<string>): boolean {
  if (weekday(sunday) !== 7) return false;
  return weekDaysEnding(sunday).every((d) => tasksFor(d).every((t) => done.has(`${d}|${t.key}`)));
}

export function isRecurringDue(nextDue: string, today: string): boolean {
  return nextDue <= today;
}
