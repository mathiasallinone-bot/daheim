import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { deviceLabel } from "./push";

describe("deviceLabel", () => {
  it("erkennt iPad auch im Desktop-Modus (iPadOS meldet sich als Mac)", () => {
    expect(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", 5)).toBe("iPad");
    expect(deviceLabel("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)", 5)).toBe("iPad");
  });
  it("iPhone, Android, Mac", () => {
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 5)).toBe("iPhone");
    expect(deviceLabel("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari", 5)).toBe("Android-Handy");
    expect(deviceLabel("Mozilla/5.0 (Linux; Android 14; SM-X200) Safari", 5)).toBe("Android-Tablet");
    expect(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe("Mac");
  });
});
