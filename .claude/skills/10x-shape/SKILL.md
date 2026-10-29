---
name: 10x-shape
description: >
  Facilitate a structured discovery conversation that turns an idea —
  greenfield or brownfield, auto-detected from cwd — into shape-notes.md,
  the input to /10x-prd. Trigger phrases: "new project", "from scratch",
  "od pomysłu", "shape an idea", "I have an idea", "greenfield",
  "brownfield", "istniejący projekt", "zmiana w projekcie".
  Use BEFORE /10x-prd, not in place of it.
argument-hint: "[freeform idea]"
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - Skill
---
# Shape: Ułatw odkrywanie (Greenfield i Brownfield) przed /10x-prd

Ta umiejętność jest początkiem łańcucha bootstrapowania. Dla greenfield: `/10x-shape → /10x-prd → 10x-tech-stack-selector → bootstrapper`. Dla brownfield: `/10x-shape → /10x-prd → 10x-stack-assess → 10x-health-check`. Jej jedyne zadanie: przeprowadzić użytkownika od „Mam pomysł” (greenfield) lub „Chcę zmienić ten system” (brownfield) do ustrukturyzowanego `context/foundation/shape-notes.md`, które `/10x-prd` może przekształcić w PRD zgodne z zablokowanym schematem.

Ta umiejętność jest **facylitatorem**, a nie generatorem treści. NIGDY nie zapisuje wizji, FR, reguł logiki biznesowej ani żadnych innych treści domenowych, których użytkownik nie podał. Jej wartością jest forma pytań i ich kolejność, a nie oferowane odpowiedzi.

Zablokowany schemat, z którym zgodne są zarówno ta umiejętność, jak i `/10x-prd`, znajduje się w `references/prd-schema.md` (względem tego SKILL.md). Przeczytaj go przed utworzeniem jakiegokolwiek artefaktu i sprawdzaj go ponownie przy każdym zapisie checkpointu.

## Kiedy używać, kiedy pominąć

**Użyj, gdy**: użytkownik opisuje pomysł na nowy projekt (greenfield), istotną zmianę w istniejącym systemie — nowy moduł, znaczącą funkcję, ulepszenie architektury (brownfield) — albo produkt, który chce zbudować od podstaw. Użyj również, gdy istniejące `context/foundation/shape-notes.md` jest niekompletne i wymaga wznowienia. Umiejętność automatycznie wykrywa typ kontekstu na podstawie znaczników projektu w cwd i dostosowuje działanie.

**Pomiń, gdy**: projekt ma już PRD lub zestaw ADR (użyj zamiast tego `/10x-frame` lub `/10x-plan`), albo użytkownik rozważa pojedynczy błąd / refaktor / małą funkcję w istniejącym kodzie, która nie uzasadnia pełnego PRD (użyj `/10x-frame`). Dla projektów brownfield, gdzie użytkownik chce ukształtować istotną zmianę, ta umiejętność JEST właściwym punktem startowym.

## Relacja z innymi umiejętnościami

- `/10x-init` — tworzy szkielet `/context` (`changes/`, `archive/`, `foundation/`) wraz z uniwersalnymi README w każdym z nich. `/10x-shape` wymaga istnienia `context/foundation/`; jeśli go brakuje, deleguje do `/10x-init` przez narzędzie `Skill` (Krok 0 poniżej).
- `/10x-prd` — wykorzystuje `shape-notes.md`. Przekazanie odbywa się przez zapis do schowka w `## Step 8`.
- `/10x-frame` — do *przeramowania* problemów o małym zakresie w istniejących systemach, gdzie pełne PRD byłoby przesadą. `/10x-shape` służy większym zmianom brownfield (nowe moduły, znaczące funkcje), które potrzebują ustrukturyzowanego odkrywania i PRD.
- `/10x-stack-assess` — dalszy krok po `/10x-prd` dla projektów brownfield. Ocenia istniejący stack względem bramek jakości.
- `/10x-health-check` — dalszy krok po `/10x-stack-assess` dla brownfield. Audytuje stan istniejącego projektu.
- `/10x-plan` — dalszy krok po `/10x-prd`, nigdy nie jest wywoływany stąd bezpośrednio.

## Początkowa odpowiedź

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli jako argument podano swobodny opis pomysłu** (np. `/10x-shape a recipe app that suggests meals from what's in your fridge`), przechwyć go dosłownie jako **pomysł zalążkowy**. Nie parafrazuj. Przejdź do Kroku 0.
2. **Jeśli podano ścieżkę pliku** (np. `/10x-shape @notes/idea.md`), przeczytaj go W CAŁOŚCI i użyj jego zawartości jako zalążka. Przejdź do Kroku 0.
3. **Jeśli nie podano niczego**, odpowiedz:

```
I'll help you shape an idea into structured notes that /10x-prd can turn into
a real PRD — whether you're starting from scratch (greenfield) or shaping a
change to an existing system (brownfield).

Please share:
1. The seed idea — what do you want to build or change, in your own words?
2. (Optional) Any rough notes, sketches, or links I should read

Tip: pass the idea inline — `/10x-shape a recipe app that uses fridge contents`
     or for brownfield — `/10x-shape add a recommendation engine to my recipe app`
```

Następnie czekaj.

## Proces

### Krok 0: Sprawdź warunek wstępny 10xWorkflow

Sprawdź scaffold 10xWorkflow, testując dwie ścieżki:

```bash
test -d context/foundation
```

Jeśli istnieje, przejdź do Kroku 0.5.

Jeśli go brakuje, projekt nie został zainicjalizowany dla 10xWorkflow. Zapytaj:

AskUserQuestion:
- question: "Ten katalog nie jest zainicjalizowany dla 10xWorkflow (brakuje context/foundation/). Uruchomić teraz /10x-init?"
  header: "Init?"
  options:
  - label: "Tak — uruchom /10x-init (Zalecane)"
    description: "Tworzy szkielet /context (changes/, archive/, foundation/) z README, a następnie kontynuuje kształtowanie."
  - label: "Nie — zakończ tutaj"
    description: "Wyjdź bez zmian. Musisz zainicjalizować projekt, zanim shape będzie mogło działać."
  multiSelect: false

Przy „Tak”: wywołaj `/10x-init` przez narzędzie **Skill** (NIE przez Bash). Gdy `/10x-init` zakończy działanie, ponownie sprawdź warunek wstępny; jeśli jest teraz spełniony, przejdź do Kroku 0.5. Przy „Nie”: wypisz „Zatrzymywanie. Uruchom `/10x-init`, gdy będziesz gotowy, a następnie ponownie wywołaj `/10x-shape`.” i ZATRZYMAJ SIĘ.

Nie duplikuj logiki scaffoldu `/10x-init`. Narzędzie `Skill` jest właściwą ścieżką delegowania.

### Krok 0.5: Wykrywanie wznowienia

Przed rozpoczęciem od nowa sprawdź, czy istnieje poprzednia sesja:

```bash
test -f context/foundation/shape-notes.md
```

Jeśli pliku nie ma, przejdź do Kroku 1 z nową sesją.

Jeśli istnieje, przeczytaj plik W CAŁOŚCI. Sparsuj blok frontmatter `checkpoint:` zgodnie z referencją schematu (`references/prd-schema.md`, sekcja „shape-notes.md checkpoint format”). Wyodrębnij: `current_phase`, `phases_completed`, `frs_drafted`, `quality_check_status`.

