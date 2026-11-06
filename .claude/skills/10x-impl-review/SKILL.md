---
name: 10x-impl-review
description: Review implementation against plan for drift, dangerous decisions, and pattern compliance
argument-hint: <plan-path> [phase N] | <saved-review-path>
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Agent
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---
# Przegląd implementacji

Porównaj faktyczne prace implementacyjne z pierwotnym planem, aby wykryć odchylenia, ryzykowne decyzje, naruszenia architektury i niewłaściwe użycie wzorców, zanim ich skutki się skumulują.

Dwa poziomy szczegółowości:
- **Przegląd fazy**: po pojedynczej fazie — szybki, skoncentrowany na zmianach z tej fazy
- **Pełny przegląd planu**: po wszystkich fazach — kompleksowy przegląd

Dwa tryby:
- **Nowy przegląd**: analiza → ustalenia → interaktywny triage
- **Wznowienie triage**: wczytaj zapisany raport i przejdź do triage dla poszczególnych problemów

## Rozpoznawanie danych wejściowych

1. Argument wskazuje na zapisany plik przeglądu (zawiera `<!-- IMPL-REVIEW-REPORT -->`) → **wznowienie triage** (przejdź do Kroku 5)
2. Argument jest `<change-id>`, a `context/changes/<change-id>/plan.md` istnieje → nowy przegląd tego planu
3. Podano ścieżkę planu (np. `@context/changes/<change-id>/plan.md`) → nowy przegląd tego planu
4. Podano numer fazy (np. „phase 3”) → przegląd tylko tej fazy
5. Brak argumentu → wylistuj `context/changes/*/change.md`; wybierz ostatnio `updated` zmianę ze `status` w `{implementing, implemented}` i potwierdź przez AskUserQuestion

Jeśli rozpoznana ścieżka planu zaczyna się od `context/archive/`, odmów: wypisz „This change is archived. Reviews are not appended to archived plans.” i ZATRZYMAJ się.

## Krok 1: Wczytaj plan i wykryj zakres zmiany

TaskCreate: „Implementation Review” / activeForm „Loading context”

1. **Przeczytaj cały plik planu** — bez limitu/offsetu.
2. **Przeczytaj `context/foundation/lessons.md`, jeśli istnieje** i użyj zaakceptowanych reguł jako priorytetów podczas skanowania ustaleń — odchylenie naruszające znaną, powtarzającą się regułę jest silniejszym sygnałem niż ogólna uwaga stylistyczna.
3. **Odczytaj stan kanoniczny z sekcji `## Progress` planu** (zobacz `references/progress-format.md`): ukończenie = `count([x]) / count([ ] + [x])`; bieżąca faza = faza zawierająca pierwszy `- [ ]` (albo ostatnia faza, jeśli wszystkie są ukończone). Odczytaj również sąsiedni `change.md` dla `status` i `updated`.
4. **Zakres**: zażądano konkretnej fazy → tylko ta faza; w przeciwnym razie wszystkie fazy, których pola wyboru Progress są w pełni `[x]` (tj. ukończone fazy).
   Dopasuj opisowe nagłówki `## Phase N:` i `## Faza N:` do Progress według numeru; zachowaj język. Zapisz dokładne numery faktycznie przeglądanych faz, także dla pełnego przeglądu (który może obejmować tylko ukończone fazy).
5. **Wyodrębnij** z przeglądanych faz: ścieżki plików z „Changes Required”, decyzje architektoniczne, kryteria sukcesu (punkty Automated/Manual w blokach Phase + ich odbicie `[ ]`/`[x]` w Progress) oraz listę „What We're NOT Doing” (ograniczenia zakresu).
6. **Wykrywanie zakresu Git** — co faktycznie się zmieniło:
   ```bash
   PLAN_DATE="<YYYY-MM-DD from filename>"
   git log --oneline --after="${PLAN_DATE}" -- .
   git diff --name-only $(git log --reverse --after="${PLAN_DATE}" --format="%H" | head -1)^..HEAD 2>/dev/null
   ```
   Jeśli zakresu nie można jednoznacznie określić, użyj jako alternatywy commitów, których komunikaty odwołują się do planu/funkcji.

