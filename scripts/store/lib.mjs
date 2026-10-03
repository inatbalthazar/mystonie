// Shared helpers for the Play Store assets (brand/play-store/README.md, ADR 0090). They run against the LOCAL
// Supabase stack and a production build on :3100, never the remote project.
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const BASE = process.env.STORE_BASE_URL ?? "http://localhost:3100";
/** Raw captures (app screens, stickers, card exports); the finished assets go to brand/play-store. */
export const RAW = join(tmpdir(), "mystonie-store");
export const OUT = join(ROOT, "brand", "play-store");
export const LOCALES = ["en", "th"];

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) process.loadEnvFile(join(ROOT, ".env.local"));
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
// The demo accounts are made and deleted with the service role: only ever on this machine's stack.
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(SUPA)) {
  throw new Error("The store scripts run only against the local Supabase stack (pnpm db:start), not the remote project.");
}
export const admin = createClient(SUPA, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } });

/** The demo collector and her friends. Usernames are free on a fresh stack; the seed fails loudly if one is taken. */
export const PEOPLE = [
  { key: "maya", username: "maya", name: "Maya", tz: "Europe/London", country: "GB", bio: "Movies on Fridays, manga on the train, and always one more episode." },
  { key: "leo", username: "leo", name: "Leo", tz: "America/New_York", country: "US", bio: "Big screens, bigger snacks." },
  { key: "sana", username: "sana", name: "Sana", tz: "Asia/Tokyo", country: "JP", bio: "Manga first, anime later." },
  { key: "kofi", username: "kofi", name: "Kofi", tz: "Africa/Accra", country: "GH", bio: "Series marathons and cozy games." },
  { key: "lucia", username: "lucia", name: "Lucía", tz: "America/Mexico_City", country: "MX", bio: "Books, films, repeat." },
];
export const emailOf = (key) => `store-${key}@example.com`;

/** UI copy by key ("Collection.edit"), so the scripts click what the app says in either language. */
const MESSAGES = Object.fromEntries(LOCALES.map((l) => [l, JSON.parse(readFileSync(join(ROOT, "messages", `${l}.json`), "utf8"))]));
export const label = (locale, key, values = {}) =>
  key.split(".").reduce((o, k) => o?.[k], MESSAGES[locale]).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");

export function uuidv7() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  let ts = BigInt(Date.now());
  for (let i = 5; i >= 0; i--) {
    b[i] = Number(ts & 0xffn);
    ts >>= 8n;
  }
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** A signed-in cookie jar for `email`: a magic link made by the admin API, verified the way the app's client would. */
export async function session(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const jar = new Map();
  const ssr = createServerClient(SUPA, ANON, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach((c) => (c.value ? jar.set(c.name, c.value) : jar.delete(c.name))),
    },
  });
  const verified = await ssr.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (verified.error) throw verified.error;
  await new Promise((r) => setTimeout(r, 50));
  return jar;
}

export async function clearRateLimits() {
  const { error } = await admin.from("rate_limits").delete().neq("key", "");
  if (error) throw new Error(`rate_limits: ${error.message}`);
}

/** Calls the app's API as `jar`'s user; clears the local rate limits and tries once more on a 429. */
export async function api(jar, method, path, body, retry = true) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (res.status === 429 && retry) {
    await clearRateLimits();
    return api(jar, method, path, body, false);
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/** The demo accounts' auth ids, found by email (the seed deletes them before making them again). */
export async function demoUsers() {
  const wanted = new Set(PEOPLE.map((p) => emailOf(p.key)));
  const found = {};
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) if (wanted.has(u.email)) found[u.email.slice(6, -12)] = u.id;
    if (data.users.length < 1000) return found;
  }
}

export async function setLocale(username, locale) {
  const { error } = await admin.from("profiles").update({ locale }).eq("username", username);
  if (error) throw new Error(`locale: ${error.message}`);
}
