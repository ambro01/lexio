---
name: 10x-bootstrapper
description: >
  Scaffold a project into the current working directory after the tech stack
  is picked. Reads context/foundation/tech-stack.md, runs the chosen starter's
  CLI with a strict conflict policy that always preserves context/, and writes
  a verification log. Use when the user says "bootstrap the project",
  "scaffold the app", "set up the codebase", "let's start the project".
  Use AFTER /10x-tech-stack-selector.
argument-hint: "[path-to-tech-stack]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---
# Bootstrapper: Od stosu technologicznego do projektu ze szkieletem

Ta umiejętność jest końcowym ogniwem sekwencji bootstrap (`/10x-shape → /10x-prd → /10x-tech-stack-selector → 10x-bootstrapper`). Jej jedyne zadanie: przekształcić pisemne przekazanie stosu technologicznego w projekt ze szkieletem w bieżącym katalogu roboczym, z ustaleniami weryfikacyjnymi zapisanymi do przeglądu przez użytkownika.

Umiejętność jest **konsumentem rejestru**, a nie jego właścicielem. Rejestr starterów znajduje się w `/10x-tech-stack-selector` (`/skills/10x-tech-stack-selector/references/starter-registry.yaml`); bootstrapper wyszukuje wybraną kartę według `starter_id`, podstawia jej `cmd_template` i kieruje działanie do właściwej strategii cwd. Jedynym wyjątkiem jest `starter_id: custom` — framework wybrany przez użytkownika, którego nie ma w rejestrze. Nie ma karty; bootstrapper rozwiązuje oficjalne polecenie generatora frameworka na podstawie `custom_starter.docs_url`, pokazuje je użytkownikowi i uruchamia wyłącznie po wyraźnym zatwierdzeniu (zob. `references/scaffold-merge.md` § Custom starter). Walidator CI (`scripts/validate-starter-registry-sync.mjs`) zapobiega odwoływaniu się przez bootstrapper do `starter_id`, którego nie ma w tym rejestrze.

v1 obsługuje **wyłącznie tryb łańcuchowy**. Bez `context/foundation/tech-stack.md` umiejętność odmawia działania i przekierowuje do `/10x-tech-stack-selector`. Nie ma wbudowanego mini-przekazania ani trybu samodzielnego. Stos spoza rejestru dociera do bootstrapper wyłącznie przez przekazanie, jako `starter_id: custom`. v1 również **nie** generuje `AGENTS.md` / `CLAUDE.md` — odpowiedzialność za to należy do przyszłej umiejętności M1L4.

## Kiedy uruchamiać

Użyj, gdy istnieje `context/foundation/tech-stack.md` i użytkownik jest gotowy do utworzenia szkieletu. Frazy wyzwalające: „bootstrap the project”, „scaffold the app”, „set up the codebase”, „let's start the project”, „spin up the repo” lub dowolna naturalna kontynuacja uruchomienia `/10x-tech-stack-selector`, które właśnie zapisało przekazanie.

Warunkiem wstępnym jest pojedynczy plik na dysku: `context/foundation/tech-stack.md`. Umiejętność nigdy nie korzysta awaryjnie z historii rozmowy, nigdy nie uruchamia ponownie wywiadu dotyczącego stosu technologicznego i nigdy nie akceptuje stosu podanego inline.

## Kiedy pominąć

Pomiń, gdy:

- Użytkownik jest w trakcie implementacji w istniejącej bazie kodu i prosi o dodanie pojedynczej biblioteki lub zastąpienie pojedynczej zależności — to obszar `/10x-frame`, a nie bootstrap.
- Użytkownik podaje stos inline bez pasującego przekazania — przekieruj do `/10x-tech-stack-selector`. Rejestruje on każdy framework, w tym te bez karty rejestru (jako `starter_id: custom`).
- Brakuje `context/foundation/tech-stack.md` — kontrola warunku wstępnego w Kroku 0 obsługuje to za pomocą jawnego przekierowania.

## Wymagane wejścia