Porównaj listę zmienionych plików z listą plików planu:
- **W planie I w diffie** → oczekiwana zmiana, zweryfikuj, czy treść odpowiada intencji
- **W diffie, ale NIE w planie** → nieplanowana zmiana, zbadaj i oznacz
- **W planie, ale NIE w diffie** → potencjalnie brakująca implementacja

Nie wczytuj wcześniej każdego zmienionego pliku do głównego kontekstu — pozwól subagentom przeczytać to, czego potrzebują. Główny kontekst powinien zawierać plan i podsumowanie diffu, a nie pełne źródła 20 plików.

## Krok 2: Równoległy przegląd przez subagentów

TaskUpdate: activeForm „Gathering evidence”

Uruchom **dwóch** subagentów jednocześnie. Każdy otrzymuje ukierunkowany kontekst — nie przekazuj pełnego planu obu.

**Agent 1 — Wykrywanie odchyleń od planu** (`subagent_type: "general-purpose"`)

Przekaż mu: tekst „Changes Required” dla przeglądanych faz oraz listę ścieżek plików do przeczytania.

Instrukcje: dla każdej planowanej zmiany przeczytaj faktyczny plik i zweryfikuj, czy implementacja odpowiada intencji. Sprawdź:
- Zmiany zaimplementowane inaczej niż zaplanowano (niezgodność intencji, nie formatowania)
- Pominięte elementy planu bez dokumentacji
- Dodatki nieopisane w planie (rozszerzanie zakresu)

Zgłoś dla każdego: ścieżkę pliku, co mówił plan, co istnieje, werdykt (MATCH / DRIFT / MISSING / EXTRA).

**Agent 2 — Bezpieczeństwo, jakość i zgodność ze wzorcami** (`subagent_type: "general-purpose"`)

Przekaż mu: pełną listę zmienionych plików do przeczytania, ścieżkę katalogu głównego projektu.

Instrukcje:

1. **Skan bezpieczeństwa i jakości** dla każdego zmienionego pliku. Oznacz:
   - **Bezpieczeństwo**: ryzyka wstrzyknięć (SQL, command, XSS), zakodowane na stałe sekrety, brak authn/authz na granicach systemu, nadmiernie liberalne CORS/uprawnienia.
   - **Wydajność**: zapytania N+1, nieograniczoną iterację/rekursję, brak paginacji, niepotrzebne synchroniczne I/O.
   - **Niezawodność**: brak obsługi błędów na granicach zewnętrznych (wywołania API, I/O plików, DB), warunki wyścigu, wycieki zasobów.
   - **Bezpieczeństwo danych**: destrukcyjne operacje DB bez wycofania, zmiany schematu bez ścieżki migracji, ryzyko utraty danych.

2. **Zgodność ze wzorcami** — dla każdego zmienionego pliku znajdź 1–2 podobne istniejące pliki i porównaj nazewnictwo, podejście do obsługi błędów, strukturę modułu, importy/eksporty, strukturę testów, wzorce konfiguracji. **Zgłaszaj tylko istotne niezgodności** (np. nowy moduł używa camelCase, gdy sąsiednie używają snake_case; nowy endpoint pomija wzorzec middleware uwierzytelniania używany przez resztę API). Pomijaj trywialne różnice stylistyczne — jeśli kod działa i realizuje plan, drobne formatowanie nie jest ustaleniem.

3. **Dopasuj nakład pracy nad wzorcami do zakresu** — jeśli diff zmienił ≤3 pliki, poświęć minimalny czas na wzorce (niewiele jest do porównania). Skaluj głębokość analizy wzorców wraz z zakresem zmian.

Zgłoś każde ustalenie z: plikiem, numerem linii, kategorią, wagą (CRITICAL / WARNING / OBSERVATION), opisem, rekomendacją.

## Krok 3: Zweryfikuj kryteria sukcesu

TaskUpdate: activeForm „Verifying success criteria”

Dla każdej przeglądanej fazy:

**Automatyczne**: uruchom przez Bash każde polecenie z pól wyboru „Automated Verification”. Zapisz polecenie, sukces/porażkę, faktyczny wynik (skróć, jeśli jest ogromny).

**Ręczne**: w sekcji `## Progress` sprawdź elementy Manual jako `- [x]` względem `- [ ]`. Oznacz jako problem elementy oznaczone jako ukończone, dla których brakuje obserwowalnych dowodów w diffie (możliwe pozorne odhaczenie); uznaj nieodhaczone elementy za oczekujące.

