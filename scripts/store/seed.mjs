// The demo world for the store screenshots: Maya's year of shows, movies, books, manga and games, and four friends.
// Everything goes through the app's own API (so stickers, rare finishes, caches and the Atlas come out the way the
// app makes them), and the old demo accounts are deleted first.
import { admin, api, BASE, clearRateLimits, demoUsers, emailOf, PEOPLE, session, uuidv7 } from "./lib.mjs";

const SOURCE = { movie: "tmdb", series: "tmdb", book: "google_books", manga: "anilist", game: "rawg" };

// Maya's year, as dates in 2026; they're stretched over this year so far (2 January to yesterday), so "This year"
// stays full whenever this runs.
const now = Date.now();
const year = new Date(now).getUTCFullYear();
const span = [Date.UTC(year, 0, 2), now - 86400e3];
const REF = [Date.UTC(2026, 0, 2), Date.UTC(2026, 9, 2)];
const at = (date, hour = 21) => {
  const f = (Date.parse(`${date}T${String(hour).padStart(2, "0")}:30:00Z`) - REF[0]) / (REF[1] - REF[0]);
  return new Date(Math.min(span[0] + f * (span[1] - span[0]), now - 3600e3)).toISOString();
};
const daysAgo = (days, hour = 20) => new Date(now - days * 86400e3 + (hour - 12) * 3600e3).toISOString();
const hoursAgo = (h) => new Date(now - h * 3600e3).toISOString();

// [external id, finished, rating, review]
const MOVIES = [
  ["496243", "2026-01-10", 5, "Rewatched it and still gasped at the same moment. Those stairs."], // Parasite
  ["129", "2026-01-24", 5], // Spirited Away
  ["194", "2026-02-07", 4], // Amélie
  ["1417", "2026-02-21", 4.5], // Pan's Labyrinth
  ["598", "2026-03-07", 4.5], // City of God
  ["579974", "2026-03-14", 4, "Three hours went by like nothing. Naatu Naatu lives in my head now."], // RRR
  ["915935", "2026-03-28", 4.5], // Anatomy of a Fall
  ["372058", "2026-04-11", 4.5], // Your Name.
  ["426426", "2026-04-25", 4], // Roma
  ["758866", "2026-05-09", 4], // Drive My Car
  ["531428", "2026-05-23", 5, "Every frame is a painting. That last shot!"], // Portrait of a Lady on Fire
  ["660120", "2026-06-06", 4], // The Worst Person in the World
  ["76341", "2026-06-20", 4.5], // Mad Max: Fury Road
  ["346648", "2026-07-04", 5, "Perfect film. No notes. Marmalade forever."], // Paddington 2
  ["354912", "2026-07-11", 4.5], // Coco
  ["120", "2026-07-18", 5], // The Fellowship of the Ring
  ["1022789", "2026-07-25", 4], // Inside Out 2
  ["872585", "2026-08-08", 4], // Oppenheimer
  ["346698", "2026-08-09", 3.5], // Barbie
  ["545611", "2026-08-22", 5, "Hot dog fingers made me cry. Somehow."], // Everything Everywhere All at Once
  ["693134", "2026-09-05", 4.5], // Dune: Part Two
  ["976893", "2026-09-19", 5, "The quietest movie I've seen all year, and the one I keep thinking about."], // Perfect Days
  ["666277", "2026-10-01", 5, "In-yun. Sat through the whole credits in silence."], // Past Lives
];
// [external id, started, finished, rating, review]
const SERIES = [
  ["93405", "2026-01-02", "2026-01-08", 4.5], // Squid Game
  ["70523", "2026-02-01", "2026-02-19", 5, "Drew the family tree on a napkin by episode four. Worth it."], // Dark
  ["67070", "2026-03-02", "2026-03-06", 5], // Fleabag
  ["94605", "2026-04-01", "2026-04-14", 5], // Arcane
  ["96677", "2026-05-01", "2026-05-12", 4], // Lupin
  ["241259", "2026-05-15", "2026-05-18", 4.5], // Baby Reindeer
  ["95396", "2026-06-01", "2026-06-24", 5, "I need season three yesterday."], // Severance
  ["71446", "2026-07-01", "2026-07-30", 4], // Money Heist
  ["136315", "2026-08-01", "2026-08-28", 4.5, "Yes, chef."], // The Bear
  ["94796", "2026-09-01", "2026-09-16", 4.5], // Crash Landing on You
];
const BOOKS = [
  ["-Ff2DwAAQBAJ", "2026-02-02", "2026-02-15", 5, "Rocky is the best friend in all of fiction."], // Project Hail Mary
  ["u7XrDwAAQBAJ", "2026-04-03", "2026-04-16", 4], // Klara and the Sun
  ["5oFjDwAAQBAJ", "2026-06-10", "2026-06-13", 4], // Convenience Store Woman
  ["63fYDwAAQBAJ", "2026-08-03", "2026-08-14", 3.5], // The Midnight Library
  ["LbOfEAAAQBAJ", "2026-09-05", "2026-09-27", 5], // Pachinko
];
const MANGA = [
  ["105778", "2026-03-10", "2026-03-22", 4.5], // Chainsaw Man
  ["108556", "2026-07-05", "2026-07-20", 4.5], // SPY x FAMILY
];
// [external id, finished, rating, hours played, review]
const GAMES = [
  ["274755", "2026-01-30", 5, 42, "One more run. One more run. One more run."], // Hades
  ["654", "2026-03-31", 4.5, 60], // Stardew Valley
  ["9767", "2026-05-28", 4.5, 38], // Hollow Knight
  ["455597", "2026-08-16", 4.5, 14, "Beat it with my sister. Still friends. Mostly."], // It Takes Two
  ["327239", "2026-09-12", 5, 96], // Tears of the Kingdom
];
// Where Maya has been, and where she wants to go next.
const PLACES = [["JP", "been", 2019], ["KR", "been", 2023], ["FR", "been", 2018], ["IT", "been", 2022], ["ES", "been", 2024], ["PT", "been", 2025],
  ["GB", "lived", 2020], ["US", "been", 2017], ["MX", "been", 2024], ["MA", "been", 2025], ["TH", "been", 2023], ["IS", "been", year],
  ["NZ", "want"], ["PE", "want"], ["NO", "want"]];
