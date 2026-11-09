import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RewardHint } from "./Rewards";
import { showStarKitten, StarKittenHost } from "./StarKitten";
import { starClip } from "@/lib/kitten-video";
import { starReason } from "@/lib/data";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Spezial-Belohnungen", () => {
  it("Doppelstern-Kätzchen spielt eigenen Clip mit passendem Satz", () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    render(<StarKittenHost />);
    act(() => showStarKitten(starReason("buch-lesen", 2), starClip("buch-lesen", 2)));
    expect(screen.getByText("Wow, Siana! Heute gibt es zwei Sterne!")).toBeTruthy();
    expect(document.querySelector("video")?.getAttribute("src")).toBe("/media/doppelstern.mp4");
  });
  it("Hinweis erscheint einmal pro Tag", () => {
    render(<RewardHint />);
    expect(screen.getByText(/geheime Spezial-Sterne/)).toBeTruthy();
    act(() => fireEvent.click(screen.getByRole("button", { name: /ich bin dabei/ })));
    expect(screen.queryByText(/geheime Spezial-Sterne/)).toBeNull();
    cleanup();
    render(<RewardHint />);
    expect(screen.queryByText(/geheime Spezial-Sterne/)).toBeNull();
  });
  it("Texte für Doppelstern und Katzenklo", () => {
    expect(starReason("buch-lesen", 1)).toContain("+1");
    expect(starReason("buch-lesen", 2)).toContain("Doppelstern");
    expect(starReason("katzenklo", 6)).toContain("+6");
    expect(starReason("katzenklo", 1)).toContain("Fünfmal");
    expect(starReason("fruehaufsteher", 1)).toContain("Überraschung");
  });
});