## Krok 4: Skompiluj ustalenia i przedstaw raport

TaskUpdate: activeForm „Compiling findings”

Każde ustalenie zawiera:
- **ID**: F1, F2, F3…
- **Waga**: CRITICAL / WARNING / OBSERVATION (jak poważne będą skutki zignorowania)
- **Wpływ**: LOW / MEDIUM / HIGH (ile uwagi wymaga decyzja)
- **Wymiar**: Plan Adherence / Scope Discipline / Safety & Quality / Architecture / Pattern Consistency / Success Criteria
- **Tytuł**: jedna linia
- **Lokalizacja**: `file:line` (lub „N/A” dla brakujących elementów)
- **Szczegół**: co jest nie tak wraz z dowodami — plan względem stanu faktycznego lub kod względem oczekiwań
- **Opcje naprawy**: 1 lub 2 (zobacz poniżej)

### Wpływ

Niezależny od wagi. CRITICAL z LOW impact (oczywista poprawka w jednej linii) jest tani; WARNING z HIGH impact (przeróbka architektoniczna) zasługuje na staranne przemyślenie.

| Wpływ | Znaczenie |
|---|---|
| 🏃 **LOW** | Szybka decyzja. Poprawka jest oczywista i ma wąski zakres. Bezpieczna do grupowania. |
| 🔎 **MEDIUM** | Warto się zatrzymać. Rzeczywisty kompromis lub nietrywialna edycja — pomyśl przed podjęciem decyzji. |
| 🔬 **HIGH** | Stawka architektoniczna. Szeroki promień oddziaływania, implikacje strategiczne lub niejasna najlepsza ścieżka. |

### Opcje naprawy

Domyślnie zaproponuj **jedną** poprawkę. Oferuj dwie tylko wtedy, gdy istnieje rzeczywisty kompromis, który rozsądny recenzent chciałby rozważyć (np. „załataj miejsce wywołania” kontra „napraw u źródła”). Jeśli łapiesz się na wymyślaniu słabej drugiej opcji, nie rób tego — przedstaw jedną i przejdź dalej.

**Ustalenia o LOW impact**: tylko `Fix: [one line]`. Szum nie pomaga, gdy odpowiedź jest oczywista.

**Ustalenia o MEDIUM/HIGH impact**: każda opcja otrzymuje:
```
[1-sentence approach] · Strength: [advantage, ideally grounded in code/plan evidence] · Tradeoff: [cost or risk] · Confidence: HIGH|MED|LOW — [1-line why] · Blind spot: [what we haven't verified, or "None significant"]
```

Przy oferowaniu dwóch opcji oznacz dokładnie jedną jako `⭐ Recommended`.

### Werdykty wymiarów

PASS / WARNING / FAIL dla każdego wymiaru:
- **Plan Adherence** — zaplanowane zmiany zaimplementowane zgodnie z opisem? FAIL przy MISSING lub istotnym DRIFT.
- **Scope Discipline** — granice „not doing” zachowane? WARNING, jeśli istnieją zmiany EXTRA, ale są nieszkodliwe.
- **Safety & Quality** — bezpieczeństwo, wydajność, niezawodność, bezpieczeństwo danych. FAIL przy dowolnym ustaleniu CRITICAL.
- **Architecture** — granice modułów, kierunek zależności, uzasadnienie abstrakcji. FAIL przy naruszeniach.
- **Pattern Consistency** — zgodność z istniejącymi konwencjami. WARNING przy drobnych niespójnościach.
- **Success Criteria** — automatyczne kontrole przechodzą, ręczne kontrole obsłużone. FAIL przy niepowodzeniach automatycznych.

### Werdykt ogólny

- **APPROVED** — wszystkie PASS albo PASS z ≤2 drobnymi ostrzeżeniami
- **NEEDS ATTENTION** — wiele ostrzeżeń albo 1 niekrytyczny FAIL
- **REJECTED** — dowolny krytyczny FAIL (bezpieczeństwo, istotne odchylenie, bezpieczeństwo danych, nieudane testy)

Sortuj ustalenia według wagi: CRITICAL → WARNING → OBSERVATION. Ogranicz do 10 — skonsoliduj powiązane ustalenia, jeśli jest ich więcej.

### Format raportu

