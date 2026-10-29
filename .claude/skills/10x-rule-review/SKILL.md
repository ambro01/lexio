---
name: 10x-rule-review
description: >
  Review the condition of an "AI rules" file (CLAUDE.md, AGENTS.md,
  .cursor/rules/*.mdc, copilot-instructions.md, .windsurfrules, or similar)
  and produce a 5-point scorecard with concrete fixes, regardless of which
  tool the rules target. Use when the user asks to "review AI rules",
  "audit AGENTS.md", "check my CLAUDE.md", "score my agent instructions".
allowed-tools:
  - Read
  - Glob
  - Grep
  - Edit
  - AskUserQuestion
---
# Przegląd zasad 10x

Oceń plik zasad dla AI w pięciu wymiarach i zwróć konkretne poprawki. Plik poddawany przeglądowi to dowolny markdown z zasadami dla AI przekazany przez użytkownika — ta umiejętność nie zakłada `CLAUDE.md`, `AGENTS.md` ani żadnego konkretnego narzędzia.

Ta umiejętność nigdy nie edytuje pliku. Tworzy kartę wyników. Użytkownik decyduje, co wdrożyć.

## Rozwiązywanie wejścia

`$ARGUMENTS` powinno być ścieżką do pojedynczego pliku markdown (bezwzględną, względną względem repozytorium lub z prefiksem `@`). Przykłady:

- `@CLAUDE.md`
- `AGENTS.md`
- `.cursor/rules/api.mdc`
- `src/api/AGENTS.md`
- `.github/copilot-instructions.md`
- `~/.claude/CLAUDE.md`

Jeśli `$ARGUMENTS` jest puste, zapytaj użytkownika jednokrotnie o ścieżkę. Nie zgaduj.

Jeśli ścieżka prowadzi do katalogu, zapytaj, który plik poddać przeglądowi. Jeśli prowadzi do wielu plików (np. `**/AGENTS.md`), oceniaj je pojedynczo i raportuj każdą kartę wyników osobno — nie łącz ich.

Jeśli plik nie istnieje, zatrzymaj się i zgłoś ścieżkę. Nie wymyślaj treści.

## Czego ta umiejętność NIE robi

- Nie edytuje pliku zasad *chyba że użytkownik wyraźnie zatwierdzi zmianę kolejności zaproponowaną przez Kontrolę 5*. Domyślne wyjście jest tylko do odczytu.
- Nie generuje pełnej „poprawionej wersji” pliku. Co najwyżej Kontrola 5 może przenosić/przegrupowywać sekcje; nigdy nie przepisuje treści zasad.
- Nie zakłada docelowego narzędzia pliku. CLAUDE.md, AGENTS.md, `.mdc`, `.windsurfrules`, niestandardowe nazwy — wszystkie są traktowane jako „plik zasad dla AI”.
- Nie ocenia *treści projektu* (architektury, wyborów technologicznych, konwencji). Ocenia *stan artefaktu zasad* — tak jak code review ocenia kod, a nie produkt.

## Procedura

1. Przeczytaj cały plik (użyj `Read` raz; jeśli ma > 2000 linii, czytaj fragmentami aż do końca).
2. Oblicz Kontrole 1–4.
3. Uruchom Kontrolę 5 w osobnym wieloetapowym przepływie (5a lista → 5b komentarz → 5c propozycja → 5d pytanie przez `AskUserQuestion` → 5e przypomnienie o zmianie atomowej). Edycja zmieniająca kolejność, jeśli wystąpi, ma miejsce tutaj i tylko po wyraźnej zgodzie użytkownika.
4. Wypisz kartę wyników w dokładnym formacie z sekcji „Format wyjścia”. Uwzględnij podsumowanie propozycji zmiany kolejności oraz decyzję użytkownika w ustaleniach Kontroli 5.
5. Zatrzymaj się. Nie proponuj dalszych działań, chyba że użytkownik o nie poprosi.

---

## 5 kontroli

### Kontrola 1 — Długość

Policz niepuste linie (ignoruj puste linie i linie będące wyłącznie separatorami, takie jak `---`).

| Linie | Werdykt | Symbol |
|-------------|--------------|--------|
| 0–200 | w porządku | OK |
| 201–500 | uwaga | WARN |
| 501+ | ostrzeżenie | FAIL |

Dlaczego to ważne: długie pliki zasad wypierają prompt użytkownika z okna kontekstu, a zasady ze środka pliku otrzymują najsłabszą uwagę modelu. Długość jest wskaźnikiem tego, że „płacisz kontekstem za rzeczy, których agent nie potrzebuje w każdej sesji”.

Dla WARN/FAIL zaproponuj:
- Podziel zasady dla poszczególnych obszarów na zagnieżdżone pliki bliżej ich kodu (np. `src/api/AGENTS.md`).
- Zastąp zduplikowaną dokumentację odwołaniami `@` do pliku kanonicznego.
- Usuń zasady, które nie są powiązane z powtarzającym się trybem awarii agenta.

### Kontrola 2 — Bezpośrednie fragmenty kodu/konfiguracji

Skanuj w poszukiwaniu bloków kodu ogrodzonych potrójnymi backtickami (```` ``` ````) oraz bloków kodu w linii dłuższych niż ~3 linie.

