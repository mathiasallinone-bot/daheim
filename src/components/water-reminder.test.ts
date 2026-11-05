import { vi } from "vitest";
import { describe, expect, it } from "vitest";
import { dueWaterSlot, zurichClock } from "./WaterReminder";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("Wasser-Wecker: welche Erinnerung ist fällig?", () => {
  const sat = "2026-11-07";
  it("Samstag vor 9 Uhr: noch nichts", () => {
    expect(dueWaterSlot(sat, 8, new Set())).toBeNull();
  });
  it("Samstag 9–10 Uhr: Flasche bereit?", () => {
    expect(dueWaterSlot(sat, 9, new Set())).toEqual({ hour: 9, kind: "flasche" });
    expect(dueWaterSlot(sat, 10, new Set())).toEqual({ hour: 9, kind: "flasche" });
  });
  it("nach 2 Stunden verfällt die Erinnerung", () => {
    expect(dueWaterSlot(sat, 11, new Set())).toBeNull();
  });
  it("beantwortet → nicht mehr fällig", () => {
    expect(dueWaterSlot(sat, 12, new Set([12]))).toBeNull();
    expect(dueWaterSlot(sat, 15, new Set([9, 12]))).toEqual({ hour: 15, kind: "trinken" });
  });
  it("Mittwoch: erste Erinnerung um 12 Uhr fragt nach der Flasche", () => {
    expect(dueWaterSlot("2026-11-11", 12, new Set())).toEqual({ hour: 12, kind: "flasche" });
    expect(dueWaterSlot("2026-11-11", 9, new Set())).toBeNull();
  });
  it("Montag (Schule bis 15:20): nie", () => {
    for (let h = 0; h < 24; h++) expect(dueWaterSlot("2026-11-09", h, new Set())).toBeNull();
  });
  it("Uhrzeit wird in Zürich gerechnet (Winter- und Sommerzeit)", () => {
    expect(zurichClock(new Date("2026-11-07T08:05:00Z"))).toEqual({ hour: 9, minute: 5 });
    expect(zurichClock(new Date("2027-06-05T07:05:00Z"))).toEqual({ hour: 9, minute: 5 });
  });
});
