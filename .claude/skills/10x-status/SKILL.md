---
name: 10x-status
description: Show status of changes by reading change.md frontmatter and parsing each plan's ## Progress section
argument-hint: "[change-id]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---
# /10x-status — Status zmian

Pokaż status każdej zmiany w drzewie `context/` bieżącego projektu, odczytując frontmatter `change.md` i parsując sekcję `## Progress` każdego planu. **Nie jest konsultowany żaden plik stanu** — Progress jest jedynym źródłem prawdy (zobacz `references/progress-format.md`).

## Tryby

- **Bez argumentu** — wyświetl listę każdego folderu w `context/changes/` i `context/archive/` ze statusem + ukończeniem Progress + ostrzeżeniami o rozbieżnościach.
- **`<change-id>`** — szczegółowy widok pojedynczej zmiany: wyświetl listę każdego artefaktu w folderze tej zmiany i zgłoś obecność/status każdego z nich.

## Renderowanie dla każdej zmiany

Dla każdego folderu w `context/changes/<change-id>/` i `context/archive/<dated-id>/`:

1. Odczytaj frontmatter `change.md`, aby uzyskać `change_id`, `title`, `status`, `updated`, `created`.
2. Jeśli istnieje `plan.md`, sparsuj jego sekcję `## Progress`:
   - `total` = liczba wierszy `- [ ]` + `- [x]` pod nagłówkiem Progress.
   - `done` = liczba wierszy `- [x]`.
   - `current_phase`/`current_step` = nagłówek `### Phase N:` oraz indeks `N.M` pierwszego `- [ ]` (lub „all complete”, jeśli `done == total`).
3. Wygeneruj jeden wiersz:

   ```
   <change-id> — <status> (<done>/<total> steps, current step <N.M>, updated <YYYY-MM-DD>)
   ```

## Wskazówka wznowienia

Po wyświetleniu listy, jeśli którakolwiek zmiana ma `status: implementing`, wybierz tę z najnowszym `updated` i skopiuj polecenie wznowienia do schowka:

```bash
echo -n "/10x-implement <change-id> phase <N>" | pbcopy 2>/dev/null || echo -n "/10x-implement <change-id> phase <N>" | clip.exe 2>/dev/null || echo -n "/10x-implement <change-id> phase <N>" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard "/10x-implement <change-id> phase <N>"
```

Oznacz ten wiersz w wyjściu za pomocą `(✓ copied)`. Tylko JEDEN wiersz otrzymuje ten sufiks — najnowsza zaktualizowana zmiana w trakcie implementacji.

Jeśli sekcja Progress tej zmiany ma co najmniej jeden wiersz `- [x]`, którego linia kończy się sufiksem ` — <sha>` (7+ znaków szesnastkowych), dodaj `(closed at <sha>)` do wskazówki wznowienia, gdzie `<sha>` jest SHA w ostatnio ukończonym wierszu (ostatni `[x]` poprzedzający pierwszy `[ ]`). Renderuj `(✓ copied)` po `(closed at <sha>)`. Całkowicie pomiń `(closed at …)` w wierszach bez SHA.

## Kontrole rozbieżności spójności (tylko ostrzeżenia, nigdy blokujące)

Podczas renderowania ujawniaj rozbieżności między `change.md.status` a stanem Progress. Ostrzeżenia pojawiają się w tym samym wierszu obok zmiany:

| Warunek | Ostrzeżenie |
|---|---|
| `status: implementing` AND Progress ma 0 `[x]` | `⚠ status drift: implementing but no progress` |
| `status: implementing` AND każdy element Progress ma `[x]` | `⚠ status drift: should be implemented` |
| `status: planned` AND dowolny element Progress ma `[x]` | `⚠ status drift: should be implementing` |
| `status: archived` AND folder znajduje się w `context/changes/` (nie `archive/`) | `⚠ status drift: archived in wrong folder` |
| Folder w `context/archive/` AND `status` ≠ `archived` | `⚠ status drift: in archive/ but status not archived` |
| `status: plan_reviewed` AND brak `reviews/plan-review.md` | `⚠ missing plan-review artifact` |
| `status: impl_reviewed` AND brak obecnego `reviews/impl-review*.md` | `⚠ missing impl-review artifact` |

