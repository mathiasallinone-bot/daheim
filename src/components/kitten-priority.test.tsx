import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MorningVideoStage } from "./MorningVideoStage";
import { setClosureOpen, showKittenClip, StarKittenHost } from "./StarKitten";
import { GREETING_CLIP, closureClips } from "@/lib/kitten-video";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  localStorage.setItem("daheim-kitten-routine-shown", "2026-11-01");
  vi.spyOn(Math, "random").mockReturnValue(0.99);
});

afterEach(() => {
  cleanup();
  setClosureOpen(false);
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Abschlussclips haben immer Vorrang", () => {
  it.each([true, false])("Morgen=%s verdrängt Zusatzclip unabhängig von Zufall und Tagesflag", (morning) => {
    render(<StarKittenHost />);
    act(() => { expect(showKittenClip(GREETING_CLIP)).toBe(true); });
    expect(screen.getByRole("dialog", { name: "Kätzchen" })).toBeInTheDocument();

    render(<MorningVideoStage morning={morning} done={false} sound={false}
      onToggleSound={() => {}} onLeave={() => {}} onReview={() => {}} />);

    expect(screen.queryByRole("dialog", { name: "Kätzchen" })).not.toBeInTheDocument();
    const closure = screen.getByRole("dialog", { name: morning ? "Morgenabschluss" : "Tagesabschluss" });
    expect(closureClips(morning, false).map((c) => c.mp4)).toContain(closure.querySelector("source")?.getAttribute("src"));
    act(() => { expect(showKittenClip(GREETING_CLIP)).toBe(false); });
    expect(screen.queryByRole("dialog", { name: "Kätzchen" })).not.toBeInTheDocument();
    expect(closure).toBeInTheDocument();
    expect(localStorage.getItem("daheim-kitten-routine-shown")).toBe("2026-11-01");
  });
});