Zwykły tekst, znaki ramki. Wymiary PASS pojawiają się tylko w tabeli werdyktów, nigdy jako ustalenia. Pomiń grupy wag z zerową liczbą ustaleń.

```
═══════════════════════════════════════════════════════════
  IMPLEMENTATION REVIEW: [Plan Title]
  Scope: Phase [N] of [Total]  |  Date: YYYY-MM-DD
  Findings: [N critical] [N warnings] [N observations]
═══════════════════════════════════════════════════════════

  Plan Adherence        PASS    ✅
  Scope Discipline      WARNING ⚠️   (1 finding)
  Safety & Quality      FAIL    ❌   (1 finding)
  Architecture          PASS    ✅
  Pattern Consistency   WARNING ⚠️   (1 finding)
  Success Criteria      PASS    ✅

  ► Overall: NEEDS ATTENTION

═══════════════════════════════════════════════════════════
  CRITICAL FINDINGS ❌
═══════════════════════════════════════════════════════════

  F1 — SQL injection in auth handler
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ❌ CRITICAL
    Impact:    🔎 MEDIUM — real tradeoff; pause to reason through it
    Dimension: Safety & Quality
    Location:  src/auth/handler.ts:42

    Detail:
    SQL query built with string concatenation. Plan specified
    parameterized queries but implementation uses template literals.

    Fix: Replace the template literal with a parameterized query using
         db.query($1, [value]).
      Strength:   Matches the pattern in src/users/query.ts and removes
                  the injection class entirely.
      Tradeoff:   Minor — one call site, a few-line change.
      Confidence: HIGH — identical pattern used elsewhere in this repo.
      Blind spot: None significant.

═══════════════════════════════════════════════════════════
  WARNING FINDINGS ⚠️
═══════════════════════════════════════════════════════════

  F2 — Unplanned /api/status endpoint
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ⚠️ WARNING
    Impact:    🔬 HIGH — architectural stakes; think carefully before deciding
    Dimension: Scope Discipline
    Location:  src/api/routes.ts:18

    Detail:
    New GET /api/status endpoint not in plan. Functionality is
    related to planned work but extends public API surface.

    Fix A ⭐ Recommended: Document in the plan as an addendum
      Strength:   Preserves the work already done; updates the source of
                  truth before future reviews use the plan as ground truth.
      Tradeoff:   Plan becomes a slightly moving target.
      Confidence: HIGH — this repo's plan updates regularly pick up
                  discovered scope through addenda.
      Blind spot: Stakeholders who reviewed the original scope aren't
                  notified.

    Fix B: Remove and add to follow-up work
      Strength:   Keeps scope discipline strict.
      Tradeoff:   Loses implemented work; another PR needed later.
      Confidence: MEDIUM — depends whether anything already depends on it.
      Blind spot: Haven't checked for callers of /api/status.

  ···

  F3 — camelCase vs. snake_case
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ⚠️ WARNING
    Impact:    🏃 LOW — quick decision; fix is obvious and narrowly scoped
    Dimension: Pattern Consistency
    Location:  src/utils/format.ts

    Detail:
    Uses camelCase (formatDate, parseInput) while existing utils use
    snake_case (format_date, parse_input).

    Fix: Rename exports to snake_case to match src/utils/.

═══════════════════════════════════════════════════════════
```

### Reguły formatowania raportu

- **Wiersz tytułu ustalenia** zawiera wyłącznie ID i krótki tytuł — nic więcej. Wszystko pozostałe trafia poniżej jako oznaczone pola, aby każdy wiersz był krótki i łatwy do przeskanowania.
- **Zawsze łącz ikony ze słowem.** Nigdy nie używaj samej ikony jako jedynego sygnału — `❌ CRITICAL`, nie tylko `❌`. Dzięki temu raport pozostaje czytelny podczas szybkiego przeglądania i nie wymaga od użytkownika zapamiętywania znaczenia każdej ikony.
- **Wpływ zawsze zawiera swoje jednoliniowe znaczenie** (skopiuj z tabeli Impact — „architectural stakes; think carefully before deciding” / „real tradeoff; pause to reason through it” / „quick decision; fix is obvious and narrowly scoped”). Dzięki temu LOW/MEDIUM/HIGH są zrozumiałe w miejscu użycia, zamiast wymagać od użytkownika pamiętania tabeli.
- Waga, Wpływ, Wymiar, Lokalizacja znajdują się każda w osobnej linii z wyrównanymi etykietami. Szczegół rozpoczyna się w osobnej linii pod etykietą `Detail:`, aby mógł naturalnie się zawijać.

