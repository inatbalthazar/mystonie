# ADR 0045: The pre-watch check: a verdict on every title page, a family set of our own topics, DTDD looked up only from title pages

**Status:** Accepted · **Date:** 2026-09-30

## Context
The owner's note of 2026-09-30 ([brief appendix D](../brief.th.md), roadmap stage 4): the real goal of avoid-topics is "is this safe to watch with my family?", before pressing play. What was built for it ([S2 content warnings](../product/features/S2-content-warnings.md), [S3 warnings & quiz](../product/features/S3-warnings-quiz.md)) answered it only in pieces:
- The title page listed DTDD's votes per topic, but no single answer, and books, manga and games showed only our scene warnings, lower down.
- Someone with no avoid-topics saw an invitation to choose from DTDD's ~290 English topics.
- Search badges come from the cache, so a title nobody opened has none.

DTDD's free tier allows 30 requests a minute and 5,000 a month ([external APIs](../architecture/external-apis.md)).

## Decision
**A verdict on top of every title page** (`TitleCheck`, `titleCheck` in `src/core/warnings.ts`), for every kind:
- **Hits:** "2 of your topics: a dog dies and jump scares", each with its source (DTDD's counts, "Confirmed on Mystonie").
- **Clear:** DTDD knows the title and nothing hits: "Nothing from your avoid list", and how sure (how many of the topics people said No to, the rest without enough votes).
- **Unknown:** no DTDD data (not matched, DTDD down, or a book, manga or game) and none of our own hits.
- Sources: DTDD's votes by the existing rule (yes ≥ 3 and yes > no), and our confirmed scene warnings and quiz "yes" answers. The movie and series page shares one DTDD lookup between the verdict and the warnings block below it (`titleWarnings` wrapped in React `cache`).

**The family set:** one tap ("Check for family viewing") saves 12 avoid-topics for someone who has none, on the title page and in Settings. They are our own topics (dog and animal deaths, jump scares, gore, gun violence, torture, sexual assault, suicide, self-harm, child abuse, sex scenes, drug use), so books, manga and games can answer them too, and they are named in the viewer's language.
- Rejected: asking people to pick first. The DTDD list is long and English only; the question people have is simpler.

**DTDD is looked up only from title pages**, as before: opening a title from search already checks it. Search badges and the Want-to-watch check stay cache-only.
- Rejected: looking up every search result. A page of 20 results would use 20 of the 30-a-minute and 5,000-a-month quota at each search.

**Want to watch:** a quiet check sticker ("Checked: nothing from your avoid list") on a Want poster DTDD knows with no badge. Titles nobody opened have neither sticker, so no sticker never means clear.

## Consequences
- The avoid-topics are the same `user_avoid_topics` rows, so the badges, the Survived card and the quiz are unchanged. No schema change.
- A title's first check spends one DTDD request, as the title page did before.
