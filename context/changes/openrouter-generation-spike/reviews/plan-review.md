<!-- PLAN-REVIEW-REPORT -->

# Plan Review: OpenRouter Generation Spike

- **Plan**: context/changes/openrouter-generation-spike/plan.md
- **Mode**: Deep (inline verification)
- **Date**: 2026-11-03
- **Verdict**: REVISE
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | WARNING |
| Lean Execution        | PASS    |
| Architectural Fitness | WARNING |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

7/7 paths ✓, 4/4 symbols ✓, brief↔plan ✓, Progress↔Phase ✓

## Findings

### F1 — Nothing bounds generation time below 60 s

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 1 §3 (client), Performance Considerations
- **Detail**: Total time is driven by output length. The plan allows max_tokens 8000 (`src/lib/ai/openrouter.ts:128`), no cap on the number of proposals, and no control of reasoning tokens. At 80–150 tokens/s, 6–8k tokens is 50–100 s. The streaming fallback does not shorten total time.
- **Fix A ⭐ Recommended**: Cap proposals (e.g. 50, prompt + truncation in parseProposals), set reasoning minimal/off, lower max_tokens to ~6000, record tokens/s in measurements.md
  - Strength: Time becomes predictable.
  - Tradeoff: A very dense lesson yields at most 50 proposals.
  - Confidence: MED — reasoning parameter form per provider needs checking.
  - Blind spot: Whether 50 is enough for a typical lesson.
- **Fix B**: Leave as is, decide after measuring in Phase 4
  - Strength: Decision based on real data.
  - Tradeoff: Phase 1 code may be reworked after deploy.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: SKIPPED

### F2 — Location of the OpenRouter client breaks the AGENTS.md convention

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 §3
- **Detail**: `AGENTS.md:36` puts I/O code called from API routes (LLM calls) in `src/lib/services/<domain>.service.ts`; the plan uses `src/lib/ai/openrouter.ts`.
- **Fix**: Move the client to `src/lib/services/ai-generation.service.ts` (+ test) and update plan references.
- **Decision**: FIXED (Fix in plan — client moved to src/lib/services/ai-generation.service.ts)

### F3 — Local gates can't run on this machine right now

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 (2.4–2.6), Phase 3 (3.3–3.7)
- **Detail**: No `.env`/`.dev.vars`, Docker Desktop not running. `npm run smoke` needs a local Supabase with confirmations off (as in CI); against hosted Supabase it fails and creates production test accounts. Local manual checks have the same gap.
- **Fix A ⭐ Recommended**: Add a local-env step at the start of Phase 2 (Docker Desktop, `npx supabase start`, `.dev.vars` with local Supabase + OpenRouter key, smoke against `npm run preview`)
  - Strength: All gates run locally; production data stays clean.
  - Tradeoff: Docker Desktop must run each session.
  - Confidence: HIGH — CI does exactly this.
  - Blind spot: First `supabase start` downloads images.
- **Fix B**: Drop 2.4/3.3 locally, rely on CI smoke
  - Strength: No local Docker.
  - Tradeoff: CI runs on push to master, which also deploys.
  - Confidence: HIGH.
  - Blind spot: Local manual checks still need some Supabase.
- **Decision**: SKIPPED

### F4 — No limit on AI spending

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 §2
- **Detail**: Open sign-up, no per-user limit (parked); any account can generate without limit.
- **Fix**: In the Phase 4 human gate, set a credit limit on the OpenRouter key (e.g. $5) and note it in deploy-plan.md.
- **Decision**: SKIPPED

### F5 — Parser contract is less precise than the code

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §2
- **Detail**: Contract doesn't say whether an empty `additionalMeanings` array counts as empty; code treats `[]` as valid and accepts lowercase CEFR.
- **Fix**: One line in the contract matching the code.
- **Decision**: SKIPPED
