import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { closureClips, closureSituation, pickClip } from "@/lib/kitten-video";
import { WEEK_BONUS_STARS } from "@/lib/plan";
import { setClosureOpen } from "@/components/StarKitten";

export function MorningVideoStage({ schoolFree = false, sound, onToggleSound, onLeave, morning = true, done = true, onReview, onNext, weekDone = false, bonusBooked = false, laundryOpen = false }: {
  laundryOpen?: boolean;
  schoolFree?: boolean;
  sound: boolean;
  onToggleSound: () => void;
  onLeave: () => void;
  morning?: boolean;
  done?: boolean;
  onReview?: () => void;
  onNext?: () => void;
  weekDone?: boolean;
  bonusBooked?: boolean;
}) {
  const [clip] = useState(() => {
    const opts = { schoolFree, weekDone };
    const key = `daheim-kitten-last-${closureSituation(morning, done, opts)}`;
    let last: string | null = null;
    try { last = localStorage.getItem(key); } catch { /* Gerätespeicher optional */ }
    const c = pickClip(closureClips(morning, done, opts), Math.random(), last);
    try { localStorage.setItem(key, c.mp4); } catch { /* Gerätespeicher optional */ }
    return c;
  });
  const video = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);

  const play = () => {
    const el = video.current;
    if (!el) return;
    setBlocked(false);
    setEnded(false);
    void el.play().catch(() => setBlocked(true));
  };

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.muted = !sound;
    void el.play().catch(() => setBlocked(true));
  }, [sound]);

  useEffect(() => {
    setClosureOpen(true);
    return () => setClosureOpen(false);
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={morning ? "Morgenabschluss" : "Tagesabschluss"} className="fixed inset-0 z-[100] h-dvh w-full overflow-hidden bg-star-soft">
      <video
        ref={video}
        autoPlay
        playsInline
        muted={!sound}
        preload="auto"
        className="h-full w-full object-contain"
        aria-label={clip.phrase}
        onEnded={() => setEnded(true)}
        onPlaying={() => { setBlocked(false); setFailed(false); }}
        onError={(event) => { if (event.currentTarget.error) setFailed(true); }}
      >
        <source src={clip.mp4} type="video/mp4" />
      </video>
      <div className="absolute inset-x-0 top-0 flex justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button variant="secondary" className="h-12 gap-2 shadow-card" onClick={() => {
          const el = video.current;
          if (el) {
            el.muted = sound;
            if (el.paused && !ended) play();
          }
          onToggleSound();
        }}>
          {sound ? <Volume2 /> : <VolumeX />}{sound ? "Ton ausschalten" : "Ton einschalten"}
        </Button>
        <Button variant="secondary" size="icon" className="size-12 shadow-card" aria-label="Kätzchen schliessen" title="Schliessen" onClick={done ? onLeave : onReview}><X /></Button>
      </div>
      {laundryOpen && (
        <p role="status" className="kitten-bubble absolute inset-x-4 top-24 mx-auto max-w-md rounded-3xl bg-card px-5 py-3 text-center text-lg font-semibold shadow-card">
          🐱🧺 Miau, Siana! Die Wäsche wartet noch – bitte lege die Kleider zusammen.
        </p>
      )}
      {(blocked || failed) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center [&_button]:pointer-events-auto">
          {failed ? <p role="alert" className="bg-card px-5 py-3 text-foreground">Das Video konnte nicht geladen werden.</p> :
            <Button size="lg" className="h-14 gap-2 text-lg" onClick={play}><Play />Video abspielen</Button>}
        </div>
      )}
      {(ended || failed) && (
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-3 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {weekDone && <p className="w-full bg-card px-3 py-2 text-center font-semibold">🏆 Ganze Woche geschafft · +{WEEK_BONUS_STARS} ⭐ {bonusBooked ? "gutgeschrieben" : "wird gutgeschrieben…"}</p>}
          {!failed && <Button variant="secondary" size="icon" className="size-14 shadow-card" aria-label="Video nochmals abspielen" title="Nochmals abspielen" onClick={() => {
            if (video.current) video.current.currentTime = 0;
            play();
          }}><RotateCcw /></Button>}
          {!done ? <Button size="lg" className="h-14 gap-2 text-lg shadow-card" onClick={onReview}><span aria-hidden>🐾</span>Aufgaben nochmals anschauen</Button> : morning ?
            <Button size="lg" className="h-14 gap-2 text-lg shadow-card" onClick={onLeave}><span aria-hidden>🐾</span>Los in den Tag!</Button> : <>
              <Button size="lg" variant="secondary" className="h-14 gap-2 text-lg shadow-card" onClick={onLeave}><span aria-hidden>🐾</span>Zurück zu heute</Button>
              <Button size="lg" className="h-14 gap-2 text-lg shadow-card" onClick={onNext}><span aria-hidden>🐾</span>Nächster Tag</Button>
            </>}
        </div>
      )}
    </div>, document.body,
  );
}