// Friends' finishes: [kind, external id, hours ago, rating, review, hours played]
const FRIENDS = {
  leo: [["movie", "693134", 2, 4.5, "Saw it in IMAX again. The sandworm ride still gets me."], ["game", "274755", 70, 5, null, 31], ["series", "95396", 130, 4.5], ["movie", "496243", 330, 5]],
  sana: [["manga", "118586", 5, 5, "Fern and Stark's chapter had me grinning on the train."], ["movie", "372058", 28, 4.5, "Cried at the same scene. Every. Time."], ["movie", "976893", 100, 5]],
  kofi: [["series", "94605", 9, 5, "That finale. I need a minute."], ["game", "654", 50, 4.5, null, 120], ["series", "136315", 150, 4]],
  lucia: [["book", "LbOfEAAAQBAJ", 20, 4.5, "A whole century in one family. Loved every page."], ["movie", "354912", 75, 5], ["movie", "426426", 170, 4.5]],
};

export async function seed() {
  for (const [key, id] of Object.entries(await demoUsers())) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(`delete ${key}: ${error.message}`);
  }
  await clearRateLimits();

  const ids = {};
  const jars = {};
  for (const p of PEOPLE) {
    const { data, error } = await admin.auth.admin.createUser({ email: emailOf(p.key), email_confirm: true, user_metadata: { locale: "en", time_zone: p.tz } });
    if (error) throw new Error(`${p.key}: ${error.message}`);
    ids[p.key] = data.user.id;
    const { error: profileError } = await admin.from("profiles").update({
      username: p.username, display_name: p.name, bio: p.bio, time_zone: p.tz, country: p.country,
      visibility: "public", atlas_public: true, locale: "en",
      created_at: new Date(Date.UTC(year - 1, 11, p.key === "maya" ? 27 : 30, 12)).toISOString(),
    }).eq("id", data.user.id);
    if (profileError) throw new Error(`profile ${p.key}: ${profileError.message}`);
    jars[p.key] = await session(emailOf(p.key));
  }

  const add = async (who, kind, externalId, status, finishedAt) =>
    (await api(jars[who], "POST", "/api/entries", { id: uuidv7(), title: { source: SOURCE[kind], kind, externalId }, status, ...(finishedAt ? { finishedAt } : {}) })).entry;
  const notes = (who, entryId, rating, review, hoursPlayed) =>
    api(jars[who], "PATCH", `/api/entries/${entryId}`, { rating: rating ?? null, review: review ?? null, ...(hoursPlayed ? { hoursPlayed } : {}) });
  const titleRow = async (kind, externalId) => {
    const { data, error } = await admin.from("titles").select("id, page_count, chapter_count").eq("source", SOURCE[kind]).eq("kind", kind).eq("external_id", externalId).single();
    if (error) throw new Error(`title ${kind} ${externalId}: ${error.message}`);
    return data;
  };
  // A series' aired episodes (or the first `upTo`), in evening sessions from `from` to `to`.
  const watch = async (externalId, from, to, upTo = Infinity) => {
    await api(jars.maya, "POST", "/api/episodes", { externalId, episodes: [{ id: uuidv7(), season: 1, episode: 1 }], watchedAt: from });
    const { id } = await titleRow("series", externalId);
    const today = new Date(now).toISOString().slice(0, 10);
    const { data } = await admin.from("title_episodes").select("season, episode, air_date").eq("title_id", id).gte("season", 1).order("season").order("episode");
    const aired = data.filter((e) => e.air_date && e.air_date <= today).slice(0, upTo);
    const [t0, t1] = [Date.parse(from), Date.parse(to)];
    const per = Math.ceil(aired.length / Math.min(aired.length, Math.max(1, Math.round((t1 - t0) / 86400e3)) + 1));
    const chunks = [];
    for (let i = 0; i < aired.length; i += per) chunks.push(aired.slice(i, i + per));
    for (const [i, chunk] of chunks.entries()) {
      const watchedAt = new Date(t0 + (chunks.length > 1 ? (i / (chunks.length - 1)) * (t1 - t0) : 0)).toISOString();
      await api(jars.maya, "POST", "/api/episodes", { externalId, episodes: chunk.map((e) => ({ id: uuidv7(), season: e.season, episode: e.episode })), watchedAt });
    }
  };
  const read = (kind, externalId, unit, steps) =>
    steps.reduce((p, [position, readAt]) => p.then(() => api(jars.maya, "POST", "/api/reading", { id: uuidv7(), kind, externalId, unit, position, readAt })), Promise.resolve());

  const finished = {};
  for (const [id, date, rating, review] of MOVIES) {
    const entry = await add("maya", "movie", id, "finished", at(date));
    await notes("maya", entry.id, rating, review);
    finished[id] = entry.id;
  }
  for (const [id, from, to, rating, review] of SERIES) {
    await watch(id, at(from, 20), at(to, 21));
    const entry = await add("maya", "series", id, "finished", at(to, 22));
    await notes("maya", entry.id, rating, review);
  }
  for (const [id, from, to, rating, review] of BOOKS) {
    await read("book", id, "page", [[40, at(from)]]);
    const pages = (await titleRow("book", id)).page_count ?? 320;
    await read("book", id, "page", [[Math.round(pages / 2), at(from, 22)], [pages, at(to)]]);
    const entry = await add("maya", "book", id, "finished", at(to, 22));
    await notes("maya", entry.id, rating, review);
    finished[id] = entry.id;
  }
  for (const [id, from, to, rating, review] of MANGA) {
    await read("manga", id, "chapter", [[12, at(from)]]);
    await read("manga", id, "chapter", [[(await titleRow("manga", id)).chapter_count ?? 97, at(to)]]);
    const entry = await add("maya", "manga", id, "finished", at(to, 22));
    await notes("maya", entry.id, rating, review);
  }
  for (const [id, date, rating, hours, review] of GAMES) {
    const entry = await add("maya", "game", id, "finished", at(date, 22));
    await notes("maya", entry.id, rating, review, hours);
  }

  // In progress and saved for later: Shōgun six episodes in, two books underway, Elden Ring, a watchlist.
  await watch("126308", daysAgo(9), daysAgo(1), 6);
  await read("book", "AfB8EAAAQBAJ", "page", [[64, daysAgo(5)], [212, daysAgo(1)]]);
  await read("manga", "118586", "chapter", [[40, daysAgo(13)], [98, daysAgo(1)]]);
  await add("maya", "game", "326243", "watching");
  for (const [kind, id] of [["movie", "6479"], ["movie", "493922"], ["series", "89905"], ["series", "19885"]]) await add("maya", kind, id, "want");

  for (const [country, status, firstYear] of PLACES) await api(jars.maya, "POST", "/api/places", { country, status, ...(firstYear ? { firstYear } : {}) });
  // A dog dies and jump scares (DoesTheDogDie topics): I Am Legend gets the pre-watch check.
  await api(jars.maya, "PUT", "/api/warnings/topics", { topicIds: [153, 161] });

  const theirs = {};
  for (const [who, list] of Object.entries(FRIENDS)) {
    for (const [kind, id, ago, rating, review, hours] of list) {
      const entry = await add(who, kind, id, "finished", hoursAgo(ago));
      await notes(who, entry.id, rating, review, hours);
      theirs[`${who}:${id}`] = entry.id;
    }
    await api(jars.maya, "POST", "/api/follows", { userId: ids[who], follow: true });
    await api(jars[who], "POST", "/api/follows", { userId: ids.maya, follow: true });
  }
  for (const who of ["leo", "sana", "kofi", "lucia"]) await api(jars[who], "POST", "/api/stamps", { entryId: finished["666277"], stamped: true });
  for (const who of ["sana", "lucia"]) await api(jars[who], "POST", "/api/stamps", { entryId: finished.LbOfEAAAQBAJ, stamped: true });
  await api(jars.maya, "POST", "/api/stamps", { entryId: theirs["leo:693134"], stamped: true });
  await api(jars.maya, "POST", "/api/stamps", { entryId: theirs["sana:118586"], stamped: true });

  // Titles cached long ago (for example by the e2e seeds) may lack posters or credits: fetch them again.
  const { data: stale } = await admin.from("titles").select("id, kind, external_id").eq("source", "tmdb").or("poster_path.is.null,credits.is.null")
    .in("id", (await admin.from("entries").select("title_id").in("user_id", Object.values(ids))).data.map((e) => e.title_id));
  for (const t of stale ?? []) {
    await admin.from("titles").update({ fetched_at: "2000-01-01T00:00:00Z" }).eq("id", t.id);
    await fetch(`${BASE}/api/titles/tmdb/${t.kind}/${t.external_id}`);
  }

  // Stickers and challenges, synced the way the app does after a finish.
  for (const who of Object.keys(jars)) await api(jars[who], "POST", "/api/milestones");
  const { data: badges } = await admin.from("user_badges").select("badge").eq("user_id", ids.maya);
  console.log(`seeded Maya and four friends; Maya has ${badges.length} stickers`);
}
