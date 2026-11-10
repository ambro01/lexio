---
change_id: openrouter-generation-spike
title: Prove OpenRouter flashcard generation on the deployed app (< 60 s)
status: archived
created: 2026-11-03
updated: 2026-11-10
archived_at: 2026-11-10T22:41:54Z
---

## Notes

Roadmap F-01 (`context/foundation/roadmap.md`). The deployed Worker sends lesson text (up to 2,000 words) to an AI model through OpenRouter and gets structured flashcard proposals back within 60 s; the API key stays a server-side secret. Three selectable models are kept in app config (cut from five after the production measurement — see measurements.md). Unlocks S-01 and S-04.
