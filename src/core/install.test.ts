import { describe, expect, it } from "vitest";
import { installWay, isInAppBrowser, quietForInstall } from "./install";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_INSTAGRAM = `${IPHONE_SAFARI.replace(" Safari/604.1", "")} Instagram 350.0.0.0 (iPhone15,2; iOS 18_0; en_US)`;
const IPHONE_FACEBOOK = `${IPHONE_SAFARI.replace(" Safari/604.1", "")} [FBAN/FBIOS;FBAV/480.0.0]`;
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const ANDROID_LINE = `${ANDROID_CHROME} Line/14.0.0`;
const ANDROID_WEBVIEW = "Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36";
const MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

const phone = { standalone: false, promptReady: false, touch: true, robot: false };

describe("installWay", () => {
  it("uses the browser's own dialog when it's ready", () => {
    expect(installWay({ ...phone, ua: ANDROID_CHROME, promptReady: true })).toBe("prompt");
  });

  it("shows Safari's Share steps on an iPhone and on an iPad that says it's a Mac", () => {
    expect(installWay({ ...phone, ua: IPHONE_SAFARI })).toBe("ios");
    expect(installWay({ ...phone, ua: MAC_SAFARI, platform: "MacIntel", maxTouchPoints: 5 })).toBe("ios");
  });

  it("points Android browsers without the dialog (yet) at their menu", () => {
    expect(installWay({ ...phone, ua: ANDROID_CHROME })).toBe("menu");
  });

  it("sends people in an app's browser out to the real one first", () => {
    for (const ua of [IPHONE_INSTAGRAM, IPHONE_FACEBOOK, ANDROID_LINE, ANDROID_WEBVIEW]) {
      expect(installWay({ ...phone, ua })).toBe("in_app");
    }
  });

  it("asks nobody who has it installed, is on a computer, or is a robot", () => {
    expect(installWay({ ...phone, ua: IPHONE_SAFARI, standalone: true })).toBe("none");
    expect(installWay({ ...phone, ua: ANDROID_CHROME, promptReady: true, robot: true })).toBe("none");
    expect(installWay({ ...phone, ua: MAC_SAFARI, touch: false })).toBe("none");
  });
});

describe("isInAppBrowser", () => {
  it("leaves the real browsers alone", () => {
    expect(isInAppBrowser(IPHONE_SAFARI)).toBe(false);
    expect(isInAppBrowser(ANDROID_CHROME)).toBe(false);
  });
});

describe("quietForInstall", () => {
  it("stays quiet while signing in and on utility pages, in any locale", () => {
    expect(quietForInstall("/auth", ["en", "th"])).toBe(true);
    expect(quietForInstall("/th/auth/confirm", ["en", "th"])).toBe(true);
    expect(quietForInstall("/unsubscribe", ["en", "th"])).toBe(true);
    expect(quietForInstall("/", ["en", "th"])).toBe(false);
    expect(quietForInstall("/th", ["en", "th"])).toBe(false);
    expect(quietForInstall("/c/0192abcd", ["en", "th"])).toBe(false);
    expect(quietForInstall("/authors", ["en", "th"])).toBe(false);
  });
});
