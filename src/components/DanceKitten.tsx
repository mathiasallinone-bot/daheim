import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Volume2, VolumeX } from "lucide-react";
import kitten from "@/assets/kitten.png";
import { Button } from "@/components/ui/button";

export const DANCE_MUSIC = "/media/katzen-tanz.mp3";
const MUSIC_MS = 11_500;
const FIRST_STAR_MS = 2_500;
const STAR_GAP_MS = 1_500;
const FLIGHT_MS = 1_600;

let music: HTMLAudioElement | null = null;

/** iOS/Safari: Musik im Tipp-Moment entsperren, damit sie nach dem Speichern spielen darf. */
export function primeDanceMusic() {
  if (typeof window === "undefined") return;
  music ??= new Audio(DANCE_MUSIC);
  music.muted = true;
  void music
    .play()
    .then(() => {
      music?.pause();
      if (music) {
        music.currentTime = 0;
        music.muted = false;
      }
    })
    .catch(() => {
      if (music) music.muted = false;
    });
}

/** Kätzchen tanzt zur Musik und schickt Siana die Sterne. */
export function DanceKitten({ stars, title, onClose }: { stars: number; title: string; onClose: () => void }) {
  const [arrived, setArrived] = useState(0);
  const [muted, setMuted] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const count = Math.max(1, Math.min(stars, 6));

  useEffect(() => {
    music ??= new Audio(DANCE_MUSIC);
    music.currentTime = 0;
    music.muted = false;
    void music.play().catch(() => setMuted(true));
    const timers = Array.from({ length: count }, (_, i) =>
      setTimeout(() => setArrived(i + 1), FIRST_STAR_MS + i * STAR_GAP_MS + FLIGHT_MS),
    );
    const end = Math.max(MUSIC_MS, FIRST_STAR_MS + count * STAR_GAP_MS + FLIGHT_MS + 2500);
    timers.push(setTimeout(() => closeRef.current(), end));
    return () => {
      timers.forEach(clearTimeout);
      music?.pause();
    };
  }, [count]);

  const toggleSound = () => {
    if (!music) return;
    if (muted) {
      music.muted = false;
      void music.play().catch(() => {});
    } else music.muted = true;
    setMuted(!muted);
  };

  const notes = ["♪", "♫", "♬", "♪", "♫"];
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Extra-Bonus: ${stars} Sterne`}
      className="fixed inset-0 z-[115] h-dvh w-full overflow-hidden bg-star-soft text-center">
      <p className="kitten-bubble absolute inset-x-4 z-10 top-[max(1.5rem,env(safe-area-inset-top))] mx-auto max-w-md rounded-3xl bg-card px-6 py-4 font-display text-2xl font-semibold shadow-card">
        {title}
      </p>
      <div className="absolute inset-x-0 top-[24%] flex justify-center">
        <div className="relative">
          <img src={kitten} alt="Tanzendes Kätzchen" className="kitten-dance w-56 max-w-[60vw]" />
          {notes.map((n, i) => (
            <span key={i} aria-hidden className="note-float text-4xl text-primary"
              style={{ left: `${10 + i * 20}%`, animationDelay: `${i * 0.5}s`, ["--dx" as string]: `${(i % 2 ? 1 : -1) * (20 + i * 8)}px`, ["--rot" as string]: `${(i % 2 ? 1 : -1) * 30}deg` }}>
              {n}
            </span>
          ))}
        </div>
      </div>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} aria-hidden className="star-fly"
          style={{ animationDelay: `${(FIRST_STAR_MS + i * STAR_GAP_MS) / 1000}s`, ["--x0" as string]: i % 2 ? "58%" : "42%" }}>
          ⭐
        </span>
      ))}
      <div className="absolute inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-3 px-6">
        <div key={arrived} className={`flex items-center gap-3 rounded-full bg-card px-6 py-3 shadow-card ${arrived ? "badge-pop" : ""}`}>
          <span aria-hidden className="text-4xl">👧</span>
          <span className="font-display text-2xl font-bold">Siana</span>
          <span aria-live="polite" className="min-w-16 font-display text-2xl font-bold text-done">{arrived ? `+${arrived} ⭐` : ""}</span>
        </div>
        <div className="flex gap-2">
          <Button size="lg" className="h-14 rounded-2xl text-lg" onClick={onClose}>🐾 Danke, Kätzchen!</Button>
          <Button size="lg" variant="ghost" className="h-14 rounded-2xl" onClick={toggleSound} aria-label={muted ? "Musik an" : "Musik aus"}>
            {muted ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