Oznacz każdy blok, który wygląda jak:
- Przykładowy komponent, endpoint, migracja, schemat, zapytanie, skrypt bash lub test.
- Plik konfiguracji (`tsconfig.json`, `eslintrc`, `package.json`, `wrangler.toml`).
- Szablon migracji lub boilerplate istniejący w innym miejscu repozytorium.

**Nie** oznaczaj:
- Krótkich fragmentów strukturalnych używanych do zdefiniowania *formatu*, który agent musi utworzyć (np. 2–4-liniowego szablonu formatu błędu).
- Przykładów poleceń (`npm run dev`, `git rebase` itd.).
- Bloków Mermaid/diagramów.

Dla każdego oznaczonego bloku zaproponuj:
- Przenieś fragment do rzeczywistego pliku w repozytorium.
- Zastąp blok jednoliniowym odwołaniem `@`, np. `@src/features/users/user.service.ts`, `@docs/api-errors.md`.
- Uzasadnienie: przy kolejnym refaktoryzowaniu przykład będzie niepoprawny w dwóch miejscach; odwołanie nie może się rozjechać.

Werdykt: OK, jeśli 0 oznaczonych bloków · WARN, jeśli 1–2 · FAIL, jeśli 3+.

### Kontrola 3 — Precyzyjny język

Skanuj w poszukiwaniu niejasnych intencji, których nie można zweryfikować względem diffu. Typowi winowajcy:

- „Pisz czysty kod”
- „Przestrzegaj najlepszych praktyk”
- „Dbaj o jakość”
- „Bądź konsekwentny”
- „Używaj nowoczesnych wzorców”
- „Uczyń to czytelnym / łatwym w utrzymaniu / odpornym”
- „Właściwie obsługuj błędy”
- „Zachowaj prostotę”

Dla każdego dopasowania **zawsze zaproponuj co najmniej jedną konkretną, testowalną alternatywę osadzoną w kontekście tego projektu**. Nigdy nie sugeruj „po prostu to usuń” — autor umieścił tę linię z jakiegoś powodu; Twoim zadaniem jest przełożyć intencję na coś, co recenzent może sprawdzić względem diffu.

Aby osadzić sugestię w kontekście, czerp sygnały z:
- pliku poddawanego przeglądowi (wspomniany stack, konwencje nazewnictwa określone w innym miejscu, twarde zasady w innych sekcjach),
- pobliskich akapitów wokół niejasnej frazy (co autor zamierzał powiedzieć?),
- widocznego kontekstu repozytorium, jeśli jest dostępny (`package.json`, `tsconfig.json`, wybór frameworka, konfiguracja linta, sąsiednie pliki zasad).

