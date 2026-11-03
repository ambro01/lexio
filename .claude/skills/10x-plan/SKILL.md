---
name: 10x-plan
description: Create detailed implementation plans with thorough research and iteration
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Edit
  - Bash
  - Agent
  - Task
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---
# Plan implementacji

Twoim zadaniem jest tworzenie szczegółowych planów implementacji w interaktywnym, iteracyjnym procesie. Zachowuj sceptycyzm, działaj dokładnie i współpracuj z użytkownikiem, aby tworzyć wysokiej jakości specyfikacje techniczne.

## Natywna możliwość zadawania pytań

Najpierw skieruj wywołanie: `/10x-plan <change-id> save` (również `$10x-plan <change-id> save`) albo prośba o zapisanie już uzgodnionego planu po zmianie trybu wznawia **trwałe zapisywanie**, a nie wywiad. Przeczytaj [references/plan-persistence.md](references/plan-persistence.md) i postępuj zgodnie z jego ścieżką zapisu przed sprawdzeniem wymagań wstępnych dotyczących pytań. Brak narzędzia do zadawania pytań nie jest przeszkodą, gdy nie pozostały żadne nierozstrzygnięte decyzje.

`AskUserQuestion` poniżej oznacza rzeczywiste narzędzie bieżącego środowiska do zadawania pytań strukturalnych: Claude Code `AskUserQuestion`, Codex `request_user_input` albo OpenCode `question`. Zachowaj znaczenie pytania oraz format rekomendacji/kompromisów podczas mapowania argumentów; rzeczywisty natywny schemat określa liczbę opcji i limity pól. Użyj mniejszej liczby opcji lub podziel niezależne pytania, gdy limit hosta jest bardziej restrykcyjny. Codex wymaga również unikalnego `id` pytania i nie udostępnia `multiSelect`; użyj tam osobnych pytań jednokrotnego wyboru, gdy wybory są niezależne. W OpenCode zamapuj `multiSelect` na `multiple`, zachowaj pytania jednokrotnego wyboru z `multiple: false` i zachowaj niestandardowe wprowadzanie tekstu (`custom: true`).

Przed pierwszym pytaniem sprawdź narzędzie rzeczywiście dostępne w bieżącej sesji. W Codex CLI/app-server natywne `request_user_input` wymaga **Plan collaboration mode**. Wywołanie tej umiejętności nie zmienia trybu hosta, a `codex exec` nie jest interaktywnym punktem wejścia do pytań. Host/kontroler musi rozpocząć interaktywną turę w trybie Plan. W OpenCode użyj sesji, której natywne narzędzie `question` ma podłączonego klienta pytań (na przykład interaktywny terminal); nienadzorowane uruchomienie wyłącznie tekstowe nie jest dowodem, że użytkownik może odpowiedzieć. Jeśli wymagane narzędzie natywne jest niedostępne, nazwij brakującą możliwość i zatrzymaj się przed założeniem odpowiedzi lub utworzeniem planu. W przypadku Codex zalecaj konkretnie przełączenie na Plan collaboration mode; w przypadku OpenCode ponownie podłącz interaktywnego klienta pytań i wznów sesję. Nie twierdź, że pytanie zostało przesłane, gdy wyświetlono jedynie tekst. Jawne nieinteraktywne zadanie, które zatrzymuje się z powodu brakujących wymagań wstępnych, nadal może zgłaszać te wymagania bez rozpoczynania wywiadu.

**Pokaż, o co pytasz.** Każde pytanie o akceptację lub potwierdzenie (złożoność, podejście, struktura faz) musi zawierać swój przedmiot. Najpierw napisz zwykłym tekstem asystenta w tej samej odpowiedzi podsumowanie wymagane przez krok, przed wywołaniem narzędzia; odpowiedź rozpoczynająca się wywołaniem narzędzia pytań na takim kroku jest błędna. Umieść również zwięzłą formę tego przedmiotu w samym tekście `question` — dla faz ponumerowaną listę faz — ponieważ niektóre hosty pokazują tylko okno dialogowe pytań. Nigdy nie proś użytkownika o zatwierdzenie czegoś, czego nie ma na ekranie.

Używaj obsługiwanego przez natywne narzędzie rozmiaru rundy: Claude Code 1–4 pytania; wytyczne Codex 1–3; OpenCode maksymalnie 4 pytania na rundę i z uwzględnieniem każdego bardziej restrykcyjnego limitu natywnego. Potwierdzony budżet pytań jest **łączny dla wszystkich rund**, a nie wymogiem zmieszczenia wszystkich pytań w pierwszym wywołaniu. Pytaj z poziomu agenta głównego; subagenci badawczy nie prowadzą wywiadu z użytkownikiem.

Sprawdź możliwość zapisu oddzielnie od możliwości zadawania pytań. Gdy host zezwala na pytania, lecz zabrania zapisów w repozytorium (w tym Codex Plan mode), przeczytaj [references/plan-persistence.md](references/plan-persistence.md). Wyjaśnij na początku, że ta sesja utworzy kompletny plan i brief w rozmowie, po czym w tej samej rozmowie nastąpi krok zapisu w Default mode. Umiejętność nie może przełączyć trybu hosta. Zachowaj najnowsze decyzje i korekty podczas tego przejścia; nie rozpoczynaj wywiadu od nowa.

## Pierwsza odpowiedź

Gdy to polecenie jest wywoływane:

1. **Sprawdź, czy podano parametry**:
   - Jeśli jako parametr podano ścieżkę pliku lub odwołanie do zgłoszenia, pomiń domyślną wiadomość
   - Natychmiast przeczytaj w CAŁOŚCI wszystkie podane pliki
   - Rozpocznij proces badawczy

2. **Jeśli nie podano parametrów**, odpowiedz:

```
I'll help you create a detailed implementation plan. Let me start by understanding what we're building.

Please provide:
1. The task/ticket description (or reference to a ticket file)
2. Any relevant context, constraints, or specific requirements
3. Links to related research or previous implementations

The more upstream context you pass in, the fewer questions I'll ask:
- Just a task description → full questioning
- Task + research doc (`context/changes/<change-id>/research.md`) → fewer questions; I won't redo what research covered
- Task + frame brief (`context/changes/<change-id>/frame.md`) → far fewer questions; the problem framing is already settled
- Task + frame + research → minimum questions; I focus only on solution-design decisions that need your input

Tip: invoke directly with a change-id or path — `/10x-plan oauth-login` or `/10x-plan @context/changes/oauth-login/frame.md`
For deeper analysis, try: `/10x-plan think deeply about @context/changes/oauth-login/research.md`
```

Następnie zaczekaj na dane wejściowe użytkownika.

## Kroki procesu

### Krok 1: Zebranie kontekstu i wstępna analiza

#### Krok 1.0: Zidentyfikuj artefakty wejściowe i dostosuj głębokość pytań

Przed jakimkolwiek czytaniem zidentyfikuj, jakie rodzaje artefaktów wejściowych przekazał użytkownik. Każdy z nich reprezentuje już podjęte decyzje — nie pytaj o nie ponownie.

- **Frame brief** — ścieżka pasuje do `context/changes/<change-id>/frame.md` albo treść zaczyna się od `# Frame Brief:` / zawiera sekcję `## Reframed`.
- **Dokument badawczy** — ścieżka pasuje do `context/changes/<change-id>/research.md` albo frontmatter YAML zawiera pola `topic:` i `researcher:`.
- **Istniejący plan** — ścieżka pasuje do `context/changes/<change-id>/plan.md` (tryb wznowienia/dopracowania — poza zakresem tej logiki skalowania).
- **Tylko opis zadania** — żadne z powyższych.

