---
name: 10x-tech-stack-selector
description: >
  Pick a starter and a stack for a greenfield project after the PRD is written.
  Reads context/foundation/prd.md, reasons over a language-aware starter
  registry with four agent-friendly quality gates, and writes the
  context/foundation/tech-stack.md hand-off. Use when the user asks "what
  stack should I use", "pick a stack", "choose framework",
  "co wybrać do projektu". Use AFTER /10x-prd, BEFORE /10x-bootstrapper.
argument-hint: "[path-to-prd]"
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---
# Selektor stosu technologicznego: od PRD do startera

Ta umiejętność jest trzecim ogniwem w łańcuchu bootstrap (`/10x-shape → /10x-prd → 10x-tech-stack-selector → /10x-bootstrapper`). Jej jedyne zadanie: przekształcić napisany PRD w rekomendowany starter oraz małe, odczytywalne maszynowo przekazanie, które `/10x-bootstrapper` może odczytać, aby stworzyć szkielet projektu.

Umiejętność jest **facylitatorem decyzji opartym na kuratorowanym rejestrze**, a nie mechanizmem rekomendacji od podstaw. Odczytuje przesłanki z PRD, zadaje maksymalnie ~6 pozostałych pytań na ścieżce niestandardowej (albo skraca proces do zweryfikowanej rekomendacji na ścieżce standardowej), analizuje karty starterów uwzględniające język w `references/starter-registry.yaml` i stosuje cztery bramki jakości będące twardymi filtrami. Rozbudowane uzasadnienie pozostaje w rozmowie; przekazanie plikowe jest minimalne.

Rejestr starterów w `references/starter-registry.yaml` jest **jedynym źródłem prawdy** dla zweryfikowanych starterów. `/10x-bootstrapper` go odczytuje; walidator CI (`scripts/validate-starter-registry-sync.mjs`) zapobiega odwołaniu bootstrappera do `starter_id`, który tutaj nie istnieje.

Rejestr jest listą rekomendacji, a nie listą dozwolonych stosów. Gdy użytkownik wskazuje framework bez karty, umiejętność go akceptuje, ocenia względem tych samych czterech bramek jakości i zapisuje jako `starter_id: custom` z blokiem `custom_starter` (zobacz `references/decision-flow.md` § Off-registry framework). Jawny wybór frameworka przez użytkownika ma pierwszeństwo przed rejestrem.

## Kiedy używać, a kiedy pominąć

**Użyj, gdy**: istnieje `context/foundation/prd.md`, a użytkownik jest gotowy wybrać stos. Frazy wyzwalające: „what stack should I use”, „pick a starter”, „choose a framework”, „co wybrać”, „what should I build this in”, „can you recommend a stack”. Użyj również, gdy użytkownik prosi o porównanie („React vs Vue vs Svelte”) przy PRD zapisanym na dysku — umiejętność wymusza ścieżkę niestandardową i przechodzi przez warianty frameworków.

**Pomiń, gdy**: `context/foundation/prd.md` nie istnieje — umiejętność odmawia i przekierowuje do `/10x-shape` + `/10x-prd`. Pomiń też, gdy użytkownik jest w trakcie implementacji w istniejącej bazie kodu i pyta o dodanie biblioteki lub zastąpienie pojedynczej zależności — to obszar `/10x-frame`, a nie wybór stosu.

## Relacja z innymi umiejętnościami

- `/10x-shape` — tworzy `shape-notes.md`, prekursor PRD. Dwa kroki upstream od tej umiejętności.
- `/10x-prd` — tworzy `context/foundation/prd.md`, kanoniczne wejście. Zawsze upstream.
- `/10x-bootstrapper` — konsument downstream. Odczytuje frontmatter `context/foundation/tech-stack.md` oraz rejestr; tworzy szkielet projektu.

## Wymagane wejścia

