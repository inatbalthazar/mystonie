import { describe, expect, it } from "vitest";
import { isUuidV7, uuidv7 } from "./ids";

describe("uuidv7", () => {
  it("makes valid, unique v7 ids", () => {
    const ids = Array.from({ length: 100 }, () => uuidv7());
    expect(ids.every(isUuidV7)).toBe(true);
    expect(new Set(ids).size).toBe(100);
  });

  it("puts the time in the first 48 bits, so ids sort by creation time", () => {
    const zeros = (b: Uint8Array<ArrayBuffer>) => b.fill(0);
    expect(uuidv7(0x0192_6000_0000, zeros)).toBe("01926000-0000-7000-8000-000000000000");
    expect(uuidv7(Date.UTC(2026, 8, 27), zeros) < uuidv7(Date.UTC(2026, 8, 28), zeros)).toBe(true);
  });

  it("keeps random bits outside the version and variant", () => {
    expect(uuidv7(0, (b) => b.fill(0xff))).toBe("00000000-0000-7fff-bfff-ffffffffffff");
  });
});

describe("isUuidV7", () => {
  it("rejects other versions and malformed ids", () => {
    expect(isUuidV7("b5a8c1a4-8c2e-4b0e-9d6f-2f3a1c0e9b11")).toBe(false);
    expect(isUuidV7("01926000-0000-7000-c000-000000000000")).toBe(false);
    expect(isUuidV7("01926000-0000-7000-8000-00000000000")).toBe(false);
    expect(isUuidV7("01926000-0000-7000-8000-000000000000")).toBe(true);
  });
});