**Liczba pytań i ich zakres skalują się wraz z dostarczonymi materiałami:**

| Artefakty wejściowe | LOW | MEDIUM | HIGH | Co zmienia się względem poziomu bazowego |
| --------------------------- | ----- | ------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Tylko zadanie (poziom bazowy) | 4–6 | 7–10 | 11–15 | Pełne pytania we wszystkich istotnych kategoriach. |
| Zadanie + badania | 3–5 | 5–7 | 8–11 | Pomiń pytania, na które odpowiedź znajduje się już w dokumencie badawczym. Nie uruchamiaj ponownie subagentów, aby znaleźć to, co badania już zmapowały. |
| Zadanie + frame | 2–3 | 4–6 | 7–9 | Pomiń kategorie [D]iagnostyczne — frame ustalił sposób ujęcia problemu. Traktuj Reframed (lub Confirmed) Problem Statement jako autorytatywne. |
| Zadanie + frame + badania | 1–2 | 3–5 | 5–7 | Pomiń oba. Pytaj wyłącznie o pytania [S]olution-design, które rzeczywiście wymagają wkładu użytkownika. |

**Wyjątek dotyczący ustalonych danych wejściowych:** jeśli artefakty wejściowe już rozstrzygają każdą istotną decyzję dotycząą rozwiązania, zaproponuj **0 merytorycznych pytań**, krótko wskaż te dowody i uzyskaj zwykłe natywne potwierdzenie złożoności/budżetu. Zachowaj natywną akceptację struktury. Jeśli uzgodniony budżet staje się niepotrzebny po późniejszych odpowiedziach, potwierdź zmianę zamiast sztucznie dodawać pytania. Powyższe zakresy wskazują nierozstrzygniętą pracę; nie wymagają wymyślania decyzji.

**Zasada**: każdy przekazany artefakt jest źródłem już podjętych decyzji. Czytanie ich jest formą słuchania użytkownika. Nie pytaj użytkownika o to, co już zapisał.

**Gdy obecny jest frame**, przeczytaj go W CAŁOŚCI i traktuj jako autorytatywny:
- Skopiuj **Reported Observation** + **Reframed (lub Confirmed) Problem Statement** jako definicję zadania. Nie kwestionuj ponownie sposobu ujęcia problemu.
- Przenieś tabelę **Hypothesis Investigation** i **Narrowing Signals** do swojej „Current State Analysis” — ta praca została już wykonana.
- Jeśli oznaczono **Confidence: LOW** dla frame, uwidocznij to w „Open Risks & Assumptions” planu i zadaj JEDNO pytanie doprecyzowujące o dalsze postępowanie (najpierw zweryfikować czy planować z uznanym ryzykiem).
- NIE badaj ponownie sposobu ujęcia problemu. Frame odpowiada za ujęcie problemu; ty odpowiadasz za projekt rozwiązania.

**Gdy obecne są badania**, przeczytaj je W CAŁOŚCI i wykorzystaj jako punkt odniesienia dla kodu:
- Sekcja „Code References” JEST twoim oparciem w kodzie — nie uruchamiaj ponownie agentów Explore, aby znaleźć te same pliki.
- „Architecture Insights” zasilają bezpośrednio „Current State Analysis.”
- Uruchamiaj subagentów tylko po to, aby wypełnić konkretne luki, których badania nie obejmują (np. dokładne pliki, które zmodyfikuje ten plan, jeśli badania były szersze).

#### Krok 1.1: Czytanie i badanie

1. **Natychmiast przeczytaj W CAŁOŚCI wszystkie wspomniane pliki**:
   - Pliki referencyjne (np. `context/changes/<change-id>/research.md`, `context/changes/<change-id>/frame.md`)
   - Dokumenty badawcze
   - Frame briefs
   - Powiązane plany implementacji
   - Wszelkie wspomniane pliki JSON/danych
   - `context/foundation/lessons.md`, jeśli istnieje — traktuj jego reguły jako wcześniejsze założenia podczas badania zakresu, przypadków brzegowych i wyborów architektonicznych; zasady już zaakceptowane przez zespół zawężają pulę pułapek projektowych, które nadal wymagają świeżych pytań.
   - **WAŻNE**: używaj narzędzia Read BEZ parametrów limit/offset, aby czytać całe pliki
   - **KRYTYCZNE**: NIE uruchamiaj podzadań przed samodzielnym przeczytaniem tych plików w głównym kontekście
   - **NIGDY** nie czytaj plików częściowo — jeśli plik jest wspomniany, przeczytaj go w całości

2. **Uruchom równoległe badania przed wywiadem**:
   Przed zadaniem użytkownikowi jakichkolwiek pytań deleguj nierozstrzygnięte luki dowodowe do subagentów pracujących równolegle — domyślnie 2–3 w jednej wiadomości, każdy w innym wymiarze wyszukiwania (np. „znajdź wszystkie pliki związane z X”, „znajdź podobne implementacje Y”, „znajdź wcześniejsze decyzje dotyczące Z w `context/changes/**/` i `context/archive/**/`”), prosząc każdego o kotwice `file:line`. Przed pierwszym delegowaniem przeczytaj [references/task-orchestration.md](references/task-orchestration.md), aby poznać kontrakt delegowania, obsługę zastępczą możliwości i wymagania dowodowe. Rozstrzygnij pojedynczy zlokalizowany fakt poprzez ukierunkowany odczyt lokalny zamiast delegowania oraz pozostaw pytania produktowe i decyzje międzykomponentowe głównemu agentowi. W Claude Code deleguj za pomocą narzędzia `Agent` (`Task` w starszych wersjach Claude Code) — `subagent_type: "Explore"` do lokalizowania kodu, `"general-purpose"` do analizy; w innych hostach użyj natywnego odpowiednika. Zaczekaj na zakończenie wszystkich uruchomionych subagentów, zanim zintegrujesz ich wyniki.

3. **Przeczytaj wszystkie pliki wskazane przez zadania badawcze**:
   - Po zakończeniu zadań badawczych przeczytaj WSZYSTKIE pliki, które wskazały jako istotne
   - Przeczytaj je W CAŁOŚCI w głównym kontekście
   - Zapewnia to pełne zrozumienie przed przejściem dalej

