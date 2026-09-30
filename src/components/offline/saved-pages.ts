"use client";

// Pages and posters the service worker saved for offline use (public/sw.js). They show the signed-in person's data, so
// they go when that person signs out or someone else signs in on this device (S3 offline, ADR 0042).

/** Deletes the saved pages and posters; the app's own files (the same for everyone) stay. */
export async function clearSavedPages() {
  if (!("caches" in window)) return;
  const names = await caches.keys().catch(() => [] as string[]);
  await Promise.all(names.filter((name) => /^mystonie-(pages|images)-/.test(name)).map((name) => caches.delete(name)));
}
