import { describe, expect, it } from "vitest";
import { clientIp, rateLimitKey } from "./rate-limit";

describe("clientIp", () => {
  it("takes the first x-forwarded-for hop", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then 'unknown'", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("rateLimitKey", () => {
  it("is stable per bucket, ip and salt", () => {
    expect(rateLimitKey("search", "203.0.113.7", "s")).toBe(rateLimitKey("search", "203.0.113.7", "s"));
  });

  it("never contains the raw IP and changes with the salt", () => {
    const key = rateLimitKey("search", "203.0.113.7", "s1");
    expect(key.startsWith("search:")).toBe(true);
    expect(key).not.toContain("203.0.113.7");
    expect(key).not.toBe(rateLimitKey("search", "203.0.113.7", "s2"));
  });
});