4. **Analizuj i weryfikuj zrozumienie**:
   - Porównaj wymagania zgłoszenia z rzeczywistym kodem
   - Zidentyfikuj wszelkie rozbieżności lub nieporozumienia
   - Zapisz założenia wymagające weryfikacji
   - Ustal rzeczywisty zakres na podstawie realiów kodu
   - **Badaj słowa, których żądanie nie definiuje.** Terminy rankingowe, wyboru i stanu — „top N”, „latest”, „first”, „winner”, „duplicate”, „active”, „until the end” — ustalają tylko to, co mówią dosłownie. Dla każdego zbuduj najmniejszy przypadek, w którym dwa odczytania dają różne widoczne dla użytkownika wyniki, a następnie sprawdź, co robi kod w tym przypadku; rozstrzygnięcie remisu przez id, kolejność wstawiania lub pozycję w tablicy nie jest decyzją podjętą przez kogokolwiek, więc nie rozstrzyga terminu. Każdy termin, którego odczytania się różnią, staje się pytaniem pierwszej rundy. Zobacz [references/question-examples.md](references/question-examples.md#undefined-terms-in-the-request), aby dowiedzieć się, jak budować przypadek, formułować opcję i rejestrować wynik.

5. **Przedstaw świadome zrozumienie i oceń złożoność**:

   Najpierw przedstaw krótkie podsumowanie tego, co udało się znaleźć:

   ```
   Based on [the ticket and my research of the codebase / your description and my analysis], I understand we need to [accurate summary].

   I've found that:
   - [Key discovery — code reference, existing asset, prior work, or domain constraint]
   - [Relevant pattern, convention, or constraint discovered]
   - [Potential complexity or edge case identified]
   ```

   Następnie oceń złożoność zadania i przedstaw ją użytkownikowi do potwierdzenia:

   ```
   **Complexity Assessment: [HIGH / MEDIUM / LOW]**

   [2-3 sentence explanation of WHY this complexity level, referencing specific factors:
   number of systems touched, integration points, state management needs,
   data model changes, unknown unknowns, testing surface area, etc.]

   I'd like to ask **[N] questions** across multiple rounds to nail down the important
   decisions about [list key decision areas: architecture, edge cases, data model, UX, testing, etc.].

   Does this feel right, or would you adjust the complexity level?
   ```

   Najpierw wyślij powyższą ocenę jako widoczną wiadomość czatu, a następnie użyj AskUserQuestion do potwierdzenia. Nazwij poziom, liczbę pytań i obszary decyzji w tekście pytania:
   - question: `"Complexity [LEVEL], [N] questions on [decision areas]. Does this assessment match your expectations?"`
     header: `"Complexity"`
     options:
     - label: `"⭐ Recommended: [N] questions (Recommended)"`
       description: `"Use the proposed question budget. · Strength: Focuses on identified decisions. · Tradeoff: Newly discovered gaps may require an adjustment."`
     - label: `"Higher — ask more questions"`
       description: `"Expand the interview with the missing concerns. · Strength: Covers additional risks. · Tradeoff: Requires more user time."`
     - label: `"Lower — fewer questions needed"`
       description: `"Reduce the interview to the remaining decisions. · Strength: Avoids redundant questions. · Tradeoff: Requires identifying which concerns are already settled."`
       multiSelect: false

   **Skala złożoności:**

   | Poziom | Pytania | Kiedy używać |
   | ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | **LOW** | 4-6 | Proste zadanie z jasnymi wymaganiami. Niewiele ruchomych części, podąża za ustalonymi wzorcami lub konwencjami, ograniczone niewiadome. Przykłady programistyczne: zmiana pojedynczego pliku, modyfikacja konfiguracji. Przykłady nieprogramistyczne: konspekt dotyczący jednego tematu, prosta zmiana procesu. |
   | **MEDIUM** | 7-10 | Wiele komponentów lub aspektów, które ze sobą współdziałają. Wymaga decyzji projektowych, ma przypadki brzegowe warte omówienia, pewną niejednoznaczność podejścia. Przykłady programistyczne: funkcja w wielu plikach, nowy endpoint API. Przykłady nieprogramistyczne: wieloczęściowy plan treści, przeprojektowanie przepływu pracy, moduł kursu. |
   | **HIGH** | 11-15 | Zagadnienia przekrojowe, istotne niewiadome, wielu interesariuszy lub ograniczeń. Wymaga myślenia architektonicznego, niesie ryzyko kosztownych poprawek w razie błędu. Przykłady programistyczne: przeprojektowanie systemu, migracja danych. Przykłady nieprogramistyczne: strategia uruchomienia wielokanałowego, przebudowa programu nauczania, zmiana procesu organizacyjnego. |

   Po potwierdzeniu (lub dostosowaniu) przez użytkownika przejdź do zadawania pytań.

6. **Zadawaj dogłębne pytania sondujące za pomocą AskUserQuestion**:

   Pytaj o pozostałe decyzje w ramach potwierdzonego łącznego budżetu, używając powyższego natywnego rozmiaru rund. Budżet obejmuje merytoryczne doprecyzowania; nie jest limitem do wypełnienia ani pozwoleniem na ponowne otwieranie ustalonych interfejsów.

   **Reguły struktury pytań:**
   - Każde pytanie powinno mieć 2–4 konkretne opcje w ramach rzeczywistego natywnego schematu; użyj 2–3, gdy jest to limit hosta
   - Używaj `multiSelect: true` tylko wtedy, gdy wybory nie wykluczają się wzajemnie
   - Zachowaj krótki `header` (maks. 12 znaków): `"Scope"`, `"Edge cases"`, `"Priority"`
   - Użytkownik zawsze może wybrać `"Other"` dla swobodnej odpowiedzi tekstowej

   **Każde pytanie MUSI mieć jedną rekomendację; każda opcja MUSI zawierać analizę kompromisów:**
   - Umieść dokładnie jedną rekomendowaną opcję **jako pierwszą**, z dokładnym szablonem etykiety `⭐ Recommended: [short choice] (Recommended)`. Zachowaj dosłowny znacznik `⭐ Recommended` oraz natywny sufiks `(Recommended)` razem; skracaj tekst wyboru, nigdy nie skracaj znacznika do `⭐ Rec`. Spełnia to zarówno format umiejętności, jak i natywne pozycjonowanie rekomendacji.
   - `description` każdej opcji musi mieć format:
     `[1-sentence what this does] · Strength: [key advantage] · Tradeoff: [key cost or risk]`
   - Rekomendacja powinna opierać się na badaniach (wzorce w kodzie dla oprogramowania, wiedza domenowa i kontekst dla zadań nieprogramistycznych) — nie na zgadywaniu

   **Sprawdź payload przed wywołaniem narzędzia:** każdy `header` ma 1–12 znaków (licz spacje), każde pytanie ma 2–4 odrębne wybory w rzeczywistym limicie hosta, tylko pierwsza etykieta zawiera dokładny znacznik `⭐ Recommended`, a każdy opis zawiera zarówno ` · Strength: `, jak i ` · Tradeoff: ` z konkretną treścią. Używaj `Format` zamiast 13-znakowego `Output format`. Zweryfikuj same argumenty wywołania natywnego, a nie wyłącznie podgląd tekstowy.

   **Przykładowe wywołanie AskUserQuestion z rekomendacjami (oprogramowanie — wdrożenie):** `Rollout` jest `[S]` — strategią wdrożenia; pytaj tylko wtedy, gdy zmiana może zawieść na produkcji w sposób, który ścieżka wydania musiałaby ograniczyć, w przeciwnym razie odziedzicz domyślny standard zespołu.

   AskUserQuestion with questions:
   - question: "How should the new pricing calculation reach production accounts?"
     header: "Rollout"
     options:
     - label: "⭐ Recommended: Flagged canary (Recommended)"
       description: "Ship behind a feature flag enabled for 10% of accounts first, then widen. · Strength: A wrong price hits a bounded group and reverts with a flag flip, no redeploy — reuses the flag wrapper already gating the checkout redesign. · Tradeoff: Both calculation paths stay live until cleanup, so pricing tests must cover each one."
     - label: "Ship to everyone at once"
       description: "Deploy the new calculation for all accounts in a single release. · Strength: One code path from day one — nothing to clean up and no flag bookkeeping. · Tradeoff: Rollback means a redeploy, and incorrect invoices have already reached customers."
     - label: "Shadow run first"
       description: "Compute old and new prices in parallel, log the differences, serve only the old result for two weeks. · Strength: Surfaces disagreements against real traffic with zero customer impact. · Tradeoff: Delays launch by the observation window and adds a diff log nobody owns yet."
     multiSelect: false

   **Przykładowe wywołanie AskUserQuestion z rekomendacjami (oprogramowanie):** `Conflicts` jest `[S]` — architekturą rozwiązania; pytaj tylko wtedy, gdy decyzja pozostaje nierozstrzygnięta po przeczytaniu artefaktów wejściowych.

   AskUserQuestion with questions:
   - question: "How should the system handle conflicts when two users edit simultaneously?"
     header: "Conflicts"
     options:
     - label: "⭐ Recommended: Guided merge (Recommended)"
       description: "Show conflict to user, let them choose which version to keep. · Strength: Prevents data loss while keeping UX simple — matches the pattern in existing EditPanel component. · Tradeoff: Adds a conflict resolution modal and WebSocket subscription for real-time detection."
     - label: "Last write wins"
       description: "Later save silently overwrites earlier one. · Strength: Zero added complexity, no UI changes needed. · Tradeoff: Users can lose work without warning — acceptable only if edits are rare or low-stakes."
     - label: "Lock-based"
       description: "First editor locks the resource; others see read-only until released. · Strength: Prevents conflicts entirely — simplest mental model for users. · Tradeoff: Stale locks require TTL + cleanup logic; blocks legitimate concurrent work."
     multiSelect: false

   **Przykładowe wywołanie AskUserQuestion z rekomendacjami (nieprogramistyczne — treść/strategia):** `Depth` jest `[D]` — diagnostyczne w zakresie odbiorców/zakresu; pomiń, jeśli frame brief już ustalił, dla kogo jest to przeznaczone.

   AskUserQuestion with questions:
   - question: "What depth of technical detail should the course module target?"
     header: "Depth"
     options:
     - label: "⭐ Recommended: Guided practice (Recommended)"
       description: "Concepts paired with step-by-step exercises. · Strength: Balances understanding and practice — matches the format that got highest completion rates in 10xDevs2. · Tradeoff: 2-3x more prep time per lesson; requires working example repos."
     - label: "Conceptual overview"
       description: "High-level principles, no code. · Strength: Accessible to all skill levels, faster to produce. · Tradeoff: Advanced learners may find it too shallow — risks losing engagement."
     - label: "Deep dive with open challenges"
       description: "Minimal scaffolding, real-world problems. · Strength: Forces genuine problem-solving, highest learning retention. · Tradeoff: High dropout risk for less experienced learners; harder to support at scale."
     multiSelect: false

   **O co pytać** — dostosuj kategorie do domeny zadania:

   Najpierw zidentyfikuj domenę zadania: **oprogramowanie**, **treści/edukacja**, **strategia/proces** albo **hybryda**. Następnie wybierz pasujące kategorie pytań. Poniższe kategorie są zorganizowane według domeny — wybieraj to, co istotne; nie wymuszaj kategorii programistycznych w zadaniach nieprogramistycznych.

   **Każda kategoria jest oznaczona `[D]` (diagnostyczna — dotycząca problemu) albo `[S]` (rozwiązanie — dotycząca sposobu budowy).** Gdy frame brief został dostarczony w Kroku 1.0, **pomiń wszystkie kategorie `[D]`** — frame je rozstrzygnął. Zawsze pytaj o kategorie `[S]`, dla których nadal potrzebny jest wkład użytkownika.

   **Kategorie uniwersalne (wszystkie domeny, wszystkie poziomy):**
   - **Granice zakresu** `[D]`: Co jest w zakresie, a co poza nim
   - **Przypadki brzegowe / tryby awarii** `[S]`: Co dzieje się, gdy coś pójdzie nie tak albo stanie się nietypowe (obsługa implementacyjna, nawet jeśli frame nazwał klasę obserwacji). Zacznij od nieokreślonych terminów ujawnionych w Kroku 1.1 — umieść konkretny przypadek w pytaniu zamiast nazywać kategorię
   - **Kryteria sukcesu** `[D]`: Skąd wiemy, że to zadziałało — z perspektywy użytkownika końcowego lub interesariusza
   - **Priorytet** `[D]`: Niezbędne kontra mile widziane — co zostaje wycięte, jeśli czas jest ograniczony

   **Kategorie specyficzne dla oprogramowania (dodawaj zgodnie ze złożonością):**

   MEDIUM+:
   - **Decyzje dotyczące modelu danych** `[S]`: Schemat, relacje, ograniczenia, migracje
   - **Strategia obsługi błędów** `[S]`: Tryby awarii, logika ponowień, komunikaty dla użytkownika
   - **Podejście do testowania** `[S]`: Poziom pokrycia, które przypadki brzegowe testować wyraźnie
   - **Granice wydajności** `[S]`: Oczekiwane obciążenie, akceptowalne opóźnienia, cache'owanie

   HIGH:
   - **Wybory architektoniczne** `[S]`: Granice usług, synchronicznie kontra asynchronicznie, zdarzenia kontra żądanie-odpowiedź
   - **Zarządzanie stanem** `[S]`: Gdzie stan jest przechowywany, gwarancje spójności, rozwiązywanie konfliktów
   - **Model bezpieczeństwa** `[S]`: Granice uwierzytelniania, dostęp do danych, walidacja wejścia
   - **Migracja i wycofanie** `[S]`: Wdrożenie przyrostowe, strategia wycofania
   - **Obserwowalność** `[S]`: Kluczowe metryki, alertowanie, powierzchnia debugowania

   **Kategorie treści / edukacji (dodawaj zgodnie ze złożonością):**

   MEDIUM+:
   - **Odbiorcy i wymagania wstępne** `[D]`: Dla kogo to jest, co już wiedzą
   - **Format i medium** `[S]`: Tekst, wideo, interaktywnie, na żywo — i dlaczego
   - **Łuk narracyjny** `[S]`: Jaką podróż odbywa czytelnik/uczący się
   - **Przykłady i ćwiczenia** `[S]`: Co utrwala koncepcje

   HIGH:
   - **Zależności programu nauczania** `[D]`: Czego należy nauczyć się przed czym
   - **Strategia oceny** `[S]`: Jak zweryfikować, że nauka nastąpiła
   - **Ponowne wykorzystanie i modułowość** `[S]`: Czy części mogą być używane samodzielnie lub w innych kontekstach
   - **Dystrybucja i dostęp** `[D]`: Gdzie to się znajduje, jak ludzie to znajdują

   **Kategorie strategii / procesu (dodawaj zgodnie ze złożonością):**

   MEDIUM+:
   - **Interesariusze i role** `[D]`: Kto jest zaangażowany, kto decyduje, kto wykonuje
   - **Harmonogram i kamienie milowe** `[S]`: Kluczowe daty, zależności, ścieżka krytyczna
   - **Identyfikacja ryzyk** `[S]`: Co może pójść nie tak, jaki jest plan awaryjny
   - **Ograniczenia zasobów** `[D]`: Budżet, czas, ludzie, narzędzia

   HIGH:
   - **Zarządzanie zmianą** `[S]`: Jak osoby, których to dotyczy, dowiedzą się o tym i wdrożą to
   - **Ramy pomiaru** `[D]`: Wskaźniki wyprzedzające kontra opóźnione, jak korygować kurs
   - **Zależności i sekwencjonowanie** `[S]`: Co co blokuje, co może działać równolegle
   - **Plan komunikacji** `[S]`: Kto musi wiedzieć co, kiedy i przez który kanał

   **O co NIE pytać:**
   - O cokolwiek już ustalonego w artefaktach wejściowych (frame brief, dokument badawczy) — ponowne pytanie jest trybem błędu, któremu ma zapobiegać to skalowanie
   - O niskopoziomowe szczegóły implementacyjne, które możesz ustalić samodzielnie (na podstawie badań kodu dla oprogramowania, z plików kontekstowych i wcześniejszej pracy dla zadań nieprogramistycznych)
   - O pytania z oczywistymi odpowiedziami przy uwzględnieniu dostarczonego już kontekstu
   - O preferencje, które nie wpływają na strukturę planu ani jego sukces

   Użyj Kroku 1.0, aby zaproponować budżet odpowiedni do złożoności i dowodów wejściowych. Uwzględnij każdą istotną nierozstrzygniętą decyzję w ramach budżetu potwierdzonego przez użytkownika; w razie potrzeby poproś o rozszerzenie, zanim zadasz kolejne merytoryczne pytanie. Nie wypełniaj sztucznie wywiadu ani nie otwieraj ponownie ustalonych wyborów, aby osiągnąć sugerowany zakres. Każde pytanie powinno rozstrzygać rzeczywistą lukę.

   Prowadź wewnętrzny rejestr nierozstrzygniętych decyzji użytkownika i najnowszej jawnej odpowiedzi dla każdej z nich. Częściowa odpowiedź albo „nie wiem” pozostawia decyzję otwartą, chyba że użytkownik wyraźnie deleguje wybór. Mechanizm już obecny w kodzie nie rozstrzyga nierozstrzygniętego wyboru produktowego dotyczącego sposobu jego użycia. Korekty zastępują wcześniejszą decyzję, zachowując pozostałe odpowiedzi.

   Przed przedstawieniem podejścia sprawdź, czy każda nierozstrzygnięta decyzja ma odpowiedź lub wyraźną delegację. Uzgodniony budżet pytań obejmuje rundy doprecyzowujące; nie wypełniaj go nowymi tematami, gdy wcześniejsze odpowiedzi nadal wymagają wyjaśnienia. Jeśli budżet wyczerpie się przy otwartej decyzji, określ, co pozostało, i zapytaj, czy rozszerzyć wywiad, zamiast po cichu wybierać albo twierdzić, że wywiad jest ukończony.

   Przenoś dokładne predykaty decyzji do podsumowań, przykładów i rezultatów. Zachowuj granice, wyjątki, jednostki i kierunek przy skracaniu odpowiedzi; węższa lub szersza reguła jest nową decyzją. Sprawdź proponowane sformułowanie względem przypadku granicznego. Po korekcie zaktualizuj zależne przykłady i brief, a także rejestr decyzji, zachowując niezwiązane wybory jako ustalone.

### Krok 2: Badania i odkrywanie

Po uzyskaniu wstępnych wyjaśnień od użytkownika TERAZ zajmij się szczegółami implementacyjnymi:

1. **Zbadaj wzorce implementacji i wcześniejsze prace**:
   W tej fazie odpowiadaj samodzielnie na pytania implementacyjne — nie proś użytkownika o podejmowanie tych decyzji.

   **W przypadku zadań programistycznych**, zbadaj bazę kodu:
   - Jakich wzorców używa baza kodu dla podobnych funkcji?
   - Jakie jest ustalone podejście do obsługi błędów / logowania / testowania?
   - Które istniejące komponenty lub narzędzia pomocnicze można ponownie wykorzystać?
   - Jakie ograniczenia narzuca obecna architektura?

   **W przypadku zadań nieprogramistycznych**, zbadaj pliki kontekstowe i wcześniejsze prace:
   - Jakie formaty, struktury lub szablony stosowano wcześniej dla podobnej pracy?
   - Jakie ograniczenia wynikają z wcześniejszych decyzji, odbiorców lub platformy?
   - Jakie powiązane treści lub procesy już istnieją, z którymi to powinno być zgodne?
   - Co działało dobrze (lub nie) w poprzednich iteracjach?

   **To NIE jest decyzja dla użytkowników** — ustalasz to poprzez badanie istniejących wzorców, plików i kontekstu.

2. **Jeśli użytkownik skoryguje jakiekolwiek nieporozumienie**:
   - Przyjmij zmienione preferencje jako najnowszą decyzję użytkownika; nie wymagaj dowodu źródłowego dla preferencji.
   - Zweryfikuj skorygowane twierdzenia faktograficzne w wskazanym źródle; deleguj tylko wtedy, gdy niezależne dochodzenie jest użyteczne
   - Przeczytaj dotknięte pliki lub sekcje, zachowując niezwiązane zweryfikowane ustalenia
   - Kontynuuj dopiero po samodzielnej weryfikacji faktów

3. **Zaktualizuj nierozstrzygnięte pytania i właścicieli**:
   Ponownie wykorzystaj listę roboczą z Kroku 1. Śledź pracę wieloobszarową za pomocą natywnych narzędzi zadań, jeśli są dostępne; dla pojedynczego wyszukania nie jest potrzebna dodatkowa ceremonia śledzenia.

4. **Badaj tylko pozostałe luki**:
   Zastosuj referencję orkiestracji do ograniczonego delegowania, dostępnych wyborów modeli, błędów uruchamiania i nieaktualnych wyników. Niezależne zadania mogą działać współbieżnie; zadania zależne czekają na swoje wymaganie wstępne. Ponownie wykorzystaj istniejącego pracownika do ukierunkowanej kontynuacji.

5. **Zamknij odkrywanie na granicy dowodów**:
   Syntezuj wyniki, gdy napływają; weryfikuj istotne twierdzenia i rozwiązuj istotne konflikty. Zatrzymaj się, gdy potrafisz wyjaśnić dotknięte kontrakty, wzorce możliwe do ponownego wykorzystania, weryfikację i pozostałe decyzje użytkownika. Anuluj nieistotne eksploracje. Niedokończone wymagane kontrole pozostają blokujące; nie zastępuj dowodów budżetem czasowym.

6. **Przedstaw ustalenia i opcje projektowe za pomocą AskUserQuestion**:

   Najpierw wyślij krótkie podsumowanie wyników badań jako widoczną wiadomość czatu (przed jakimkolwiek pytaniem o podejście):

   ```
   Based on my research, here's what I found:

   **Current State:**
   - [Key discovery about existing code]
   - [Pattern or convention to follow]
   ```

   Sprawdź podejścia względem ustalonych wymagań przed ich zaproponowaniem. Odrzuć opcje, które pomijają wymagane gwarancje; nie wymyślaj alternatyw, aby wypełnić limit. Rozróżniaj decyzje użytkownika od brakujących dowodów i szczegółów implementacyjnych, które agent może wyprowadzić.

   Następnie, jeśli istnieje wiele prawidłowych podejść, przedstaw je jako ustrukturyzowane wybory za pomocą AskUserQuestion:

   AskUserQuestion:
   - question: "Which implementation approach should we use?"
     header: "Approach"
     options:
     - label: "⭐ Recommended: [Option A] (Recommended)"
       description: "[What A does]. · Strength: [Evidence-backed advantage]. · Tradeoff: [Concrete cost or limitation]."
     - label: "[Option B name]"
       description: "[What B does]. · Strength: [Evidence-backed advantage]. · Tradeoff: [Concrete cost or limitation]."

   Jeśli wyraźnie istnieje jedno najlepsze podejście, pomiń AskUserQuestion i wyjaśnij, dlaczego je wybrano.
   Pytaj tylko wtedy, gdy wybór rzeczywiście ma znaczenie i nie możesz ustalić odpowiedzi na podstawie wzorców w bazie kodu.

### Krok 3: Opracowanie struktury planu

Po uzgodnieniu podejścia:

1. **Przedstaw zarys planu i uzyskaj ustrukturyzowaną informację zwrotną**:

   Najpierw zapisz proponowane fazy zwykłym tekstem asystenta w tej samej odpowiedzi, przed wywołaniem narzędzia. To wymóg, a nie opcja: użytkownik zatwierdza tę listę, więc musi być widoczna na ekranie przed pojawieniem się pytania.

   ```
   Here's my proposed plan structure:

   ## Overview
   [1-2 sentence summary]

   ## Implementation Phases:
   1. [Phase name] - [what it accomplishes]
   2. [Phase name] - [what it accomplishes]
   3. [Phase name] - [what it accomplishes]
   ```

   Następnie użyj AskUserQuestion. Powtórz ponumerowane nazwy faz w tekście pytania (po jednym wierszu na fazę), aby lista była widoczna nawet tam, gdzie host pokazuje wyłącznie okno dialogowe:
   - question: `"Does this phase breakdown look right?\n1. [Phase name] - [what it accomplishes]\n2. [Phase name] - [what it accomplishes]\n3. [Phase name] - [what it accomplishes]"`
     header: `"Phases"`
     options:
     - label: `"⭐ Recommended: Approve phases (Recommended)"`
       description: `"Write the detailed plan with these phases. · Strength: Uses the reviewed structure. · Tradeoff: Later scope changes require revisiting it."`
     - label: `"Needs adjustment"`
       description: `"Revise the phase scope or ordering. · Strength: Addresses missing constraints now. · Tradeoff: Adds a planning round."`
     - label: `"Too granular"`
       description: `"Combine phases into larger units. · Strength: Reduces coordination overhead. · Tradeoff: Each verification step covers more work."`
       multiSelect: false

### Krok 4: Pisanie szczegółowego planu

Po zatwierdzeniu struktury:

Jeśli zapisy w repozytorium są zabronione, przygotuj pełny plan przy użyciu [references/plan-templates.md](references/plan-templates.md) oraz briefu z Kroku 4.5 **w rozmowie**, a następnie wydaj przekazanie do trwałego zapisu z `references/plan-persistence.md`. Nie twórz folderów, nie aktualizuj metadanych, nie zapisuj szkicu w innym miejscu ani nie deleguj zapisów, aby obejść ograniczenie hosta. To stan `awaiting_persistence`, a nie zapisany lub ukończony plan. Host z możliwością zapisu podąża bezpośrednio zwykłą ścieżką poniżej.

1. **Rozstrzygnij folder zmiany, a następnie zapisz plan** do `context/changes/<change-id>/plan.md`.
   - Jeśli użytkownik wywołał `/10x-plan <change-id>` i `context/changes/<change-id>/` już istnieje, użyj go.
   - W przeciwnym razie wyprowadź kebab-case `<change-id>` z tematu i utwórz folder + `change.md` (odzwierciedlając semantykę `/10x-new`) przed zapisem.
   - Odmów, jeśli rozstrzygnięta ścieżka zaczyna się od `context/archive/` — wyświetl: `"This change is archived. Open a new change with `/10x-new` instead."` i ZATRZYMAJ się.
   - Po zapisaniu i zweryfikowaniu zarówno planu, jak i briefu, przesuń wyłącznie `new`/`preparing` do `planned` oraz ustaw `updated: <today>`; zachowaj tożsamość, niezwiązane metadane i późniejsze stany cyklu życia. Użyj ograniczonego helpera metadanych/fallbacku z [plan-persistence.md](references/plan-persistence.md#reuse-the-metadata-helper).
   - **Zsynchronizuj roadmapę** (najlepszy wysiłek): jeśli `context/foundation/roadmap.md` zawiera element, którego `Change ID` jest równe `<change-id>`, zmień temu elementowi `Status: planning`. Zobacz „## Roadmap status sync” poniżej. Nigdy nie blokuje; większość zmian nie będzie śledzona w roadmapie.
2. **Przeczytaj teraz [references/plan-templates.md](references/plan-templates.md) i użyj jego struktury pełnego planu.** Bloki faz zawierają zwykłe punktorowane elementy — `- `, a nie `- [ ]` — a pojedyncza kanoniczna sekcja `## Progress` na dole zarządza stanem checkboxów; zobacz `references/progress-format.md`. Nie ładuj szablonów artefaktów podczas odkrywania tylko po to, aby przygotować się do późniejszego pisania.

Sekcja Progress jest mechaniczna — wygeneruj jedną `### Phase N: <name>` na fazę, z podsekcjami `#### Automated` / `#### Manual` wymieniającymi każde kryterium Success Criteria z tej fazy jako `- [ ] <phase>.<index> <title>`. Pomiń puste podsekcje. Same bloki Phase zawierają zwykłe punktory `- ` (bez checkboxów); sekcja `## Progress` jest jedynym miejscem, w którym występują `[ ]` / `[x]`.

### Krok 4.5: Brief planu (dwustronicowy)

Po zapisaniu pełnego planu wygeneruj zwięzły brief, który zapewni czytelnikowi obraz całości, zanim zagłębi się w szczegółowy plan. Brief jest pierwszą rzeczą, którą użytkownik czyta — powinien zajmować mniej niż 2 minuty i pozostawić jasny model mentalny tego, co plan robi, dlaczego oraz jakie były kluczowe decyzje.

1. **Zapisz brief** do `context/changes/<change-id>/plan-brief.md` (obok `plan.md` w tym samym folderze zmiany).

2. **Użyj szablonu briefu z [references/plan-templates.md](references/plan-templates.md)**:

3. **Kluczowe zasady briefu**:
   - Musi mieścić się na około 2 drukowanych stronach (~60-80 wierszy markdown). Jeśli wychodzi dłużej, skróć.
   - Tabela „Key Decisions” jest sercem — ujawnia, co zostało ustalone podczas pytań, aby każdy, kto później czyta plan, rozumiał wybory bez ponownego czytania wszystkich pytań.
   - „Starting Point” osadza czytelnika w tym, co istnieje dzisiaj — bez tego osoba nieznająca projektu nie może zrozumieć różnicy.
   - „Prerequisites & Estimated effort” na dole tabeli Phases daje czytelnikowi szybką ocenę wykonalności przed podjęciem decyzji o przeczytaniu pełnego planu.
   - Pisz dla kogoś, kto nie uczestniczył w rozmowie planistycznej — powinien rozumieć kształt i uzasadnienie planu wyłącznie z briefu.
   - Umieść link do pełnego planu na górze, aby czytelnik mógł zagłębić się w dowolną sekcję.
   - Wyprowadź brief z tego samego najnowszego rejestru decyzji co plan. Podczas istniejącego przebiegu przeglądu porównaj twierdzenia, liczby, przykłady i wykluczenia w obu dokumentach; skoryguj sprzeczności przed trwałym zapisem. Dla każdego zmienionego parametru wygeneruj ponownie dotyczące go dosłowne przykłady i oczekiwane wyniki; nie zachowuj poprzedniego oczekiwanego ciągu przy aktualizowaniu wyłącznie tabeli decyzji. Sprawdź wymagane sekcje, w tym References, względem już załadowanego szablonu. Strukturalnie poprawna tabela nie potwierdza zgodności z otaczającym ją tekstem.

### Krok 5: Synchronizacja i przegląd

Przy `$10x-plan <change-id> save` (oraz ścieżce trwałego zapisu w [plan-persistence.md](references/plan-persistence.md)) **pomiń tę sekcję**. Ta ścieżka już obsługuje jedno wstępne `inspect`, jeden zapis, jeden przebieg weryfikacji oraz jedno `mark-planned`. Nie dodawaj drugiego odczytu zwrotnego, drugiego uruchomienia helpera ani własnoręcznie stworzonego walidatora Markdown.

1. **Potwierdź, że plan + brief trafiły do folderu zmiany** (tylko dla planowania w sesji z możliwością zapisu; nie dla ścieżki zapisu):
   - `ls context/changes/<change-id>/plan.md context/changes/<change-id>/plan-brief.md` powinny oba istnieć.
   - Odczytaj zapisaną treść ponownie jeden raz. Zweryfikuj, że najnowsze decyzje i korekty są zgodne w obu dokumentach, wymagane sekcje planu/briefu są obecne, a Success Criteria każdej fazy mapują się jeden do jednego na kanoniczny wiersz Progress. Tylko nowe wiersze planowania muszą być niezaznaczone; powtórne zapisy zachowują istniejący Progress wykonania i późniejszy status cyklu życia w ścieżce trwałego zapisu. Zachowaj niezwiązane metadane. Kontrole mechaniczne mogą odczytywać pełne pliki, zwracając tylko liczby, hashe i możliwe do wykonania błędy; sprawdzaj treść semantyczną względem uzgodnionego planu. Nie wyświetlaj wielokrotnie wszystkich trzech dokumentów. Zgłoś ukończenie dopiero po tych kontrolach; samo istnienie plików jest niewystarczające.

2. **Skopiuj polecenie szybkiego startu do schowka**:
   - Po zapisaniu planu skopiuj polecenie implementacji do schowka:

   ```bash
   echo -n "/10x-implement <change-id> phase 1" | pbcopy 2>/dev/null || echo -n "/10x-implement <change-id> phase 1" | clip.exe 2>/dev/null || echo -n "/10x-implement <change-id> phase 1" | xclip -selection clipboard 2>/dev/null || true
   ```

   ```powershell
   # PowerShell (Windows)
   Set-Clipboard "/10x-implement <change-id> phase 1"
   ```

3. **Przedstaw zarówno brief, jak i pełny plan**:

   ```
   I've created the implementation plan:

   📋 Brief (start here): `context/changes/<change-id>/plan-brief.md`
   📄 Full plan: `context/changes/<change-id>/plan.md`

   → /10x-implement <change-id> phase 1 (✓ copied)

   Review the brief first, then check the full plan for anything that needs adjustment:
   - Are the phases properly scoped?
   - Are the success criteria specific enough?
   - Any technical details that need adjustment?
   - Missing edge cases or considerations?
   ```

4. **Iteruj na podstawie informacji zwrotnej** — bądź gotowy, aby:
   - Dodać brakujące fazy
   - Dostosować podejście techniczne
   - Doprecyzować kryteria sukcesu (zarówno automatyczne, jak i ręczne)
   - Dodać/usunąć elementy zakresu

5. **Kontynuuj dopracowywanie**, aż użytkownik będzie zadowolony

## Synchronizacja statusu roadmapy

`context/foundation/roadmap.md` (tworzony przez `/10x-roadmap`) indeksuje każdy Foundation/Slice według stabilnego **Change ID**. Gdy planowanie zmienia element roadmapy w konkretny folder zmiany + plan, oznacz ten element jako **`planning`**, aby roadmapa odzwierciedlała, że element opuścił backlog i wszedł w aktywną pracę. `/10x-implement` później przesuwa ten sam element do `in-progress`, a `/10x-archive` zamyka go jako `done`.

Wykonaj to w Kroku 4 (bezpośrednio po stemplu `change.md` → `planned`). Wyszukiwanie jest **obowiązkowe**; „najlepszy wysiłek” dotyczy wyłącznie *edycji* — brak roadmapy lub nieznalezienie celu jest pomijane po cichu i nigdy nie blokuje, nie pyta ani nie przerywa działania. Nie pomijaj sprawdzenia, zakładając, że roadmapy nie ma.

1. `test -f context/foundation/roadmap.md`. Jeśli plik nie istnieje, pomiń ten krok po cichu.
2. Przeczytaj plik. Szukaj `<change-id>` użytego jako `Change ID`:
   - w tabeli `## At a glance` — wiersza, którego komórka kolumny **Change ID** jest dokładnie równa `<change-id>`;
   - oraz w treści `## Foundations` / `## Slices` — bloku `### <ID>: …`, który zawiera wiersz `- **Change ID:** <change-id>`.

   Dopasowanie jest wyłącznie dokładnym ciągiem. **Brak dopasowania** → wyświetl `ℹ context/foundation/roadmap.md has no item with Change ID "<change-id>" — roadmap left untouched.` i zakończ tutaj.
3. **Dopasowanie znalezione** → jeśli `- **Status:**` elementu jest już `planning`, `in-progress` lub `done`, pozostaw go bez zmian (**tylko do przodu**: nigdy nie cofaj bardziej zaawansowanego statusu) i zakończ. W przeciwnym razie zastosuj obie edycje za pomocą narzędzia Edit — każdą niezależnie i w ramach najlepszego wysiłku; pomiń podedycję, której cel nie znajduje się tam, gdzie umieszcza go szablon `/10x-roadmap`, i odnotuj pominięcie. Dotykaj wyłącznie pola `Status`:
   1. **`## At a glance`** — ustaw komórkę **Status** dopasowanego wiersza na `planning`.
   2. **Treść elementu** — przepisz wiersz `- **Status:**` elementu na `- **Status:** planning`.

   Następnie zmień frontmatter roadmapy `updated:` na `<today>` (pomiń, jeśli nie ma frontmatter).
4. `/10x-plan` nie commitują własnych artefaktów; pozostaw zmianę w working tree. Jest commitowana później razem z pierwszą fazą `/10x-implement` zmiany (która ponownie zmienia ten sam element na `in-progress`).

## Ważne wytyczne

1. **Bądź sceptyczny**:
   - Kwestionuj niejasne wymagania
   - Wcześnie identyfikuj potencjalne problemy
   - Pytaj „dlaczego” i „co z”
   - Nie zakładaj — weryfikuj w kodzie, plikach lub kontekście

2. **Bądź interaktywny**:
   - Nie zapisuj pełnego planu za jednym razem
   - Uzyskuj akceptację na każdym głównym kroku
   - Pozwalaj na korekty kursu
   - Pracuj wspólnie

3. **Bądź dokładny**:
   - Przeczytaj CAŁKOWICIE wszystkie pliki kontekstowe przed planowaniem
   - Badaj nierozstrzygnięte wzorce lokalnie lub przez ograniczone niezależne zadania z użyciem referencji orkiestracji
   - Uwzględniaj konkretne odwołania (file:line dla kodu, ścieżki dokumentów dla treści)
   - Zapisuj mierzalne kryteria sukcesu z jasnym rozróżnieniem automatyczne kontra ręczne

4. **Bądź praktyczny**:
   - Skupiaj się na przyrostowych, testowalnych zmianach
   - Uwzględniaj migrację i wycofanie
   - Myśl o przypadkach brzegowych
   - Uwzględniaj „czego NIE robimy”

5. **Śledź postęp**:
   - Ponownie wykorzystuj listę nierozstrzygniętych pytań; natywne narzędzia zadań są opcjonalne i zależne od hosta
   - Dokładnie oznaczaj ukończoną, zablokowaną i anulowaną pracę; unikaj ewidencji dla pojedynczego wyszukania

6. **OBOWIĄZKOWE: Dogłębne pytania skalowane złożonością za pomocą AskUserQuestion**:
   - **PRZED** zapisaniem jakiegokolwiek planu MUSISZ ocenić złożoność (HIGH/MEDIUM/LOW) i uzyskać potwierdzenie użytkownika
   - Użyj skalowania wejściowego z Kroku 1.0, jego wyjątku dotyczącego ustalonych danych wejściowych oraz całkowitego budżetu pytań potwierdzonego przez użytkownika; zakresy dla samego zadania nie zastępują zaakceptowanych decyzji wejściowych
   - Każde pytanie musi zawierać jeden wybór `⭐ Recommended: [short choice] (Recommended)` jako pierwszy; każda opcja wymaga dokładnego formatu opisu Strength/Tradeoff oraz nagłówka mającego maksymalnie 12 znaków
   - Uwzględniaj zakres, przypadki brzegowe, architekturę, model danych, testowanie i wydajność odpowiednio do złożoności
   - Pytaj w rundach obsługiwanych natywnie (Claude 1–4, wytyczne Codex 1–3) w ramach potwierdzonego łącznego budżetu; rozszerzaj go wyraźnie tylko dla nierozstrzygniętych decyzji
   - Zachowaj potwierdzony wywiad oraz natywną akceptację struktury. Dostosuj budżet z użytkownikiem, gdy zmienia się zakres; nigdy nie powtarzaj ustalonych pytań jedynie po to, aby wypełnić zakres bazowy
   - Zaczekaj na odpowiedzi użytkownika przed przejściem do szczegółowego planowania

7. **Brak otwartych pytań w końcowym planie**:
   - Jeśli napotkasz otwarte pytania podczas planowania, ZATRZYMAJ się
   - Natychmiast zbadaj je lub poproś o wyjaśnienie
   - NIE zapisuj planu z nierozstrzygniętymi pytaniami
   - Plan implementacji musi być kompletny i wykonalny
   - Każda decyzja musi zostać podjęta przed sfinalizowaniem planu
   - Termin rozstrzygnięty przez użytkownika trafia do już istniejących sekcji — nazwanego testu lub kryterium sukcesu, gdy zaakceptowany, „What We're NOT Doing” gdy odrzucony. Nie twórz dla niego nowej sekcji
   - Podsekcje „Critical Implementation Details” są opcjonalne: uwzględniaj je tylko wtedy, gdy istnieje rzeczywiste ograniczenie, pułapka lub wymóg kolejności. Domyślnie je pomijaj. Plan bez tej sekcji nie jest niekompletny.

8. **Opisuj zamiar, nie implementację**:
   - Plan mówi implementującemu **co zmienić i dlaczego**, a nie jak pisać kod
   - Każdy wpis zmiany w `### Changes Required:` rozdziela `**Intent**` (co i dlaczego) od `**Contract**` (interfejs, sygnaturę, pole schematu, trasę, strukturę lub niezmiennik, którego dotyczy zmiana). Fragmenty kodu, gdy są potrzebne, znajdują się na końcu `**Contract**`
   - Domyślnie nie umieszczaj fragmentów kodu. Uwzględnij fragment TYLKO wtedy, gdy zmiana nie jest oczywista (trudne regex, nietypowe wywołanie API, nieintuicyjne porządkowanie, obejście problemu, kontrakt sygnatury, od którego zależą inne fazy)
   - Dla rutynowych edycji — dodania pola, podłączenia handlera, zastosowania istniejącego wzorca — opisz `**Intent**` w 1-2 zdaniach, nazwij `**Contract**` w jednym i zakończ. Implementujący (człowiek lub agent) ustala kod na podstawie ścieżki pliku, otaczającego wzorca i zamiaru
   - Ścieżki plików oraz krótkie opisy Intent/Contract zwykle wystarczą. Oprzyj się pokusie wcześniejszego pisania kodu

## Wytyczne dotyczące kryteriów sukcesu

**Zawsze rozdzielaj kryteria sukcesu na dwie kategorie:**

1. **Automated Verification** — polecenia, które agenci mogą uruchomić: `make test`, `npm run lint`, kontrole typów, istnienie konkretnych plików
2. **Manual Verification** — testy wykonywane przez człowieka: UI/UX, rzeczywista wydajność, przypadki brzegowe, akceptacja użytkownika

Kryteria sukcesu każdej fazy używają zwykłych punktów `- ` pod nagłówkami `#### Automated Verification:` i `#### Manual Verification:`. Skopiuj każde kryterium dokładnie raz do kanonicznej sekcji `## Progress` jako niezaznaczony numerowany wiersz; Progress jest jedynym miejscem przeznaczonym na checkboxy wykonania.

## Typowe wzorce

- **Zmiany w bazie danych**: schemat/migracja → metody magazynu → logika biznesowa → API → klienci
- **Nowe funkcje**: wzorce badawcze → model danych → backend → API → UI
- **Refaktoryzacja**: udokumentuj zachowanie → zmiany przyrostowe → kompatybilność wsteczna → migracja

## Koordynacja zadań

[Referencja orkiestracji](references/task-orchestration.md) zarządza wyborem zadań, delegowaniem, obsługą zastępczą możliwości modelu, przeglądem dowodów i zatrzymywaniem. Nie zastępuje natywnych pytań, akceptacji struktury ani ścieżki zapisu świadomej trybu. Nie wywołuj rekomendatora modelu implementacyjnego tylko po to, aby zakończyć badania lub zapisać uzgodniony plan.

- **Uruchamiaj wielu subagentów równolegle** w jednej wiadomości — 2–3 dla fazy badawczej — zamiast jednego po drugim.
- **Utrzymuj każde zadanie skupione** na konkretnym obszarze, ze szczegółowymi instrukcjami (katalogi, co wyodrębnić, oczekiwany format).
- **Żądaj konkretnych odwołań `file:line`** w odpowiedziach.
- **Zaczekaj na zakończenie wszystkich uruchomionych subagentów** przed syntezą ustaleń.
- **Weryfikuj wyniki subagentów** — jeśli ustalenie jest nieoczekiwane, uruchom kontynuację i porównaj je z rzeczywistym kodem.

## Zarządzanie kontekstem

Planowanie może intensywnie wykorzystywać kontekst ze względu na badania + iterację. Utrzymuj efektywność kontekstu:

- **Deleguj badania do subagentów** — zwracają podsumowania, dzięki czemu główny kontekst pozostaje zwięzły. Nie czytaj ponownie plików, które subagenci już przeanalizowali, chyba że musisz zweryfikować konkretne szczegóły.
- **Syntezuj, nie gromadź** — po powrocie subagentów syntetyzuj ustalenia w swoim zrozumieniu, zamiast cytować dosłownie duże bloki.
- **Jeśli kontekst wydaje się pogarszać podczas planowania** — jeśli odpowiedzi stają się powolne lub powtarzalne, zapisz bieżący szkic planu do pliku i zaoferuj użytkownikowi kontynuowanie w świeżym kontekście:
  Wykonaj to tylko wtedy, gdy host zezwala na zapisy w repozytorium. W trybie planowania tylko do odczytu użyj przekazania rozmowy z `references/plan-persistence.md`; nie twierdź, że szkic został zapisany, ani nie obiecuj, że nowa rozmowa odzyska niedostępne decyzje.
  ```
  The plan draft is saved at: context/changes/<change-id>/plan.md
  Would you like to continue refining in a fresh window?
  → /10x-plan <change-id> (✓ copied)
  ```
  Dzięki temu `/10x-plan` może ponownie załadować szkic i kontynuować iterację z pełnym dostępnym kontekstem.

## Dodatkowe przykłady pytań

Jeśli trudno jest sformułować pytanie specyficzne dla funkcji, zapoznaj się z [references/question-examples.md](references/question-examples.md). Powyższy format pytań i skalowanie wejściowe pozostają autorytatywne; przykłady nie ustanawiają zmierzonych korzyści wydajnościowych.