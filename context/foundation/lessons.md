# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Nie dodawaj lodash bez jawnego powodu

- **Context**: Implementacja funkcji w aplikacji TypeScript po stronie frontendu i backendu.
- **Problem**: Agent użył `_.filter()`, mimo że lodash nie jest częścią projektu. To dodałoby niepotrzebną zależność i rozjechało lokalną konwencję pracy z natywnymi API.
- **Rule**: Nie dodawaj lodash bez jasnego wskazania. Projekt preferuje natywne funkcje JS/TS w standardzie 2026+.
- **Applies to**: plan, implement, impl-review

## Commituj aktualizacje narzędzi osobno od zmian funkcjonalnych

- **Context**: Commit e8cd592 (Phase 2 of openrouter-generation-spike) — .claude/skills/10x-*, .claude/.10x-cli-manifest.json, CLAUDE.md
- **Problem**: The phase commit for the endpoint also carried ~22 files of 10x CLI skills and a CLAUDE.md rewrite unrelated to the feature. Harmless for the app, but it muddies the change's history and makes reviewing the diff harder.
- **Rule**: Commit 10x CLI / tooling updates (.claude/, CLAUDE.md) separately from feature commits, never inside a phase commit.
- **Applies to**: implement, impl-review
