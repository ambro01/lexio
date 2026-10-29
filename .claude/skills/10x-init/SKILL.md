---
name: 10x-init
description: Initialize the /context directory in this project — scaffold context/{changes,archive,foundation}/ plus universal README.md files if absent.
allowed-tools:
  - Read
  - Write
  - Bash
---
# /10x-init — Zainicjuj katalog /context

Utwórz szkielet katalogu `/context` (`changes/`, `archive/`, `foundation/`) oraz uniwersalny `README.md` w każdym z nich, aby konwencje śledzenia zmian i dokumentów bazowych miały swoje miejsce. Idempotentne: każdy z sześciu artefaktów (3 katalogi + 3 README) jest niezależnie tworzony, jeśli nie istnieje; ponowne uruchomienie w projekcie, gdzie wszystko już istnieje, nie wykonuje żadnych zmian.

Ta umiejętność jest wyraźnym punktem wejścia dla użytkowników, którzy chcą z góry utworzyć konwencje workflow. NIE jest warunkiem wstępnym dla `/10x-new`, `/10x-archive` ani żadnej umiejętności korzystającej — `/10x-new` odmówi działania, jeśli brakuje `context/changes/`, a `/10x-archive` leniwie tworzy `context/archive/` na żądanie. `/10x-init` istnieje dla użytkowników, którzy wolą najpierw skonfigurować szkielet.

## Proces

### Krok 1: Utwórz `context/changes/` + `README.md`

Jeśli katalog istnieje, pozostaw go bez zmian i oznacz katalog jako `present` w podsumowaniu. W przeciwnym razie utwórz go za pomocą `mkdir -p` i oznacz jako `created`.

Jeśli istnieje `context/changes/README.md`, pozostaw go bez zmian i oznacz jako `present`. W przeciwnym razie zapisz go z tą kanoniczną zawartością (osadzoną inline — bez osobnego pliku szablonu):

```
# Changes

In-flight changes. One folder per change at `context/changes/<change-id>/`, identified by a `change.md` identity file. Created via `/10x-new`. Holds research, frame, plan, reviews, and other change-scoped artifacts.

When a change is complete, archive it with `/10x-archive` to move it under `context/archive/`.
```

### Krok 2: Utwórz `context/archive/` + `README.md`

Jeśli katalog istnieje, pozostaw go bez zmian i oznacz katalog jako `present`. W przeciwnym razie utwórz go za pomocą `mkdir -p` i oznacz jako `created`.

Jeśli istnieje `context/archive/README.md`, pozostaw go bez zmian i oznacz jako `present`. W przeciwnym razie zapisz go z tą kanoniczną zawartością:

```
# Archive

Completed changes. Folders moved here from `context/changes/` when archived (see `/10x-archive`). Read-only by convention; skills refuse to write here.
```

### Krok 3: Utwórz `context/foundation/` + `README.md`

Jeśli katalog istnieje, pozostaw go bez zmian i oznacz katalog jako `present`. W przeciwnym razie utwórz go za pomocą `mkdir -p` i oznacz jako `created`.

Jeśli istnieje `context/foundation/README.md`, pozostaw go bez zmian i oznacz jako `present`. W przeciwnym razie zapisz go z tą kanoniczną zawartością:

```
# Foundation Docs

Cross-change living documents that span multiple changes. Each project picks which foundation docs it needs (e.g. product requirements, tech-stack, roadmap, glossary, test-stack). Foundation docs are owned by the skills that read and write them; this README describes the conventions that apply to all of them.

## Update convention

**Edit-in-place.** Foundation docs evolve over the lifetime of the project. When something changes incrementally (a new dependency, a refined product goal, a shifted milestone), edit the existing file. Don't create dated copies.

## Archive convention

When a foundation doc is fully superseded — replaced by a new approach rather than refined — move it to `foundation/archive/YYYY-MM-DD-<doc>.md` and write the replacement at the original path. The archive folder is a historical record; nothing reads from it routinely.

## Anti-pattern

Do **not** put change-scoped docs here. Anything tied to a single change (its plan, its research, its review) belongs under `context/changes/<change-id>/`. Foundation is for what outlives any one change.
```

### Krok 4: Wyświetl podsumowanie

Wyświetl sześciowierszowy blok statusu:

```
context/changes/                [created|present]
context/changes/README.md       [created|present]
context/archive/                [created|present]
context/archive/README.md       [created|present]
context/foundation/             [created|present]
context/foundation/README.md    [created|present]
```

Następnie przedstaw jedn akapitowy przewodnik po przeznaczeniu każdego katalogu i tym, gdzie szukać dalej:

- `context/changes/` zawiera zmiany w toku. Uruchom `/10x-new`, aby utworzyć nowy katalog zmiany wraz z plikiem tożsamości `change.md`.
- `context/archive/` zawiera ukończone zmiany. Uruchom `/10x-archive`, gdy zmiana jest gotowa — przeniesie on katalog z `changes/` do `archive/`.
- `context/foundation/` zawiera żywe dokumenty obejmujące wiele zmian. Nie ma tu stałej listy plików; dokumenty bazowe są własnością umiejętności, które je zapisują (np. `/10x-prd` zapisuje `prd.md`, a `/10x-tech-stack-selector` zapisuje `tech-stack.md`).

Zatrzymaj się. Nie przechodź dalej do `/10x-new` ani żadnej innej umiejętności; użytkownik uruchamia je, gdy ma coś do zrobienia.

## Uwagi

- **Idempotentne.** Ponowne uruchomienie `/10x-init` w projekcie, w którym istnieją już wszystkie sześć artefaktów, nie wykonuje żadnych zmian (poza wyświetleniem statusu). Nigdy nie może nadpisywać istniejącej zawartości.
- **Brak wymuszonej kolejności.** Wszystkie sześć artefaktów jest niezależnych. Jeśli istnieją tylko niektóre, utwórz brakujące i pozostaw istniejące bez zmian.
- **Katalogi nadrzędne są tworzone w razie potrzeby.** `context/` może nie istnieć w świeżym projekcie — utwórz go niejawnie poprzez semantykę `mkdir -p` dla każdego katalogu podrzędnego.
- **Nie jest warunkiem wstępnym.** Inne umiejętności samodzielnie inicjalizują własne pliki. `/10x-init` jest dla użytkowników, którzy lubią z góry skonfigurować szkielet `/context`.
- **`lessons.md` i `contract-surfaces.md` nie są tutaj tworzone.** Te pliki są od początku do końca własnością gałęzi triage `/10x-lesson`, `/10x-contract` i `/10x-impl-review`, które samodzielnie inicjalizują je z ich kanonicznymi nagłówkami przy pierwszym użyciu.