Jeśli kontekst projektu naprawdę nie sugeruje niczego konkretnego, zaproponuj rozsądne ustawienie domyślne dla wykrytego stacku i oznacz je jako **(założenie)**, aby autor wiedział, że należy je potwierdzić.

Przykłady (zauważ, że każde zastąpienie zapożycza nazwy/konwencje specyficzne dla projektu, a nie ogólne porady):

| Niejasna fraza w pliku | Sygnał z kontekstu projektu | Osadzone, testowalne zastąpienie |
|-----------------------------------|--------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| „Pisz czysty kod” | TypeScript + ESLint wspomniane w tym samym pliku | „Unikaj `any`. Funkcje powyżej 40 linii muszą zostać podzielone. Uruchom `pnpm lint` przed commitem.” |
| „Właściwie obsługuj błędy” | Twarda zasada wcześniej: API zwraca format `{ error: {...} }` | „Handlery API muszą zwracać `{ error: { code, message, context } }` zgodnie z formatem zdefiniowanym powyżej. Nigdy nie rzucaj surowych wyjątków.” |
| „Bądź konsekwentny w nazewnictwie” | Plik wspomina w innym miejscu `feature.handler.ts` | „Używaj `<feature>.handler.ts` (zgodnie z istniejącymi handlerami w `src/api/`), a nie `featureHandler.ts`.” |
| „Używaj nowoczesnych wzorców” | Projekt używa natywnego JS, brak lodash w `package.json` | „Używaj natywnych metod `Array`/`Object`. Nie dodawaj `lodash` — nie ma go w `package.json` i chcemy, aby tak pozostało.” |
| „Uczyń komponenty czytelnymi” | Projekt React + Tailwind | „Komponenty powyżej 150 linii muszą zostać podzielone. Klasy Tailwind dla warunków przechodzą przez `cn()` (założenie — potwierdź, jeśli używany jest inny helper).” |
| „Zachowaj prostotę” | Usługa Python FastAPI | „Preferuj jeden model Pydantic na żądanie/odpowiedź. Bez zagnieżdżonych dekoratorów poza `@router.post` + `@requires_auth`.” |

Werdykt: OK, jeśli 0 niejasnych fraz · WARN, jeśli 1–3 · FAIL, jeśli 4+.

Werdykt: OK, jeśli 0 niejasnych fraz · WARN, jeśli 1–3 · FAIL, jeśli 4+.

### Kontrola 4 — Nadmiarowa wiedza

Jesteś agentem wykonującym przegląd tego pliku. Czytaj go tak, jak czytałbyś go na początku sesji, i po każdym akapicie zadaj jedno pytanie:

> **„Czy wiedziałem to już przed otwarciem pliku?”**

Jeśli odpowiedź brzmi „tak, to jest w moich danych treningowych” albo „tak, to udokumentowane ustawienie domyślne frameworka” albo „tak, README/konfiguracja linta już to mówi” — oznacz to. Autor zużył kontekst na coś, czego nie trzeba było wyjaśniać.

Podczas skanowania stosuj te autotesty:

- **Test „bez zaskoczenia”.** Czy mógłbyś sam utworzyć ten akapit na prośbę, bez dostępu do projektu? Jeśli tak — jest nadmiarowy.
- **Test „domyślnego zachowania frameworka”.** Czy zasada powtarza coś, co framework, konfiguracja linta, kontroler typów lub runner testów już wymusza (np. „używaj trybu TypeScript strict”, „używaj cleanupu `useEffect`”, „FastAPI używa Pydantic do walidacji”, „PostgreSQL obsługuje JSONB”)? Jeśli tak — jest nadmiarowa. Narzędzie wykryje naruszenie; proza niczego nie doda.
- **Test „definicji”.** Czy akapit definiuje ogólny termin inżynierski („czym jest warstwa usług”, „czym jest REST”, „czym są hooki”, „czym jest JSX”, „czym jest `Decimal`”)? Znasz je. Oznacz i usuń.
- **Test „mogłoby być linkiem”.** Czy powiela `README.md`, skrypty z `package.json`, układ projektu lub ustawienia `.eslintrc`? Jeśli tak — zastąp przez `@README.md` / `@package.json` / `@.eslintrc.json`. Odwołanie nie może się rozjechać; skopiowana proza może.
- **Test „zapachu tutoriala”.** Jeśli akapit brzmi jak sekcja ze strony frameworka „Getting Started” lub artykułu na Medium — to treść tutorialowa, a nie wiedza o projekcie. Czytałeś takie rzeczy podczas treningu.

