// The Android app (ADR 0097): a Trusted Web Activity of mystonie.com, built with Bubblewrap from `android/`. Chrome
// shows the site full screen, without its address bar, only when the site vouches for the app in
// `/.well-known/assetlinks.json` with the SHA-256 fingerprints of the certificates that sign it.

/** The app's id on Google Play. It can never change once published. */
export const ANDROID_PACKAGE = "com.mystonie.app";

/** Where the Android app opens (the manifest's start_url, marked so the site knows it's the app). */
export const ANDROID_START_URL = "/home?source=twa";

/** A certificate's SHA-256 fingerprint as keytool and Play Console print it: 32 hex bytes joined by colons. */
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/**
 * The fingerprints from `ANDROID_CERT_SHA256` (comma or space separated, upper-cased; bad ones dropped). Usually two:
 * the upload key's, and Play App Signing's from Play Console.
 */
export function parseFingerprints(value: string | undefined): string[] {
  const all = (value ?? "")
    .split(/[\s,]+/)
    .map((v) => v.trim().toUpperCase())
    .filter((v) => FINGERPRINT.test(v));
  return [...new Set(all)];
}

/** The Digital Asset Links statement: empty (no app vouched for) until a fingerprint is set. */
export function assetLinks(fingerprints: readonly string[], packageName: string = ANDROID_PACKAGE) {
  if (fingerprints.length === 0) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: [...fingerprints] },
    },
  ];
}

/**
 * Opened inside the Android app: its first page comes with `?source=twa` or Chrome's `android-app://<package>`
 * referrer. Later pages in the same app session carry neither, so the browser side remembers it.
 */
export function isAndroidAppLaunch(search: string, referrer: string): boolean {
  return new URLSearchParams(search).get("source") === "twa" || referrer.startsWith(`android-app://${ANDROID_PACKAGE}`);
}
