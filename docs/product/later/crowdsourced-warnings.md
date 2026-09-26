# F05 · Content warnings (doesthedogdie-style)

> **Status: LATER (gated).** Not part of the current plan. See [later/README.md](README.md) for the gate. Written before the global, solo-sized plan: re-check against AGENTS.md before building.

**Phase:** M4 · **Priority:** Core differentiator

## Summary
Users choose the content they want to avoid (e.g. sex scene, pet death, jumpscare, specific phobias). Title pages then show **verified** warnings for those tags, with **episode and timestamp** when known. The data starts from doesthedogdie (DTDD) where licensing allows, then grows through **crowdsourcing** with up/down votes and a **verification threshold**.

## User stories
- As a sensitive viewer, I pick my avoid-tags once and see warning badges on any title that contains them.
- As a viewer, I see *where* it happens (S02E05 · 00:41:10–00:42:30) so I can skip it.
- As a community member, I submit a warning with a timestamp, or vote on existing ones.

## Rules
- Tags are data, not code: the `warning_tags` table can be extended or retired anytime by admins (slug, name_th, name_en, category, is_active).
- A **warning** = (title, tag, optional season/episode, optional start/end seconds, optional chapter/page for books, note, created_by).
- Votes: one vote per user per warning, `+1` confirm / `-1` dispute. Users may change their vote.
- **Verification threshold:** a warning becomes `verified` when confirmations ≥ **5** and confirmations > disputes. The threshold is a config value. Only verified warnings show on main pages and as badges. Unverified ones appear in a "needs confirmation" section and feed [F15 quiz](quiz.md).
- Status transitions MUST happen on the server (DB function/trigger), never by the client setting a status.
- Quiz answers (F15) count as confirmations/disputes for the same warning.
- Seed data from DTDD: import only if the API terms allow it (see [open questions](../../open-questions.md)). Mark imported rows `source = 'dtdd'`.
- Users MUST only vote on titles they have marked finished (reduces noise). *(Proposed. Confirm in open questions.)*

## Acceptance criteria
- [ ] User can set avoid-tags in settings, and badges appear on title cards and detail pages for matching verified warnings.
- [ ] Submitting a warning with S/E + timestamp works for TV. Movies use a timestamp only, books a chapter/page.
- [ ] The 5th confirming vote flips status to `verified` (DB test).
- [ ] A client cannot set `status` directly (RLS/policy test).

## Data
`warning_tags`, `warnings`, `warning_votes`, `user_avoid_tags`.