Co **nie** jest nadmiarowe (nie oznaczaj):
- Konwencje specyficzne dla projektu, które przeczą domyślnemu zachowaniu frameworka („używamy `useEffect` wyłącznie do efektów ubocznych niezwiązanych z danymi”).
- Lokalne pułapki i historyczne obejścia, których nie można wywnioskować z kodu („tabela `events` jest partycjonowana według miesięcy — zbiorcze inserty do niewłaściwej partycji kończą się cichym błędem”).
- Wewnętrzne zasady nazewnictwa, układu lub przepływu pracy („postings znajdują się w `<verb>_<noun>.posting.ts`”).
- Zasady wyglądające na ogólne, ale powiązane z rzeczywistym incydentem (plik powinien wspominać incydent lub zawierać link do rejestru trybów awarii).

Dla każdego oznaczonego akapitu zaproponuj jedno z poniższych:
- **Usuń to** — już to wiedziałeś.
- **Zastąp odwołaniem `@`** — `@README.md`, `@tsconfig.json`, `@docs/...`.
- **Zachowaj tylko, jeśli jest poparte incydentem** — a jeśli tak, poproś autora o dodanie notatki o incydencie w linii, aby zasada przetrwała przyszłe audyty.

Werdykt: OK, jeśli 0 nadmiarowych akapitów · WARN, jeśli 1–3 · FAIL, jeśli 4+.

### Kontrola 5 — Kolejność zasad

Modele zwracają większą uwagę na początek i koniec długiego kontekstu („uwaga w kształcie litery U”). Krytyczne zasady ukryte w środku długiego pliku są statystycznie mniej prawdopodobne do przestrzegania. Ta kontrola ma własny wieloetapowy przepływ, ponieważ zmiana kolejności pliku jest istotną edycją, a nie jednoliniową poprawką.

Wykonaj kroki w kolejności. Wynik tej kontroli trafia do karty wyników *i* może uruchomić interaktywną zmianę kolejności.

#### Krok 5a — Wypisz bieżącą strukturę wysokiego poziomu

Przejdź przez plik i wypisz bieżącą strukturę najwyższego poziomu jako listę numerowaną. Użyj nagłówków H1/H2 (oraz H3 tylko wtedy, gdy nie ma H2). Uwzględnij numer linii każdego nagłówka. **Nie** komentuj jeszcze — jedynie przedstaw to, co jest.

Przykład:
```
Current order:
1. # Welcome to OrderFlow            (line 1)
2. ## About the team                 (line 5)
3. ## Project mission                (line 9)
4. ## Our values                     (line 13)
5. ## Tech stack                     (line 22)
6. ## Setup                          (line 36)
7. ## TypeScript                     (line 78)
...
N. ## Project conventions            (line 312)
```

Jeśli plik nie ma nagłówków, powiedz to wyraźnie: *„Brak nagłówków sekcji — plik jest jednym niezróżnicowanym blokiem.”*

#### Krok 5b — Skomentuj kolejność

Teraz opatrz listę adnotacjami. Dla każdej sekcji przypisz krótki tag i jednoliniową uwagę. Użyj tych tagów:

