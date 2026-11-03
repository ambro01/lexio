---
name: 10x-plan-review
description: >
  Review implementation plans for substance, feasibility, and architectural fitness.
  Use when user asks to review a plan, says "is this plan good", "check my plan",
  "review this plan", mentions plan review, or references a plan file and asks
  for feedback. Also trigger when user finishes /10x-plan and wants validation
  before starting /10x-implement.
---
# Przegląd planu

Wychwyć problemy merytoryczne w planie implementacji, zanim powstanie choć jedna linia kodu. Wadliwy plan kosztuje godziny — wadliwy przegląd kosztuje minuty.

Podczas gdy `/10x-impl-review` pyta „czy zbudowaliśmy to, co zaplanowaliśmy?”, ten pyta „czy ten plan rzeczywiście zadziała?”.

Dwa tryby:
- **Świeży przegląd**: analiza → ustalenia → interaktywny triage
- **Wznowienie triage**: załaduj zapisany raport i przejdź do triage dla poszczególnych problemów

## Rozwiązywanie danych wejściowych

1. Argument wskazuje zapisany plik przeglądu (zawiera `<!-- PLAN-REVIEW-REPORT -->`) → **wznowienie triage** (przejdź do Kroku 6)
2. Argument to `<change-id>`, a `context/changes/<change-id>/plan.md` istnieje → przeglądaj ten plan
3. Podano ścieżkę planu (np. `@context/changes/<change-id>/plan.md`) → użyj jej
4. Brak argumentu → wyświetl `context/changes/*/plan.md` (najnowsze według `change.md.updated`) przez AskUserQuestion
5. Flaga `--quick` → tryb tylko dokumentu (pomiń Krok 3)

Jeśli rozwiązana ścieżka planu zaczyna się od `context/archive/`, odmów zapisania przeglądu: wypisz „Ta zmiana jest zarchiwizowana. Przeglądy nie są dopisywane do zarchiwizowanych planów.” i ZATRZYMAJ się.

## Krok 1: Wczytanie i skan spójności wewnętrznej

Przeczytaj cały plik planu. Przeczytaj także sąsiedni `plan-brief.md` w tym samym folderze zmiany, jeśli istnieje. Przeczytaj `context/foundation/lessons.md`, jeśli istnieje, i używaj zaakceptowanych reguł jako wcześniejszych przesłanek podczas skanowania pod kątem problemów merytorycznych / wykonalności / łamania kontraktów — ustalenie, które powtarza znaną, cykliczną regułę, powinno mieć większą, a nie mniejszą wagę. Wyodrębnij:
- **Pożądany stan końcowy** i **Kryteria sukcesu**
- **Analizę stanu obecnego** — udokumentowane ograniczenia i pułapki
- **Granice zakresu** — „Czego NIE Robimy”
- **Fazy** — ścieżki plików, zmiany, zależności
- **Decyzje** i **założenia** (jawne i ukryte) — odnotuj dla siebie każdy termin rankingowy lub selekcyjny, na którym opiera się plan („top N”, „latest”, „active”, „duplicate”), którego przypadek remisu nigdy nie zostaje w planie rozstrzygnięty; zasila to poniższe Martwe punkty
- **Sekcję postępu** — kanoniczny blok `## Progress` na końcu planu (zobacz `references/progress-format.md`)

Przed jakąkolwiek weryfikacją kodu sprawdź plan względem niego samego. Te trzy skany często wykrywają problemy o najwyższej wartości — problemy, które autor planu odkrył, ale których nie doprowadził w pełni do końca:

- **Sprzeczność**: czy Analiza stanu obecnego dokumentuje ograniczenie, które implementacja ignoruje? (np. „npm doesn't run preuninstall for deps”, a fazy mimo to na tym polegają) Czy elementy z „Czego NIE Robimy” pojawiają się ponownie w fazach? Czy faza zakłada zachowanie, które gdzie indziej uznano za wadliwe?
- **Luka w obietnicy**: każda funkcjonalność obiecana w Pożądanym stanie końcowym / Kryteriach sukcesu / Notatkach migracyjnych powinna mieć wspierającą ją fazę. Jeśli kryteria sukcesu mówią „rate limiting works”, ale żadna faza go nie buduje, implementator napotka lukę w trakcie budowy.
- **Łamanie kontraktów** (gdy plan definiuje lub wykorzystuje endpointy API): prześledź przepływ danych między endpointami — jeśli krok B potrzebuje tokena/ID z kroku A, czy odpowiedź A go zawiera? Oznacz nierozstrzygnięte decyzje projektowe, które implementator musiałby zgadywać (który endpoint, która metoda auth, który storage dla stanu rate-limit).
- **Dotknięte powierzchnie kontraktowe**: jeśli w projekcie istnieje `docs/reference/contract-surfaces.md`, przeczytaj go i wyodrębnij listę nagłówków H2 jako nazwy powierzchni. Uruchom `grep -F` względem tekstu planu z jednym `-e <surface name>` na nagłówek. Dla każdego trafienia przeczytaj odpowiednią sekcję H2 pliku `contract-surfaces.md` i sprawdź, czy (a) plan dokładnie opisuje obecny kształt powierzchni oraz (b) każda zmiana nazwy lub schematu jest oznaczona jako łamiąca z historią migracji dla konsumentów downstream. Jeśli plik nie istnieje, pomiń to sprawdzenie bez komunikatu — jest to konwencja opt-in, automatycznie inicjowana przy pierwszym użyciu przez `/10x-contract` lub gałąź triage `/10x-impl-review`. Lista grep wyprowadzona z H2 oznacza: gdy konsument doda nową powierzchnię do swojego pliku, następny przegląd planu automatycznie ją wykryje — nie jest potrzebna edycja SKILL.md.
- **Spójność Postęp↔Faza** (kontrakt mechaniczny — zobacz `references/progress-format.md`):
  - Dokładnie jeden nagłówek `## Progress` na końcu plan.md.
  - Każde `## Phase N: <name>` lub `## Faza N: <name>` w treści planu ma pasujące `### Phase N: <name>` w Progress, dopasowane według numeru fazy. Zachowaj język opisowego nagłówka; samo `Faza` zamiast `Phase` nie jest ustaleniem CRITICAL ani żadną wadą spójności.
  - Każdy punkt Kryteriów sukcesu (pod `#### Automated Verification:` / `#### Manual Verification:`) w bloku Fazy ma pasujące `- [ ] N.M <title>` (lub `- [x]`) w odpowiadającej podsekcji Progress.
  - Bloki Faz zawierają wyłącznie zwykłe punkty `- ` — bez `- [ ]` ani `- [x]` poza sekcją Progress.
  Traktuj każdy z tych przypadków jako ustalenie CRITICAL w obszarze Kompletności planu — `/10x-implement` nie zdoła sparsować nieprawidłowej sekcji Progress.

## Krok 2: Ugruntowanie

Szybko, bez sub-agentów:
- **Ścieżki**: `ls -l` dla ≥5 ścieżek plików, które plan deklaruje zmodyfikować. Nieistniejące ścieżki są krytyczne.
- **Symbole**: grep dla konkretnych funkcji/kluczy konfiguracji, do których odwołuje się plan.
- **Spójność brief↔plan**: czy fazy, decyzje i zakres się zgadzają?

Raportuj inline: `Grounding: 5/5 paths ✓, 3/3 symbols ✓, brief↔plan ✓`. Eskaluj do ustalenia tylko w przypadku niepowodzenia.

## Krok 3: Weryfikacja codebase (tylko tryb głęboki)

Pomiń, jeśli `--quick`.

Na podstawie Kroków 1–2 zidentyfikuj **3–5 najbardziej ryzykownych twierdzeń** w planie — rzeczy, które, jeśli okażą się błędne, wymuszą znaczące przeróbki. Uruchom **jednego** sub-agenta (`subagent_type: "general-purpose"`) z trzema połączonymi zadaniami:

1. **Zweryfikuj najbardziej ryzykowne twierdzenia** względem rzeczywistego kodu. Dla każdego: co pokazuje kod, czy potwierdza czy zaprzecza planowi, wraz z dowodem file:line.
2. **Przegląd promienia rażenia**: dla funkcji, stałych lub endpointów, które modyfikuje plan, przeszukaj codebase pod kątem innych wywołujących/importujących niewymienionych w planie. To pliki, o których plan nie wie, że je dotyka.
3. **Sprawdzenie wzorca** (tylko jeśli plan wprowadza nowe wzorce): czy istniejące pliki w dotkniętych obszarach już to rozwiązują? Rozrost wzorców jest częstym ustaleniem.

Daj sub-agentowi ukierunkowane pytania z istotnymi ścieżkami plików — nie wrzucaj całego planu. Skupiony prompt znajduje więcej niż szerokie przeszukanie, ponieważ agent wie, czego szukać.

## Krok 4: Analiza merytoryczna

Przeanalizuj plan względem pięciu wymiarów. Twórz ustalenia tylko dla rzeczywistych problemów — nie wypełniaj raportu komunikatami „nie znaleziono problemów”.

### Zgodność ze stanem końcowym
Przechodząc kolejno przez fazy, czy system osiąga zadeklarowany stan końcowy? Czy wszystkie kryteria sukcesu mogłyby przejść, podczas gdy cel nadal pozostałby niespełniony? Czy istnieje jakaś luka „ostatniej mili”, w której plan wykonuje 90% i zatrzymuje się tuż przed końcem?

### Szczupła realizacja
Dla każdej fazy: „gdybym to usunął, czy stan końcowy nadal byłby osiągalny?”. Wypatruj przedwczesnej abstrakcji, dodatków „skoro już tu jesteśmy”, frameworków tam, gdzie wystarczyłaby funkcja, sprzeczności zakresu (elementy „nie robimy” pojawiające się w fazach).

### Dopasowanie architektoniczne
Czy pasuje to do istniejącego systemu? Nowe wzorce tam, gdzie zadziałałyby istniejące (rozrost wzorców). Czyste granice modułów i poprawny kierunek zależności. Zmiany o dużym promieniu rażenia — fazy dotykające wielu plików między modułami, zmiany współdzielonych narzędzi. Mgliste „refactor as needed” lub „update accordingly”, które wymkną się spod kontroli.

### Martwe punkty
Czego plan nie rozważa? Ścieżki błędów (opisano tylko szczęśliwą ścieżkę?), historia rollbacku (faza 3 kończy się niepowodzeniem — czy możemy cofnąć?), wpływ na zasoby/koszty (wywołania API, praca obliczeniowa — ile to kosztuje przy oczekiwanym użyciu?), zmiany wartości domyślnych (domyślna wartość, która potraja koszt lub czas, powinna być wskazana), luki w testowaniu, granice bezpieczeństwa. Granica pozostawiona przez plan kodowi: termin, którego używa, ale nigdy nie rozstrzyga w przypadku remisu (N-ty kontra N+1-ty przy równych wartościach, jednostka liczby, dokładny moment zmiany stanu) — oznacz ją, gdy jedyną odpowiedzią jest to, co implementacja robi dzisiaj.

### Kompletność planu
Czy dokument jest wykonalny? Czy ścieżki plików są konkretne (a nie „somewhere in src/”)? Czy zmiany są na poziomie funkcji/metod? Czy kryteria sukcesu zawierają uruchamialne polecenia? Czy są TBD, TODO lub sekcje-zastępniki?

## Krok 5: Zestaw ustaleń

Każde ustalenie zawiera:

- **ID**: F1, F2, F3…
- **Severity**: CRITICAL / WARNING / OBSERVATION (jak poważne będzie zignorowanie)
- **Impact**: LOW / MEDIUM / HIGH (ile skupienia wymaga decyzja)
- **Dimension**: jeden z End-State Alignment / Lean Execution / Architectural Fitness / Blind Spots / Plan Completeness
- **Title**: jedna linia
- **Location**: sekcja lub faza planu
- **Detail**: co jest nie tak wraz z dowodami — twierdzenie planu kontra stan faktyczny lub brakujący element
- **Fix options**: 1 lub 2 (zobacz poniżej)

### Wpływ

Niezależny od istotności. CRITICAL z LOW impact (oczywista poprawka) jest tani do rozwiązania; WARNING z HIGH impact (niejasne kompromisy, szeroki promień rażenia) zasługuje na staranne przemyślenie.

| Wpływ | Znaczenie |
|---|---|
| 🏃 **LOW** | Szybka decyzja. Poprawka jest oczywista i wąsko ograniczona. Bezpieczne do grupowania. |
| 🔎 **MEDIUM** | Warto się zatrzymać. Istnieje rzeczywisty kompromis lub nietrywialna edycja — pomyśl przed decyzją. |
| 🔬 **HIGH** | Stawka architektoniczna. Szeroki promień rażenia, implikacje strategiczne lub niejasna najlepsza ścieżka. |

### Opcje poprawy

Domyślnie stosuj **jedną** poprawkę. Przedstawiaj dwie tylko wtedy, gdy istnieje rzeczywisty kompromis, który inteligentny recenzent chciałby rozważyć — nie każde ustalenie ma alternatywy warte sztucznego tworzenia.

**Kiedy oferować dwie poprawki**: gdy podejście A i podejście B mają rzeczywistą zaletę, której drugie nie ma (np. „minimalna edycja łatająca objaw” kontra „refaktoryzacja usuwająca klasę problemu”). Jeśli przyłapiesz się na wymyślaniu słabej drugiej opcji, aby spełnić szablon, nie rób tego — przedstaw jedną poprawkę i przejdź dalej.

**Ustalenia o LOW-impact**: pomiń dekompozycję — po prostu `Fix: [one line]`. Szum nie pomaga, gdy odpowiedź jest oczywista.

**Ustalenia o MEDIUM/HIGH-impact**: każda opcja otrzymuje:
```
[1-sentence approach] · Strength: [advantage, ideally grounded in plan/codebase evidence] · Tradeoff: [cost or risk] · Confidence: HIGH|MED|LOW — [1-line why] · Blind spot: [what we haven't verified, or "None significant"]
```

Gdy oferujesz dwie opcje, oznacz dokładnie jedną jako `⭐ Recommended`.

### Werdykty wymiarów i werdykt ogólny

Każdy wymiar: **PASS** / **WARNING** / **FAIL**.

- **SOUND** — bezpieczny do implementacji. Wszystkie PASS albo PASS z drobnymi ostrzeżeniami.
- **REVISE** — wymaga ukierunkowanych poprawek. Wiele ostrzeżeń lub 1 niekrytyczny FAIL.
- **RETHINK** — fundamentalne problemy. Wiele FAIL lub błędne podejście.

Sortuj ustalenia według istotności: CRITICAL → WARNING → OBSERVATION. Ogranicz do 10 — scal powiązane ustalenia, jeśli jest ich więcej.

## Krok 6: Przedstaw raport i zaproponuj zapis

Zwykły tekst, znaki ramek. Ustalenia pogrupowane według istotności; pomiń puste grupy. Wymiary PASS pojawiają się wyłącznie w tabeli werdyktów, nigdy jako ustalenia.

```
═══════════════════════════════════════════════════════════
  PLAN REVIEW: [Plan Title]
  Mode: Deep / Quick  |  Date: YYYY-MM-DD
  Findings: [N critical] [N warnings] [N observations]
═══════════════════════════════════════════════════════════

  End-State Alignment    PASS    ✅
  Lean Execution         WARNING ⚠️   (1 finding)
  Architectural Fitness  PASS    ✅
  Blind Spots            FAIL    ❌   (1 finding)
  Plan Completeness      WARNING ⚠️   (1 finding)

  Grounding: 5/5 paths ✓, 3/3 symbols ✓, brief↔plan ✓
  ► Overall: REVISE

═══════════════════════════════════════════════════════════
  CRITICAL FINDINGS ❌
═══════════════════════════════════════════════════════════

  F1 — No rollback for 50M-row backfill
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ❌ CRITICAL
    Impact:    🔬 HIGH — architectural stakes; think carefully before deciding
    Dimension: Blind Spots
    Location:  Phase 3 — Database Changes

    Detail:
    Plan adds a NOT NULL column to users (50M rows) but no phase
    covers rollback if the backfill fails mid-way. Partial backfill
    leaves the table in an inconsistent state.

    Fix A ⭐ Recommended: Make column nullable + separate restartable backfill
      Strength:   Restartable; partial progress isn't destructive; matches
                  the pattern used for users.email_verified_at last quarter.
      Tradeoff:   Two deploys (add nullable → backfill → enforce NOT NULL).
      Confidence: HIGH — this exact approach shipped cleanly 3 months ago.
      Blind spot: Enforce step still needs its own rollback note.

    Fix B: Add explicit rollback phase with full table snapshot
      Strength:   Single deploy; rollback is atomic.
      Tradeoff:   50M-row snapshot is expensive in disk and lock time.
      Confidence: MEDIUM — haven't measured snapshot cost on a table this size.
      Blind spot: Replication lag during snapshot is unverified.

═══════════════════════════════════════════════════════════
  WARNING FINDINGS ⚠️
═══════════════════════════════════════════════════════════

  F2 — Provider pattern for 2 config sources
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ⚠️ WARNING
    Impact:    🔎 MEDIUM — real tradeoff; pause to reason through it
    Dimension: Lean Execution
    Location:  Phase 1 — Config Refactor

    Detail:
    Plan builds a full provider-pattern config system for only two
    sources (env + file). A direct dict merge achieves the same end
    state with ~1/3 the code.

    Fix: Replace config provider abstraction with direct dict merge in
         load_config(). Introduce the provider pattern only when a third
         source appears.
      Strength:   Less code, fewer concepts to maintain.
      Tradeoff:   If a third source ships soon, we refactor twice.
      Confidence: HIGH — the existing codebase follows this "add abstraction
                  when needed" pattern everywhere else.
      Blind spot: Plans for additional config sources not surveyed.

  ···

  F3 — Vague "refactor utils as needed"
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ⚠️ WARNING
    Impact:    🏃 LOW — quick decision; fix is obvious and narrowly scoped
    Dimension: Plan Completeness
    Location:  Phase 2

    Detail:
    "Refactor format_output as needed" — format_output is imported by
    12 files across 4 modules. Implementer has no guidance.

    Fix: Specify exact signature changes and list callers needing updates.

═══════════════════════════════════════════════════════════
```

### Zasady formatowania raportu

- Linia **tytułu ustalenia** zawiera tylko ID i krótki tytuł — nic więcej. Wszystko pozostałe trafia poniżej jako oznaczone pola, aby każdy wiersz był krótki i łatwy do przeskanowania.
- **Zawsze łącz ikony ze słowem.** Nigdy nie używaj samej ikony jako jedynego sygnału — `❌ CRITICAL`, a nie samo `❌`. Dzięki temu raport pozostaje czytelny podczas przeglądania i nie wymaga od użytkownika zapamiętywania znaczenia każdej ikony.
- **Impact zawsze zawiera jednolinijkowe znaczenie** (skopiuj z tabeli Impact — „architectural stakes; think carefully before deciding” / „real tradeoff; pause to reason through it” / „quick decision; fix is obvious and narrowly scoped”). Dzięki temu LOW/MEDIUM/HIGH są zrozumiałe w miejscu użycia zamiast polegać na tym, że użytkownik pamięta tabelę.
- Severity, Impact, Dimension, Location są każde w osobnej linii z wyrównanymi etykietami. Detail zaczyna się w osobnej linii pod etykietą `Detail:`, aby mógł naturalnie się zawijać.

Następnie zapytaj:

```
question: "Plan review complete. How would you like to proceed?"
header: "Plan Review — [N] findings"
options:
  - label: "Triage findings"
    description: "Walk through each finding and decide."
  - label: "Save report & triage later"
    description: "Save the full report. Resume with /10x-plan-review <report-path>."
  - label: "Save report only"
    description: "Save and finish — I'll handle the findings myself."
multiSelect: false
```

### Zapisywanie raportu

Zapisz do `context/changes/<change-id>/reviews/plan-review.md` (jeden plan-review na folder zmiany; ponowne uruchomienie nadpisuje). Zaktualizuj `change.md`: `status: plan_reviewed`, `updated: <today>`.

```markdown
<!-- PLAN-REVIEW-REPORT -->
# Plan Review: [Plan Title]

- **Plan**: [plan file path]
- **Mode**: Deep / Quick
- **Date**: YYYY-MM-DD
- **Verdict**: [SOUND/REVISE/RETHINK]
- **Findings**: [N critical] [N warnings] [N observations]

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS/WARNING/FAIL |
| Lean Execution | PASS/WARNING/FAIL |
| Architectural Fitness | PASS/WARNING/FAIL |
| Blind Spots | PASS/WARNING/FAIL |
| Plan Completeness | PASS/WARNING/FAIL |

## Grounding
[grounding line]

## Findings

### F1 — No rollback for 50M-row backfill

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Database Changes
- **Detail**: Plan adds a NOT NULL column to users (50M rows) but no phase covers rollback if the backfill fails mid-way.
- **Fix A ⭐ Recommended**: Make column nullable + separate restartable backfill
  - Strength: Restartable; partial progress isn't destructive.
  - Tradeoff: Two deploys.
  - Confidence: HIGH — this approach shipped cleanly last quarter.
  - Blind spot: Enforce step still needs its own rollback note.
- **Fix B**: Add explicit rollback phase with full table snapshot
  - Strength: Single deploy; rollback is atomic.
  - Tradeoff: 50M-row snapshot is expensive in disk and lock time.
  - Confidence: MEDIUM — snapshot cost unverified at this size.
  - Blind spot: Replication lag during snapshot is unverified.
- **Decision**: PENDING

### F3 — Vague "refactor utils as needed"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2
- **Detail**: "Refactor format_output as needed" — imported by 12 files across 4 modules.
- **Fix**: Specify exact signature changes and list callers needing updates.
- **Decision**: PENDING
```

Znacznik `<!-- PLAN-REVIEW-REPORT -->` oraz pola `Decision: PENDING` umożliwiają tryb wznowienia.

„Save & triage later” → zapisz, wypisz ścieżkę, przypomnij o uruchomieniu `/10x-plan-review <saved-report-path>`.
„Triage” → przejdź do Kroku 7.

## Krok 7: Interaktywny triage

### Tryb wznowienia

Jeśli uruchomiono przez zapisany plik: przeczytaj go, sparsuj nagłówki `### F`, przefiltruj do `Decision: PENDING`. Jeśli nie ma żadnych, powiedz „Wszystkie ustalenia zostały przeanalizowane” i zatrzymaj się.

### Pętla triage

Przechodź przez ustalenia w kolejności istotności (CRITICAL → WARNING → OBSERVATION). Dla każdego:

**Z 2 opcjami poprawy:**
```
question: "F[N] — [title]\n\nSeverity: [sev icon] [SEV]\nImpact: [impact icon] [LEVEL] — [meaning]\nDimension: [dim]\nLocation: [loc]\n\nDetail: [detail]\n\n[Fix A block]\n\n[Fix B block]"
header: "Finding [current] of [total remaining]"
options:
  - label: "Apply Fix A ⭐"
    description: "[Fix A one-liner]"
  - label: "Apply Fix B"
    description: "[Fix B one-liner]"
  - label: "Fix differently"
    description: "Different approach — let's discuss."
  - label: "Skip"
    description: "Not worth addressing now."
  - label: "Accept risk"
    description: "Understood — I'll handle during implementation."
  - label: "Disagree"
    description: "Not actually an issue — dismiss."
multiSelect: false
```

**Z 1 opcją poprawy:** te same opcje, ale zastąp „Apply Fix A/B” pojedynczym „Fix in plan”.

**Obsługa odpowiedzi:**
- **Apply Fix A/B / Fix in plan**: pokaż dokładną edycję planu (przed/po). Krótkie potwierdzenie, następnie zastosuj. Oznacz jako FIXED (zapisz, której poprawki użyto, np. „Fixed via Fix A”).
- **Fix differently**: zapytaj o preferowane podejście, zastosuj je, oznacz jako FIXED.
- **Skip** → SKIPPED. **Accept risk** → ACCEPTED. **Disagree** → DISMISSED. Przejdź dalej, nie dyskutuj.

Po każdej decyzji, jeśli pracujesz z zapisanym plikiem, zaktualizuj jego pole `Decision:`.

### Podsumowanie

```
═══════════════════════════════════════════════════════════
  TRIAGE COMPLETE
═══════════════════════════════════════════════════════════

  Fixed:     F1 (Fix A), F3   (2)
  Skipped:   F4               (1)
  Accepted:  F2               (1)
  Dismissed: F5               (1)

  ► Verdict after fixes: [updated if fixes changed it, e.g. REVISE → SOUND]
═══════════════════════════════════════════════════════════
```

## Uwagi

- To umiejętność **review**. Analizuj i raportuj — nie przepisuj planu, chyba że zostaniesz o to poproszony podczas triage.
- Bądź konkretny. „Phase 3 introduces a second event system alongside the existing EventBus in `src/core/events.ts`” — nie „architecture might have issues”.
- Odróżniaj „nie zadziała” (FAIL) od „mogłoby być lepsze” (WARNING).
- Jeśli plan jest rzeczywiście dobry, powiedz to krótko i zakończ. Nie twórz sztucznych ustaleń.
- Impact dotyczy *wysiłku decyzyjnego*, a nie *istotności*. LOW impact przy ustaleniu CRITICAL oznacza, że poprawka jest oczywista; HIGH impact przy WARNING oznacza, że kompromis jest rzeczywisty.
- Dwie opcje poprawy tylko wtedy, gdy istnieje rzeczywisty kompromis. Nie wymyślaj alternatyw dla trywialnych poprawek.
- Podczas triage utrzymuj tempo. Użytkownik już przeczytał raport — przedstaw ustalenie, przyjmij decyzję, przejdź dalej.
- Podczas stosowania poprawki do planu wprowadzaj minimalne, ukierunkowane edycje. Nie restrukturyzuj całego planu dla jednego ustalenia.