Podsumuj, co znaleziono:

```
Found a prior shape session at context/foundation/shape-notes.md:

  Project:                 [from frontmatter project field, or "(unnamed)"]
  Current phase:           [N — Phase name]
  Phases completed:        [list]
  FRs drafted so far:      [count]
  Quality check status:    [pending | warned | accepted]
```

Następnie zapytaj:

AskUserQuestion:
- question: "Jak chcesz kontynuować?"
  header: "Wznowić?"
  options:
  - label: "Wznów od Fazy [next] (Zalecane)"
    description: "Kontynuuj od miejsca, w którym zakończyła się poprzednia sesja. Ukończone fazy są podsumowywane, a nie odtwarzane."
  - label: "Zacznij od nowa"
    description: "Zarchiwizuj istniejące shape-notes.md do context/foundation/archive/ i rozpocznij nową sesję."
  - label: "Anuluj"
    description: "Wyjdź bez zmian."
  multiSelect: false

Przy „Wznów”: przejdź bezpośrednio do następnej nieukończonej fazy (Krok `current_phase` + (1, jeśli bieżąca faza znajduje się w `phases_completed`, w przeciwnym razie 0)). NIE uruchamiaj ponownie ukończonych faz — jedynie podsumuj każdą użytkownikowi w 1–2 zdaniach („Faza 1 uchwyciła: <jednowierszowy problem>; Faza 2 uchwyciła: <jednowierszowa persona>; …”), aby miał kontekst wcześniej podjętych decyzji.

Przy „Zacznij od nowa”: przenieś istniejący plik do `context/foundation/archive/shape-notes-<YYYY-MM-DD-HHMM>.md` (utwórz katalog archiwum, jeśli go nie ma), a następnie przejdź do Kroku 1 z nową sesją.

Przy „Anuluj”: ZATRZYMAJ SIĘ bez zmian.

### Krok 0.7: Wykrywanie typu kontekstu

Przed wejściem do pętli odkrywania określ, czy jest to sesja greenfield czy brownfield. Wykrywanie uruchamia się raz; wynik (`context_type`) jest zapisywany we frontmatter `shape-notes.md` i określa zachowanie faz przez resztę sesji.

**Automatyczne wykrywanie**: oceń cwd w trzech poziomach sygnałów. Pojedynczy plik manifestu nie wystarczy — pusty katalog po `npm init -y` nie powinien uruchamiać trybu brownfield.

```bash
# Tier 1 (strong): version control with history
git log --oneline -1 2>/dev/null && echo "T1:git-history"

# Tier 2 (medium): lockfiles prove real dependency resolution happened
ls package-lock.json yarn.lock pnpm-lock.yaml Cargo.lock poetry.lock go.sum Gemfile.lock composer.lock 2>/dev/null | while read f; do echo "T2:$f"; done

# Tier 3 (weak): manifest files alone — could be a fresh init
ls package.json Cargo.toml pyproject.toml go.mod Gemfile composer.json 2>/dev/null | while read f; do echo "T3:$f"; done

# Bonus signals (confirm, don't trigger alone): source dirs, framework configs, CI
ls -d src/ app/ lib/ .github/ .gitlab-ci.yml Dockerfile tsconfig.json next.config.* vite.config.* 2>/dev/null | while read f; do echo "B:$f"; done
```

```powershell
# PowerShell (Windows) — use this block instead of the bash one above on Windows shells.
# Do NOT let a bash→PowerShell translator rewrite the bash block: the `while read f; do echo "B:$f"`
# pattern produces a literal "B:$f" string that Windows interprets as drive `B:`, triggering a
# permission prompt for a non-existent drive.

# Tier 1 (strong): version control with history
if (git log --oneline -1 2>$null) { "T1:git-history" }

# Tier 2 (medium): lockfiles prove real dependency resolution happened
@('package-lock.json','yarn.lock','pnpm-lock.yaml','Cargo.lock','poetry.lock','go.sum','Gemfile.lock','composer.lock') |
  Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { "T2:$_" }

# Tier 3 (weak): manifest files alone — could be a fresh init
@('package.json','Cargo.toml','pyproject.toml','go.mod','Gemfile','composer.json') |
  Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { "T3:$_" }

# Bonus signals (confirm, don't trigger alone): source dirs, framework configs, CI
@('src','app','lib','.github','.gitlab-ci.yml','Dockerfile','tsconfig.json') |
  Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { "B:$_" }
Get-ChildItem -Path . -Filter 'next.config.*' -File -ErrorAction SilentlyContinue |
  ForEach-Object { "B:$($_.Name)" }
Get-ChildItem -Path . -Filter 'vite.config.*' -File -ErrorAction SilentlyContinue |
  ForEach-Object { "B:$($_.Name)" }
```

Punktacja:
- **Trafienie Tier 1** (istnieje historia git) → silny sygnał brownfield
- **Trafienie Tier 2** (istnieje lockfile) → silny sygnał brownfield
- **Tier 1 + Tier 2** → brownfield z wysoką pewnością
- **Tylko Tier 3** (manifest, bez lockfile i git) → niejednoznaczne — może być świeżym `npm init`
- **Brak sygnałów** → greenfield

Logika decyzji:
- **Dowolne trafienie Tier 1 lub Tier 2** → zaproponuj `context_type: brownfield`
- **Tylko Tier 3** → zaproponuj brownfield, ale zaznacz niejednoznaczność: „Znalazłem plik manifestu, ale bez lockfile lub historii git — może to być świeżo zainicjalizowany projekt, a nie rzeczywisty brownfield.”
- **Brak sygnałów** → zaproponuj `context_type: greenfield`

Wypisz, co wykryto:

- **Brownfield z wysoką pewnością** (T1 lub T2):
  ```
  This looks like an existing project:
    [list detected signals, e.g. "git history (47 commits)", "package-lock.json", "src/ directory"]
  I'll run in brownfield mode — focusing on what exists, what's changing,
  and what must be preserved.
  ```

- **Niejednoznaczne** (tylko T3):
  ```
  I found [manifest file] but no lockfile or git history — this could be a
  freshly initialized project or a real brownfield. I'll propose brownfield
  mode, but override to greenfield if you're starting from scratch.
  ```

- **Greenfield** (brak sygnałów):
  ```
  No project markers found in this directory — I'll run in greenfield mode,
  which assumes you're starting from scratch.
  ```

Następnie potwierdź z użytkownikiem:

AskUserQuestion:
- question: "Wykryty kontekst: [greenfield|brownfield]. Czy to poprawne?"
  header: "Kontekst"
  options:
  - label: "[Greenfield|Brownfield] — poprawnie (Zalecane)"
    description: "[Opis trybu wykrytego automatycznie]"
  - label: "[Inny tryb] — nadpisz"
    description: "Przełącz na [inny tryb]."
  multiSelect: false

Zapisz potwierdzone `context_type` we frontmatter `shape-notes.md` (obok `checkpoint:`) natychmiast. Ta wartość jest kluczowa dla automatycznego routingu `/10x-prd`.

Przy wznowieniu (Krok 0.5), jeśli `shape-notes.md` ma już `context_type:` we frontmatter, pomiń automatyczne wykrywanie — tryb jest zablokowany z poprzedniej sesji.

### Wzorzec odkrywania (dotyczy każdego Kroku 1–6 poniżej)

Każda faza odkrywania podąża tą samą pętlą. Przyswój ją przed przeczytaniem kroków dla poszczególnych faz; treść dla faz określa, o co pytać, a nie jak pytać.

