import { describe, expect, it } from "vitest";
import { weekTileLabel } from "./week-label";

describe("weekTileLabel", () => {
  it("nennt Wochentag, Datum TT.MM.JJJJ und Fortschritt", () => {
    const l = weekTileLabel({ iso: "2026-11-05", today: "2026-10-31", activity: "turnen", free: false, entries: 2, done: 3, total: 6 });
    expect(l).toContain("Donnerstag 05.11.2026");
    expect(l).toContain("3 von 6 erledigt");
  });
});
