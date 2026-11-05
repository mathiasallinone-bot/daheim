import gutenMorgen from "@/assets/clip-01-guten-morgen.mp4.asset.json";
import freierTag from "@/assets/clip-02-freier-tag.mp4.asset.json";
import vergessen from "@/assets/clip-03-etwas-vergessen.mp4.asset.json";
import stern from "@/assets/clip-04-goldener-stern.mp4.asset.json";
import guteNacht from "@/assets/clip-05-gute-nacht.mp4.asset.json";
import woche from "@/assets/clip-06-erfolgreiche-woche.mp4.asset.json";
import erledigen from "@/assets/clip-07-aufgaben-erledigen.mp4.asset.json";
import tipMorgen from "@/assets/tip-01-guten-morgen.mp4.asset.json";
import tipZaehne from "@/assets/tip-02-zaehneputzen.mp4.asset.json";
import tipHaare from "@/assets/tip-03-haare-kaemmen.mp4.asset.json";
import tipAufgaben from "@/assets/tip-04-aufgaben-selbststaendig.mp4.asset.json";
import tipPause from "@/assets/tip-05-kleine-pause.mp4.asset.json";
import tipKontrolle from "@/assets/tip-06-alles-kontrollieren.mp4.asset.json";
import tipStolz from "@/assets/tip-07-stolz-sein.mp4.asset.json";

import v_morgen_schule_1 from "@/assets/var-morgen-schule-1.mp4.asset.json";
import v_morgen_schule_2 from "@/assets/var-morgen-schule-2.mp4.asset.json";
import v_morgen_schule_3 from "@/assets/var-morgen-schule-3.mp4.asset.json";
import v_morgen_frei_1 from "@/assets/var-morgen-frei-1.mp4.asset.json";
import v_morgen_frei_2 from "@/assets/var-morgen-frei-2.mp4.asset.json";
import v_morgen_frei_3 from "@/assets/var-morgen-frei-3.mp4.asset.json";
import v_morgen_offen_1 from "@/assets/var-morgen-offen-1.mp4.asset.json";
import v_morgen_offen_2 from "@/assets/var-morgen-offen-2.mp4.asset.json";
import v_morgen_offen_3 from "@/assets/var-morgen-offen-3.mp4.asset.json";
import v_abend_offen_1 from "@/assets/var-abend-offen-1.mp4.asset.json";
import v_abend_offen_2 from "@/assets/var-abend-offen-2.mp4.asset.json";
import v_abend_offen_3 from "@/assets/var-abend-offen-3.mp4.asset.json";
import v_abend_fertig_1 from "@/assets/var-abend-fertig-1.mp4.asset.json";
import v_abend_fertig_2 from "@/assets/var-abend-fertig-2.mp4.asset.json";
import v_abend_fertig_3 from "@/assets/var-abend-fertig-3.mp4.asset.json";
import v_woche_fertig_1 from "@/assets/var-woche-fertig-1.mp4.asset.json";
import v_woche_fertig_2 from "@/assets/var-woche-fertig-2.mp4.asset.json";
import v_woche_fertig_3 from "@/assets/var-woche-fertig-3.mp4.asset.json";

export type KittenClip = { mp4: string; phrase: string };

export const STAR_CLIP: KittenClip = { mp4: stern.url, phrase: "Gut gemacht Siana. Du hast dir einen Belohnungsstern verdient." };

/** Wählt den passenden Abschluss-Clip. */
export function kittenVideo(morning: boolean, done: boolean, opts: { schoolFree?: boolean; weekDone?: boolean } = {}): KittenClip {
  if (morning) {
    if (!done) return { mp4: vergessen.url, phrase: "Schau nochmals nach, Siana, ob du wirklich alles erledigt hast." };
    return opts.schoolFree
      ? { mp4: freierTag.url, phrase: "Guten Morgen Siana. Geniesse deinen freien Tag." }
      : { mp4: gutenMorgen.url, phrase: "Guten Morgen Siana. Du hast alles super erledigt. Ich wünsche dir einen schönen Tag." };
  }
  if (!done) return { mp4: erledigen.url, phrase: "Bist du sicher, dass du alles erledigt hast, Siana? Schaue nochmals, bevor du schlafen gehst." };
  if (opts.weekDone) return { mp4: woche.url, phrase: "Super Siana, du hast die ganze Woche alles geschafft!" };
  return { mp4: guteNacht.url, phrase: "Super, Siana. Du hast heute alle Aufgaben erledigt. Schlaf gut." };
}

/* Kurze Zusatz-Clips (ergänzen die Abschluss-Clips, ersetzen nichts). */
export const GREETING_CLIP: KittenClip = { mp4: tipMorgen.url, phrase: "Guten Morgen Siana, heute wartet ein schöner Tag auf dich. Du schaffst das." };
export const REDEEM_CLIP: KittenClip = { mp4: tipStolz.url, phrase: "Ich schick dir eine grosse Katzenumarmung. Miau!" };
const zaehne: KittenClip = { mp4: tipZaehne.url, phrase: "Zähne geputzt? Dein Lächeln strahlt ja wie die Sonne." };
const haare: KittenClip = { mp4: tipHaare.url, phrase: "Auch deine Haare sitzen prima. So kann der Tag beginnen." };
const TASK_CLIPS: Record<string, KittenClip> = {
  "zaehne-morgen": zaehne,
  "zaehne-abend": zaehne,
  "haare-morgen": haare,
  hausaufgaben: { mp4: tipAufgaben.url, phrase: "Wow, du hast deine Aufgaben ganz selbstständig erledigt. Pfote drauf!" },
  "rucksack-auspacken": { mp4: tipPause.url, phrase: "Eine kleine Pause hast du dir verdient. Kuschel dich kurz ein." },
  rucksack: { mp4: tipKontrolle.url, phrase: "Fast alles geschafft. Schau noch einmal nach, ob alles erledigt ist." },
};