1. Plik PRD — istnieje, jest czytelny, zgodny ze schematem PRD (`/skills/10x-shape/references/prd-schema.md`). Domyślna lokalizacja: `context/foundation/prd.md`. Użytkownik MOŻE przekazać inną ścieżkę jako argument (zobacz „Initial Response” poniżej). Umiejętność odczytuje **frontmatter** jako przesłanki (`product_type`, `target_scale`, `timeline_budget`, `project`) i może odczytać sekcje treści (`## Functional Requirements`, `## Non-Goals`) dla audytu funkcji oraz wykrywania momentów sokratejskich, w których FR-y PRD wskazują funkcję nieobecną w rekomendowanym starterze.
2. `references/starter-registry.yaml` — dołączony do umiejętności. Ładowany podczas podejmowania decyzji.
3. `references/residual-interview.md` — dołączony. Ładowany podczas wywiadu.
4. `references/handoff-schema.md` — dołączony. Ładowany podczas zapisu.
5. `references/agent-friendly-criteria.md` — dołączony. Ładowany podczas filtrowania.
6. `references/decision-flow.md` — dołączony. Ładowany podczas podejmowania decyzji.

## Początkowa odpowiedź

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli podano argument ścieżki** (np. `/10x-tech-stack-selector @context/foundation/prd-v2.md` lub `/10x-tech-stack-selector path/to/prd.md`), usuń początkowy `@`, jeśli występuje, i użyj ścieżki dosłownie jako lokalizacji PRD dla tego uruchomienia.
2. **Jeśli nie podano argumentu**, ustaw domyślną ścieżkę PRD na `context/foundation/prd.md`.

Przenieś rozwiązaną ścieżkę przez Step 0; reszta przepływu działa na niej jako `<prd-path>`.

## Przepływ pracy

### Step 0 — Warunek wstępny PRD

Sprawdź warunek wstępny PRD względem rozwiązanej ścieżki:

```bash
test -f "<prd-path>"
```

Jeśli plik jest **nieobecny**, wykonaj dokładnie to i ZATRZYMAJ SIĘ — bez zastępczego wywiadu, bez wbudowanego mini-PRD, bez odczytywania historii rozmowy w celu pozyskania zastępczych przesłanek:

```bash
echo -n "/10x-shape" | pbcopy 2>/dev/null || echo -n "/10x-shape" | clip.exe 2>/dev/null || echo -n "/10x-shape" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard "/10x-shape"
```

Wypisz dosłownie (podstaw rozwiązaną ścieżkę; jeśli użyto domyślnej, jest to `context/foundation/prd.md`):

```
Tech-stack-selector requires a PRD at `<prd-path>`. Run `/10x-shape` first, then re-invoke.
```

Następnie ZATRZYMAJ SIĘ. Kontekst rozmowy **nie** jest rozwiązaniem zastępczym — nawet jeśli treść PRD była omawiana wcześniej na czacie, umiejętność wymaga pliku na dysku.

Jeśli plik jest **obecny**, odczytaj go W CAŁOŚCI (bez `limit`/`offset`) i przejdź do Step 1.

### Step 1 — Załaduj przesłanki PRD

Przeanalizuj frontmatter PRD. Wyodrębnij:

- `project` → inicjuje `project_name` w przekazaniu (zamień na kebab-case dla przekazania, jeśli nie jest już w kebab-case).
- `product_type` → steruje wyszukiwaniem rozwidlenia ścieżki Q0.
- `target_scale.users` → waga przesłanek (small/medium/large/enterprise).
- `timeline_budget.mvp_weeks` → waga przesłanek (krótkie harmonogramy faworyzują sprawdzone w boju + popularne startery).

Odczytaj treść PRD dla kontekstu audytu funkcji: przeskanuj `## Functional Requirements` pod kątem funkcji wymuszających określoną technologię (auth, payments, realtime, AI/LLM, background jobs, file storage, i18n). Pokaż je później jako listę kontrolną w Q1.

Powtórz użytkownikowi przesłanki:

```
PRD priors:
  Project:       <project>
  Product type:  <product_type>
  Scale:         <target_scale.users>
  Timeline:      <timeline_budget.mvp_weeks> weeks
                 (after-hours: <timeline_budget.after_hours_only>)

  Detected feature signals from FRs:
    - <feature> (FR-NNN)
    - ...
```

Zadaj jedno pytanie potwierdzające:

AskUserQuestion:
- question: "Czy te przesłanki są poprawne, czy chcesz coś skorygować, zanim przejdziemy dalej?"
  header: "Przesłanki"
  options:
  - label: "Poprawne — przejdź dalej (zalecane)"
    description: "Kontynuuj z tymi przesłankami."
  - label: "Skoryguj wartość"
    description: "Zapytam, które pole skorygować, a następnie zaktualizuję nadpisanie w pamięci (PRD na dysku pozostanie niezmieniony)."
  - label: "Zatrzymaj — najpierw popraw PRD"
    description: "Zakończ. Uruchom ponownie /10x-prd, aby poprawić przesłanki, a następnie ponownie wywołaj /10x-tech-stack-selector."
  multiSelect: false

Jeśli wybrano „Skoryguj wartość”: zapytaj, które pole, zapisz nadpisanie i kontynuuj z zastosowanym nadpisaniem tylko dla tej sesji.

### Step 2 — Rozwidlenie ścieżki Q0 + wywiad pozostały

Załaduj `references/residual-interview.md` i postępuj zgodnie z opisanym tam przepływem Q.

Wywiad ma dwie ścieżki:

- **Ścieżka standardowa** (domyślnie rekomendowana w Q0): użytkownik akceptuje zweryfikowaną rekomendację dla swojej komórki `(product_type, language_family)`. Q1–Q3 i Q6 są pomijane. Nadal wykonywane są Q4 (wdrożenie), Q5 (CI/CD) oraz potwierdzenie nazwy projektu; samokontrola Q8 jest pomijana (rekomendowana ścieżka sama w sobie jest bezpieczniejszym wyborem).
- **Ścieżka niestandardowa** (użytkownik decyduje się zaprojektować własną): pełne przejście Q1–Q6 oraz warunkowe Q7 (runner testów), a następnie samokontrola Q8 przed przekazaniem.