Nigdy nie zgłaszaj błędu ani nie kończ z kodem różnym od zera z powodu rozbieżności — `/10x-status` ma charakter informacyjny. Ostrzeżenie daje użytkownikowi sygnał, aby poprawić `change.md` lub przenieść folder.

## Szczegółowy widok pojedynczej zmiany (`/10x-status <change-id>`)

Po wywołaniu z argumentem `<change-id>` wyświetl listę każdego pliku w folderze tej zmiany z jednolinijkowym opisem, a następnie wypisz pełną sekcję Progress z SHA renderowanymi inline obok ukończonych wierszy:

```
<change-id> — <status> (<done>/<total> steps, updated <YYYY-MM-DD>)

  change.md          ✓ frontmatter present
  frame.md           ✓ ([file size, line count])
  research.md        ✗ not present
  plan.md            ✓ ([N] phases; current step <N.M>)
  plan-brief.md      ✓
  test-plan.md       ✗ not present
  reviews/
    plan-review.md   ✓
    impl-review.md   ✗ not present
  follow-ups/
    review-fixes.md  ✗ not present

Progress:
  Phase 1: <phase title>
    [x] 1.1 <title> — <sha>
    [x] 1.2 <title>           ← SHA-less row (legacy / empty-diff phase)
    [ ] 1.3 <title>
  Phase 2: <phase title>
    [ ] 2.1 <title>
    ...
```

Renderuj każdy wiersz Progress, zachowując jego oznaczenie `[x]` / `[ ]` oraz oryginalny indeks kroku + tytuł. Dla wierszy `[x]` dodaj ` — <sha>` TYLKO wtedy, gdy wiersz źródłowy w `plan.md` już zawiera ten sufiks; nigdy nie wymyślaj ani nie zgaduj SHA. Wiersze `[x]` bez SHA renderuj dokładnie jak obecnie (bez sufiksu).

Rozwiąż `<change-id>` do `context/changes/<change-id>/` albo `context/archive/<change-id>/` (to drugie dla zmian, których folder archiwum zachowuje sam slug; foldery archiwum mogą również mieć postać `<created-date>-<change-id>/` — spróbuj obu).

## Szkic wykonania

```bash
# 1. List all changes (active + archived)
find context/changes context/archive -mindepth 1 -maxdepth 1 -type d 2>/dev/null

# 2. For each, read change.md frontmatter (status, updated, title)
# 3. For each, parse plan.md ## Progress section if present
# 4. Render one line per change with completion + drift warnings
# 5. Pick the most-recently updated `implementing` change → clipboard hint
```

## Ważne uwagi

- **Progress jest autorytatywny.** Nigdy nie odczytuj ani nie zapisuj żadnego pliku pomocniczego stanu. Nigdy nie używaj grep do wyszukiwania znaczników postępu w komentarzach HTML.
- **Kontrole rozbieżności są wyłącznie ostrzeżeniami.** Ujawniaj niezgodności; nie poprawiaj ich automatycznie. Użytkownik aktualizuje `change.md` lub przenosi folder, jeśli ostrzeżenie jest uzasadnione.
- **Wpisy archiwalne są tylko do odczytu.** Renderuj je, ale nie sugeruj poleceń, które zapisywałyby wewnątrz `context/archive/`.
- **Szybkość**: dla listy bez argumentów preferuj jeden wsadowy odczyt wszystkich frontmatterów `change.md` oraz pojedynczy grep sekcji Progress plików plan.md zamiast odczytywania każdego planu w całości. Parsowanie wymaga teraz końcowego sufiksu ` — <sha>` oraz indeksu `N.M`, ale nadal pozostaje jednoprzejściowym wyrażeniem regularnym po sekcji Progress — bez dodatkowych odczytów plików.