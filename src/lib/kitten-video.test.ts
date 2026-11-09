import { describe, expect, it } from "vitest";
import { closureClips, closureSituation, pickClip, GREETING_CLIP, kittenVideo, REDEEM_CLIP, shouldGreet, shouldShowRoutineClip, STAR_CLIP, taskClip } from "./kitten-video";

describe("Kätzchen-Abschluss", () => {
  it("Morgen erledigt an Schultag: Guten Morgen", () => {
    expect(kittenVideo(true, true).mp4).toContain("guten-morgen");
  });
  it("Morgen erledigt an schulfreiem Tag: Freier Tag", () => {
    expect(kittenVideo(true, true, { schoolFree: true }).mp4).toContain("freier-tag");
  });
  it("Morgen offen: Etwas vergessen", () => {
    expect(kittenVideo(true, false).mp4).toContain("etwas-vergessen");
  });
  it("Abend erledigt: Gute Nacht", () => {
    expect(kittenVideo(false, true).mp4).toContain("gute-nacht");
  });
  it("Sonntag mit ganzer Woche: Erfolgreiche Woche", () => {
    expect(kittenVideo(false, true, { weekDone: true }).mp4).toContain("erfolgreiche-woche");
  });
  it("Abend offen: Aufgaben erledigen", () => {
    expect(kittenVideo(false, false).mp4).toContain("aufgaben-erledigen");
  });
  it("Stern-Übergabe: Goldener Stern", () => {
    expect(STAR_CLIP.mp4).toContain("goldener-stern");
  });
});

describe("Zusatz-Clips", () => {
  it.each([
    ["zaehne-morgen", "zaehneputzen"], ["zaehne-abend", "zaehneputzen"],
    ["haare-morgen", "haare-kaemmen"],
    ["hausaufgaben", "aufgaben-selbststaendig"], ["rucksack-auspacken", "kleine-pause"],
    ["rucksack", "alles-kontrollieren"],
  ])("%s zeigt %s", (key, clip) => { expect(taskClip(key, true)?.mp4).toContain(clip); });
  it("kein Clip für andere Tage", () => { expect(taskClip("zaehne-morgen", false)).toBeNull(); });
  it("kein Clip für andere Aufgaben", () => { expect(taskClip("abfall", true)).toBeNull(); });
  it("kein Haare-kämmen-Clip am Abend", () => { expect(taskClip("haare-abend", true)).toBeNull(); });
  it("Einlösen: Stolz sein", () => { expect(REDEEM_CLIP.mp4).toContain("stolz-sein"); });
  it("Begrüssung: Guten-Morgen-Clip", () => { expect(GREETING_CLIP.mp4).toContain("tip-01-guten-morgen"); });
  it("Begrüssung bis 10:59, einmal pro Tag", () => {
    expect(shouldGreet(10, null, "2026-11-02")).toBe(true);
    expect(shouldGreet(11, null, "2026-11-02")).toBe(false);
    expect(shouldGreet(8, "2026-11-02", "2026-11-02")).toBe(false);
    expect(shouldGreet(8, "2026-11-01", "2026-11-02")).toBe(true);
  });
});

describe("Routine-Zusatzclips", () => {
  const today = "2026-11-01";
  it("Zufall unter 1/3 und noch nicht gezeigt", () => {
    expect(shouldShowRoutineClip(1 / 3 - 0.0001, null, today)).toBe(true);
  });
  it("Zufall ab 1/3 zeigt keinen Clip", () => {
    expect(shouldShowRoutineClip(1 / 3, null, today)).toBe(false);
    expect(shouldShowRoutineClip(0.9, null, today)).toBe(false);
  });
  it("heute bereits gezeigt sperrt auch bei passendem Zufall", () => {
    expect(shouldShowRoutineClip(0, today, today)).toBe(false);
  });
  it("gestern gezeigt erlaubt heute bei passendem Zufall", () => {
    expect(shouldShowRoutineClip(0.1, "2026-10-31", today)).toBe(true);
  });
});

describe("Abwechslung beim Abschluss", () => {
  const cases: [boolean, boolean, { schoolFree?: boolean; weekDone?: boolean }][] = [
    [true, true, {}], [true, true, { schoolFree: true }], [true, false, {}],
    [false, false, {}], [false, true, {}], [false, true, { weekDone: true }],
  ];
  it.each(cases)("Morgen=%s fertig=%s %o: Original-Clip zuerst, nur lippensynchrone Clips", (m, d, o) => {
    const clips = closureClips(m, d, o);
    expect(clips[0]).toEqual(kittenVideo(m, d, o));
    for (const c of clips) {
      expect(c.phrase).toContain("Siana");
      expect(c.mp4).not.toContain("/var-");
    }
  });
  it("nie zweimal hintereinander derselbe Clip (sofern es Alternativen gibt)", () => {
    const clips = [{ mp4: "a", phrase: "" }, { mp4: "b", phrase: "" }, { mp4: "c", phrase: "" }];
    for (const last of clips) for (const r of [0, 0.5, 0.9999]) expect(pickClip(clips, r, last.mp4).mp4).not.toBe(last.mp4);
    expect(pickClip([clips[0]!], 0.5, "a").mp4).toBe("a");
  });
  it("Situationen", () => {
    expect(closureSituation(true, true, { schoolFree: true })).toBe("morgen-frei");
    expect(closureSituation(false, true, { weekDone: true })).toBe("woche-fertig");
  });
});
