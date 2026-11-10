# Generation measurements — openrouter-generation-spike (F-01)

- **Date:** 2026-11-03
- **Target:** production, `https://lexio.rafalambro.workers.dev` (Cloudflare Workers Free plan)
- **Sample:** `scripts/fixtures/lesson-sample.txt` — 1,973 words of lesson-style English (article, dialogue, phrasal-verb list, grammar, exercise instructions)
- **Tool:** `npm run measure:generation` (one request per model, sequential, signed in as an existing account)
- **Budget:** < 60,000 ms wall-clock per generation

## Results — kept models

| Model                        | Status | Wall ms | Upstream ms | Proposals | Dropped | Prompt tok | Completion tok | Cost USD |
| ---------------------------- | ------ | ------- | ----------- | --------- | ------- | ---------- | -------------- | -------- |
| `anthropic/claude-haiku-5.5` | 200    | 13,870  | 13,720      | 39        | 0       | 4,428      | 2,945          | 0.0019   |
| `openai/gpt-6-luna`          | 200    | 31,939  | 31,710      | 49        | 0       | 2,774      | 3,544          | 0.0021   |
| `google/gemini-3.8-flash`    | 200    | 17,608  | 17,477      | 21        | 0       | 3,099      | 2,187          | 0.0105   |

The Worker adds about 150–230 ms on top of the OpenRouter call. CPU time is not a problem; the wait on `fetch()` doesn't count toward the 10 ms limit.

## Quality notes (first 10 proposals per model)

- **Claude Haiku 5.5:** correct Polish translations in the lesson's sense ("hand in — składać (wypowiedzenie)", "draw up — sporządzić (plan, dokument)"), useful additional meanings, natural example sentences. Picks phrasal verbs from the text. CEFR levels plausible, slightly high in places (allotment C1). Some inflected forms kept ("wilting" instead of "wilt").
- **GPT-6 Luna:** most proposals (49), good translations, keeps multi-word terms ("pension scheme"). Includes easier words (steady, generous) — more noise for B2 learners. Slowest at ~32 s, still within budget.
- **Gemini 3.8 Flash:** most selective (21), consistently uses base forms ("wilt"), rich additional meanings (e.g. "set aside — uchylać (wyrok)"). Most expensive per lesson (~5× the others).

## Dropped models

| Model                                        | Result                                       | Note                                                                          |
| -------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| `deepseek/deepseek-v4.1-flash`               | 502 after 23,359 ms                          | Upstream/output error; reason not captured (no log tail at that time).        |
| `mistralai/mistral-large-4-0`                | 502 after 74,375 ms                          | Over budget even before the error.                                            |
| `qwen/qwen3.8-flash` (replacement)           | 502 after 6,488 ms, then 504 after 90,000 ms | Unstable; second run hit the 90 s upstream timeout (seen in `wrangler tail`). |
| `mistralai/mistral-small-2603` (replacement) | not measured                                 | Run was cut short by a typo in `MODELS`; dropped together with Qwen.          |

## Decision

- **Kept models:** three (Claude Haiku 5.5, GPT-6 Luna, Gemini 3.8 Flash). The plan's "keep five" is relaxed by the user's decision: three working models are enough to prove the flow, and chasing more replacements is out of scope for the spike.
- **Default:** `anthropic/claude-haiku-5.5` — fastest (~14 s, a quarter of the budget), cheapest, good translation quality.
- **Streaming:** not needed — all kept models finish well under 60 s.
- **Follow-up (not in this change):** the three 502s were never diagnosed. If more models are needed later, run `npx wrangler tail` during measurement and check whether the failure is OpenRouter rejecting `response_format` or content that is not plain JSON (e.g. wrapped in code fences).