1. `context/foundation/tech-stack.md` — przekazanie zapisane przez `/10x-tech-stack-selector`. Kontrakt: zob. `references/handoff-consumer.md` (który wskazuje `/10x-tech-stack-selector/references/handoff-schema.md` jako autorytatywny schemat).
2. Wybrana karta z `/skills/10x-tech-stack-selector/references/starter-registry.yaml`. Rozwiązywana przez wyszukiwanie `starter_id`. Zawiera `cmd_template`, `language_family`, `bootstrapper_confidence`, `toolchain.package_manager`, `deployment_defaults`. Dla `starter_id: custom` nie ma karty; zastępuje ją blok `custom_starter` (`name`, `docs_url`) z przekazania.
3. `references/bootstrapper-config.yaml` — nadpisania `cwd_strategy` dla poszczególnych starterów po stronie bootstrapper + wyszukiwanie `language_family → audit_command`. Dołączone do umiejętności.
4. `references/handoff-consumer.md` — dołączone. Wczytywane w Kroku 0.
5. `references/refusal-protocol.md` — dołączone. Wczytywane, gdy zostanie spełniony dowolny warunek odmowy.
6. `references/pre-scaffold-verification.md` — dołączone. Wczytywane w Kroku 1.
7. `references/scaffold-merge.md` — dołączone. Wczytywane w Kroku 2.
8. `references/post-scaffold-verification.md` — dołączone. Wczytywane w Kroku 3.
9. `references/verification-log-schema.md` — dołączone. Wczytywane w Kroku 4.

## Początkowa odpowiedź

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli podano argument ścieżki** (np. `/10x-bootstrapper @context/foundation/tech-stack-v2.md` lub `/10x-bootstrapper path/to/tech-stack.md`), usuń początkowy znak `@`, jeśli występuje, i użyj ścieżki dosłownie jako lokalizacji przekazania dla tego uruchomienia.
2. **Jeśli nie podano argumentu**, domyślnie ustaw ścieżkę przekazania na `context/foundation/tech-stack.md`.

Przenieś rozwiązaną ścieżkę przez Krok 0; pozostała część przepływu pracy operuje na niej jako `<handoff-path>`.

## Przepływ pracy

### Krok 0 — Warunek wstępny przekazania

Sprawdź warunek wstępny przekazania względem rozwiązanej ścieżki:

```bash
test -f "<handoff-path>"
```

**Jeśli nie istnieje**, wykonaj dokładnie to i ZATRZYMAJ SIĘ — bez zapasowego wywiadu, bez inline mini-przekazania, bez czytania rozmowy w celu znalezienia zastępczego wyboru stosu:

```bash
echo -n "/10x-tech-stack-selector" | pbcopy 2>/dev/null || echo -n "/10x-tech-stack-selector" | clip.exe 2>/dev/null || echo -n "/10x-tech-stack-selector" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard "/10x-tech-stack-selector"
```

Wypisz dosłownie (podstaw rozwiązaną ścieżkę; jeśli użyto wartości domyślnej, jest to `context/foundation/tech-stack.md`):

```
Bootstrapper requires a tech-stack hand-off at `<handoff-path>`. Run `/10x-tech-stack-selector` first, then re-invoke.
```

Następnie ZATRZYMAJ SIĘ. Kontekst rozmowy **nie** jest rozwiązaniem awaryjnym — nawet jeśli wybór stosu był omawiany wcześniej na czacie, umiejętność wymaga pliku na dysku. Zob. `references/refusal-protocol.md`, aby poznać pełny zestaw warunków odmowy i ciągów dla schowka.

**Jeśli istnieje**, przeczytaj go W CAŁOŚCI (bez `limit`/`offset`) i kontynuuj. Przeanalizuj frontmatter zgodnie z `references/handoff-consumer.md` i rozwiąż wybraną kartę przez wyszukiwanie `starter_id` w `/skills/10x-tech-stack-selector/references/starter-registry.yaml`. Jeśli wyszukiwanie się nie powiedzie, uruchom odmowę z powodu rozbieżności rejestru z `references/refusal-protocol.md` i ZATRZYMAJ SIĘ. Jeśli `starter_id` ma wartość `custom`, pomiń wyszukiwanie i użyj zamiast tego `custom_starter` (odmowa nadal obowiązuje, jeśli w tym bloku brakuje `name`).

Powtórz użytkownikowi wykorzystane pola jako podsumowanie do potwierdzenia lub korekty:

```
Hand-off received:
  Starter:        <starter_id> — <name>   (for custom: "custom — <custom_starter.name>")
  Project name:   <project_name>
  Package manager:<package_manager | "(card default)" if omitted>
  Language:       <hints.language_family>
  Confidence:     <hints.bootstrapper_confidence>
  Path taken:     <hints.path_taken>
  Deployment:     <hints.deployment_target>
  Feature flags:  <comma list of has_* set to true, or "none">
```

Zadaj jedno pytanie potwierdzające:

