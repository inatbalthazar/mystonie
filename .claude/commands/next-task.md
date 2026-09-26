---
description: Pick the next unchecked roadmap task and implement it end to end
argument-hint: "[optional task text or stage, e.g. S1]"
---

Implement one roadmap task for Mystonie, following AGENTS.md.

1. Read `docs/roadmap.md`. If `$ARGUMENTS` is given, pick the matching task. Otherwise pick the first unchecked `[ ]` task of the **current stage** that is not marked 🧑 (owner task). Don't move to a later stage while the current one has unchecked agent tasks. Tell me which task you picked.
2. Read `docs/product/vision.md`, the spec the task links to, and only the architecture docs and ADRs it touches. Check `docs/open-questions.md`. If a blocking question has no default, stop and ask me.
3. Plan briefly, then implement the smallest change that satisfies the acceptance criteria. Respect the hard rules and "Where code goes" in AGENTS.md: English-first i18n, pure `src/core`, API keys server-side, cards rendered in the browser.
4. Add or update tests, then run lint, typecheck and tests.
5. Update docs in the same change: tick the roadmap box, update the spec or data model if behaviour or schema changed, and add an ADR for any choice between alternatives.
6. Summarize (in Thai) what changed, what's verified, and anything left open. Don't commit unless I ask.
