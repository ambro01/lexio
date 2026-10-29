---
name: 10x-health-check
description: >
  Health-check an existing project: dependency audit, security scan, test
  runner detection, CI/CD and missing-config analysis. Writes
  context/foundation/health-check.md with prioritized fixes and an
  agent-readiness verdict. Trigger phrases: "health check", "audit my project",
  "is my project healthy", "sprawdź projekt", "audyt projektu". Use AFTER
  /10x-stack-assess (brownfield chain), BEFORE agent onboarding.
argument-hint: "[path-to-stack-assessment]"
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---
# Kontrola stanu: audyt istniejącego projektu pod kątem gotowości dla agentów

Ta umiejętność jest odpowiednikiem `/10x-bootstrapper` dla istniejących projektów. Tam, gdzie bootstrapper tworzy szkielet nowego projektu i go weryfikuje, health-check uruchamia te same trzy bramki wykonania (pre/in/post) jako strukturę oceny istniejącej bazy kodu. Wykorzystuje wzorzec dyspozycji audytu dla poszczególnych języków z weryfikacji po utworzeniu szkieletu przez bootstrapper, ale stosuje go jako pierwszy krok, a nie końcową kontrolę.

Umiejętność znajduje się w łańcuchu dla istniejących projektów: `/10x-shape → /10x-prd → /10x-stack-assess → /10x-health-check`. Jej jedynym zadaniem jest audyt stanu zależności projektu, infrastruktury testowej, konfiguracji CI/CD oraz kompletności konfiguracji, a następnie utworzenie ustrukturyzowanego raportu z priorytetowymi poprawkami i werdyktem gotowości dla agentów.

Gdy istnieje `context/foundation/stack-assessment.md` (z `/10x-stack-assess`), health-check łączy swoje ustalenia z lukami w bramkach jakości zidentyfikowanymi tam. Oba raporty się uzupełniają: stack-assess ocenia *wybór stosu* względem bramek jakości; health-check ocenia *stan projektu* względem kryteriów zdrowia operacyjnego.

## Kiedy używać, kiedy pominąć