### Zapisywanie raportu (zawsze)

Zachowaj `Reviewed phases` jako jawną listę rozdzielonych przecinkami numerów faktycznie sprawdzonych faz (np. `1, 3`) albo `none`, gdy nie sprawdzono żadnej. Nigdy nie wyciągaj wniosków o pokryciu na podstawie nazwy pliku raportu, werdyktu ani etykiety „Full plan”. Pełny przegląd wymienia każdy sprawdzony numer i może zastąpić kilka raportów faz dla pokrycia archiwalnego; dodane lub pozostawione bez przeglądu fazy nie są uwzględniane. Wznowienie triage zachowuje pierwotne pokrycie; nie uzupełniaj niepewnego starszego zakresu.

**Każda ścieżka w tym skillu zapisuje raport i oznacza zmianę** — Triage teraz, Triage później oraz Done wszystkie zapisują plik. To pozwala `/10x-archive` i `/10x-status` zobaczyć przegląd oraz utrzymuje poprawny `change.md.status`. Zrób to *przed* przedstawieniem opcji kontynuacji — nigdy warunkowo i nigdy wyłącznie w gałęziach „save”.

1. **Zapisz plik raportu** do `context/changes/<change-id>/reviews/impl-review.md` (lub `context/changes/<change-id>/reviews/impl-review-phase-N.md` dla przeglądu ograniczonego do fazy), używając poniższego formatu. Utwórz katalog `reviews/`, jeśli go nie ma.
2. **Oznacz `change.md`**: ustaw `status: impl_reviewed` oraz `updated: <today>`. Raz, tutaj — niezależnie od tego, którą opcję kontynuacji wybierze użytkownik. (Jeśli pole `change.md` ma już wartość `impl_reviewed`, po prostu odśwież `updated`.)
3. Jeśli użytkownik później przeprowadzi triage, raport na dysku jest kopią roboczą: jego pola `Decision:` są aktualizowane w miejscu po rozstrzygnięciu każdego ustalenia (Krok 5), a wszelkie działania następcze „fix in plan/code” są kolejkowane do `context/changes/<change-id>/follow-ups/review-fixes.md`.

```markdown
<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: [Plan Title]

- **Plan**: [plan file path]
- **Scope**: Phase [N] of [Total] / Full plan
- **Reviewed phases**: [explicit phase numbers, e.g. 1, 2, 3]
- **Date**: YYYY-MM-DD
- **Verdict**: [APPROVED/NEEDS ATTENTION/REJECTED]
- **Findings**: [N critical] [N warnings] [N observations]

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS/WARNING/FAIL |
| Scope Discipline | PASS/WARNING/FAIL |
| Safety & Quality | PASS/WARNING/FAIL |
| Architecture | PASS/WARNING/FAIL |
| Pattern Consistency | PASS/WARNING/FAIL |
| Success Criteria | PASS/WARNING/FAIL |

## Findings

### F1 — SQL injection in auth handler

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/auth/handler.ts:42
- **Detail**: SQL query built with string concatenation. Plan specified parameterized queries.
- **Fix**: Replace the template literal with a parameterized query using db.query($1, [value]).
  - Strength: Matches pattern in src/users/query.ts; removes injection class.
  - Tradeoff: Minor — one call site, a few-line change.
  - Confidence: HIGH — identical pattern used elsewhere.
  - Blind spot: None significant.
- **Decision**: PENDING

### F2 — Unplanned /api/status endpoint

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Scope Discipline
- **Location**: src/api/routes.ts:18
- **Detail**: New GET /api/status endpoint not in plan.
- **Fix A ⭐ Recommended**: Document in the plan as an addendum
  - Strength: Preserves the work; updates source of truth.
  - Tradeoff: Plan becomes a slightly moving target.
  - Confidence: HIGH — addendum pattern used regularly here.
  - Blind spot: Original-scope stakeholders not notified.
- **Fix B**: Remove and add to follow-up work
  - Strength: Keeps scope discipline strict.
  - Tradeoff: Loses implemented work; another PR later.
  - Confidence: MEDIUM — depends on callers.
  - Blind spot: Haven't checked for callers.
- **Decision**: PENDING

### F3 — camelCase vs. snake_case

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/utils/format.ts
- **Detail**: Uses camelCase while existing utils use snake_case.
- **Fix**: Rename exports to snake_case to match src/utils/.
- **Decision**: PENDING
```