Wzorzec to **BMAD-Facilitator + GSD-Gray-Area + mattpocock-recommended-answer + Socrates challenge**:

1. **Otwórz fazę** jednolinijkowym stwierdzeniem, co ta faza tworzy, oraz jednym otwartym pytaniem, aby pozyskać pierwszą próbę użytkownika. (Postawa facylitatora BMAD: nigdy nie generuj treści samodzielnie.)
2. **Ujawnij 3–5 szarych obszarów** jako decyzje wielokrotnego wyboru, gdy pierwsza próba użytkownika zawiera niejednoznaczności. Użyj AskUserQuestion. Każda opcja to rzeczywiste stanowisko z kompromisem, a nie placeholder. (Odkrywanie szarych obszarów GSD.)
3. **Oznacz zalecaną opcję** przez „(Recommended)” w etykiecie i umieść ją jako pierwszą. Zawsze uwzględnij opcję „Not sure / haven't decided”. (Mechanizm ograniczania zmęczenia mattpocock-recommended-answer.)
4. **Zablokuj decyzję u użytkownika** jako jednolinijkowe podsumowanie, które potwierdza przed zapisem na dysk.
5. **Zapisz sekcję(-e) fazy** do `shape-notes.md` oraz zaktualizuj `checkpoint.current_phase` i `checkpoint.phases_completed` zgodnie ze schematem.

**Twarde zasady**:

- NIGDY nie generuj treści, których użytkownik nie podał. Jeśli sekcja potrzebuje wartości, której użytkownik nie podał, zapytaj — nie wymyślaj. Wyjątkiem jest formatowanie mechaniczne (numeracja FR-NNN, nagłówki sekcji, scaffolding frontmatter).
- NIGDY nie zobowiązuj się z góry do stacku (framework, baza danych, platforma hostingowa, rodzina języków). PRD zawiera tylko założenia na poziomie produktu — `product_type`, `target_scale`, `timeline_budget`. Kwestie związane ze stackiem są zbierane po `/10x-prd`.
- NIGDY nie używaj w dostarczanym wyniku języka 10xDevs / cohort / certification. Mechanika tutaj to uniwersalne wskaźniki dobrze określonego projektu. Artefakt dla użytkownika ma brzmieć jak ogólna umiejętność kształtowania.

### Krok 1: Wizja i problem

Ta faza tworzy sekcje `## Vision & Problem Statement` oraz `## User & Persona` (wyłącznie główna persona) w `shape-notes.md`. Dwie sekcje, nie jedna, ponieważ persona wiąże problem. **Brownfield** tworzy również sekcję `## Current System`.

#### Tryb Greenfield

Rozpocznij od: „Zacznijmy od bólu. W jednym lub dwóch zdaniach — kto go odczuwa, w jakim momencie go odczuwa i ile go to dziś kosztuje?”

Słuchaj. Powtórz osobno trzy komponenty:

```
Pain:        [the literal problem]
Person:      [who has it — name a role, not "users"]
Moment:      [when they feel it — the situation that triggers the pain]
Cost today:  [what they currently do, and what it costs them]
```

Jeśli którykolwiek z czterech elementów jest niejasny („everyone”, „always”, „a lot of pain”), zakwestionuj go pytaniem Sokratesa: „Co musiałoby być prawdą, aby okazało się, że to niewłaściwy problem do rozwiązania?” albo „Kogo konkretnie widziałeś doświadczającego tego w ostatnim miesiącu?”

Następnie ujawnij szare obszary (użyj AskUserQuestion z 2–4 pytaniami, **multiSelect w pytaniach, w których może współistnieć wiele stanowisk**):

- Kategoria bólu — jaki to rodzaj problemu? (tarcie w workflow / brakująca funkcja / dane uwięzione gdzieś / paraliż decyzyjny / narzut koordynacyjny / inne)
- Wgląd — co użytkownik wie, czego nie uwzględnia status quo? (użyj Sokratesa: „Jeśli twój pomysł jest oczywisty, dlaczego nikt jeszcze tego nie zbudował?”)
- Zakres głównej persony — kto dokładnie? (konkretna rola w organizacji / osoby w wielu organizacjach / jeden nazwany użytkownik, w tym ty / nisza hobbystyczna / nie wiem)

#### Tryb Brownfield

Rozpocznij od: „Zacznijmy od obecnego systemu. W kilku zdaniach — co dziś istnieje, kto z tego korzysta i jaki problem lub brakująca funkcja napędza tę zmianę?”

Słuchaj. Powtórz osobno pięć komponentów:

```
Current system:  [what exists — name the product/service/module]
Tech stack:      [languages, frameworks, infrastructure the user mentions]
Users:           [who uses it today — name roles, not "users"]
Pain / gap:      [what's wrong or missing — the trigger for this change]
Must preserve:   [what must NOT break — existing behavior, integrations, data]
```

Jeśli użytkownik nie potrafi określić „must preserve”, zakwestionuj to: „Jeśli ta zmiana jutro coś zepsuje, co będzie tą rzeczą, która cię zaalarmuje?” albo „Co obecni użytkownicy zauważą jako pierwsze?”

Następnie ujawnij szare obszary:

- Kategoria zmiany — jakiego rodzaju jest to zmiana? (nowy moduł / znacząca funkcja / ulepszenie architektury / migracja / integracja / inne)
- Wgląd — co użytkownik wie o obecnym systemie, co czyni tę zmianę nieoczywistą? (Sokrates: „Dlaczego nie zostało to zrobione wcześniej?”)
- Zakres głównej persony — jak dla greenfield

Zapisz najpierw sekcję `## Current System` (sekcja tylko dla brownfield — opisuje to, co istnieje), potem `## Vision & Problem Statement` (przeformułowane jako delta: co się zmienia i dlaczego), a następnie `## User & Persona`.

#### Oba tryby

Zablokuj przechwyconą treść zgodnie ze strukturą sekcji schematu. Dopisz do `shape-notes.md`. Zaktualizuj `checkpoint.current_phase: 2` i dodaj `1` do `checkpoint.phases_completed`.

### Krok 2: Persona i kontrola dostępu

Ta faza tworzy sekcję `## Access Control`. Persona została uchwycona w Kroku 1; tutaj pytamy, jak persona dociera do produktu.

#### Tryb Greenfield

Rozpocznij od: „Jak ta osoba dostaje się do aplikacji? Logowanie, profil lokalny, klucz dostępu, w ogóle bez autoryzacji?”

Użyj AskUserQuestion z opcjami bazującymi na najczęstszych modelach:

- Login (email + password / OAuth / passwordless) (Recommended for multi-user web/mobile)
- Local profile (data lives on-device, no server) (Recommended for solo / privacy-first)
- Access key (link or token; no account creation)
- N/A — single user, single device, no separation

Jeśli odpowiedź jest inna niż N/A, zadaj jedno pytanie uzupełniające o separację ról: czy jest to płaski model użytkowników, czy istnieją role (np. admin / member / guest), które widzą różne rzeczy? Sokrates: „Jaki jest najmniejszy model dostępu, który nadal uczyniłby MVP użytecznym?”

#### Tryb Brownfield

Rozpocznij od: „Opisz obecną autoryzację i role użytkowników w tym systemie. Jak użytkownicy dostają się do niego dzisiaj i jakie role istnieją?”

