import { describe, expect, it } from "vitest";
import { dayStatus, formatCH, isRecurringDue, tasksFor, thursdayActivity, todayZurich, addDays, TASK_STARS, HAIR_SELF_STARS, WEEK_BONUS_STARS, TRASH_STARS, READING_EVERY, LAUNDRY_EVERY, milestoneStars, laundryPart, weekDaysEnding, isWeekComplete, homeworkStep, homeworkUrgent, homeworkVisible, homeworkReminder, homeworkBlocksClose } from "./plan";

const keys = (d: string) => tasksFor(d).map((t) => t.key);

describe("Donnerstagsrotation", () => {
  it("29.10.2026 Schwimmen, 05.11. Turnen, 12.11. Schwimmen", () => {
    expect(thursdayActivity("2026-10-29")).toBe("schwimmen");
    expect(thursdayActivity("2026-11-05")).toBe("turnen");
    expect(thursdayActivity("2026-11-12")).toBe("schwimmen");
    expect(thursdayActivity("2026-11-19")).toBe("turnen");
  });
  it("kein Termin vor Start oder an anderen Tagen", () => {
    expect(thursdayActivity("2026-10-22")).toBeNull();
    expect(thursdayActivity("2026-10-30")).toBeNull();
  });
  it("kein Termin in den Weihnachtsferien", () => {
    expect(thursdayActivity("2026-12-31")).toBeNull();
  });
});

describe("Weihnachtsferien", () => {
  it("24.12. ab Mittag, bis 10.01.2027, Schule ab 11.01.2027", () => {
    expect(dayStatus("2026-12-24").kind).toBe("halbtag");
    expect(dayStatus("2027-01-04").kind).toBe("ferien");
    expect(dayStatus("2027-01-10").kind).toBe("ferien");
    expect(dayStatus("2027-01-11").kind).toBe("schule");
  });
});

describe("Aufgaben", () => {
  it("Sonntag: Rucksack bereitmachen, Kleider, Haarewaschen, Zähne und Haare kämmen", () => {
    expect(keys("2026-11-01").sort()).toEqual(["haare-abend", "haare-morgen", "haarewaschen", "kleider-bereitlegen", "rucksack", "zaehne-abend", "zaehne-morgen"]);
  });
  it("Freitag: Zähneputzen morgens/abends und Rucksack auspacken", () => {
    expect(keys("2026-10-30").sort()).toEqual(["haare-abend", "haare-morgen", "rucksack-auspacken", "zaehne-abend", "zaehne-morgen"]);
  });
  it("Montag enthält Rucksack auspacken und bereitmachen", () => {
    expect(keys("2026-11-02")).toEqual(expect.arrayContaining(["rucksack-auspacken", "rucksack"]));
  });
  it("Samstag: nur Zähneputzen und Haare kämmen", () => {
    expect(keys("2026-10-31").sort()).toEqual(["haare-abend", "haare-morgen", "zaehne-abend", "zaehne-morgen"]);
  });
  it("Zähne und Haare kämmen morgens und abends an allen 7 Tagen", () => {
    for (let i = 0; i < 7; i++) expect(keys(addDays("2026-11-02", i))).toEqual(expect.arrayContaining(["zaehne-morgen", "zaehne-abend", "haare-morgen", "haare-abend"]));
  });
  it("Haare kämmen erst ab 29.10.2026, Zähne schon vorher", () => {
    expect(keys("2026-10-24")).toEqual(expect.arrayContaining(["zaehne-morgen", "zaehne-abend"]));
    expect(keys("2026-10-28")).not.toContain("haare-morgen");
    expect(keys("2026-10-28")).not.toContain("haare-abend");
  });
  it("Haarewaschen an Schwimmtag, nicht an Turntag", () => {
    expect(keys("2026-10-29")).toContain("haarewaschen");
    expect(keys("2026-11-05")).not.toContain("haarewaschen");
  });
});

describe("Sterne", () => {
  it("Routinen 0, Haare selber 1, Wochenbonus 1, Abfall 1", () => {
    expect(TASK_STARS).toBe(0);
    expect(HAIR_SELF_STARS).toBe(1);
    expect(WEEK_BONUS_STARS).toBe(1);
    expect(TRASH_STARS).toBe(1);
  });
  it("Buch lesen: Stern erst beim 5. Mal", () => {
    expect([1, 2, 3, 4, 5, 6, 10].map((n) => milestoneStars(n, READING_EVERY))).toEqual([0, 0, 0, 0, 1, 0, 1]);
  });
  it("Wäsche: Stern erst beim 10. Mal", () => {
    expect(milestoneStars(9, LAUNDRY_EVERY)).toBe(0);
    expect(milestoneStars(10, LAUNDRY_EVERY)).toBe(1);
  });
  it("Wäsche hängt vor 12 Uhr = Morgen, sonst Abend", () => {
    expect(laundryPart(9)).toBe("morgen");
    expect(laundryPart(12)).toBe("abend");
  });
  it("Wochenbonus nur bei lückenloser Woche", () => {
    const all = new Set(weekDaysEnding("2026-11-08").flatMap((d) => tasksFor(d).map((t) => `${d}|${t.key}`)));
    expect(isWeekComplete("2026-11-08", all)).toBe(true);
    all.delete("2026-11-04|zaehne-abend");
    expect(isWeekComplete("2026-11-08", all)).toBe(false);
    expect(isWeekComplete("2026-11-07", all)).toBe(false);
  });
});

