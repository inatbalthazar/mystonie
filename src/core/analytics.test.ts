import { describe, expect, it } from "vitest";
import { landingAttribution, posthogAssetsHost, posthogUiHost } from "./analytics";

describe("landingAttribution", () => {
  it("keeps ref and tpl from a shared card link", () => {
    expect(landingAttribution("?ref=card&tpl=boldStats&utm_source=x")).toEqual({ ref: "card", tpl: "boldStats" });
  });

  it("ignores missing, empty and odd values", () => {
    expect(landingAttribution("")).toEqual({});
    expect(landingAttribution("?ref=&tpl=<script>")).toEqual({});
    expect(landingAttribution(`?ref=${"a".repeat(41)}`)).toEqual({});
  });
});

describe("posthog hosts", () => {
  it("maps the API host to the UI and assets hosts", () => {
    expect(posthogUiHost("https://eu.i.posthog.com")).toBe("https://eu.posthog.com");
    expect(posthogUiHost("https://us.i.posthog.com")).toBe("https://us.posthog.com");
    expect(posthogAssetsHost("https://eu.i.posthog.com")).toBe("https://eu-assets.i.posthog.com");
    expect(posthogAssetsHost("https://us.i.posthog.com")).toBe("https://us-assets.i.posthog.com");
  });
});