Słuchaj. Następnie zapytaj, co się zmienia:

- „Czy model autoryzacji zmienia się w ramach tej pracy?” (tak — opisz / nie — pozostaw bez zmian)
- „Czy dodawane są nowe role, czy granice istniejących ról się przesuwają?” (tak — opisz / nie — pozostaw bez zmian)

Jeśli użytkownik mówi, że autoryzacja się nie zmienia, zapisz obecny model autoryzacji jako `## Access Control` z notatką: `No changes planned — current model preserved.` Jeśli planowane są zmiany, uchwyć zarówno obecny model, jak i planowane zmiany.

Sokrates: „Jaka jest najmniejsza zmiana dostępu, która nadal uczyniłaby tę funkcję użyteczną bez zakłócania działania dla obecnych użytkowników?”

#### Oba tryby

Zapisz przechwyconą treść jako blok `## Access Control` zgodnie ze schematem. Zaktualizuj `checkpoint.current_phase: 3` i dopisz `2` do `checkpoint.phases_completed`.

### Krok 3: Dyscyplina MVP

Ta faza tworzy roboczy blok `## Success Criteria` (podsekcje Primary / Secondary / Guardrails zgodnie ze schematem) oraz inicjuje pole frontmatter `timeline_budget`.

#### Tryb Greenfield

Rozpocznij od: „Naszkicuj najmniejszy kompletny przepływ użytkownika, który udowodni, że ten produkt działa. Przeprowadź mnie przez pierwszą sesję, klik po kliku.”

Słuchaj. Gdy użytkownik opisze przepływ, powtórz go jako numerowaną sekwencję („1. user opens app, 2. user does X, 3. user sees Y, …”) i zapytaj: „Czy przy trzech tygodniach pracy po godzinach możesz dostarczyć ten przepływ?”

**Ujawnienie kosztu zakresu**: jeśli przepływ zawiera więcej niż około 6 odrębnych działań użytkownika przed dostarczeniem wartości LUB własna estymacja użytkownika przekracza około 3 tygodnie pracy po godzinach LUB przepływ wymaga wielu integracji / usług zewnętrznych / niestandardowej infrastruktury przed uzyskaniem jakiegokolwiek widocznego dla użytkownika efektu, wyraźnie pokaż koszt. Celem jest świadomy wybór, nie egzekwowanie — dłuższe terminy są prawidłowe, ale użytkownik powinien wybrać je celowo:

```
This first version is bigger than what typically ships in three weeks of
after-hours work. The greenfield trap is shipping nothing because the first
version was too big to finish. Two valid paths from here:

  Scope down — keep the timeline tight. Common moves:
    - Drop the [identified expensive piece] for v1; add it in v2 once anything works.
    - Replace [identified integration] with a manual / hardcoded version for now.
    - Cut the user count to one (yourself) for v1.

  Commit to the longer timeline — own the cost. A multi-week MVP is doable, but
  it requires sustained dedication, hard work over a stretch of evenings or
  weekends, and tolerance for periods where progress feels invisible. Most
  greenfield projects that exceed their first estimate die not from the work
  itself but from the gap between expected and actual effort.
```

Użyj AskUserQuestion z trzema opcjami:

- **Scope down (Recommended)** — wybierz, jeśli powyższy koszt jest dla ciebie nową informacją; rozpoczniemy ten krok ponownie z mniejszym pierwszym przepływem.
- **Commit to the longer timeline — I understand it will take sustained effort** — wybierz tylko wtedy, jeśli naprawdę przemyślałeś, jak wygląda dla ciebie wielotygodniowe zobowiązanie po godzinach, i świadomie w to wchodzisz.
- **Restart Step 3 with a different first flow** — wybierz, jeśli żadna opcja nie pasuje i chcesz ponownie naszkicować MVP od podstaw.

Jeśli użytkownik wybierze „Commit to the longer timeline”:

1. Uchwyć jego szacowane `mvp_weeks` (zapytaj, jeśli nie zostało jeszcze podane).
2. Dopisz linię `## Timeline acknowledgment` pod blokiem budżetu czasowego w shape-notes, która zapisuje: szacowaną liczbę tygodni, że użytkownik wyraźnie zaakceptował koszt stałego wysiłku oraz datę. Format: `Acknowledged on <YYYY-MM-DD>: <N>-week MVP requires sustained dedication; user accepted.`
3. Kontynuuj bez dalszego nagabywania — potwierdzenie jest bramką, powtarzane ostrzeżenia nie są.

#### Tryb Brownfield

Rozpocznij od: „Opisz najmniejszą przyrostową zmianę, która udowodni, że to ulepszenie działa. Przeprowadź mnie przez to, jak zmienia się doświadczenie użytkownika — co robi inaczej po wdrożeniu tej zmiany?”

Słuchaj. Powtórz jako numerowaną sekwencję delty: „1. user opens [existing feature], 2. they now see [new thing], 3. they can [new capability]…”

Następnie zadaj dwa pytania specyficzne dla brownfield:

- „Jaki jest promień rażenia tej zmiany? Które istniejące funkcje, integracje lub przepływy danych mogą się zepsuć?” (Sokrates: „Co obecny użytkownik zauważy jako pierwsze, jeśli ta zmiana pójdzie źle?”)
- „Czy przy trzech tygodniach pracy po godzinach możesz dostarczyć tę zmianę?” (ta sama dyscyplina harmonogramu co w greenfield)

**Ujawnienie kosztu zakresu**: ta sama logika co w greenfield, ale przeformułowana:

```
This change is bigger than what typically ships in three weeks of after-hours work.
The brownfield trap is starting a large change in an existing system and leaving
it half-done — partially modified code is worse than the original. Two paths:

  Scope down — find the smallest slice that proves the change works. Common moves:
    - Limit to one use case / one user role first.
    - Keep the existing behavior as fallback; add the new path alongside.
    - Drop [identified expensive integration] for v1.

  Commit to the longer timeline — same as greenfield: sustained effort, accepted.
```

Te same opcje AskUserQuestion co dla greenfield.

#### Oba tryby

Gdy przepływ jest zablokowany, uchwyć go jako kryterium sukcesu `### Primary` (działający przepływ = produkt/zmiana zadziałały). Zapytaj jeszcze raz o `### Secondary` (1 element mile widziany) oraz `### Guardrails` (1–2 rzeczy, które nie mogą się zepsuć — prywatność, minimalna wydajność, UX). Dla brownfield guardrails powinny wyraźnie uwzględniać istniejące zachowanie, które należy zachować.

Ustaw `timeline_budget.mvp_weeks` (greenfield) albo `timeline_budget.delivery_weeks` (brownfield) w scaffolding frontmatter na liczbę podaną przez użytkownika — 1, jeśli zakres został zmniejszony, w przeciwnym razie zaakceptowaną estymację.

Zapisz blok `## Success Criteria`. Zaktualizuj `checkpoint.current_phase: 4` i dopisz `3` do `checkpoint.phases_completed`.

### Krok 4: Wymagania funkcjonalne i user stories

Ta faza tworzy sekcje `## Functional Requirements` oraz `## User Stories`.

#### Tryb Greenfield

Rozpocznij od: „Teraz przejdźmy do konkretów. Na podstawie naszkicowanego przepływu MVP, co aktor musi *móc* zrobić? Wymień możliwości — sformatuję je jako FR.”

Uchwyć każdą możliwość jako pojedynczy wiersz FR zgodny z formatem schematu:

```
- FR-NNN: [Actor] can [capability]. Priority: must-have | nice-to-have
```

`NNN` jest trzycyfrowe z zerami wiodącymi, zaczynając od `001`. Domyślnie `Priority: must-have` dla wszystkiego w przepływie MVP; zapytaj wyraźnie, czy któraś możliwość jest `nice-to-have`.

#### Tryb Brownfield

Rozpocznij od: „Teraz przejdźmy do konkretów. Na podstawie opisanej zmiany, jakie możliwości są dodawane, modyfikowane lub zachowywane? Wymień je — sformatuję je jako FR z kategorią zmiany.”

Uchwyć każdą możliwość z dodatkowym tagiem `Change:`:

```
- FR-NNN: [Actor] can [capability]. Priority: must-have | nice-to-have. Change: new | modified | preserved
```

- `new` — możliwość, która nie istnieje w obecnym systemie
- `modified` — istniejąca możliwość, której zachowanie się zmienia
- `preserved` — istniejąca możliwość, która musi nadal działać bez zmian (defensywny FR — czyni zachowanie wyraźnym)

Skłoń użytkownika do myślenia o zachowanych FR: „Które istniejące możliwości muszą wyraźnie przetrwać tę zmianę? Wyraźne określenie zachowania zapobiega przypadkowemu psuciu.” Jeśli użytkownik wskaże zachowane FR, uchwyć je — staną się FR-ami ochronnymi dla PRD brownfield.

#### Oba tryby

Pogrupuj tematycznie przy użyciu podnagłówków `###`, jeśli liczba FR przekracza około 6 (np. `### Authentication`, `### Recipe matching`, `### Persistence`).

Po uchwyceniu FR poproś użytkownika o przekształcenie co najmniej **głównej ścieżki przepływu MVP** (greenfield) lub **głównej ścieżki zmiany** (brownfield) w user story `### US-01:` z Given/When/Then zgodnie ze schematem. Każda dodatkowa user story jest opcjonalna, ale zalecana dla każdego FR z nieoczywistymi kryteriami akceptacji.

Zaktualizuj `checkpoint.frs_drafted` do liczby wpisów FR-NNN.

Zaktualizuj `checkpoint.current_phase: 4.5` i przejdź bezpośrednio do rundy Sokratesa (NIE oznaczaj fazy 4 jako ukończonej w `phases_completed`, dopóki runda Sokratesa nie zapisze wyniku).

### Krok 4.5: Runda wyzwania Sokratesa

To dedykowana zbiorcza runda — dokładnie jedno wyzwanie na każdy FR uchwycony w Kroku 4, nie więcej i nie mniej.

Dla każdego FR-NNN w kolejności dokumentu zapytaj:

```
FR-NNN: [Actor] can [capability]. Priority: ...
What would have to be true for this FR to be wrong — i.e., for shipping it to
hurt the product instead of help it? OR: what's the strongest counter-argument
to including this in the MVP?
```

Użyj AskUserQuestion dla każdego FR z 2–4 opcjami sformułowanymi jako wiarygodne kontrargumenty (wynikające z domeny FR — nie ogólne). Zawsze uwzględniaj opcję „No counter-argument; it stands as written” jako OSTATNIĄ opcję (nie pierwszą), aby pytanie zmuszało użytkownika do rozważenia wyzwania przed jego odrzuceniem.

Uchwyć każdą odpowiedź użytkownika jako blok cytatu `> Socrates:` pod jej FR w `shape-notes.md`:

```
- FR-001: User can save a recipe to favorites. Priority: must-have
  > Socrates: Counter-argument considered: "favorites duplicate the recipe list
  > if recipes are already small in number." Resolution: kept; favorites are
  > cross-session, the main list is per-fridge.
```

Jeśli runda Sokratesa skłoni użytkownika do zmiany FR (np. podziału na dwa, obniżenia priorytetu do nice-to-have, całkowitego usunięcia), zaktualizuj wiersz FR w miejscu i ponownie wyemituj `checkpoint.frs_drafted`.

Gdy każdy FR ma blok cytatu Sokratesa, dopisz `4` do `checkpoint.phases_completed`, zaktualizuj `checkpoint.current_phase: 5`.

### Krok 5: Logika biznesowa i właściwości jakościowe

Ta faza tworzy sekcje `## Business Logic` oraz `## Non-Functional Requirements`. **Brownfield** tworzy również sekcję `## Constraints & Preserved Behavior`. Encje i pola celowo NIE są uchwytywane jako osobna sekcja — wynikają z FR i User Stories (odpowiednio Kroki 4 i 4 tej umiejętności) oraz są ustalane podczas dalszego wyboru stacku / planowania implementacji.

#### Tryb Greenfield

Rozpocznij od: „Opisz regułę działania w JEDNYM zdaniu — decyzję domenową, którą podejmuje twoja aplikacja i która odróżnia ją od ogólnej listy CRUD.”

Jeśli użytkownik potrafi stworzyć jednolinijkową regułę, uchwyć ją jako pierwszy wiersz `## Business Logic`. Następnie poproś o ≤ 3 akapity pomocnicze wyjaśniające, jakie dane wejściowe reguła wykorzystuje (jako dane wejściowe widoczne dla użytkownika, nie komponenty systemu), jaki jest jej wynik oraz jak użytkownik spotyka się z nią w przepływie produktu. NIE nazywaj komponentów ani aktorów wykonujących obliczenie — są to dalsze wybory architektoniczne. Opisz regułę tak, jakby implementacja była nieznana.

**Wykrywanie antywzorca pustego CRUD**: jeśli „logika biznesowa” użytkownika sprowadza się do „użytkownicy mogą dodawać, wyświetlać, aktualizować i usuwać rekordy” bez reguły stosowanej przez samą aplikację (bez rekomendacji, priorytetyzacji, klasyfikacji, walidacji, scoringu, workflow ani obliczeń), ujawnij to wyraźnie:

```
What you've described is a CRUD list — and that's a known greenfield
anti-pattern. CRUD without a domain decision means the app provides no value
the user couldn't get from a spreadsheet or a notes file. The product is
hollow.

A real domain rule answers "what does the application decide for the user?".
Common shapes:

  - Recommendation:  app suggests items based on user state
  - Prioritization:  app orders items by an inferred urgency / importance
  - Classification:  app tags items by category / sentiment / quality
  - Validation:      app checks items against a domain rule and flags problems
  - Scoring:         app rates items so the user can compare them
  - Workflow:        app moves items through states with transition rules
  - Calculation:     app computes a value from inputs the user supplies

What rule does YOUR app apply?
```