describe("Datum", () => {
  it("TT.MM.JJJJ", () => expect(formatCH("2026-11-21")).toBe("21.11.2026"));
  it("Zürich-Zeit nach Mitternacht", () =>
    expect(todayZurich(new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-26"));
  it("28-Tage-Intervall", () => expect(addDays("2026-10-24", 28)).toBe("2026-11-21"));
  it("Regelmässige Arbeit erst ab Fälligkeit sichtbar", () => {
    expect(isRecurringDue("2026-11-12", "2026-11-11")).toBe(false);
    expect(isRecurringDue("2026-11-12", "2026-11-12")).toBe(true);
    expect(isRecurringDue("2026-11-12", "2026-11-20")).toBe(true);
  });
});

describe("Hausaufgaben & Haare kämmen", () => {
  it("Haare kämmen morgens und abends, auch am Wochenende", () => {
    expect(keys("2026-11-02")).toEqual(expect.arrayContaining(["haare-morgen", "haare-abend"]));
    expect(keys("2026-11-01")).toContain("haare-morgen");
  });
  it("Klick wechselt zu einpacken, dann fertig", () => {
    expect(homeworkStep(false, false)).toBe("erledigen");
    expect(homeworkStep(true, false)).toBe("einpacken");
    expect(homeworkStep(true, true)).toBe("fertig");
  });
  it("ab Donnerstag hervorgehoben, Mo–Fr sichtbar", () => {
    expect(homeworkUrgent("2026-11-04", "erledigen")).toBe(false);
    expect(homeworkUrgent("2026-11-05", "einpacken")).toBe(true);
    expect(homeworkUrgent("2026-11-05", "fertig")).toBe(false);
    expect(homeworkVisible("2026-11-06")).toBe(true);
    expect(homeworkVisible("2026-11-07")).toBe(false);
  });
});

describe("Morgen/Abend und Schwimmsachen", () => {
  it("Schwimmsachen bereitmachen am Morgen jedes Schwimm-Donnerstags (29.10., 12.11.)", () => {
    expect(keys("2026-10-29")).toContain("schwimmsachen-bereit");
    expect(keys("2026-11-05")).not.toContain("schwimmsachen-bereit");
    expect(keys("2026-11-12")).toContain("schwimmsachen-bereit");
    expect(tasksFor("2026-11-12").find((t) => t.key === "schwimmsachen-bereit")?.part).toBe("morgen");
  });
  it("Schwimmsachen einpacken am Abend vorher (11.11.), nicht vor Turnen (04.11.)", () => {
    expect(keys("2026-11-11")).toContain("schwimmsachen-einpacken");
    expect(keys("2026-11-04")).not.toContain("schwimmsachen-einpacken");
    expect(tasksFor("2026-11-11").find((t) => t.key === "schwimmsachen-einpacken")?.part).toBe("abend");
  });
  it("Morgen: Zähne und Haare morgens; Abend: Rest", () => {
    const m = tasksFor("2026-11-02").filter((t) => t.part === "morgen").map((t) => t.key);
    expect(m.sort()).toEqual(["haare-morgen", "zaehne-morgen"]);
  });
});

describe("Hausaufgaben-Regeln pro Schulwoche", () => {
  it("Montag erst ab Nachmittag sichtbar, Di–Fr ganztags", () => {
    expect(homeworkVisible("2026-11-09", "morgen")).toBe(false);
    expect(homeworkVisible("2026-11-09", "abend", 9)).toBe(false);
    expect(homeworkVisible("2026-11-09", "abend", 14)).toBe(true);
    expect(homeworkVisible("2026-11-09", "abend")).toBe(true);
    expect(homeworkVisible("2026-11-10", "morgen", 8)).toBe(true);
  });
  it("Mittwochabend Hinweis nur, wenn nicht fertig", () => {
    expect(homeworkReminder("2026-11-11", "erledigen")).toBe(true);
    expect(homeworkReminder("2026-11-11", "einpacken")).toBe(true);
    expect(homeworkReminder("2026-11-11", "fertig")).toBe(false);
    expect(homeworkReminder("2026-11-10", "erledigen")).toBe(false);
  });
  it("Mo–Mi blockieren nicht, Donnerstag schon", () => {
    for (const d of ["2026-11-09", "2026-11-10", "2026-11-11"]) expect(homeworkBlocksClose(d, "erledigen")).toBe(false);
    expect(homeworkBlocksClose("2026-11-12", "erledigen")).toBe(true);
    expect(homeworkBlocksClose("2026-11-12", "einpacken")).toBe(true);
    expect(homeworkBlocksClose("2026-11-12", "fertig")).toBe(false);
  });
  it("Donnerstag vor Ferien-Freitag (24.12.2026) blockiert nicht", () => {
    expect(homeworkBlocksClose("2026-12-24", "erledigen")).toBe(false);
  });
});
