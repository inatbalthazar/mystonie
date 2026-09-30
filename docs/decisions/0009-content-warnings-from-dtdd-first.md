# ADR 0009: Content warnings from the DoesTheDogDie API first

**Status:** Accepted · **Date:** 2026-09-23 · Our own timestamped warnings and the quiz were built in stage 3: [ADR 0043](0043-scene-warnings-and-quiz.md)

## Context
Content warnings are a differentiator, but a community verification system (votes, thresholds, quizzes) needs thousands of active users before its data is trustworthy, and wrong data can hurt sensitive users. The owner asked to use an existing API for warning tags first, after the core features.

## Decision
- In stage 2, show warnings from the **DoesTheDogDie (DTDD) API**: its topic list and per-title yes/no community votes, for the topics each user chooses to avoid.
- Calls are server-side only, cached in `title_warnings` (≥ 7 days) and credited with a link back to DTDD.
- Provider sits behind a `WarningsProvider` interface so our own community data can be merged later.
- Our own timestamped, community-verified warnings and the quiz system stay **later** ([product/later](../product/later/README.md)).

## Consequences
- Warnings are available with zero community size.
- DTDD data is mostly yes/no per topic. Episode/timestamp precision comes only with our later system.
- Dependency risk: API terms may change. Mitigated by the cache + interface. Verify DTDD terms (including commercial use) before launch of Pro.