Znacznik `<!-- IMPL-REVIEW-REPORT -->` oraz pola `Decision: PENDING` umożliwiają tryb wznowienia.

### Opcje kontynuacji

Po zapisaniu raportu i oznaczeniu `change.md` zapytaj, jak kontynuować:

```
question: "Review saved to <report-path>. How would you like to proceed?"
header: "Implementation Review — [N] findings"
options:
  - label: "Triage findings now"
    description: "Walk through each finding and decide. Decisions are written back to the saved report."
  - label: "Triage later"
    description: "Resume with /10x-impl-review <report-path>."
  - label: "Done"
    description: "Report saved — I'll handle the findings myself."
multiSelect: false
```

- **Triage findings now** → przejdź do Kroku 5; zapisany raport jest kopią roboczą.
- **Triage later** → wypisz ścieżkę zapisanego raportu i przypomnij o uruchomieniu `/10x-impl-review <report-path>`.
- **Done** → wypisz ścieżkę zapisanego raportu i ZATRZYMAJ się.

Niezależnie od wyboru plik raportu i oznaczenie `impl_reviewed` już istnieją na dysku — wybór określa jedynie, czy triage odbędzie się teraz, później, czy zostanie pozostawiony użytkownikowi.

## Krok 5: Interaktywny triage

TaskUpdate: activeForm „Triage”

### Tryb wznowienia

Jeśli wejście nastąpiło przez zapisany plik: przeczytaj go, sparsuj nagłówki `### F`, przefiltruj do `Decision: PENDING`. Jeśli nie ma żadnych: „All findings triaged.” Gotowe.

### Pętla triage

Przechodź przez ustalenia w kolejności wagi (CRITICAL → WARNING → OBSERVATION). Dla każdego:

**Z 2 opcjami naprawy:**
```
question: "F[N] — [title]\n\nSeverity: [sev icon] [SEV]\nImpact: [impact icon] [LEVEL] — [meaning]\nDimension: [dim]\nLocation: [loc]\n\nDetail: [detail]\n\n[Fix A block]\n\n[Fix B block]"
header: "Finding [current] of [total remaining]"
options:
  - label: "Apply Fix A ⭐"
    description: "[Fix A one-liner]"
  - label: "Apply Fix B"
    description: "[Fix B one-liner]"
  - label: "Skip"
    description: "Not worth fixing now."
  - label: "Record as lesson"
    description: "Save as a recurring project rule via /10x-lesson."
multiSelect: false
```

**Z 1 opcją naprawy:**
```
question: "F[N] — [title]\n\nSeverity: [sev icon] [SEV]\nImpact: [impact icon] [LEVEL] — [meaning]\nDimension: [dim]\nLocation: [loc]\n\nDetail: [detail]\n\n[Fix block]"
header: "Finding [current] of [total remaining]"
options:
  - label: "Fix now"
    description: "[Fix one-liner]"
  - label: "Fix differently"
    description: "Different approach — let's discuss."
  - label: "Skip"
    description: "Not worth fixing now."
  - label: "Record as lesson"
    description: "Save as a recurring project rule via /10x-lesson."
multiSelect: false
```