/** Clip nach dem Abhaken einer Aufgabe (nur für heute), sonst null. */
export function taskClip(key: string, isToday: boolean): KittenClip | null {
  return isToday ? TASK_CLIPS[key] ?? null : null;
}

/** Gemeinsame Anzeigegrenze für Zähneputzen und Haare kämmen. */
export function shouldShowRoutineClip(random: number, lastShownDay: string | null, today: string): boolean {
  return random < 1 / 3 && lastShownDay !== today;
}

export function isRoutineClipTask(key: string): boolean {
  return ["zaehne-morgen", "zaehne-abend", "haare-morgen", "haare-abend"].includes(key);
}

/** Begrüssung: nur bis 11:00 Uhr und höchstens einmal pro Tag. */
export function shouldGreet(zurichHour: number, lastGreetedDay: string | null, today: string): boolean {
  return zurichHour < 11 && lastGreetedDay !== today;
}

/* Abwechslung beim Morgen-/Tagesabschluss: gleiche Bilder, neue fertig vertonte Sätze. */
export type ClosureSituation = "morgen-schule" | "morgen-frei" | "morgen-offen" | "abend-offen" | "abend-fertig" | "woche-fertig";

export function closureSituation(morning: boolean, done: boolean, opts: { schoolFree?: boolean; weekDone?: boolean } = {}): ClosureSituation {
  if (morning) return !done ? "morgen-offen" : opts.schoolFree ? "morgen-frei" : "morgen-schule";
  if (!done) return "abend-offen";
  return opts.weekDone ? "woche-fertig" : "abend-fertig";
}

const VARIANTS: Record<ClosureSituation, KittenClip[]> = {
  "morgen-schule": [
    { mp4: v_morgen_schule_1.url, phrase: "Super, Siana! Jetzt kann die Schule kommen." },
    { mp4: v_morgen_schule_2.url, phrase: "Bravo, Siana, alles erledigt. Viel Spass in der Schule!" },
    { mp4: v_morgen_schule_3.url, phrase: "Toll gemacht, Siana! Hab einen fröhlichen Schultag." },
  ],
  "morgen-frei": [
    { mp4: v_morgen_frei_1.url, phrase: "Juhu, Siana! Viel Spass beim Spielen." },
    { mp4: v_morgen_frei_2.url, phrase: "Prima, Siana! Jetzt beginnt dein freier Tag." },
    { mp4: v_morgen_frei_3.url, phrase: "Super gemacht, Siana! Geniess die freie Zeit." },
  ],
  "morgen-offen": [
    { mp4: v_morgen_offen_1.url, phrase: "Fast geschafft, Siana! Schau nochmals kurz nach." },
    { mp4: v_morgen_offen_2.url, phrase: "Siana, da fehlt noch etwas. Du schaffst das!" },
    { mp4: v_morgen_offen_3.url, phrase: "Nur noch ein kleiner Schritt, Siana. Schau auf deine Liste." },
  ],
  "abend-offen": [
    { mp4: v_abend_offen_1.url, phrase: "Siana, ein paar Aufgaben warten noch auf dich." },
    { mp4: v_abend_offen_2.url, phrase: "Fast fertig, Siana! Nur noch ein bisschen." },
    { mp4: v_abend_offen_3.url, phrase: "Schau nochmals nach, Siana. Gleich ist alles geschafft." },
  ],
  "abend-fertig": [
    { mp4: v_abend_fertig_1.url, phrase: "Bravo, Siana! Träum etwas Schönes." },
    { mp4: v_abend_fertig_2.url, phrase: "Super, Siana! Jetzt ab ins Bett. Gute Nacht." },
    { mp4: v_abend_fertig_3.url, phrase: "Das war ein toller Tag, Siana. Schlaf schön." },
  ],
  "woche-fertig": [
    { mp4: v_woche_fertig_1.url, phrase: "Wow, Siana, die ganze Woche geschafft!" },
    { mp4: v_woche_fertig_2.url, phrase: "Siana, du bist ein Wochen-Champion! Miau!" },
    { mp4: v_woche_fertig_3.url, phrase: "Eine perfekte Woche, Siana! Ich bin mega stolz." },
  ],
};

/** Original-Clip zuerst, danach die Varianten. */
export function closureClips(morning: boolean, done: boolean, opts: { schoolFree?: boolean; weekDone?: boolean } = {}): KittenClip[] {
  return [kittenVideo(morning, done, opts), ...VARIANTS[closureSituation(morning, done, opts)]];
}

/** Zufällige Wahl, nie zweimal hintereinander derselbe Clip. `random` in [0,1). */
export function pickClip(clips: KittenClip[], random: number, lastMp4: string | null): KittenClip {
  const pool = clips.length > 1 ? clips.filter((c) => c.mp4 !== lastMp4) : clips;
  return pool[Math.min(pool.length - 1, Math.floor(random * pool.length))]!;
}