Użyj AskUserQuestion z powyższymi formami reguł jako opcjami wielokrotnego wyboru (oraz „I want to add a rule — give me a moment to think” i „I'm building this as pure CRUD anyway — record it”). Jeśli użytkownik wybierze regułę, wróć do jednolinijkowego pytania. Jeśli zaakceptuje etykietę pustego CRUD, zapisz to jako `# TODO: domain rule — see Open Questions` zgodnie ze schematem i dodaj wpis do prowadzonego bloku `## Open Questions` w shape-notes.md.

#### Tryb Brownfield

Rozpocznij od: „Jaka jest istniejąca reguła domenowa — decyzja, którą obecny system podejmuje dla użytkownika? Następnie: czy ta zmiana dodaje nową regułę, modyfikuje istniejącą czy dotyczy wyłącznie infrastruktury (bez zmiany reguł)?”

Słuchaj. Sklasyfikuj odpowiedź:

- **Dodaje nową regułę domenową** — uchwyć jak w greenfield (jednolinijkowa reguła dla nowej możliwości).
- **Modyfikuje istniejącą regułę** — najpierw uchwyć bieżącą regułę („The system currently does X”), następnie zmianę („This change modifies it to do Y”). Obie linie trafiają do `## Business Logic`.
- **Tylko infrastruktura** — zmiana nie dotyka logiki domenowej (np. migracja, poprawa wydajności, integracja). Zapisz: „No domain logic change. This is an infrastructure/technical change.” Pomiń kontrolę pustego CRUD — nie dotyczy pracy infrastrukturalnej brownfield.

Po logice biznesowej uchwyć ograniczenia i zachowane zachowanie jako `## Constraints & Preserved Behavior`:

- „Jakie istniejące integracje, API lub kontrakty danych musi respektować ta zmiana?”
- „Czy są zaangażowane migracje danych? Co dzieje się z istniejącymi danymi?”
- „Jakie gwarancje wstecznej kompatybilności są potrzebne?”

#### Oba tryby

Po zablokowaniu logiki biznesowej (lub zapisaniu jej braku) zapytaj w jednej rundzie o wymagania niefunkcjonalne: „Czy aplikacja musi zachowywać określone właściwości na swojej zewnętrznej granicy — takie, które użytkownik, operator lub regulator może zmierzyć bez sprawdzania implementacji? Pomyśl o: czasie odpowiedzi odbieranym przez użytkownika, zobowiązaniach prywatności, dostępności, obsługiwanych przeglądarkach/urządzeniach, okresach retencji.” Dla brownfield dodaj: „Czy istnieją zewnętrznie obserwowalne zachowania lub SLA, które nie mogą się pogorszyć?”

Uchwyć jako wypunktowanie `## Non-Functional Requirements` zgodnie ze schematem. Każdy NFR łączy właściwość z mierzalnym celem (lub binarnym zobowiązaniem) i unika nazywania mechanizmu, strategii egzekwowania, lokalizacji uruchomieniowej lub elementu UI — są to dalsze wybory. Jeśli użytkownik sformułuje NFR mechanicznie („rate-limit per IP”, „spinner during load”, „Postgres query < 50ms”), odzwierciedl go w formie zewnętrznie obserwowalnej przed uchwyceniem („auth resists credential stuffing without locking out fat-finger users”; „continuous visible feedback during any operation > 2s”; „user-perceived response < 800ms p95”).

NIE pytaj „jakie encje użytkownik tworzy, odczytuje, aktualizuje lub usuwa?” — encje nie są zagadnieniem PRD. Rzeczowniki, którymi operuje produkt, pojawiają się w FR (Krok 4) i User Stories. Jeśli pytanie na poziomie pola wydaje się potrzebne do wyjaśnienia reguły biznesowej, skieruj je do `## Open Questions` do rozwiązania później, nie do przechwytywania modelu danych.

Dopisz `5` do `checkpoint.phases_completed`, zaktualizuj `checkpoint.current_phase: 6`.

### Krok 6: Ramowanie produktu

Ta faza tworzy sekcję `## Non-Goals` oraz pola frontmatter na poziomie produktu (`product_type`, `target_scale`, `timeline_budget`).

Frontmatter PRD dotyczy wyłącznie poziomu produktu. Kwestie związane ze stackiem — skład zespołu, preferencje językowe, listy technologii do unikania, tryb/region/budżet wdrożenia, kształt pipeline CI/CD — oraz zobowiązania architektoniczne — decyzje implementacyjne, strategia testowania, plan wdrożenia — NIE są częścią PRD. Są zbierane po `/10x-prd`, gdy kształt produktu jest zablokowany. Pytanie o nie teraz zachęca użytkownika do nadmiernego zobowiązania przed wyborem stacku, a odpowiedzi zwykle wymagają ponownego rozważenia po wybraniu stacku.

#### Tryb Greenfield

Rozpocznij od: „Ostatnia faza — ustalmy kilka szczegółów ramowych, a potem określmy, czego to MVP wyraźnie NIE robi. Nie wybieramy tu frameworków, wdrożenia ani planów testów/CI — to nastąpi później, po wyborze stacku.”

Zadaj użytkownikowi poniższe trzy krótkie pytania ramujące, JEDNO NA RAZ (osobne AskUserQuestion dla każdego pytania, nie jeden blok wielopytaniowy). Formułuj każde pytanie prostym językiem zgodnie z sugestiami poniżej — NIE wypisuj nazw pól takich jak `product_type` ani `target_scale` w treści pytania lub etykietach opcji. Wewnętrznie mapuj odpowiedź użytkownika na odpowiednie pole frontmatter.

1. **Jaki rodzaj rzeczy budujesz?**
   - Opcje: „Strona internetowa lub aplikacja webowa” / „API lub usługa backendowa” / „Narzędzie wiersza poleceń” / „Aplikacja mobilna” / „Aplikacja desktopowa” / „Biblioteka lub SDK” / „Pipeline danych” — oraz alternatywa dowolnego tekstu.
   - Zamapuj wybraną etykietę na `product_type`: web-app / api / cli / mobile / desktop / library / data-pipeline / other.

2. **Mniej więcej ile osób będzie z tego korzystać po uruchomieniu?**
   - Opcje: „Tylko ja albo garstka osób” / „Od kilkudziesięciu do stu” / „Do dziesięciu tysięcy” / „Powyżej dziesięciu tysięcy”.
   - Zamapuj wybraną etykietę na `target_scale.users`: small / medium / large / enterprise.
   - Po odpowiedzi zadaj krótkie pytanie Sokratesa: „Jak zmieniłaby się twoja reguła domenowa przy 100x tej skali?” Uchwyć każdy wgląd jako jednolinijkową notatkę w sekcji Vision shape-notes, jeśli ujawni coś nowego.

3. **Dwa szybkie pytania o czas.**
   - Zapytaj w jednej rundzie: „Czy masz twardy termin, do którego dążysz? Jeśli tak, jaka data — jeśli nie, po prostu powiedz 'no deadline'.” (Mapuj na `timeline_budget.hard_deadline`: data ISO lub `null`.)
   - Następnie: „Czy będzie to praca po godzinach czy część twojej pracy etatowej?” (Mapuj na `timeline_budget.after_hours_only`: bool.)
   - `timeline_budget.mvp_weeks` zostało już zablokowane w Kroku 3 — nie pytaj o nie ponownie.

#### Tryb Brownfield

Rozpocznij od: „Ostatnia faza — ustalmy kilka szczegółów ramowych oraz to, czego ta zmiana wyraźnie NIE robi. Nie zmieniamy tu stacku — te decyzje przyjdą później.”

Dla brownfield pytania o ramowanie produktu stają się bramkami „czy to się zmienia?” typu tak/nie oraz uchwyceniem ograniczeń:

1. **Czy typ produktu się zmienia?**
   - Jeśli istniejący system jest aplikacją webową i ta zmiana tego nie zmienia → zapisz `product_type` bez zmian z notatką: `No change — existing [type].`
   - Jeśli zmiana wprowadza nową powierzchnię produktu (np. dodanie CLI do aplikacji webowej) → uchwyć nowy `product_type` obok istniejącego.

2. **Czy baza użytkowników się zmienia?**
   - Ten sam wzorzec: zapisz obecne `target_scale` oraz czy zmiana na nie wpływa. Jeśli zmiana otwiera system dla nowych użytkowników lub innej skali, uchwyć deltę.

3. **Czas** — te same dwa pytania co w greenfield (`hard_deadline`, `after_hours_only`). `timeline_budget.delivery_weeks` zostało już zablokowane w Kroku 3.

Po ramowaniu dodaj: „Jakie ograniczenia nakłada istniejący system na tę zmianę? Pomyśl o: oknach wdrożeniowych, istniejących wymaganiach CI/CD, wstecznej kompatybilności z obecnymi konsumentami API, istniejącym monitoringu/alertingu.” Uchwyć w `## Constraints & Preserved Behavior` (rozszerz sekcję utworzoną w Kroku 5).

#### Oba tryby

Po zablokowaniu ramowania produktu uruchom **jedną** wielokrotnego wyboru rundę Non-Goals. Forma to lista rzeczy do unikania — ale dotycząca unikania *zakresu* (możliwości, których MVP nie zbuduje / zmiana nie dotknie, wymiarów jakości, do których nie będzie dążyć), a nie unikania technologii. Zapytaj:

```
What is this [MVP/change] explicitly NOT doing? Pick anything that should be
ruled out *now* so it doesn't sneak back in later. Functional non-goals
(capabilities we won't build/change) and non-functional non-goals (quality
dimensions we won't aim for) both belong here.
```

Użyj AskUserQuestion z `multiSelect: true` oraz 3–5 opcjami wynikającymi z domeny użytkownika — NIE ogólnymi. Przykłady (wygeneruj ponownie dla każdego projektu):

- „Avoid: building our own [domain algorithm — e.g., recommendation, scheduling, scoring]” — silne unikanie zakresu; wymuś teraz decyzję buy-vs-build.
- „Avoid: [expensive infrastructure piece — e.g., local LLM, real-time sync, multi-region]” — silne unikanie zakresu; brak kształtuje przepływ danych.
- „Avoid: [secondary persona — e.g., shared decks, team workspaces, admin features]” — wyraźna blokada single-tenant.
- „Avoid: [quality dimension — e.g., offline-first, full WCAG-AA, sub-100ms latency]” — wyraźny niefunkcjonalny non-goal.
- Dla brownfield: „Avoid: [existing system change — e.g., migrating the database, rewriting auth, changing the deployment target]” — wyraźny non-goal istniejącego systemu.
- „Other (you tell me)” — uchwycenie dowolnego tekstu.

Dopisz wybrane elementy do `## Non-Goals` zgodnie ze schematem (jednolinijkowe uzasadnienie każdego). Jeśli pojawią się technologie do unikania (np. „avoid: PHP”, „avoid: monorepo”), NIE dodawaj ich do `## Non-Goals` — uchwyć je w treści shape-notes pod blokiem `## Forward: tech-stack` (informacyjny, niebędący częścią schematu PRD), aby następny krok łańcucha mógł je przejąć.

**NIE** pytaj w tej umiejętności o decyzje implementacyjne, strategię testowania ani plan wdrożenia i CI/CD. Te kwestie znajdują się po wyborze / ocenie stacku. Jeśli użytkownik dobrowolnie poda treść tego rodzaju, uchwyć ją w shape-notes pod `## Forward: technical-roadmap` (informacyjne; nie sekcja PRD), aby dalsza umiejętność mogła ją przejąć.

Dopisz `6` do `checkpoint.phases_completed`, zaktualizuj `checkpoint.current_phase: 7`. Przejdź bezpośrednio do Kroku 7.

### Krok 7: Końcowa miękka kontrola krzyżowa

Ta faza uruchamia poprzeczkę jakości na wszystkich przechwyconych danych. Jest to **miękka bramka**: ostrzega, ale pozwala na nadpisanie.

Przeczytaj bieżące `shape-notes.md` i sprawdź każdy z poniższych elementów. Dla każdego oznacz `present` lub `missing/weak`:

1. **Access Control** — blok `## Access Control` istnieje i ma nietrywialną wartość (nie tylko pusty placeholder).
2. **Business Logic (one-sentence rule)** — `## Business Logic` rozpoczyna się jednym zdaniem oznajmującym (nie akapitem, nie „TBD”). Dla zmian brownfield wyłącznie infrastrukturalnych „No domain logic change” jest prawidłowe.
3. **Project artifacts** — samo `shape-notes.md` istnieje z prawidłowym checkpointem frontmatter. (W tym momencie zawsze występuje.)
4. **Timeline-cost acknowledged** — albo `timeline_budget.mvp_weeks` / `delivery_weeks` ≤ 3, ALBO w shape-notes istnieje blok `## Timeline acknowledgment`, który zapisuje, że użytkownik zaakceptował koszt stałego wysiłku w Kroku 3. Dłuższe terminy są prawidłowe; bramką jest ujawnienie i akceptacja kosztu, nie krótki termin.
5. **Non-Goals** — blok `## Non-Goals` istnieje z co najmniej jednym wpisem.
6. **Preserved behavior** *(tylko brownfield)* — blok `## Constraints & Preserved Behavior` istnieje i wyraźnie nazywa to, co nie może się zepsuć. Pomiń tę kontrolę dla sesji greenfield.

NIE sprawdzaj `## Testing Strategy`, `## Deployment & CI/CD` ani `## Implementation Decisions` — nie są częścią schematu PRD. Znajdują się po wyborze / ocenie stacku, nie w PRD.

Wypisz tabelę wyniku:

```
═══════════════════════════════════════════════════════════
  QUALITY CROSS-CHECK
═══════════════════════════════════════════════════════════

  Access Control:           [present | missing — describe]
  Business Logic:           [...]
  Project artifacts:        present
  Timeline-cost ack:        [present | missing — describe]
  Non-Goals:                [...]
  Preserved behavior:       [present | missing — describe | n/a (greenfield)]

═══════════════════════════════════════════════════════════
```

Dla każdego `missing/weak` **wymień go z nazwy** z jednolinijkową konsekwencją: „Business Logic: not captured as a one-sentence rule — your PRD will be hollow without a domain decision.” Ogólne ostrzeżenia „your PRD has gaps” unieważniają bramkę; nie zapisuj ich.

Następnie zapytaj:

AskUserQuestion:
- question: "Jak chcesz kontynuować?"
  header: "Kontrola krzyżowa"
  options:
  - label: "Uzupełnij braki teraz"
    description: "Wróć do odpowiedniej fazy, aby uzupełnić brakujące elementy. Zalecane, jeśli brakuje wielu elementów."
  - label: "Zaakceptuj i zakończ"
    description: "Kontynuuj mimo braków. Zostaną zapisane jako ostrzeżenia w checkpoincie i ujawnione w Open Questions /10x-prd."
  - label: "Uruchom ponownie fazę [N]"
    description: "Wróć do konkretnej fazy i odbuduj ją od tego miejsca."
  multiSelect: false

Przy „Uzupełnij braki teraz”: zapytaj, który brak; przejdź z powrotem do fazy, do której należy (Krok 1–6); uruchom ponownie tylko tę fazę; następnie wróć do Kroku 7.

Przy „Zaakceptuj i zakończ”: ustaw `checkpoint.quality_check_status: warned` (jeśli pozostały jakiekolwiek braki) lub `accepted` (jeśli wszystkie elementy występują — 6 dla greenfield, 7 dla brownfield). Dopisz sekcję `## Quality cross-check` do `shape-notes.md`, wymieniając każdy brak z nazwy wraz z jednolinijkową konsekwencją — `/10x-prd` odzwierciedli je w `## Open Questions`.

Przy „Uruchom ponownie fazę [N]”: przejdź do tej fazy. NIE usuwaj wcześniejszej treści; pozwól fazie nadpisać własne sekcje.

Dopisz `7` do `checkpoint.phases_completed`, zaktualizuj `checkpoint.current_phase: 8`. Przejdź do Kroku 8.

### Krok 8: Przekazanie

Końcowy zapis `shape-notes.md`:

- Potwierdź, że `checkpoint.quality_check_status` ma wartość `warned` lub `accepted` (nigdy `pending` w tym momencie).
- Zaktualizuj `updated:` do dzisiejszej daty we frontmatter.
- Sprawdź ponownie względem referencji schematu: dla greenfield treść powinna przewidywać 10 sekcji PRD w kolejności wymaganej przez schemat; dla brownfield — 11 sekcji PRD brownfield. Frontmatter powinien być pełnym blokiem `checkpoint:` wraz z `context_type`. Każda perspektywiczna treść uchwycona w Kroku 6 pozostaje w swoim bloku `## Forward: ...` — NIE jest włączana do sekcji schematu PRD.

Następnie skopiuj polecenie następnego kroku do schowka i ogłoś:

```bash
echo -n "/10x-prd" | pbcopy 2>/dev/null || echo -n "/10x-prd" | clip.exe 2>/dev/null || echo -n "/10x-prd" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard "/10x-prd"
```

Wypisz:

```
═══════════════════════════════════════════════════════════
  SHAPE COMPLETE
═══════════════════════════════════════════════════════════

  Project:                [project name]
  Context type:           [greenfield | brownfield]
  Phases captured:        1, 2, 3, 4, 5, 6
  FRs drafted:            [count]
  Quality check:          [warned | accepted]

  ► Notes:  context/foundation/shape-notes.md
  ► Next:   /10x-prd  (✓ copied to clipboard)

  After /10x-prd, the next chain step will pick up:
    Greenfield → tech-stack selection, then bootstrap
    Brownfield → stack assessment, then health check
  None of those belong in PRD itself.
═══════════════════════════════════════════════════════════
```

ZATRZYMAJ SIĘ. Nie przechodź automatycznie do `/10x-prd` — użytkownik uruchamia je, gdy jest gotowy.

## Krytyczne zasady ochronne

1. **Facylitator, nie generator.** Umiejętność nigdy nie zapisuje treści domenowych, których użytkownik nie podał. Jeśli sekcja potrzebuje wartości, której użytkownik nie dostarczył, zapytaj. Wyjątkiem jest formatowanie mechaniczne (numeracja FR-NNN, scaffolding nagłówków schematu, klucze frontmatter).

2. **Schemat jest kontraktem.** Kształt `shape-notes.md` i osadzony scaffold dla przyszłego PRD są określane przez `references/prd-schema.md`. Sprawdzaj ponownie przy każdym zapisie checkpointu. Jeśli schemat zmieni się w trakcie implementacji, zaktualizuj treść tej umiejętności, aby pasowała — rozjazd jest trybem awarii.

3. **Otwartość na stack jest wiążąca.** Nigdy nie pytaj o framework, bazę danych, rodzinę języków ani konkretną platformę, nie rekomenduj ich ani się do nich nie zobowiązuj. PRD rejestruje tylko założenia na poziomie produktu (`product_type`, `target_scale`, `timeline_budget`); skład zespołu, preferencje językowe, wdrożenie i kształt CI/CD są zbierane po `/10x-prd`. Jeśli użytkownik dobrowolnie poda treść związaną ze stackiem, uchwyć ją w treści shape-notes pod `## Forward: tech-stack` — nie w sekcjach mapowanych do PRD.

4. **Antywzorce są ujawniane z nazwy, nie ogólnie.** Wykrywanie pustego CRUD nazywa brakujące formy reguł i prosi użytkownika o wybranie jednej. Wykrywanie zbyt dużego MVP nazywa kosztowne elementy i oferuje konkretne ruchy zmniejszające zakres. Ostrzeżenia „Your idea has issues” unieważniają bramkę.

5. **Miękka bramka, nie twarda bramka.** Końcowa kontrola krzyżowa OSTRZEGA, ale pozwala użytkownikowi nadpisać każdą lukę. Ścieżki nadpisania są zapisywane w checkpoincie jako `quality_check_status: warned` i ujawniane w `## Open Questions` `/10x-prd`. Odmowa zakończenia nie wchodzi w zakres.

6. **Zachowanie świadome trybu.** Umiejętność automatycznie wykrywa typ kontekstu (greenfield vs brownfield) na podstawie znaczników projektu w cwd i odpowiednio dostosowuje wszystkie sześć faz odkrywania. Dla brownfield pętla odkrywania przechodzi od „co budujesz od zera?” do „co istnieje, co się zmienia, co musi zostać zachowane?”. Jeśli użytkownik wywołuje tę umiejętność dla problemu o małym zakresie w istniejącym kodzie (pojedynczy błąd, szybki refaktor), zasugeruj zamiast tego `/10x-frame` — `/10x-shape` służy zmianom uzasadniającym pełne PRD.

7. **Tylko język uniwersalny.** Żadnych odniesień do 10xDevs / cohort / certification w żadnym wyniku dla użytkownika ani artefakcie zapisanym na dysku. Mechanika tutaj to uniwersalne wskaźniki dobrze określonego projektu; kontekst persony, który je zmotywował, znajduje się w folderze zmian, nie w dostarczanej umiejętności.

8. **Wznowienie zachowuje wcześniejszą pracę.** Przy wznowieniu ukończone fazy są PODSUMOWYWANE po 1–2 zdania każda, nigdy uruchamiane ponownie. Wcześniejsze decyzje użytkownika są kluczowe; ich odtwarzanie frustruje użytkownika i grozi sprzecznością z wcześniejszymi ustaleniami.

## Notatki

- Jest to umiejętność **kształtowania**. Wynikiem jest `shape-notes.md`, nie `prd.md`. `/10x-prd` jest generatorem dokumentu.
- Referencja schematu (`references/prd-schema.md`) jest jedynym źródłem prawdy. Każda nazwa pola, nazwa sekcji lub klucz checkpointu przywołany w tej treści MUSI istnieć w dokumencie schematu — jeśli nie istnieje, najpierw popraw dokument schematu.
- Dla greenfield 10 sekcji PRD jest przewidywanych w kolejności treści `shape-notes.md`, aby `/10x-prd` mogło je czysto zamapować. Dla brownfield przewidywanych jest zamiast tego 11 sekcji PRD brownfield (zobacz `references/prd-schema.md`). Nazwy są dokładnie zgodne. Treść perspektywiczna (pozostałości tech-stack-selector / stack-assess; przyszłe kwestie technical-roadmap) znajduje się w oddzielnych blokach `## Forward to ...` w treści shape-notes i NIE mapuje się do PRD.
- Jeśli użytkownik naciska, aby pominąć fazę („just generate the PRD already”), wyjaśnij konsekwencję: brakujące fazy tworzą puste sekcje PRD. Następnie zaoferuj pominięcie z wyraźnie przedstawionym kosztem. Wybór należy do użytkownika.