**Użyj, gdy**: użytkownik ma istniejący projekt i chce zweryfikować jego stan przed rozpoczęciem wspomaganego przez agentów developmentu. Katalog projektu powinien zawierać rozpoznawalne znaczniki projektu (`package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `Gemfile`, `composer.json`, `*.csproj`, `pubspec.yaml`).

**Pomiń, gdy**: użytkownik tworzy szkielet nowego projektu — `/10x-bootstrapper` uruchamia własne etapy weryfikacji. Pomiń także, gdy użytkownik chce wyłącznie oceny bramek jakości stosu bez kontroli stanu operacyjnego — to obszar `/10x-stack-assess`.

## Relacja z innymi umiejętnościami

- `/10x-stack-assess` — upstream. Tworzy `context/foundation/stack-assessment.md`. Opcjonalne wejście — health-check może działać bez niego, ale raport jest bogatszy, gdy luki są powiązane.
- `/10x-bootstrapper` — odpowiednik dla greenfield. Te same trzy bramki wykonania, inne zastosowanie (weryfikacja szkieletu vs audyt istniejącego projektu).
- `/10x-shape`, `/10x-prd` — wcześniejsze etapy łańcucha dla istniejących projektów. Nie są bezpośrednimi wejściami, ale kontekst zakresu zmian z PRD może pomóc określić, które części projektu są najważniejsze.

## Wymagane wejścia

1. Istniejąca baza kodu w cwd z co najmniej jednym rozpoznawalnym znacznikiem projektu.

## Opcjonalne wejścia

1. `context/foundation/stack-assessment.md` — jeśli jest obecny, health-check odwołuje się do luk w bramkach jakości w zestawieniu z ustaleniami operacyjnymi.
2. `context/foundation/prd.md` — jeśli jest obecny i zawiera `context_type: brownfield`, health-check wykorzystuje `## Scope of Change` z PRD do priorytetyzacji ustaleń istotnych dla planowanej pracy.

## Początkowa odpowiedź

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli podano argument ścieżki** (np. `/10x-health-check @context/foundation/stack-assessment.md`), usuń początkowy `@`, jeśli występuje, i użyj ścieżki jako lokalizacji stack-assessment dla tego uruchomienia. Ocena jest opcjonalnym kontekstem, a nie warunkiem wstępnym.
2. **Jeśli nie podano argumentu**, sprawdź `context/foundation/stack-assessment.md`. Jeśli istnieje, wczytaj go w celu utworzenia powiązań. Jeśli nie istnieje, kontynuuj bez niego.

## Przebieg pracy

### Krok 0 — Warunek wstępny cwd

Wykryj znaczniki projektu:

```bash
find . -maxdepth 1 \( -name "package.json" -o -name "Cargo.toml" -o -name "pyproject.toml" -o -name "go.mod" -o -name "Gemfile" -o -name "composer.json" -o -name "*.csproj" -o -name "pubspec.yaml" \) 2>/dev/null
```

Jeśli **nie znaleziono żadnych znaczników**, wyświetl:

```
No project markers found in the current directory. /10x-health-check requires an existing codebase.
If you're starting from scratch, use /10x-bootstrapper after /10x-tech-stack-selector instead.
```

Następnie STOP.

Jeśli znaleziono znaczniki, wykryj rodzinę języka na podstawie znacznika (ta sama logika wykrywania co w kroku 1 `/10x-stack-assess`) i przejdź do kroku 1.

### Krok 1 — Kontrola wstępna (audyt zależności + lockfile + bezpieczeństwo)

**Bramka wykonania: kontrola wstępna.** Przed odczytaniem lub zmianą czegokolwiek w projekcie przeprowadź audyt drzewa zależności. Odpowiada to bramce przed wykonaniem w bootstrapper: „jaki jest stan przekazania przed podjęciem działania?”

#### 1a. Obecność lockfile

Sprawdź lockfile pasujący do wykrytej rodziny języka:

| Rodzina języka | Oczekiwane lockfile |
|---|---|
| JS/TS | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb` |
| Python | `poetry.lock`, `uv.lock`, `Pipfile.lock`, `requirements.txt` (słaby — nie jest prawdziwym lockfile) |
| Rust | `Cargo.lock` |
| Go | `go.sum` |
| Ruby | `Gemfile.lock` |
| PHP | `composer.lock` |
| .NET | `packages.lock.json` (NuGet) |
| Dart | `pubspec.lock` |

Jeśli nie znaleziono lockfile, oznacz to jako ustalenie:

```
⚠ No lockfile detected. Dependency versions are not pinned — builds are non-reproducible
  and the agent cannot reason about exact dependency state.
  Fix: run <package-manager lock command> to generate a lockfile.
```

#### 1b. Audyt zależności

Wybierz narzędzie audytowe ekosystemu według rodziny języka. Tabela dyspozycji odpowiada wzorcowi `audit_commands` bootstrapper:

| Rodzina języka | Polecenie audytu | Uwagi |
|---|---|---|
| JS/TS | `npm audit --json` | Kończy się kodem niezerowym, gdy istnieją podatności — nie jest to warunek zatrzymania |
| Python | `pip-audit --format json` | W razie braku pip-audit przechodzi do pominięcia |
| Rust | `cargo audit --json` | W razie braku cargo-audit przechodzi do pominięcia |
| Go | `govulncheck -json ./...` | W razie braku govulncheck przechodzi do pominięcia |
| Ruby | `bundle audit check --update` | Wynik czytelny dla człowieka, analizuj linia po linii |
| PHP | `composer audit --format json` | Wymaga Composer 2.4+ |
| .NET | `dotnet list package --vulnerable --include-transitive` | Czytelne dla człowieka, analizuj znaczniki poziomu ważności |
| Java, Dart | (pomiń) | Brak wbudowanego narzędzia audytowego; odnotuj pominięcie i zalecaj narzędzia zewnętrzne |

Uruchom wybrane polecenie z cwd. Przechwyć stdout, stderr i kod wyjścia. Kod wyjścia narzędzia audytowego ma charakter informacyjny — health-check NIE zatrzymuje się po niezerowym kodzie wyjścia audytu.

**Podział według ważności** (taki sam jak w weryfikacji po utworzeniu szkieletu przez bootstrapper):

- CRITICAL (CVSS >= 9.0) — pokaż bezpośrednio
- HIGH (CVSS 7.0–8.9) — pokaż bezpośrednio
- MODERATE (CVSS 4.0–6.9) — tylko zarejestruj
- LOW (CVSS < 4.0) — tylko zarejestruj

Dla narzędzi z natywną klasyfikacją ważności (npm-audit, cargo-audit, govulncheck) użyj etykiety narzędzia. Dla narzędzi bez natywnej klasyfikacji ważności domyślnie użyj MODERATE, chyba że komunikat dotyczący podatności wyraźnie wskazuje CRITICAL lub HIGH.

Gdy narzędzie rozróżnia zależności bezpośrednie i przechodnie, pokaż podział. Ustalenia dotyczące zależności bezpośrednich są od razu możliwe do działania; ustalenia dotyczące zależności przechodnich mają charakter doradczy.

#### 1c. Kontrola nieaktualnych zależności

Jeśli rodzina języka to obsługuje, uruchom szybkie sprawdzenie aktualności:

| Rodzina języka | Polecenie | Co pokazuje |
|---|---|---|
| JS/TS | `npm outdated --json` | Current vs wanted vs latest dla każdego pakietu |
| Python | `pip list --outdated --format json` | Current vs latest |
| Rust | `cargo outdated --root-deps-only` (jeśli zainstalowano) | Nieaktualne bezpośrednie zależności |
| Ruby | `bundle outdated --only-explicit` | Nieaktualne bezpośrednie gemy |

To sprawdzenie ma charakter informacyjny — pokaż luki w wersjach głównych oraz pakiety opóźnione o więcej niż 2 wersje główne. Nie zgłaszaj każdej aktualizacji wersji podrzędnej.

**Tryb obsługi błędów dla wszystkich kroków 1a–1c**: WARN-AND-CONTINUE. Jeśli narzędzie nie jest zainstalowane, odnotuj pominięcie i kontynuuj. Jeśli wywołanie sieciowe się nie powiedzie, odnotuj częściowy wynik i kontynuuj. Nigdy nie zatrzymuj pracy z powodu ustalenia kontroli wstępnej.

Po zakończeniu kontroli wstępnej wyświetl jedną linię podsumowania:

```
Pre-check: <lockfile status>. Audit: <C> CRITICAL, <H> HIGH, <M> MODERATE, <L> LOW.
Outdated: <N> packages with major version gaps.
```

### Krok 2 — Kontrola w trakcie (runner testów, CI/CD, konfiguracja)

**Bramka wykonania: kontrola w trakcie.** Analiza tylko do odczytu infrastruktury testowej projektu, potoku CI/CD i kompletności konfiguracji. Odpowiada to bramce w trakcie wykonania w bootstrapper: „jak wygląda środowisko wykonawcze?”

#### 2a. Wykrywanie i stan runnera testów

Wykryj runner testów na podstawie plików konfiguracji:

| Rodzina języka | Źródła wykrywania | Runnery testów |
|---|---|---|
| JS/TS | skrypty/devDeps w `package.json`, `vitest.config.*`, `jest.config.*`, `playwright.config.*`, `cypress.config.*` | Vitest, Jest, Playwright, Cypress, Mocha |
| Python | `pyproject.toml [tool.pytest]`, `setup.cfg [tool:pytest]`, `tox.ini`, `pytest.ini` | pytest, unittest, tox |
| Rust | `Cargo.toml` (wbudowany `cargo test`) | cargo test |
| Go | (wbudowany `go test`) | go test |
| Ruby | zależności w `Gemfile`, `.rspec`, `Rakefile` | RSpec, Minitest |
| PHP | `phpunit.xml*`, zależności w `composer.json` | PHPUnit, Pest |
| .NET | referencje w `*.csproj` | xUnit, NUnit, MSTest |

Jeśli wykryto runner testów, spróbuj uruchomienia próbnego, aby zweryfikować, czy testy mogą się wykonać:

```bash
# JS/TS examples:
npx vitest run --reporter=json 2>&1 | head -50  # Vitest
npx jest --listTests 2>&1 | head -20             # Jest

# Python:
python -m pytest --collect-only 2>&1 | tail -5   # pytest

# Rust:
cargo test --no-run 2>&1 | tail -10              # cargo test

# Go:
go test -list '.*' ./... 2>&1 | head -20         # go test
```

Pokaż ustalenia:

- **Wykryto runner testów + testy działają**: podaj liczbę testów, jeśli jest dostępna, oraz nazwę runnera
- **Wykryto runner testów + testów nie można uruchomić**: oznacz jako ustalenie wraz z błędem
- **Nie wykryto runnera testów**: oznacz jako istotne ustalenie — agent nie może weryfikować własnych zmian

#### 2b. Ocena konfiguracji CI/CD

Sprawdź pliki konfiguracji CI/CD:

```bash
find . -maxdepth 2 \( -name ".github" -o -name ".gitlab-ci.yml" -o -name "Jenkinsfile" -o -name ".circleci" -o -name "cloudbuild.yaml" -o -name "bitbucket-pipelines.yml" -o -name ".travis.yml" \) 2>/dev/null
```

Jeśli znaleziono konfigurację CI, odczytaj ją i oceń pokrycie:

| Etap | Co sprawdzić |
|---|---|
| Lint | Czy istnieje krok lint? (eslint, ruff, clippy, rubocop, phpstan itd.) |
| Test | Czy istnieje krok testów? Czy odpowiada wykrytemu runnerowi testów? |
| Build | Czy istnieje krok build/compile? |
| Type check | Czy istnieje krok type-check? (tsc, mypy, pyright itd.) |
| Security | Czy istnieje krok skanowania bezpieczeństwa? (npm audit, Snyk, CodeQL, Dependabot itd.) |

Pokaż podsumowanie pokrycia:

```
CI/CD: <provider> detected. Stages: lint <✓/✗>, test <✓/✗>, build <✓/✗>,
type-check <✓/✗>, security <✓/✗>.
```

Jeśli nie znaleziono konfiguracji CI, odnotuj to jako element kategorii B — osoba ucząca się skonfiguruje CI w późniejszej lekcji infrastruktury. Nie oznaczaj tego jako pilnego ustalenia.

#### 2c. Brakujące pliki konfiguracji

Sprawdź typową konfigurację deweloperską:

| Plik | Cel | Ważność w przypadku braku |
|---|---|---|
| `.editorconfig` | Spójne formatowanie w różnych edytorach | low |
| `.prettierrc*` / `biome.json` (JS/TS) | Formatowanie kodu | medium (jeśli nie skonfigurowano formatera) |
| `.eslintrc*` / `eslint.config.*` (JS/TS) | Linting | medium |
| `tsconfig.json` z `strict: true` (TS) | Rygor typów | high (jeśli projekt TS nie używa strict) |
| `.gitignore` | Wykluczenia śledzonych plików | high |
| `.env.example` / `.env.template` | Dokumentacja zmiennych środowiskowych | low |
| `CLAUDE.md` / `AGENTS.md` | Pliki instrukcji dla agentów | Kategoria B — omawiane w onboardingu agentów |

Pokaż brakujące pliki pogrupowane według ważności.

**Tryb obsługi błędów dla wszystkich kroków 2a–2c**: WARN-AND-CONTINUE. Analiza tylko do odczytu nie powinna się nie powieść, ale jeśli odczyt pliku zwróci błąd lub uruchomienie próbne się zawiesi, przechwyć, co możesz, i przejdź dalej.

Po zakończeniu kontroli w trakcie wyświetl jedną linię podsumowania:

```
In-check: test runner <detected/not detected>, CI <provider/not detected>,
<N> configuration gaps (<H> high, <M> medium, <L> low).
```

### Krok 3 — Kontrola końcowa (ocena + rekomendacje)

**Bramka wykonania: kontrola końcowa.** Zsyntetyzuj ustalenia z kontroli wstępnej i kontroli w trakcie w werdykt gotowości dla agentów oraz priorytetową listę poprawek. Odpowiada to bramce po wykonaniu w bootstrapper: „jaki jest stan po ocenie wszystkiego?”

#### 3a. Powiązanie z stack-assessment

Jeśli istnieje `context/foundation/stack-assessment.md`, odczytaj go i połącz ustalenia:

- Jeśli stack-assess wskazał niepowodzenie bramki jakości (np. „typed: fail”), a health-check nie znalazł sprawdzania typów w CI → wzmocnij przekaz: „stos nie zapewnia bezpieczeństwa typów ORAZ CI nie egzekwuje typów — kompensacja jest podwójnie ważna”
- Jeśli stack-assess wskazał strategie kompensacji → sprawdź, czy istnieją zalecane wpisy w plikach instrukcji (czy obecne są `CLAUDE.md` / `AGENTS.md`? Czy zawierają zalecane reguły?)
- Jeśli stack-assess wydał werdykt `ready-with-compensation`, ale brakuje wpisów kompensacyjnych → oznacz to jako lukę

#### 3b. Określenie ogólnego stanu zdrowia

Na podstawie wszystkich ustaleń:

- **healthy**: brak ustaleń audytu CRITICAL/HIGH, wykryto działający runner testów, brak luk konfiguracji o wysokiej ważności w kategorii A.
- **needs-attention**: występują pewne ustalenia kategorii A, ale wszystkie można rozwiązać. Typowe przypadki: kilka ostrzeżeń audytowych HIGH, brakujący formatter lub brak rygoru typów.
- **critical-issues**: ustalenia audytu CRITICAL, brak runnera testów lub kumulujące się liczne luki kategorii A o wysokiej ważności. Agent będzie miał trudności bez przygotowania.

Ustalenia kategorii B (brak CI, brak AGENTS.md, brak konfiguracji wdrożeniowej) **nie** wpływają na werdykt — są oczekiwane na tym etapie i zostaną rozwiązane w późniejszych lekcjach. Projekt może być `healthy` bez potoku CI, jeśli ma działający runner testów, czyste zależności i dobrą lokalną konfigurację.

Werdykt ma charakter informacyjny, a nie blokujący. Nawet `critical-issues` oznacza „zainwestuj czas w poprawki kategorii A przed oczekiwaniem płynnej współpracy z agentem”, a nie „porzuć projekt”.

#### 3c. Priorytetowa lista poprawek

Podziel ustalenia na dwie kategorie:

**Kategoria A — Napraw przed pracą z agentem** (możliwe do wykonania teraz):

1. **Krytyczne podatności bezpieczeństwa** — napraw przed rozpoczęciem jakiejkolwiek pracy wspomaganej przez agenta dotyczącej objętych ścieżek kodu
2. **Brak runnera testów** — agent nie może weryfikować własnych zmian; zainstaluj i skonfiguruj runner
3. **Brakujący lockfile** — niereprodukowalne buildy podważają niezawodność agenta
4. **Ustalenia audytu o wysokiej ważności** — przeanalizuj i załatataj lub zaakceptuj ryzyko
5. **Brak rygoru typów** (TS bez strict, Python bez mypy) — agent generuje mniej niezawodny kod
6. **Brak formattera/lintera** — styl wyjścia agenta będzie niespójny
7. **Nieaktualne zależności z dużymi lukami wersji** — potencjalne zmiany łamiące podczas aktualizacji
8. **Brak `.editorconfig` / `.env.example`** — wygoda, nie blokada

**Kategoria B — Rozwiązywane w nadchodzących lekcjach** (potwierdź, nie alarmuj):

Te ustalenia są rzeczywiste, ale osoba ucząca się skonfiguruje je w nadchodzących krokach. Przedstaw je jako „kolejny krok”, a nie problemy:

- **Brak potoku CI** → omawiany w lekcji infrastruktury/wdrożeń. Odnotuj lukę i wskaż przyszły krok: „Skonfigurujesz CI w nadchodzącej lekcji. Na razie dla współpracy z agentem najważniejsze jest lokalne pokrycie przez runner testów.”
- **Brak plików instrukcji dla agentów** (CLAUDE.md / AGENTS.md) → omawiany w lekcji onboardingu agentów. Nie zalecaj tworzenia ich teraz: „Onboarding agentów przeprowadzi Cię przez tworzenie tych plików z właściwą zawartością. Wygenerowanie teraz szablonu byłoby przedwczesne.”
- **Brak konfiguracji wdrożeniowej** → omawiany w lekcji infrastruktury. Potwierdź, nie nadawaj priorytetu.

Gdy health-check jest uruchamiany samodzielnie (poza łańcuchem kursu), wszystkie ustalenia trafiają na pojedynczą listę rankingową bez podziału A/B — struktura kontekstu kursu obowiązuje wyłącznie, gdy użytkownik przechodzi przez łańcuch dla istniejących projektów. Przy uruchamianiu w ramach łańcucha kursu 10xDevs wzbogacaj odniesienia do przyszłych kroków tytułami lekcji i linkami:
- onboarding agentów = [Agent Onboarding: Agents.md, AI Rules i feedback loops (M1L4)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l4)
- infrastructure & CI/CD = [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)

Każdy wpis poprawki (w obu kategoriach) musi zawierać:

- Co jest nie tak (ustalenie)
- Dlaczego ma to znaczenie dla przepływów pracy agentów (wpływ)
- Co z tym zrobić (konkretne polecenie lub działanie naprawcze albo lekcja, która to omawia)
- Szacowany nakład pracy: quick (< 5 min), moderate (15–30 min), significant (> 1 hour) lub **upcoming lesson** dla elementów kategorii B

### Krok 4 — Zapis health-check.md

Sprawdź kolizję:

```bash
test -f context/foundation/health-check.md
```

Jeśli plik istnieje, zapytaj:

AskUserQuestion:
- question: "context/foundation/health-check.md already exists. How would you like to proceed?"
  header: "Collision"
  options:
  - label: "Overwrite (Recommended)"
    description: "Replace the existing health check. The prior version is lost unless committed."
  - label: "Save as health-check-v2.md"
    description: "Preserve history. New report lands at the next available version slot."
  - label: "Abort"
    description: "Exit without writing. The conversation findings are preserved in chat only."
  multiSelect: false

Zbuduj plik wyjściowy zgodnie z `references/health-check-schema.md`.

Zapisz do `context/foundation/health-check.md` (utwórz `context/foundation/`, jeśli nie istnieje).

Po zapisie wyświetl końcowe podsumowanie:

```
═══════════════════════════════════════════════════════════
  HEALTH CHECK COMPLETE
═══════════════════════════════════════════════════════════

  Project:        <project name>
  Health:         <healthy | needs-attention | critical-issues>
  Audit findings: <C> CRITICAL, <H> HIGH
  Test runner:    <detected (runner name) | not detected>
  CI/CD:          <provider | not detected>
  Fixes:          <N> recommended (<Q> quick, <M> moderate, <S> significant)

  ► Report:       context/foundation/health-check.md
  ► Next:         Agent onboarding — both greenfield and brownfield
                  paths converge with equivalent context artifacts.
═══════════════════════════════════════════════════════════
```

STOP. Nie przechodź automatycznie do żadnej kolejnej umiejętności.

## Wynik

Zapisywany jest pojedynczy plik: `context/foundation/health-check.md` (lub `health-check-vN.md`, jeśli wybrano zapis wersjonowany).

## Odniesienia

- `references/health-check-schema.md` — struktura `context/foundation/health-check.md`.

## Krytyczne zabezpieczenia

1. **Cwd jest warunkiem wstępnym.** Umiejętność wymaga istniejącej bazy kodu z rozpoznawalnymi znacznikami projektu. Nie przeprowadzaj oceny wyłącznie na podstawie kontekstu rozmowy.

2. **Analiza tylko do odczytu.** Health-check nigdy nie modyfikuje projektu. Bez `npm audit fix`, bez `pip install --upgrade`, bez automatycznego łatania. Sugerowanie poprawek w raporcie jest w porządku; ich uruchamianie jest poza zakresem.

3. **WARN-AND-CONTINUE w każdej gałęzi.** Żadne ustalenie nie zatrzymuje umiejętności. Krytyczne podatności bezpieczeństwa, brak runnerów testów, brak CI — wszystko jest przedstawiane jako ustalenia z rekomendacjami, nigdy jako blokady. Użytkownik decyduje, co naprawić i kiedy.

4. **Nadaj priorytet według wpływu na agenta.** Lista poprawek jest uporządkowana według wpływu na przepływy pracy agentów, a nie według ogólnej ważności. Brakujący runner testów jest dla agenta ważniejszy niż ostrzeżenie audytowe LOW, ponieważ agent nie może weryfikować własnych zmian bez testów.

5. **Konkretne poprawki, nie ogólne porady.** Każda rekomendacja musi zawierać konkretne polecenie lub działanie. „Dodaj testy” nie jest poprawką; „Uruchom `npm init vitest@latest`, aby skonfigurować Vitest, a następnie dodaj skrypt testowy do package.json” jest poprawką.

6. **Odwołuj się do stack-assessment, gdy jest dostępne.** Jeśli użytkownik najpierw uruchomił `/10x-stack-assess`, health-check musi łączyć ustalenia z lukami w bramkach jakości. Oba raporty się uzupełniają — nie duplikuj analizy bramek, odwołuj się do niej.

7. **Wewnętrzne etykiety umiejętności pozostają wewnętrzne.** Rozmawiając z użytkownikiem, nigdy nie odwołuj się do numerów kroków, nazw bramek jako terminów technicznych ani wewnętrznych nazw pól. Używaj prostego języka: „audyt zależności”, „kontrola infrastruktury testowej”, „ogólny stan zdrowia”.

8. **Świadomość kontekstu kursu.** Health-check jest częścią ścieżki edukacyjnej. Brak CI/CD, brak AGENTS.md i brak konfiguracji wdrożeniowej to oczekiwane luki na tym etapie — przedstawiaj je jako „kolejny krok”, a nie jako błędy. Werdykt nie może karać osoby uczącej się za rzeczy, których jeszcze nie nauczono.

9. **Wyłącznie uniwersalny język.** W publikowanej zawartości nie używaj prywatnych ścieżek vault ani brandingu specyficznego dla organizacji.