**Obsługa odpowiedzi:**
- **Apply Fix A/B / Fix now**: pokaż dokładną zmianę kodu przed/po. Krótkie potwierdzenie („Apply this?”), następnie edytuj. Oznacz FIXED (zapisz, która opcja, np. „Fixed via Fix A”).
- **Fix differently**: zapytaj o preferowane podejście, zastosuj je, oznacz FIXED.
- **Record as lesson**: wstępnie wypełnij cztery pola wpisu lekcji bezpośrednio z ustalenia — `Context` z Location ustalenia, `Problem` z Detail ustalenia, `Rule` i `Applies to` pozostaw jako puste placeholdery do wypełnienia przez użytkownika. Pokaż proponowany wpis jako kompletny blok markdown i poproś użytkownika o edycję / potwierdzenie przez AskUserQuestion („Approve this entry?” / „Edit before saving” / „Cancel”). Po potwierdzeniu dodaj wpis jako nową sekcję H2 do `context/foundation/lessons.md` — jeśli plik nie istnieje, najpierw utwórz go z tym kanonicznym 5-wierszowym nagłówkiem (bez osobnego pliku szablonu; nagłówek jest osadzony tutaj inline):

  ```
  # Lessons Learned

  > Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

  ```

  Przepływ wstępnego wypełnienia, a następnie potwierdzenia jest kluczowym szczegółem UX; użytkownik musi zobaczyć pełny proponowany wpis z wstępnie wypełnionymi Context/Problem oraz mieć możliwość edycji Rule i Applies-to przed dodaniem. Po pomyślnym dodaniu **zawsze** zadaj pytanie uzupełniające przez AskUserQuestion: „Lesson saved. Also apply the fix to the current code?” z opcjami „Yes — fix now” / „No — lesson only”. **Nigdy nie pomijaj tego pytania ani nie decyduj za użytkownika** — niezależnie od tego, czy poprawka jest trywialna, poza zakresem czy obejmuje wiele plików, decyzja należy do użytkownika. Jeśli tak: pokaż zmianę kodu przed/po, zastosuj ją, oznacz `FIXED + ACCEPTED-AS-RULE: <rule title>`. Jeśli nie: oznacz `ACCEPTED-AS-RULE: <rule title>` (ustalenie pozostaje niepoprawione, reguła jest zapisana dla przyszłej pracy).
- **Skip** → SKIPPED. Przejdź dalej, nie dyskutuj.
- **Inne (wolny tekst)**: zinterpretuj intencję użytkownika. Typowe intencje: „fix differently” (szczególnie w kontekście dwóch poprawek) → zapytaj o preferowane podejście, zastosuj je, oznacz FIXED; „accept risk” → oznacz ACCEPTED wraz z uzasadnieniem użytkownika; „dismiss”/„disagree” → oznacz DISMISSED.

Po każdej decyzji zaktualizuj pole `Decision:` zapisanego raportu dla tego ustalenia (raport zawsze istnieje na dysku — zobacz Krok 4).

### Podsumowanie

```
═══════════════════════════════════════════════════════════
  TRIAGE COMPLETE
═══════════════════════════════════════════════════════════

  Fixed:     F1, F2 (Fix A)   (2)
  Rule:      F3 (+ fixed)     (1)
  Skipped:   F4               (1)
  Accepted:  F5               (1)

═══════════════════════════════════════════════════════════
```

Zaktualizuj zapisany raport o ostateczne decyzje. Oznacz zadanie przeglądu jako ukończone.

## Uwagi

- To skill **przeglądu**. Domyślnie analizuj i raportuj — wprowadzaj edycje podczas triage tylko wtedy, gdy użytkownik wyraźnie wybierze „Apply Fix” lub „Fix differently” dla konkretnego ustalenia.
- Bądź konkretny. „src/auth/handler.ts:42 — SQL query built with string concatenation, vulnerable to injection” — nie „there might be a security issue somewhere”.
- Nie oznaczaj preferencji stylistycznych, jeśli nie mają znaczenia. Jeśli kod działa i realizuje plan, drobne różnice stylistyczne względem istniejącego kodu są obserwacjami, a nie ostrzeżeniami.
- Jeśli sam plan był wadliwy (np. zaplanował niebezpieczne podejście), oznacz to — ten przegląd wykrywa również problemy planu.
- Wpływ dotyczy *wysiłku decyzyjnego*, a nie *wagi*. LOW impact przy ustaleniu CRITICAL oznacza, że poprawka jest oczywista; HIGH impact przy WARNING oznacza, że kompromis jest rzeczywisty.
- Dwie opcje naprawy tylko wtedy, gdy istnieje rzeczywisty kompromis. Nie wymyślaj alternatyw dla trywialnych poprawek.
- Podczas przeglądu pojedynczej fazy nadal sprawdź, czy zmiany z tej fazy nie naruszyły założeń poprzednich faz. Fazy mogą na siebie oddziaływać.
- Podczas triage utrzymuj tempo. Użytkownik już przeczytał raport.
- Podczas naprawy wprowadzaj minimalne, ukierunkowane edycje. Nie refaktoryzuj otaczającego kodu ani nie „ulepszaj” rzeczy, które nie zostały oznaczone.