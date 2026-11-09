import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { STAR_PHRASE } from "@/lib/kitten";
import { STAR_CLIP, type KittenClip } from "@/lib/kitten-video";
import { DanceKitten } from "@/components/DanceKitten";

const SOUND_KEY = "daheim-kitten-sound";
type Show = { kind: "star"; reason: string; clip: KittenClip } | { kind: "tip"; clip: KittenClip } | { kind: "dance"; stars: number; title: string };
type Listener = (s: Show | null) => void;
const listeners = new Set<Listener>();
let current: Show | null = null;
let closureOpen = false;
const emit = (s: Show | null) => { current = s; listeners.forEach((l) => l(s)); };

/** Zeigt kurz das Kätzchen, das einen Belohnungsstern überbringt (hat Vorrang). */
export function showStarKitten(reason: string, clip: KittenClip = STAR_CLIP) {
  emit({ kind: "star", reason, clip });
}

/** Tanzendes Kätzchen mit Musik, das Siana die Sterne schickt (Extra-Bonus, hat Vorrang). */
export function showDanceKitten(stars: number, title: string) {
  emit({ kind: "dance", stars, title });
}

/** Kurzer Zusatz-Clip; wird übersprungen, wenn Stern- oder Abschluss-Clip läuft. */
export function showKittenClip(clip: KittenClip) {
  if (closureOpen || current) return false;
  emit({ kind: "tip", clip });
  return true;
}

/** Abschluss-Clips melden sich hier an; sie verdrängen einen laufenden Zusatz-Clip. */
export function setClosureOpen(open: boolean) {
  closureOpen = open;
  if (open && current?.kind === "tip") emit(null);
}

function soundOn() {
  try { return localStorage.getItem(SOUND_KEY) === "1"; } catch { return false; }
}

export function StarKittenHost() {
  const [show, setShow] = useState<Show | null>(current);
  useEffect(() => {
    listeners.add(setShow);
    setShow(current); // Kinder-Effekte laufen vor diesem Effekt
    return () => void listeners.delete(setShow);
  }, []);
  const close = () => emit(null);
  useEffect(() => {
    if (!show || show.kind === "dance") return;
    const t = setTimeout(close, show.kind === "star" ? 9000 : 8000);
    return () => clearTimeout(t);
  }, [show]);

  if (!show || typeof document === "undefined") return null;
  if (show.kind === "dance") return <DanceKitten stars={show.stars} title={show.title} onClose={close} />;
  if (show.kind === "tip") return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Kätzchen" onClick={close}
      className="fixed inset-0 z-[105] flex h-dvh w-full items-center justify-center bg-star-soft p-4">
      <video key={show.clip.mp4} src={show.clip.mp4} autoPlay playsInline preload="auto" muted={!soundOn()}
        aria-label={show.clip.phrase} className="max-h-full w-full max-w-3xl rounded-3xl object-contain shadow-card"
        onEnded={() => setTimeout(close, 400)} onError={close} />
      <p className="sr-only">Tippen zum Überspringen</p>
    </div>,
    document.body,
  );
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Belohnungsstern"
      className="fixed inset-0 z-[110] flex h-dvh w-full flex-col items-center justify-center gap-4 bg-star-soft p-6 text-center"
      onClick={close}>
      <p className="kitten-bubble max-w-md rounded-3xl bg-card px-6 py-4 font-display text-2xl font-semibold shadow-card">
        {show.clip === STAR_CLIP ? STAR_PHRASE : show.clip.phrase}
      </p>
      <video key={show.clip.mp4} src={show.clip.mp4} autoPlay playsInline muted={!soundOn()}
        aria-label={show.clip.phrase} className="w-full max-w-2xl rounded-3xl shadow-card"
        onEnded={() => setTimeout(close, 1500)}
        onError={() => setTimeout(close, 4000)} />
      <p className="text-lg text-muted-foreground">{show.reason}</p>
      <Button size="lg" className="h-14 rounded-2xl text-lg" onClick={close}>🐾 Danke, Kätzchen!</Button>
    </div>,
    document.body,
  );
}
