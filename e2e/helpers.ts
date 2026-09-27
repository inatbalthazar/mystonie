import { expect, type APIRequestContext, type Page } from "@playwright/test";

// Sign-in runs against the local Supabase stack (`pnpm db:start`) and reads emails from its Mailpit inbox.
// The send-email hook calls http://host.docker.internal:3000, so these need `pnpm dev` on port 3000.
export const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export async function mailpitUp(request: APIRequestContext): Promise<boolean> {
  return request
    .get(`${MAILPIT}/api/v1/info`, { timeout: 2000 })
    .then((r) => r.ok())
    .catch(() => false);
}

/** The newest email to `to`, polled until it arrives. */
export async function lastEmail(request: APIRequestContext, to: string): Promise<{ Subject: string; Text: string }> {
  for (let i = 0; i < 30; i++) {
    const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${to}"` } });
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    if (messages[0]) return (await request.get(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json();
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no email to ${to}`);
}

export const uniqueEmail = (tag: string) => `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

/** Signs up a new account with the English email-code flow and lands on `next`. */
export async function signUp(page: Page, request: APIRequestContext, tag: string, next = "/collection"): Promise<string> {
  const email = uniqueEmail(tag);
  await page.goto(`/auth?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  const code = (await lastEmail(request, email)).Subject.match(/^(\d{6,10}) /)?.[1];
  expect(code).toBeTruthy();
  await page.getByLabel("Code from the email").fill(code!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`));
  return email;
}

// Local Supabase keys for seeding test data (never real secrets: `pnpm db:start` prints them).
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // no .env.local: seeding tests skip
  }
}

export const canSeed = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export type SeedTitle = { kind: "movie" | "series"; externalId: string; name: string; year: number; posterPath: string | null; runtimeMin: number };

/** Caches titles in the local `titles` table, so adding them never needs TMDB. */
export async function seedTitles(request: APIRequestContext, titles: SeedTitle[]): Promise<void> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/titles?on_conflict=source,kind,external_id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "resolution=merge-duplicates" },
    data: titles.map((t) => ({
      source: "tmdb",
      kind: t.kind,
      external_id: t.externalId,
      name: t.name,
      year: t.year,
      poster_path: t.posterPath,
      runtime_min: t.runtimeMin,
      fetched_at: new Date().toISOString(),
    })),
  });
  expect(res.ok(), await res.text()).toBe(true);
}

/** Answers the page's /api/search with these titles (matching the query), without TMDB. */
export async function mockSearch(page: Page, titles: SeedTitle[]): Promise<void> {
  await page.route(
    (url) => url.pathname === "/api/search",
    (route) => {
      const q = (new URL(route.request().url()).searchParams.get("q") ?? "").toLowerCase();
      const words = q.split(/\s+/).filter(Boolean);
      const results = titles
        .filter((t) => words.every((w) => t.name.toLowerCase().includes(w)))
        .map((t) => ({
          source: "tmdb",
          externalId: t.externalId,
          kind: t.kind,
          name: t.name,
          year: t.year,
          imageUrl: t.posterPath ? `https://image.tmdb.org/t/p/w342${t.posterPath}` : undefined,
        }));
      return route.fulfill({ json: { results } });
    },
  );
}

/** Caches an ended series and its episodes (all aired in 2020) locally, so its page never calls TMDB. */
export async function seedSeries(
  request: APIRequestContext,
  series: { externalId: string; name: string; seasons: number[] },
): Promise<void> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const now = new Date().toISOString();
  const title = await request.post(`${base}/rest/v1/titles?on_conflict=source,kind,external_id`, {
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
    data: {
      source: "tmdb",
      kind: "series",
      external_id: series.externalId,
      name: series.name,
      year: 2020,
      runtime_min: 45,
      episode_count: series.seasons.reduce((a, b) => a + b, 0),
      season_count: series.seasons.length,
      raw: { status: "Ended" },
      fetched_at: now,
    },
  });
  expect(title.ok(), await title.text()).toBe(true);
  const [{ id }] = (await title.json()) as { id: string }[];
  const episodes = series.seasons.flatMap((count, i) =>
    Array.from({ length: count }, (_, e) => ({
      title_id: id,
      season: i + 1,
      episode: e + 1,
      name: `Episode ${e + 1}`,
      runtime_min: 45,
      air_date: `2020-0${i + 1}-${String(e + 1).padStart(2, "0")}`,
      fetched_at: now,
    })),
  );
  const res = await request.post(`${base}/rest/v1/title_episodes?on_conflict=title_id,season,episode`, {
    headers: { ...headers, Prefer: "resolution=merge-duplicates" },
    data: episodes,
  });
  expect(res.ok(), await res.text()).toBe(true);
}

type PushDevice = { subscription: { endpoint: string; keys: { p256dh: string; auth: string } }; privateKey: string };
type PushDelivery = { headers: Record<string, string>; message: () => Promise<{ title: string; body: string; url: string; tag?: string }> };

/**
 * A local stand-in for the browsers' push services (ADR 0028; the dev server accepts http://127.0.0.1 endpoints
 * outside production). `device(name)` is a subscription as a browser would make it; the endpoint answers 201,
 * or 410 for a device named "gone". `received(name)` decrypts what was pushed to it, like the browser would.
 */
export async function fakePushService() {
  const { createServer } = await import("node:http");
  const { decryptPushPayload, toBase64Url } = await import("../src/core/push");
  const devices = new Map<string, PushDevice>();
  const deliveries = new Map<string, { headers: Record<string, string>; body: Buffer }[]>();
  const server = createServer((req, res) => {
    const name = (req.url ?? "").split("/").pop()!;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      deliveries.set(name, [...(deliveries.get(name) ?? []), { headers: req.headers as Record<string, string>, body: Buffer.concat(chunks) }]);
      res.writeHead(name.startsWith("gone") ? 410 : 201).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const run = Date.now().toString(36);

  // Browsers make a P-256 key pair and a 16-byte secret per subscription.
  for (const name of ["ok", "gone"]) {
    const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
    const p256dh = toBase64Url(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
    const { d } = await crypto.subtle.exportKey("jwk", pair.privateKey);
    devices.set(name, {
      subscription: { endpoint: `http://127.0.0.1:${port}/push/${name}-${run}`, keys: { p256dh, auth: toBase64Url(crypto.getRandomValues(new Uint8Array(16))) } },
      privateKey: d!,
    });
  }

  return {
    device: (name: "ok" | "gone") => devices.get(name)!,
    received: (name: "ok" | "gone"): PushDelivery[] => {
      const device = devices.get(name)!;
      return (deliveries.get(`${name}-${run}`) ?? []).map(({ headers, body }) => ({
        headers,
        message: async () => JSON.parse(new TextDecoder().decode(await decryptPushPayload(new Uint8Array(body), device.subscription.keys, device.privateKey))),
      }));
    },
    /** Endpoints of this run the database still holds. */
    stored: async (): Promise<string[]> => {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/push_subscriptions?select=endpoint&endpoint=like.*-${run}&order=endpoint`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      return ((await res.json()) as { endpoint: string }[]).map((r) => r.endpoint);
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
