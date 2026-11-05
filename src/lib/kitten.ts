// Sätze des Kätzchens (Sprechblasen-Texte).
export const DAY_PHRASES = [
  "Miau! Gut gemacht, Siana. Weiter so!",
  "Schnurr! Alles geschafft, Siana. Das hast du super gemacht!",
  "Miau, miau! Ich bin so stolz auf dich, Siana!",
  "Prima, Siana! Heute hast du alles erledigt. Miau!",
  "Schnurr, schnurr! Du bist ein richtiger Profi, Siana!",
];
export const WEEK_PHRASES = [
  "Miau! Die ganze Woche geschafft, Siana! Sieben Sterne für dich!",
  "Schnurr! Eine perfekte Woche, Siana. Sieben Sterne, weiter so!",
];
export const MORNING_PHRASES = [
  "Guten Morgen Siana. Du hast alles super erledigt. Ich wünsche dir einen schönen Tag.",
];
export const STAR_PHRASE = "Gut gemacht Siana. Du hast dir einen Belohnungsstern verdient.";
export const ALL_PHRASES = [...DAY_PHRASES, ...WEEK_PHRASES, ...MORNING_PHRASES, STAR_PHRASE];
export const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)] ?? list[0]!;
