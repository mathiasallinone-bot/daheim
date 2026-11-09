import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RewardHint } from "./Rewards";
import { starReason } from "@/lib/data";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Spezial-Belohnungen", () => {
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
