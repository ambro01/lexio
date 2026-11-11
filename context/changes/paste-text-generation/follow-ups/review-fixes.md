# Review follow-ups: paste-text-generation

From `reviews/impl-review.md` (2026-11-11).

## F2 — Duplicate outcome rows on a repeated accept (for S-07)

- **Risk accepted in S-01.** `accept_proposal_set` creates `set_id` on the server, so an accept repeated after a lost response, or from a second tab, writes every `proposal_outcomes` row again (the cards merge harmlessly).
- **Before S-07 computes the acceptance rate:**
  - Have the client send a `draftId` (UUID created in `createDraft`) and store it with the outcome rows (a new migration).
  - De-duplicate on it, or make the accept repeat-safe so a repeat returns the earlier counts.
- **Caveat:** rows written before then have no draft id. Decide whether to ignore possible duplicates there or de-duplicate heuristically (same user, same word_key, same tag, a few seconds apart).
