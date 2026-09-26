# F17 · Help chatbot (RAG)

> **Status: LATER (gated).** Not part of the current plan. See [later/README.md](README.md) for the gate. Written before the global, solo-sized plan: re-check against AGENTS.md before building.

**Phase:** M7 · **Priority:** Nice-to-have

## Summary
An in-app assistant that answers in Thai or English about:
1. **How to use Mystonie:** features, Gem rules, quiz rules, privacy, and store/orders FAQ (retrieved from help articles).
2. **The user's own collection:** "How many horror movies did I watch this year?", "What was the longest game I finished?"

## Architecture
- Edge Function `chat` calls **Claude** (use the latest model; see the `claude-api` skill when implementing) with retrieved context.
- **Help knowledge:** markdown help articles in `help_articles`, chunked and embedded into **pgvector** (`help_chunks`). Re-embedded when an article changes.
- **Collection questions:** don't embed user data. Give the model **tools** that call typed, RLS-scoped queries / `packages/core` stats (e.g. `get_stats(group, period)`, `search_my_entries(query)`). This keeps answers exact and private.
- The user's JWT is forwarded so every query runs under RLS as that user.

## Rules
- Answers MUST cite which help article they used (link).
- Never reveal other users' data. Never perform wallet/store actions: read-only tools only.
- Per-user rate limit and daily token budget (config). Show a friendly limit message.
- Log conversations (for quality) with a PDPA-compliant retention period. Users can clear their history.

## Acceptance criteria
- [ ] "How do I earn Gems?" answers from the Gem/quiz help article with a link.
- [ ] "How many books did I read in 2026?" matches the Stats page exactly.
- [ ] Asking about another user's collection is refused.
- [ ] Exceeding the daily budget returns the limit message, not an error.

## Data
`help_articles`, `help_chunks` (embedding vector), `chat_sessions`, `chat_messages`.
