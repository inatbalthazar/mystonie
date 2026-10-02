import { describe, expect, it } from "vitest";
import { nextActDelay, nextBlink, pickStonieAct, STONIE_ACTS } from "./stonie";

describe("pickStonieAct", () => {
  it("can pick every act", () => {
    const seen = new Set(Array.from({ length: 200 }, (_, i) => pickStonieAct(i / 200)));
    expect([...seen].sort()).toEqual([...STONIE_ACTS].sort());
  });

  it("never does the same thing twice in a row", () => {
    for (const last of STONIE_ACTS) {
      for (let i = 0; i < 50; i++) expect(pickStonieAct(i / 50, last)).not.toBe(last);
    }
  });

  it("spins rarely", () => {
    const spins = Array.from({ length: 1000 }, (_, i) => pickStonieAct(i / 1000)).filter((a) => a === "spin").length;
    expect(spins).toBeLessThan(60);
    expect(pickStonieAct(0.9999)).toBe("tilt");
  });
});

describe("timing", () => {
  it("keeps acts 7 to 16 seconds apart", () => {
    expect(nextActDelay(0)).toBe(7000);
    expect(nextActDelay(0.9999)).toBeLessThanOrEqual(16000);
  });

  it("blinks every few seconds, sometimes twice", () => {
    expect(nextBlink(0, 0.5)).toEqual({ delay: 2500, double: false });
    expect(nextBlink(1, 0.1)).toEqual({ delay: 6500, double: true });
  });
});