AskUserQuestion:
- question: "Kontynuować z tym przekazaniem czy najpierw coś poprawić?"
  header: "Przekazanie"
  options:
  - label: "Kontynuuj (zalecane)"
    description: "Kontynuuj z przekazaniem w odczytanej postaci."
  - label: "Popraw wartość"
    description: "Zapytam, które pole nadpisać dla tego uruchomienia; plik na dysku pozostanie bez zmian."
  - label: "Zatrzymaj — najpierw popraw przekazanie"
    description: "Zakończ. Uruchom ponownie /10x-tech-stack-selector, aby zaktualizować tech-stack.md, a następnie wywołaj ponownie."
  multiSelect: false

Jeśli „Popraw wartość”: zapytaj, które pole, przechwyć nadpisanie i kontynuuj z nadpisaniem zastosowanym wyłącznie dla tej sesji. Następnie uruchom ochronę zapełnionego cwd z `references/refusal-protocol.md` (ostrzeżenie i potwierdzenie, jeśli cwd już zawiera charakterystyczny dla szkieletu ślad, taki jak `package.json`, `Cargo.toml`, `Gemfile`, `pyproject.toml` itd.).

### Krok 1 — Weryfikacja przed utworzeniem szkieletu

Przed uruchomieniem CLI startera wykonaj lekkie sprawdzenie aktualności opisane w `references/pre-scaffold-verification.md`. Przeczytaj teraz tę referencję. Ten etap jest tylko do odczytu — bez klonowania, bez instalacji, bez zmian w systemie plików — i ma charakter informacyjny, nie blokujący: każde ustalenie to WARN-AND-CONTINUE.

Sekwencja:

1. Na podstawie wybranej karty wyprowadź nazwę pakietu npm z `cmd_template`, jeśli `hints.language_family == js` i szablon wywołuje CLI `create-*` (np. `npm create next-app` → `create-next-app`, `npm create astro` → `create-astro`, `npm create vite` → `create-vite`). Jeśli szablon zaczyna się od `git clone`, pomiń krok npm.
2. Jeśli wyprowadzono nazwę pakietu, uruchom `npm view <package> version` oraz `npm view <package> time.modified`.
3. Na podstawie wybranej karty przeanalizuj `docs_url`. Jeśli wskazuje na `github.com/<owner>/<repo>`, uruchom `gh api repos/<owner>/<repo> --jq '.pushed_at'`.
4. Oblicz wagę zgodnie z progami w `pre-scaffold-verification.md` (fresh / aged / stale).
Dla `starter_id: custom`: pomiń krok npm i uruchom sprawdzenie GitHub względem `custom_starter.docs_url` tylko wtedy, gdy jest to adres URL GitHub; w przeciwnym razie zapisz „no recency signal available”.

5. Wypisz jedną linię podsumowania w rozmowie. Poprzedź ją jednoliniowym ostrzeżeniem „Heads-up”, jeśli którykolwiek sygnał jest stale. Nigdy nie blokuj — niezależnie od tego przejdź do Kroku 2.
6. Przygotuj w rekordzie weryfikacji w pamięci rozwiązaną nazwę pakietu (jeśli występuje), adres URL repozytorium GitHub (jeśli występuje), oba znaczniki czasu oraz obie wagi. Krok 4 zapisuje ten rekord na dysku.

Jeśli wywołanie sieciowe się nie powiedzie, zapisz błąd i kontynuuj z częściowym rekordem — zob. „Failure mode” w referencji.

Wyszukaj teraz `cwd_strategy` dla wybranego `starter_id` w `references/bootstrapper-config.yaml` (domyślnie `subdir-then-move`, jeśli id nie jest wymienione). Krok 2 go potrzebuje. Jednocześnie wyszukaj `audit_commands[<hints.language_family>]` z tego samego pliku i przygotuj je dla Kroku 3 (wartość `null` oznacza, że Krok 3 pominie audyt i odnotuje pominięcie w logu).

### Krok 2 — Utworzenie szkieletu i scalenie

Przeczytaj teraz `references/scaffold-merge.md`. Zawiera pełny mechanizm dla trzech strategii cwd, macierz konfliktów, reguły podstawiania oraz ścieżkę HARD-STOP dla awarii CLI.

Sekwencja:

1. Rozwiąż `cmd_template` z wybranej karty. Dla `starter_id: custom` rozwiąż je zamiast tego zgodnie z `scaffold-merge.md` § Custom starter — obejmuje to pokazanie dokładnego polecenia i uzyskanie wyraźnego zatwierdzenia, zanim cokolwiek zostanie uruchomione. Podstaw `{name}` i `{pm}` zgodnie ze strategią w danym zakresie (zob. `scaffold-merge.md` § Substitution rules). Zapasową wartością `{pm}` jest `toolchain.package_manager` karty, jeśli w przekazaniu pominięto to pole.
2. Wykonaj rozgałęzienie według `cwd_strategy` (rozwiązanego w Kroku 1 z `bootstrapper-config.yaml`, z wartością domyślną `subdir-then-move`):
   - **`subdir-then-move`** — uruchom rozwiązane polecenie z `{name}=.bootstrap-scaffold`. Po kodzie wyjścia 0 zastosuj macierz konfliktów, przenosząc pliki do cwd, a następnie usuń `.bootstrap-scaffold/`.
   - **`native-cwd`** — uruchom rozwiązane polecenie z `{name}=.` bezpośrednio w cwd. Bez kroku scalania. Przed uruchomieniem: wypisz pliki, których CLI zaraz dotknie, i pokaż je w rozmowie przed exec.
   - **`git-clone`** — uruchom rozwiązane polecenie z `{name}=.bootstrap-scaffold`. Po kodzie wyjścia 0 usuń `.bootstrap-scaffold/.git/` przed zastosowaniem macierzy konfliktów i przeniesieniem plików do cwd. Następnie usuń `.bootstrap-scaffold/`.
3. Przechwyć stdout, stderr i kod wyjścia do rekordu weryfikacji w pamięci niezależnie od wyniku.
4. **Awaria CLI to HARD-STOP.** Jeśli kod wyjścia jest niezerowy, uruchom ścieżkę obsługi awarii CLI w `scaffold-merge.md` § CLI failure handling: pozostaw `.bootstrap-scaffold/` na miejscu, nie stosuj macierzy konfliktów, zapisz częściowy `verification.md` z `phase_3_status: failed`, ustaw schowek na `/10x-bootstrapper`, wypisz podsumowanie awarii i ZATRZYMAJ SIĘ. Nie przechodź do Kroku 3.
5. Przy kodzie wyjścia 0 wypisz jedną linię podsumowania zgodnie z formatem w `scaffold-merge.md` § Surfacing the result. Przygotuj dziennik przenoszenia plik po pliku w rekordzie weryfikacji w pamięci. Przejdź do Kroku 3.

Ochrona zapełnionego cwd z Kroku 0 (`refusal-protocol.md` § (d)) została już uruchomiona przed tym krokiem. Macierz konfliktów stanowi siatkę bezpieczeństwa: istniejące pliki stają się rodzeństwem `.scaffold`, `context/` jest zawsze zachowany, a `.gitignore` jest scalany przez dopisanie.

Rozmawiając z użytkownikiem, tłumacz nazwy strategii na prosty język („utwórz szkielet w tymczasowym katalogu, a potem przenieś pliki”, „utwórz szkielet bezpośrednio w bieżącym katalogu”, „sklonuj repozytorium startera bez zachowywania jego historii git”) zamiast dosłownie powtarzać wewnętrzne etykiety.

### Krok 3 — Weryfikacja po utworzeniu szkieletu

Przeczytaj teraz `references/post-scaffold-verification.md`. Ten etap kieruje działanie do polecenia audytu rozwiązanego w Kroku 1 (`audit_commands[<hints.language_family>]` z `bootstrapper-config.yaml`) i przypisuje ustaleniom poziomy wagi.

Sekwencja:

1. Jeśli rozwiązane polecenie audytu ma wartość `null`, pomiń audyt i przygotuj w rekordzie weryfikacji ustrukturyzowaną notatkę „no built-in audit tool for <language_family>”. Wypisz linię pominięcia zgodnie z formatem Output z referencji. Przejdź do Kroku 4.
2. W przeciwnym razie uruchom rozwiązane polecenie z cwd (lub z odpowiedniego katalogu instalacji zależności, jeśli szkielet tak ustrukturyzował projekt). Przechwyć stdout, stderr i kod wyjścia. Kod wyjścia narzędzia audytowego ma charakter wyłącznie informacyjny — bootstrapper NIE zatrzymuje się przy niezerowym kodzie wyjścia audytu.
3. Przeanalizuj wynik zgodnie z blokiem wywołania dla danego ekosystemu w referencji. Przypisz ustalenia do poziomów CRITICAL / HIGH / MODERATE / LOW.
4. Jeśli narzędzie obsługuje rozróżnienie bezpośrednie vs przechodnie, oblicz ten podział.
5. Wypisz jedną linię podsumowania w rozmowie zgodnie z formatem Output z referencji. Liczby CRITICAL i HIGH są pokazywane inline; MODERATE i LOW tylko w logu.
6. Przygotuj pełny podział (surowe wyjście, przeanalizowane liczby, szczegóły każdego ustalenia, podział bezpośrednie/przechodnie) w rekordzie weryfikacji w pamięci.