- **CRITICAL** — zasada nośna (bezpieczeństwo, pieniądze, nieodwracalność, specyficzne dla projektu „nigdy nie rób X”).
- **USEFUL** — rzeczywista wiedza o projekcie, która pomaga, ale nie jest pułapką.
- **INTRO** — powitanie/misja/zespół — obniża gęstość sygnału na początku.
- **REDUNDANT** — już oznaczone w Kontroli 4 (domyślne zachowania frameworka, definicje, treści tutorialowe).
- **VAGUE** — już oznaczone w Kontroli 3.
- **REFERENCE** — wskazuje inne pliki przez składnię `@` (tanie, dobre w dowolnym miejscu).

Następnie w jednym akapicie opisz problem strukturalny. Przykłady:

> „Krytyczne zasady bezpieczeństwa i izolacji najemców znajdują się na dole (linia 312). Pierwsze 35 linii to INTRO/wartości/marketing, którym model nada dużą wagę, ale które nie zawierają żadnych praktycznych zasad. Ryzyko: agent przeczyta w pełni nadmiarową treść i pobieżnie przejrzy zasady, które faktycznie mają znaczenie.”

> „Kolejność jest w przybliżeniu poprawna — twarde zasady na górze, konwencje w środku, odwołania na dole. Jeden akapit INTRO w linii 1 można skrócić, ale nie jest potrzebne strukturalne przetasowanie.”

#### Krok 5c — Zaproponuj lepszą kolejność (tylko jeśli jest potrzebna)

Jeśli komentarz w 5b zidentyfikował rzeczywisty problem, zaproponuj docelową kolejność. Przedstaw ją jako *„sekcje przeniesione na górę / zachowane / przeniesione na dół / usunięte”*, a nie jako pełne przepisanie każdej linii.

Przykład:
```
Proposed order:
1. ## Hard rules         (was: line 312)        ← moved to top
2. ## Project conventions (was: line 312, split) ← moved up
3. ## Tech stack          (was: line 22)         ← kept
4. ## Setup               (was: line 36)         ← kept, replace with @README.md if possible
5. ## Failure modes       (new section)          ← collect incident-driven rules here
—   ## About the team / Mission / Values        ← remove (Check 3/4 already flagged these)
```

Jeśli 5b nie wykryło problemu, całkowicie pomiń 5c — powiedz *„Kolejność jest poprawna; nie jest potrzebne przetasowanie.”*

#### Krok 5d — Zapytaj przed zmianą kolejności

Jeśli 5c utworzyło propozycję, **zapytaj użytkownika przez `AskUserQuestion`** przed dotknięciem pliku. Sformułuj pytanie konkretnie. Przykładowe opcje:

- **Tak, zmień kolejność pliku teraz** — zastosuj proponowaną strukturę, zachowaj całą treść zasad, jedynie przenieś/przegrupuj sekcje.
- **Przenieś tylko krytyczne zasady na górę** — minimalna zmiana: podnieś twarde zasady na górę, resztę pozostaw bez zmian.
- **Nie, pozostaw sugestię tylko w raporcie** — nie edytuj pliku; karta wyników pozostaje bez zmian.
- **Najpierw pokaż mi diff** — utwórz zmieniony plik jako blok podglądu w czacie, bez zapisu.

Jeśli użytkownik wybierze opcję edycji, zastosuj ją ostrożnie: zachowaj każdy bajt treści zasad (przenoszą się tylko nagłówki i bloki sekcji) i wykonaj jedną edycję. Jeśli użytkownik wybierze „pozostaw sugestię”, nie rób nic.

#### Krok 5e — Przypomnienie o zmianie atomowej

Zawsze zakończ Kontrolę 5 tym przypomnieniem, niezależnie od tego, czy nastąpiła zmiana kolejności:

> **Przetestuj każdą zmianę w następnej sesji agenta.** Zmiana kolejności pliku zasad zmienia kształt kontekstu — jej wpływ na zachowanie agenta ujawni się dopiero przy kolejnym wykonaniu rzeczywistego zadania. Wprowadzaj zmiany pojedynczo (atomowo): zmień kolejność, następnie uruchom reprezentatywne zadanie, a potem przejdź do kolejnej zmiany (podziału, usunięcia duplikatów, przepisania). Łączenie wielu zmian strukturalnych uniemożliwia przypisanie zmiany zachowania do konkretnej edycji.

