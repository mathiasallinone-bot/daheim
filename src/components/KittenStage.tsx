// Sprechende, interaktive Kätzchen-Bühne: folgt dem Finger, schnurrt beim Streicheln,
// bewegt den Mund beim Sprechen und führt mit den Pfoten zum nächsten Tag.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import { createPortal } from "react-dom";
import { VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import kittenOpen from "@/assets/kitten.png";
import kittenCalm from "@/assets/kitten-closed.png";
import kittenPurr from "@/assets/kitten-purr.png";
import { WEEK_BONUS_STARS, addDays, todayZurich } from "@/lib/plan";

type Spark = { id: number; x: number; y: number; dx: number; rot: number; size: number; glyph: string };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const HEARTS = ["💗", "💛", "✨", "🐾"];

export function KittenStage({
  phrase, talking, sound, onToggleSound, onSay, morning, weekDone, bonusBooked, day, onLeave,
}: {
  phrase: string;
  talking: boolean;
  sound: boolean;
  onToggleSound: () => void;
  onSay: () => void;
  morning: boolean;
  weekDone: boolean;
  bonusBooked: boolean;
  day: string;
  onLeave: (iso?: string) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const cur = useRef({ x: 0, y: 0, purr: 0 });
  const pressed = useRef(false);
  const moves = useRef(0);
  const downAt = useRef(0);
  const lastSpark = useRef(0);
  const seq = useRef(1);

  const [sparks, setSparks] = useState<Spark[]>([]);
  const [hop, setHop] = useState(false);
  const [purring, setPurring] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [blink, setBlink] = useState(false);
  const [words, setWords] = useState(0);

  // Sanft dem Finger hinterherbewegen (Trägheit), damit nichts ruckelt.
  useEffect(() => {
    let raf = 0;
    const step = () => {
      cur.current.x += (target.current.x - cur.current.x) * 0.12;
      cur.current.y += (target.current.y - cur.current.y) * 0.12;
      cur.current.purr += ((purring ? 1 : 0) - cur.current.purr) * 0.08;
      const el = body.current;
      if (el) {
        el.style.setProperty("--lx", cur.current.x.toFixed(3));
        el.style.setProperty("--ly", cur.current.y.toFixed(3));
        el.style.setProperty("--purr", cur.current.purr.toFixed(3));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [purring]);

  // Mund auf/zu im Takt des Sprechens.
  useEffect(() => {
    if (!talking) { setMouthOpen(false); return; }
    const id = setInterval(() => setMouthOpen((m) => !m), 170);
    return () => clearInterval(id);
  }, [talking]);

  // Satz Wort für Wort sichtbar werden lassen.
  useEffect(() => {
    const total = phrase.split(" ").length;
    if (!talking) { setWords(total); return; }
    setWords(1);
    const id = setInterval(() => setWords((w) => Math.min(total, w + 1)), 190);
    return () => clearInterval(id);
  }, [talking, phrase]);

  // Zwinkern, damit das Kätzchen auch ruhig "lebt".
  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, 3400);
    return () => clearInterval(id);
  }, []);

  const spark = (x: number, y: number, big = false) => {
    const id = seq.current++;
    const s: Spark = {
      id, x, y,
      dx: Math.round((Math.random() - 0.5) * 110),
      rot: Math.round((Math.random() - 0.5) * 60),
      size: big ? 34 + Math.round(Math.random() * 14) : 20 + Math.round(Math.random() * 10),
      glyph: HEARTS[Math.floor(Math.random() * HEARTS.length)]!,
    };
    setSparks((p) => [...p.slice(-26), s]);
    setTimeout(() => setSparks((p) => p.filter((k) => k.id !== id)), 1300);
  };

  const onMove = (e: RPointerEvent) => {
    const el = stage.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    target.current = {
      x: clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.45), -1, 1),
      y: clamp((e.clientY - (r.top + r.height * 0.45)) / (r.height * 0.45), -1, 1),
    };
    if (!pressed.current) return;
    moves.current += 1;
    setPurring(true);
    const now = performance.now();
    if (now - lastSpark.current > 120) {
      lastSpark.current = now;
      spark(e.clientX - r.left, e.clientY - r.top);
    }
  };

  const onDown = (e: RPointerEvent) => {
    pressed.current = true;
    moves.current = 0;
    downAt.current = performance.now();
    setPurring(true);
    e.stopPropagation();
  };

  const onUp = (e: RPointerEvent) => {
    if (!pressed.current) return;
    pressed.current = false;
    setTimeout(() => setPurring(false), 900);
    const r = stage.current?.getBoundingClientRect();
    if (moves.current < 8 && performance.now() - downAt.current < 500 && r) {
      for (let i = 0; i < 7; i++) {
        setTimeout(() => spark(e.clientX - r.left + (Math.random() - 0.5) * 90, e.clientY - r.top - 30, true), i * 60);
      }
      setHop(true);
      setTimeout(() => setHop(false), 700);
      onSay();
    }
  };

  const lookAt = (side: number) => { target.current = { x: side * 0.9, y: 0.15 }; };

  const shown = phrase.split(" ").slice(0, words).join(" ");
  const speaking = talking && words < phrase.split(" ").length;
  const src = purring || blink ? kittenPurr : talking && mouthOpen ? kittenOpen : kittenCalm;

  const stageEl = (
    <div
      ref={stage}
      className="fixed inset-0 z-[100] flex h-dvh w-full touch-none select-none flex-col items-center justify-center gap-5 overflow-hidden bg-star-soft px-5 py-6 text-center"
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className="kitten-bubble relative z-10 max-w-xl rounded-[28px] bg-card px-6 py-4 font-display text-2xl font-semibold shadow-card sm:text-3xl">
        <span aria-hidden className="absolute -bottom-3 left-1/2 size-6 -translate-x-1/2 rotate-45 rounded-[6px] bg-card" />
        <span>{morning ? "☀️ " : ""}{shown}{speaking ? "…" : ""}</span>
      </div>

      <div ref={body} className="kitten-body">
        <div className="kitten-shadow" aria-hidden />
        <div
          className={`kitten-fig ${hop ? "kitten-hop" : ""}`}
          onPointerDown={onDown}
          role="img"
          aria-label="Kätzchen: antippen zum Sprechen, mit dem Finger darüberstreichen zum Streicheln"
        >
          <img
            src={src}
            alt=""
            width={816}
            height={816}
            draggable={false}
            className={`size-[min(78vw,58vh)] ${talking ? "kitten-talk" : "kitten-breathe"}`}
          />
        </div>
        <div className={`kitten-purr ${purring ? "is-on" : ""}`} aria-hidden>Schnurr, schnurr …</div>
      </div>

      {weekDone && (
        <p className="relative z-10 text-lg font-semibold">
          🏆 Ganze Woche geschafft · +{WEEK_BONUS_STARS} ⭐ {bonusBooked ? "gutgeschrieben" : "wird gutgeschrieben…"}
        </p>
      )}
      {!sound && (
        <Button variant="ghost" onClick={onToggleSound} className="relative z-10 h-12 gap-2 rounded-xl">
          <VolumeX className="size-5" /> Ton einschalten
        </Button>
      )}

      <div className={`grid w-full max-w-xl grid-cols-2 gap-4 transition-opacity duration-500 ${talking ? "pointer-events-none opacity-0" : "opacity-100"}`}>
        {morning ? (
          <button
            type="button"
            onClick={() => onLeave()}
            onPointerEnter={() => lookAt(0)}
            className="paw-in col-span-2 flex min-h-24 flex-col items-center justify-center rounded-3xl bg-card p-3 text-lg font-semibold shadow-card active:scale-95"
          >
            <span className="text-5xl" aria-hidden>🐾</span>
            Los in den Tag!
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onLeave(todayZurich())}
              onPointerEnter={() => lookAt(-1)}
              onPointerLeave={() => lookAt(0)}
              className="paw-in flex min-h-24 flex-col items-center justify-center rounded-3xl bg-card p-3 text-lg font-semibold shadow-card active:scale-95"
            >
              <span className="text-5xl -scale-x-100" aria-hidden>🐾</span>
              Zurück zu heute
            </button>
            <button
              type="button"
              onClick={() => onLeave(addDays(day, 1))}
              onPointerEnter={() => lookAt(1)}
              onPointerLeave={() => lookAt(0)}
              className="paw-in flex min-h-24 flex-col items-center justify-center rounded-3xl bg-card p-3 text-lg font-semibold shadow-card active:scale-95"
            >
              <span className="text-5xl" aria-hidden>🐾</span>
              Nächster Tag
            </button>
          </>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {sparks.map((s) => (
          <span
            key={s.id}
            className="kitten-spark"
            style={{ left: s.x, top: s.y, fontSize: s.size, "--dx": `${s.dx}px`, "--rot": `${s.rot}deg` } as CSSProperties}
            aria-hidden
          >
            {s.glyph}
          </span>
        ))}
      </div>
    </div>
  );

  // Direkt am Dokument aufhängen: nichts im Layout kann die Bühne überdecken oder verkürzen.
  if (typeof document === "undefined") return null;
  return createPortal(stageEl, document.body);
}