Niedostępne narzędzie, awaria sieci lub awaria analizy: WARN-AND-CONTINUE zgodnie z blokiem Failure mode w referencji. Obecne ustalenia CRITICAL: WARN-AND-CONTINUE — bootstrapper informuje, decyzję podejmuje użytkownik.

### Krok 4 — Zapisz verification.md i zakończ

Przeczytaj teraz `references/verification-log-schema.md`. Ten krok zapisuje ślad audytowy uruchomienia na dysku i wypisuje końcowe podsumowanie.

Sekwencja:

1. Upewnij się, że istnieje `context/changes/bootstrap-verification/`. Utwórz katalog, jeśli go brakuje (bez `change.md` — folder zawiera wyłącznie log).
2. Jeśli `context/changes/bootstrap-verification/verification.md` już istnieje, uruchom ochronę WARN-AND-CONFIRM z `references/refusal-protocol.md` § (e). Przy „Overwrite” kontynuuj. Przy „Save as verification-v2.md” zwiększ numer do następnego dostępnego slotu `verification-vN.md`. Przy „Abort” zatrzymaj się bez zapisywania.
3. Utwórz treść pliku zgodnie z `references/verification-log-schema.md`: frontmatter (z `phase_3_status: ok` dla zwykłych uruchomień, `failed` dla częściowego logu HARD-STOP), następnie `## Hand-off`, `## Pre-scaffold verification`, `## Scaffold log`, `## Post-scaffold audit`, `## Hints recorded but not acted on`, `## Next steps`. Sekcja `Hints recorded but not acted on` pobiera każdą wskazówkę z flag przekazania `handoff-consumer.md` jako „surfaces but does not act on in v1”.
4. Zapisz plik. Jeśli zapis się nie powiedzie (błąd systemu plików, odmowa uprawnień), awaryjnie wypisz pełną treść na czacie zgodnie z blokiem failure-mode schematu.
5. Wypisz końcowe podsumowanie w rozmowie:

   ```
   Bootstrapped <starter_id> into the current directory. Verification log: context/changes/bootstrap-verification/verification.md.

   Pre-scaffold: <one-line recency summary>.
   Scaffold:    <one-line scaffold summary>.
   Audit:       <one-line audit summary>.

   Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.
   ```

6. Zatrzymaj się. Nie ustawiaj schowka do ponowienia po udanym uruchomieniu; dla v1 łańcuch jest ukończony.

W przypadku częściowego logu HARD-STOP (awaria CLI w Kroku 2), Krok 4 nadal jest uruchamiany, ale ze skróconą strukturą treści ze schematu (sekcja `Audit not run`, `phase_3_status: failed`). Schowek jest ustawiany na `/10x-bootstrapper` w celu ponowienia przez ścieżkę awarii Kroku 2, a nie przez ten krok.

## Wynik

Co umiejętność wytwarza na zewnątrz:

- **Pliki projektu ze szkieletem w cwd** — zapisywane przez CLI startera, z rodzeństwem `.scaffold` tam, gdzie polityka konfliktów wykryła kolizję. `context/` w cwd jest zachowany dosłownie.
- **`context/changes/bootstrap-verification/verification.md`** — ślad audytowy uruchomienia. Schemat w `references/verification-log-schema.md`. Jeden plik na uruchomienie; ponowne uruchomienia nadpisują go (z ochroną WARN-AND-CONFIRM).
- **Podsumowania rozmowy na każdym kroku** — echo do potwierdzenia lub korekty z Kroku 0, podsumowanie aktualności z Kroku 1, podsumowanie tworzenia szkieletu z Kroku 2 (z notatkami o rodzeństwie `.scaffold` i obsłudze `.gitignore`), podsumowanie audytu z Kroku 3, końcowe podsumowanie z Kroku 4 ze wskazaniem kolejnych kroków.
- **Wskaźnik w schowku wyłącznie na ścieżkach awarii** — `/10x-tech-stack-selector` dla odmów z powodu braku przekazania i rozbieżności rejestru, `/10x-bootstrapper` dla ponowienia HARD-STOP po awarii CLI w Kroku 2. Przy udanym uruchomieniu schowek nie jest ustawiany.