#### Werdykt

Oceń plik przed jakąkolwiek zmianą kolejności, na podstawie pierwotnej kolejności:

- **OK** — góra pliku jest gęsta od zasad CRITICAL/USEFUL, nagłówki są jasne, brak nadmiaru INTRO na początku.
- **WARN** — struktura jest mieszana: niektóre krytyczne zasady są na górze, inne ukryte; lub na początku znajduje się nietrywialne INTRO.
- **FAIL** — krytyczne zasady pojawiają się po linii 200 albo plik nie ma w ogóle nagłówków, albo pierwsze ponad 30 linii to wyłącznie INTRO/marketing.

---

## Format wyjścia

Wypisz dokładnie to, w tej kolejności. Użyj polskiego lub angielskiego zgodnie z językiem promptu użytkownika. Odwołuj się do `path:line` dla każdego konkretnego ustalenia, aby użytkownik mógł od razu do niego przejść.

```
# Rule Review — <path>

**Overall:** <one-line summary, e.g. "Healthy file with two redundancy hotspots" or "Long, vague, and bottom-heavy — needs a split">

## Scorecard

| # | Check                | Verdict | Score |
|---|----------------------|---------|-------|
| 1 | Length               | OK/WARN/FAIL | <n> non-blank lines |
| 2 | Direct snippets      | OK/WARN/FAIL | <n> flagged blocks |
| 3 | Precise language     | OK/WARN/FAIL | <n> vague phrases |
| 4 | Redundant knowledge  | OK/WARN/FAIL | <n> redundant rules |
| 5 | Rule ordering        | OK/WARN/FAIL | <one-line reason> |

## Findings

### 1. Length — <verdict>
- <n> non-blank lines.
- <suggestion if WARN/FAIL, otherwise omit>

### 2. Direct snippets — <verdict>
- `path:line-range` — <what kind of snippet> → suggest `@<file>` reference.
- ...

### 3. Precise language — <verdict>
- `path:line` — "<vague phrase>" → "<testable rewrite>"
- ...

### 4. Redundant knowledge — <verdict>
- `path:line` — <what's redundant> → <delete | replace with @reference | keep only if backed by an incident>
- ...

### 5. Rule ordering — <verdict>
- <structural observation, e.g. "Critical security rule at line 287, intro fluff lines 1–42">
- <suggestion>

## Top 3 actions
1. <highest-leverage fix>
2. <second>
3. <third>
```

Jeśli kontrola ma wynik OK, nadal umieść ją w tabeli, ale pomiń podsekcję „Ustalenia” (napisz `### N. <name> — OK` oraz jedną krótką linię, nic więcej).

„Top 3 actions” muszą być uporządkowane według wpływu, a nie numeru kontroli. Wybierz spośród wszystkich pięciu kontroli.

---

## Przypadki brzegowe

- **Plik poniżej 50 linii:** nadal uruchom wszystkie pięć kontroli. Krótkie pliki najczęściej nie przechodzą Kontroli 3 (niejasność) i Kontroli 4 (nadmiarowość).
- **Plik składa się głównie z odwołań (`@…`) i ma niewiele zasad w linii:** to dobry znak dla Kontroli 2 i 4. Nie obniżaj za to oceny.
- **Plik jest `.mdc` z frontmatterem (`globs:`, `alwaysApply:`):** licz linie zasad od końca frontmatteru. Sam frontmatter jest konfiguracją, a nie treścią zasad.
- **Plik jest wygenerowanym stubem z `/init` i nie był modyfikowany:** nadal go przejrzyj. Często dominuje Kontrola 4 (nadmiarowość) — to sygnał do uporządkowania.
- **W projekcie istnieje wiele plików zasad:** przejrzyj ten przekazany. Wspomnij o plikach sąsiednich w „Top 3 actions” tylko wtedy, gdy jest to istotne (np. duplikacja między głównym `AGENTS.md` a zagnieżdżonym).