Q0 wyprowadza `language_family` z jawnej treści PRD, jeśli jest obecna, w przeciwnym razie pyta raz w Q0 (frontmatter PRD nie zawiera tech_preferences). Mapa rekomendowanych ustawień domyślnych na początku `references/starter-registry.yaml` rozwiązuje `(product_type, language_family) → starter_id`. Jeśli komórka ma zweryfikowaną wartość domyślną, przedstaw ją po nazwie z jednolinijkowym dopasowaniem oraz wartością `bootstrapper_confidence` startera. Jeśli komórka nie ma wartości domyślnej (mapa pokazuje `<none>`), wymuś ścieżkę niestandardową z jednoliniową notatką („No vetted recommended default exists for `<product_type, language_family>`; we'll walk the full residual interview.”).

Domyślna opcja Q0 jest **redakcyjna, a nie cicha**: nazwij rekomendowany starter na początku i poproś o jawne potwierdzenie. Użytkownik musi świadomie zaakceptować albo wybrać inną ścieżkę — nigdy nie akceptuj domyślnie bez pytania.

Jeśli użytkownik odpowie w Q0 (lub w dowolnym późniejszym pytaniu), podając konkretny framework zamiast wybierania opcji, traktuj to jako ścieżkę niestandardową z tym frameworkiem jako wyborem użytkownika. Jeśli framework ma kartę w rejestrze, użyj karty. Jeśli jej nie ma, postępuj zgodnie z gałęzią spoza rejestru w `references/decision-flow.md` — nigdy nie przekierowuj użytkownika do karty rejestru, o którą nie prosił, i nigdy nie sugeruj zmiany rodziny językowej tylko po to, aby do niej dotrzeć.

### Step 3 — Podejmij decyzję

Załaduj `references/decision-flow.md` i `references/agent-friendly-criteria.md`. Załaduj `references/starter-registry.yaml` i odczytaj tylko karty istotne dla ograniczonego zbioru kandydatów (przefiltrowane według `language_family` i `product_type` zgodnie z decision flow Step A) — nie cały rejestr, aby ograniczyć koszt promptu.

Wykonaj decision flow:

- **Ścieżka standardowa** — wybór z `recommended_defaults` jest już kandydatem wiodącym; przejdź do Step E (pokaż `bootstrapper_confidence`) i pomiń filtrowanie/punktację.
- **Ścieżka niestandardowa** — wykonaj Step A (filtruj według language_family + product_type + funkcji wymaganych + zgodności z wdrożeniem), Step B (odrzuć wpisy niespełniające dowolnego kryterium `agent_friendly.*`, z zastrzeżeniem dla poszczególnych rodzin językowych), Step C (przeanalizuj pozostałe karty, uwzględniając team_profile + tech_preferences + timeline_budget), Step D (kandydat wiodący + 1–2 alternatywy z `alternatives_to_consider`), Step E (pokaż bootstrapper_confidence).
- **Framework spoza rejestru** — użytkownik wskazał framework bez karty w rejestrze. Pomiń filtrowanie kandydatów i pytanie o wariant frameworka; oceń wskazany framework zgodnie z decision-flow § Off-registry framework, a następnie przejdź do Step E.

Pokaż wyzwania sokratejskie tam, gdzie wskazuje decision flow: wariant frameworka Q6 na ścieżce niestandardowej, `tech_preferences` wskazuje starter, który nie spełnia ≥1 bramki jakości, starter rekomendowany domyślnie nie zawiera funkcji wskazanej przez użytkownika w FR-ach PRD albo wybrany starter ma `bootstrapper_confidence: best-effort` ORAZ użytkownik pracuje solo (dodatkowe ostrzeżenie).

Format wyjścia rozmowy:

```
Recommendation: <starter_id> — <name>
Confidence:     <verified | first-class | best-effort>

<one-paragraph rationale tying the PRD priors and the user's answers to the lead card>

Alternatives worth a glance:
  - <starter_id_a> — <one-line tradeoff>
  - <starter_id_b> — <one-line tradeoff>

<if a flag was raised during the interview (preference vs quality, missing
 feature, scaffolding-friction warning): a one-line summary of what surfaced,
 how the user resolved it, and whether they're proceeding with a known-friction
 stack>
```

### Step 4 — Zapisz przekazanie

Załaduj `references/handoff-schema.md`. Najpierw zbuduj zawartość przekazania w pamięci.

Rozwiąż `package_manager` na podstawie `toolchain.package_manager` wybranej karty. Pole jest otwartym łańcuchem (cokolwiek określa karta — `npm`, `uv`, `poetry`, `bundle`, `gradle`, `cargo`, `go-modules`, `composer`, `dotnet` itd.); dla ekosystemów bez zewnętrznego wyboru (np. Go) karta może pominąć pole, w takim przypadku pomiń je również we frontmatter przekazania.

Dla frameworka spoza rejestru zapisz `starter_id: custom`, wypełnij blok `custom_starter` (`name`, `docs_url`), pobierz `package_manager` ze standardowego narzędzia budowania frameworka i ustaw `hints.bootstrapper_confidence: best-effort`. Zobacz `references/handoff-schema.md` § `custom_starter`.

Rozwiąż `hints.deployment_target` na podstawie Q4. Jeśli użytkownik wybrał „I don't know yet — pick the recommended default for me”, zastosuj pierwszą wartość `deployment_default` karty (NIE dosłowny łańcuch `unspecified`).

Wypełnij `hints.path_taken`: `standard` lub `custom`. Wypełnij `hints.self_check_answers` 5 wartościami logicznymi z Q8, jeśli ścieżka niestandardowa została wykonana; ustaw `null`, jeśli wybrano ścieżkę standardową.

Sprawdź kolizję:

```bash
test -f context/foundation/tech-stack.md
```

Jeśli plik nie istnieje, zapisz `context/foundation/tech-stack.md` ze zwalidowaną zawartością.

Jeśli plik istnieje, zapytaj:

AskUserQuestion:
- question: "context/foundation/tech-stack.md już istnieje. Jak chcesz postąpić?"
  header: "Kolizja"
  options:
  - label: "Nadpisz (zalecane)"
    description: "Zastąp istniejący tech-stack.md nowym wyborem. Poprzednia wersja zostanie utracona, chyba że została zatwierdzona w repozytorium."
  - label: "Zapisz jako tech-stack-v2.md"
    description: "Zachowaj historię. Nowy wybór trafi do następnego dostępnego miejsca tech-stack-vN.md."
  - label: "Przerwij"
    description: "Zakończ bez zapisywania. Uzasadnienie rozmowy zostanie zachowane wyłącznie na czacie."
  multiSelect: false

Rekomendowaną opcją domyślną jest tutaj „Nadpisz”, ponieważ tech-stack-selector jest jednorazową decyzją dla projektu; wiele wersji zwykle oznacza, że użytkownik ponownie rozważa wybór, w którym to przypadku utrata poprzedniego wyboru jest zamierzona. Wersjonowany zapis jest rozwiązaniem awaryjnym.

Po zapisaniu skopiuj komendę następnego kroku i ogłoś:

```bash
echo -n "/10x-bootstrapper" | pbcopy 2>/dev/null || echo -n "/10x-bootstrapper" | clip.exe 2>/dev/null || echo -n "/10x-bootstrapper" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard "/10x-bootstrapper"
```

Wypisz:

```
═══════════════════════════════════════════════════════════
  TECH STACK SELECTED
═══════════════════════════════════════════════════════════

  Starter:        <starter_id>
  Path taken:     <standard | custom>
  Confidence:     <verified | first-class | best-effort>

  ► Hand-off:  context/foundation/tech-stack.md
  ► Next:      /10x-bootstrapper  (✓ copied to clipboard)
═══════════════════════════════════════════════════════════
```

ZATRZYMAJ SIĘ. Nie przechodź automatycznie do `/10x-bootstrapper` — użytkownik uruchamia go, gdy jest gotowy.

## Wyjście

Zapisywany jest jeden plik: `context/foundation/tech-stack.md` (lub `tech-stack-vN.md`, jeśli wybrano zapis wersjonowany).

Frontmatter zgodny ze schematem w `references/handoff-schema.md`:

```yaml
---
starter_id: <key from registry | custom>
custom_starter:            # only when starter_id is custom
  name: <framework name>
  docs_url: <official docs URL>
package_manager: <card-prescribed string; may be omitted for some ecosystems>
project_name: <kebab-case>
hints:
  language_family: js | python | ruby | java | go | rust | php | dotnet | dart | multi
  team_size: solo | small | mixed
  deployment_target: <starter-prescribed string>
  ci_provider: github-actions | gitlab-ci | circleci | cloudflare-builds
  ci_default_flow: auto-deploy-on-merge | manual-promotion
  bootstrapper_confidence: verified | first-class | best-effort
  path_taken: standard | custom
  quality_override: <bool>
  self_check_answers: <object | null>
  has_auth: <bool>
  has_payments: <bool>
  has_realtime: <bool>
  has_ai: <bool>
  has_background_jobs: <bool>
---

## Why this stack

<one paragraph, ≤ 200 words>
```

## Referencje

- `references/starter-registry.yaml` — kanoniczne karty starterów + mapa `recommended_defaults`.
- `references/residual-interview.md` — rozwidlenie ścieżki Q0 + przejście Q1–Q8.
- `references/handoff-schema.md` — kontrakt frontmatter `tech-stack.md`.
- `references/agent-friendly-criteria.md` — cztery bramki jakości + zastrzeżenie dla poszczególnych rodzin językowych.
- `references/decision-flow.md` — Steps A–E dla obu ścieżek.

## Krytyczne zabezpieczenia

1. **PRD jest warunkiem wstępnym, a nie rozwiązaniem zastępczym.** Żadnego wbudowanego mini-PRD, żadnego odczytywania rozmowy dla zastępczych przesłanek. Plik na dysku jest kontraktem.

2. **Domyślna opcja Q0 jest redakcyjna.** Nazwij rekomendację na początku; wymagaj jawnego potwierdzenia. Nigdy nie akceptuj domyślnie po cichu.

3. **Wybór ścieżki standardowej lub niestandardowej jest wiążący.** Standard skraca proces do rekomendacji + Q4/Q5/nazwa projektu. Niestandardowa wykonuje pełne przejście oraz samokontrolę Q8. Nie łącz ich — ścieżka wybrana przez użytkownika w Q0 jest tym, co zapisuje `hints.path_taken`.

4. **`bootstrapper_confidence` ma charakter informacyjny, nigdy blokujący.** Poziom pewności `best-effort` NIE wyklucza startera z rekomendacji; pojawia się w rozmowie jako ostrzeżenie i trafia do `hints.bootstrapper_confidence`, aby bootstrapper mógł się dostosować.

5. **Walidator jednokierunkowy.** Bootstrapper nie może odwoływać się do `starter_id`, którego nie ma w rejestrze tej umiejętności; tech-stack-selector może przenosić startery, których bootstrapper jeszcze nie obsługuje (te startery mają `bootstrapper_confidence: best-effort`, dopóki nie zostaną zweryfikowane end-to-end).

6. **Wyłącznie uniwersalny język.** Żadnych prywatnych ścieżek do vaulta ani brandingu specyficznego dla organizacji w dostarczanej treści. `pnpm validate:no-vault-paths` wymusza to w CI. Rejestr recommended-defaults jest z założenia wielojęzykowy; żaden pojedynczy starter nie jest „tą” rekomendowaną ścieżką.

7. **Rejestr rekomenduje; użytkownik decyduje.** Nigdy nie przedstawiaj rejestru jako reguły, której użytkownik musi przestrzegać, nigdy nie twierdź, że następna umiejętność „nie może działać” z niewymienionym frameworkiem, i nigdy nie wymyślaj ograniczeń, których nie ma w tej umiejętności. Niewymieniony framework jest prawidłowym wyborem z `bootstrapper_confidence: best-effort` — jasno wyjaśnij, co to oznacza (tworzenie szkieletu będzie opierać się na własnym generatorze frameworka i może wymagać ręcznych kroków), i pozwól użytkownikowi wybrać.

8. **Wewnętrzne etykiety umiejętności pozostają wewnętrzne.** Podczas rozmowy z użytkownikiem nigdy nie odwołuj się do numerów Q (`Q0`, `Q3`, `Q6`), liter kroków (`Step A`, `Step B`, …, `Step E`) ani sformułowań autora, takich jak „path-fork”, „residual interview”, „Socratic moment”, „decision flow”. Te etykiety porządkują dokumenty referencyjne dla nawigacji w czasie działania; użytkownik nie ma możliwości powiązania ich z czymkolwiek widocznym. Przetłumacz je na prosty język przed wyświetleniem — „ten wybór” zamiast „path-fork”, „pytanie o framework” zamiast „Q6”, „alternatywa warta zaznaczenia” zamiast „Socratic moment”, „Pominę pytania o audyt funkcji, profil zespołu i preferencje technologiczne” zamiast „Pominę Q1–Q3”. To samo dotyczy wewnętrznych ścieżek pól w rozmowie: `hints.deployment_target` / `agent_friendly.typed` / `bootstrapper_confidence` są nazwami pól w przekazaniu / rejestrze, a nie sformułowaniami kierowanymi do użytkownika — „twój cel wdrożeniowy”, „czy stos używa jawnych typów”, „jak płynne będzie tworzenie szkieletu” są tłumaczeniami przeznaczonymi dla użytkownika.