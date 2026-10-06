import { describe, expect, it } from "vitest";
import { ANDROID_PACKAGE, assetLinks, isAndroidAppLaunch, parseFingerprints } from "./android";

const A = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, "0").toUpperCase()).join(":");
const B = Array.from({ length: 32 }, () => "AB").join(":");

describe("parseFingerprints", () => {
  it("reads comma or space separated fingerprints, upper-cased, once each", () => {
    expect(parseFingerprints(`${A.toLowerCase()}, ${B}`)).toEqual([A, B]);
    expect(parseFingerprints(`${A} ${A}`)).toEqual([A]);
  });

  it("drops what isn't a SHA-256 fingerprint", () => {
    expect(parseFingerprints(undefined)).toEqual([]);
    expect(parseFingerprints("")).toEqual([]);
    expect(parseFingerprints("AB:CD, not-a-key")).toEqual([]);
    expect(parseFingerprints(A.replace(/:/g, ""))).toEqual([]);
  });
});

describe("assetLinks", () => {
  it("vouches for the app with its fingerprints", () => {
    expect(assetLinks([A, B])).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: [A, B] },
      },
    ]);
  });

  it("vouches for nothing without a fingerprint", () => {
    expect(assetLinks([])).toEqual([]);
  });
});

describe("isAndroidAppLaunch", () => {
  it("is the app's start URL or Chrome's android-app referrer", () => {
    expect(isAndroidAppLaunch("?source=twa", "")).toBe(true);
    expect(isAndroidAppLaunch("", `android-app://${ANDROID_PACKAGE}/`)).toBe(true);
    expect(isAndroidAppLaunch("?source=pwa", "https://mystonie.com/")).toBe(false);
    expect(isAndroidAppLaunch("", "android-app://com.other.app/")).toBe(false);
  });
});