Czego umiejętność NIE wytwarza w v1:

- **`AGENTS.md` / `CLAUDE.md`** — odroczone do przyszłej umiejętności M1L4 („Memory Architecture”).
- **Pliki przepływu CI** (`.github/workflows/ci.yml` itd.) — odroczone do tej samej przyszłej umiejętności.
- **`git init`** ani żadnej historii git — bootstrapper zakłada, że użytkownik zarządza własnym repozytorium. Strategia `git-clone` jawnie usuwa sklonowane `.git/` przed przeniesieniem plików, aby historia upstreamowego startera nie przedostała się dalej.
- **Automatyczne naprawy / automatyczne poprawki ustaleń audytu** — bootstrapper informuje; decyzję podejmuje użytkownik.

## Referencje

- `references/handoff-consumer.md` — które klucze frontmatter przekazania bootstrapper wykorzystuje, pokazuje i ignoruje.
- `references/refusal-protocol.md` — warunki odmowy, treść i ciągi dla schowka.
- `references/bootstrapper-config.yaml` — nadpisania `cwd_strategy` dla poszczególnych starterów + mapa `language_family → audit_command`.
- `references/pre-scaffold-verification.md` — lekkie sprawdzenie aktualności.
- `references/scaffold-merge.md` — mechanizm `.bootstrap-scaffold/`, trzy strategie cwd, macierz konfliktów.
- `references/post-scaffold-verification.md` — rozdzielanie audytów według języka + klasyfikacja poziomów wagi.
- `references/verification-log-schema.md` — struktura `context/changes/bootstrap-verification/verification.md`.

## Krytyczne zasady ochronne

1. **Przekazanie jest warunkiem wstępnym, a nie rozwiązaniem awaryjnym.** Bez inline mini-przekazania, bez odczytywania historii rozmowy w poszukiwaniu zastępczych pól. Kontraktem jest plik na dysku.

2. **Bootstrapper wykorzystuje rejestr; nie jest jego właścicielem.** Kanoniczny rejestr starterów znajduje się w `/10x-tech-stack-selector`. Rozbieżność między `starter_id` wskazywanymi przez bootstrapper a rejestrem jest błędem CI (`scripts/validate-starter-registry-sync.mjs`). `custom` jest zarezerwowane i nigdy nie występuje w rejestrze.

3. **`context/` jest zawsze zachowany.** Polityka konfliktów jest rygorystyczna: nic pod `context/` w cwd nigdy nie jest nadpisywane przez szkielet. Pełną macierz konfliktów (Faza 3) znajdziesz w `references/scaffold-merge.md`.

4. **Awaria CLI to HARD-STOP.** Niezerowy kod wyjścia w Kroku 2 zatrzymuje umiejętność, pozostawia `.bootstrap-scaffold/` na miejscu do inspekcji i zapisuje częściowy log weryfikacji. Wszystkie inne fazy używają WARN-AND-CONTINUE — ustalenia weryfikacji mają charakter informacyjny, nie blokujący.

5. **v1 nie generuje `AGENTS.md` / `CLAUDE.md`.** To zadanie przechodzi do przyszłej umiejętności M1L4 („Memory Architecture”). v1 pokazuje w podsumowaniu rozmowy wartości wskazówek, takie jak `bootstrapper_confidence: best-effort` i `quality_override: true`, ale nie podejmuje żadnych działań kompensujących.

6. **Etykiety wewnętrzne umiejętności pozostają wewnętrzne.** Rozmawiając z użytkownikiem, nigdy nie odwołuj się do numerów kroków (`Step 0`, `Step 2`), nazw strategii dosłownie (`subdir-then-move`, `native-cwd`, `git-clone`) bez kontekstu ani do wewnętrznych ścieżek pól (`hints.deployment_target`). Tłumacz na prosty język: „etap tworzenia szkieletu”, „twój cel wdrożenia”, „jak CLI tworzy szkielet w bieżącym katalogu”, „przez klonowanie repozytorium startera”.

7. **Polecenie niestandardowego startera nigdy nie jest uruchamiane bez pokazania.** Dla `starter_id: custom` polecenie tworzenia szkieletu pochodzi z dokumentacji frameworka, a nie ze zweryfikowanej karty — zawsze je wypisz i zaczekaj na wyraźne zatwierdzenie. Jeśli nie można zidentyfikować oficjalnego generatora, przejdź do ścieżki ręcznego tworzenia szkieletu zamiast improwizować.