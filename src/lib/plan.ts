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
/** Katzenklo putzen: jedes 5. Mal 1 Stern; in der Spezialwoche jedes Mal 6 Sterne. Muss zum DB-Trigger passen. */
export const LITTER_EVERY = 5;
export const LITTER_SPECIAL = { from: "2026-11-09", to: "2026-11-15", stars: 6 } as const;
export const isLitterSpecial = (iso: string) => iso >= LITTER_SPECIAL.from && iso <= LITTER_SPECIAL.to;
/** Vergessene Morgen- bzw. Tagesabschlüsse bis zum Abzug von 1 Stern. */
export const CLOSURE_LIMIT = 5;
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
/** Frühaufsteher-Frist (Stunde, Zürich): Mo–Fr 8 Uhr, Sa/So und Weihnachtsferien 10 Uhr. Muss zu public.morning_deadline passen. */
export const morningDeadlineHour = (iso: string) => (weekday(iso) >= 6 || (iso >= XMAS_FROM && iso <= XMAS_TO) ? 10 : 8);
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

/* ---------- Stundenplan Klasse 2a Melchenbühl, Schuljahr 2026/27 ---------- */

export type Lesson = { from: string; to: string; subject: string };

const MORNING: Record<number, Lesson[]> = {
  1: [{ from: "08:20", to: "11:55", subject: "GU" }],
  2: [
    { from: "08:20", to: "09:05", subject: "GU" },
    { from: "09:10", to: "09:55", subject: "Sport" },
    { from: "10:20", to: "11:55", subject: "GU" },
  ],
  3: [{ from: "08:20", to: "11:55", subject: "GU" }],
  4: [
    { from: "08:20", to: "09:05", subject: "Sport/Schwimmen" },
    { from: "09:10", to: "09:55", subject: "GU" },
    { from: "10:20", to: "11:55", subject: "Gestalten" },
  ],
  5: [{ from: "08:20", to: "11:55", subject: "GU" }],
};
const AFTERNOON: Record<number, Lesson[]> = {
  1: [
    { from: "13:45", to: "14:30", subject: "Sport" },
    { from: "14:35", to: "15:20", subject: "GU" },
  ],
  2: [{ from: "13:45", to: "15:20", subject: "GU" }],
  // Donnerstag: MGS nur in den Wochen ohne Schwimmen (siehe schoolLessons)
  4: [{ from: "13:45", to: "15:20", subject: "MGS" }],
};

/** Unterricht an einem Tag (leer an Wochenenden und in den Ferien). */
export function schoolLessons(iso: string): Lesson[] {
  const st = dayStatus(iso);
  if (st.kind === "wochenende" || st.kind === "ferien") return [];
  const wd = weekday(iso);
  const am = MORNING[wd] ?? [];
  if (st.kind === "halbtag") return am;
  const pm = wd === 4 && isSwimDay(iso) ? [] : (AFTERNOON[wd] ?? []);
  return [...am, ...pm];
}

/** Ende des Unterrichts ("HH:MM") oder null, wenn schulfrei. */
export function schoolEnd(iso: string): string | null {
  const l = schoolLessons(iso);
  return l.length ? l[l.length - 1]!.to : null;
}

/** Schulfreier Nachmittag an einem Schultag (Mi, Fr, Do mit Schwimmen, Halbtag). */
export function hasFreeAfternoon(iso: string): boolean {
  const end = schoolEnd(iso);
  return end !== null && end <= "12:00";
}

/* ---------- Wasser-Erinnerung ---------- */

export type WaterSlot = { hour: number; kind: "flasche" | "trinken" };

/** Erinnerungszeiten (volle Stunden, Zürich): schulfrei 9/12/15/18 Uhr, freier Nachmittag 12/15/18 Uhr.
 *  Die erste Erinnerung fragt nach der Wasserflasche, die weiteren ob getrunken wurde. Muss zu public.water_slots passen. */
export function waterSlots(iso: string): WaterSlot[] {
  const hours = schoolEnd(iso) === null ? [9, 12, 15, 18] : hasFreeAfternoon(iso) ? [12, 15, 18] : [];
  return hours.map((hour, i) => ({ hour, kind: i === 0 ? "flasche" : "trinken" }));
}

export const WATER_TEXT: Record<WaterSlot["kind"], { title: string; question: string; yes: string }> = {
  flasche: { title: "Wasserflasche bereit?", question: "Hallo Siana! Ist deine Wasserflasche gefüllt und bereit?", yes: "💧 Ja, sie ist bereit!" },
  trinken: { title: "Zeit zum Trinken!", question: "Hey Siana, hast du schon Wasser getrunken?", yes: "💧 Ja, ich habe getrunken!" },
};
