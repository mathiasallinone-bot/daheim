import { formatCH, weekdayName } from "./plan";

/** Screenreader-Beschriftung einer Wochenkachel. */
export function weekTileLabel(o: {
  iso: string; today: string; activity: "schwimmen" | "turnen" | null; free: boolean;
  entries: number; done: number; total: number;
}): string {
  return [
    `${weekdayName(o.iso)} ${formatCH(o.iso)}`,
    o.iso === o.today ? "heute" : null,
    o.activity === "schwimmen" ? "Schwimmen" : o.activity === "turnen" ? "Turnen" : null,
    o.free ? "Ferien" : null,
    o.entries ? `${o.entries} Einträge` : null,
    o.total ? `${o.done} von ${o.total} erledigt` : null,
  ].filter(Boolean).join(", ");
}
