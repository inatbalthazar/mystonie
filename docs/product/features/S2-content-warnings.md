# S2 · Content warnings (from the DoesTheDogDie API)

**Stage:** 2 (first item) · Our own community system with timestamps and quizzes is **later**, see [later/crowdsourced-warnings.md](../later/crowdsourced-warnings.md) · Decision: [ADR 0009](../../decisions/0009-content-warnings-from-dtdd-first.md)

## Summary
Users pick the topics they want to avoid (e.g. *a dog dies*, *jump scares*, *sexual content*, *flashing lights*, *spiders*). Title pages and cards then show warnings for those topics, using the existing community data from **DoesTheDogDie (DTDD)**.

## Behaviour
- **Settings → Warnings:** choose avoid-topics from the DTDD topic list (grouped by category, searchable). Default: none (the feature is opt-in).
- **Title page:** a "Content warnings" section:
  - For each avoid-topic: **Yes / No / Unclear** based on DTDD yes/no vote counts, e.g. "Yes · 142 yes / 3 no".
  - Other topics are collapsed under "See all topics".
  - Details are **spoiler-free by default**. Comments are hidden behind a tap.
  - Credit line: "Warnings from DoesTheDogDie.com" with a link to the title on DTDD.
- **Cards and search results:** a small warning badge when a title has a "Yes" for one of the user's avoid-topics.
- **Survived Card:** for titles where DTDD says "jump scares: yes" (or similar), the finish celebration offers a Survived template ("Survived the jump scares 👻"). Counts or timestamps are only shown if the data provides them.

## Rules
- **DTDD is called server-side only** (route handler) with `DTDD_API_KEY`. Verify endpoints, rate limits, attribution and commercial-use terms against DTDD's current API docs **before** implementation. Record the findings in [external-apis](../../architecture/external-apis.md).
- **Matching:** match a DTDD media item to our `titles` row by TMDB/IMDb id if the API returns one. Otherwise match by title + year + type, and store the matched `dtdd_id` on the title. Ambiguous matches are not shown.
- **Cache** DTDD responses in `title_warnings` with `fetched_at`. Refresh when older than 7 days on view (stale-while-revalidate). Never call DTDD from the client.
- **"Yes" rule** (config): yes votes ≥ 3 and yes > no → Yes. no ≥ 3 and no > yes → No. Otherwise Unclear.
- Put the provider behind an interface (`WarningsProvider`) so our own community data can be merged later.
- Avoid-topic settings live in our DB (`user_avoid_topics`), keyed by DTDD topic id.

## Acceptance criteria
- [ ] A user who avoids "a dog dies" sees a badge on a title where DTDD shows yes, with vote counts and the DTDD credit.
- [ ] A second view within 7 days makes no DTDD request (cache hit).
- [ ] An unmatched title shows "No warning data yet" and no badge.
- [ ] No DTDD key or request appears in client bundles or network calls from the browser.

## Data
`titles.dtdd_id`, `title_warnings` (title_id, topic_id, topic_name, yes_count, no_count, fetched_at), `user_avoid_topics`.
