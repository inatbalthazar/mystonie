import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import th from "../../messages/th.json";
import { mergeMessages, type Messages } from "./merge-messages";

describe("mergeMessages", () => {
  it("falls back to the base value for missing nested keys", () => {
    const base = { Home: { title: "Mystonie", tagline: "Finished it?" }, Footer: { language: "Language" } };
    const override = { Home: { tagline: "ดูจบแล้ว?" } };
    expect(mergeMessages(base, override)).toEqual({
      Home: { title: "Mystonie", tagline: "ดูจบแล้ว?" },
      Footer: { language: "Language" },
    });
  });

  it("does not mutate its inputs", () => {
    const base = { A: { b: "1" } };
    mergeMessages(base, { A: { b: "2" } });
    expect(base).toEqual({ A: { b: "1" } });
  });
});

function keyPaths(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "string" ? [prefix + key] : keyPaths(value, `${prefix}${key}.`),
  );
}

describe("message files", () => {
  it("th.json only contains keys that exist in en.json (English is the source of truth)", () => {
    const enKeys = new Set(keyPaths(en));
    expect(keyPaths(th).filter((key) => !enKeys.has(key))).toEqual([]);
  });
});
