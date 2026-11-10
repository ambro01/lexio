# Contract surfaces

Names that other parts of the system depend on. Renaming any of them breaks a caller in another slice — change them only together with every listed user, and in a new additive migration for database names.

## Database (`supabase/migrations/20261110210825_flashcard_data_contract.sql`)

| Name                                                                                                           | Kind     | Contract                                                                                                                                                                                                            | Relied on by           |
| -------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `public.flashcards`                                                                                            | table    | One row per word per user. Columns: `word`, `word_key` (generated), `translation`, `additional_meanings text[]`, `example_sentence`, `cefr` (A1–C2 or null), timestamps.                                            | S-01, S-04, S-05, S-06 |
| `public.tags`                                                                                                  | table    | One row per tag name per user. Columns: `name` (as first typed), `name_key` (generated).                                                                                                                            | S-01, S-05, S-06       |
| `public.flashcard_tags`                                                                                        | table    | Card ↔ tag links; composite foreign keys guarantee both belong to the same user. Index on `tag_id` for review by tag.                                                                                               | S-05, S-06             |
| `word_key` / `name_key`                                                                                        | rule     | `lower(regexp_replace(btrim(x), '\s+', ' ', 'g'))` — lowercase, trimmed, inner whitespace collapsed. Unique per user.                                                                                               | S-01, S-04, S-09       |
| `public.save_flashcard(p_word, p_translation, p_additional_meanings, p_example_sentence, p_cefr, p_tag_names)` | function | Returns `(flashcard_id, created)`. Inserts the card or finds the existing one by `word_key` (content left unchanged), creates missing tags, links them — one transaction, `security invoker`, `authenticated` only. | S-01, S-04             |
| RLS                                                                                                            | policies | Every table: `select` / `insert` / `update` / `delete` for `authenticated` with `user_id = auth.uid()` (`flashcard_tags`: no update). No policies for `anon` (sees 0 rows).                                         | all slices             |

## Service (`src/lib/services/flashcards.service.ts`)

| Name                                                             | Contract                                                                                       | Relied on by |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------ |
| `saveFlashcard(client, input)`                                   | `SaveFlashcardInput` → `{ id, created }`; existing word only gains the tags (FR-005).          | S-01, S-04   |
| `listFlashcards(client)`                                         | `Flashcard[]` with tags, newest first.                                                         | S-05         |
| `updateFlashcard(client, id, patch)`                             | Content only; `DuplicateWordError` on word collision, `FlashcardNotFoundError` if not visible. | S-05         |
| `deleteFlashcard(client, id)`                                    | Removes the card and its links; tags stay.                                                     | S-05         |
| `suggestTags(client, prefix?)`                                   | Up to 20 of the user's tags by name, prefix matched on `name_key`.                             | S-01, S-05   |
| `Flashcard`, `Tag`, `SaveFlashcardInput`, `UpdateFlashcardInput` | Shared types in `src/types.ts`.                                                                | all slices   |

## Scripts

| Name                | Contract                                                                     |
| ------------------- | ---------------------------------------------------------------------------- |
| `npm run db:types`  | Regenerates `src/db/database.types.ts` from the local schema.                |
| `npm run check:rls` | Two-user isolation and one-word check; must pass in CI before data features. |
