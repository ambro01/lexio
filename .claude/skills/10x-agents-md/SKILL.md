---
name: 10x-agents-md
description: >
  Generate an AGENTS.md onboarding document for AI coding agents working in
  this repository. Inspects the repo (package manifest, README, scripts,
  lint/test config, layout, commit history) and writes a concise contributor
  guide titled "Repository Guidelines". Use when the user invokes
  /10x-agents-md, asks to "create AGENTS.md", "write an agent onboarding
  doc", "generate contributor guide for agents", or similar. The output is
  optimized to be small, precise, reference-heavy, and ordered with critical
  rules at the top — so a future agent reads it once and stays unblocked.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - Edit
  - AskUserQuestion
---
# Agenci 10x MD

Utwórz `AGENTS.md`, który będzie służyć jako dokument wdrożeniowy dla agentów AI programujących w tym repozytorium. Plik ma być krótki, specyficzny dla repozytorium i ustrukturyzowany tak, aby najważniejsze zasady pojawiały się jako pierwsze.

## Rozwiązywanie danych wejściowych

`$ARGUMENTS` jest opcjonalne. Może to być:

- puste → zapisz w `AGENTS.md` w katalogu głównym repozytorium.
- ścieżka katalogu → zapisz `AGENTS.md` wewnątrz tego katalogu (przydatne dla zagnieżdżonych przewodników dotyczących konkretnych obszarów, np. `src/api/AGENTS.md`).
- pełna ścieżka pliku kończąca się na `.md` → zapisz tam dosłownie.

Jeśli plik docelowy już istnieje, **nie** nadpisuj go po cichu. Przejdź do przepływu aktualizacji w sekcji „Procedure → Update path”. Domyślnym zachowaniem jest chirurgiczna edycja, która zachowuje nadal aktualną treść, a nie przepisanie pliku.

## Wykrywanie zakresu — poziom repozytorium vs. poziom katalogu

Ta sama umiejętność może utworzyć dwa istotnie różne dokumenty w zależności od tego, **skąd** została wywołana. Wykryj zakres przed analizą, aby szkic był skierowany na właściwy poziom.

1. **Rozwiąż katalog docelowy.** Jeśli `$ARGUMENTS` wskazuje ścieżkę, jest ona celem. W przeciwnym razie użyj bieżącego katalogu roboczego (`pwd`).
2. **Porównaj z katalogiem głównym repozytorium.** Uruchom `git rev-parse --show-toplevel`. Jeśli katalog docelowy jest równy katalogowi głównemu repozytorium → **zakres na poziomie repozytorium**. Jeśli jest podkatalogiem (np. `src/components/`, `packages/api/src/routes/`, `app/api/`) → **zakres na poziomie katalogu**.

**Zakres na poziomie repozytorium.** Postępuj zgodnie z poniższą procedurą i „Output structure” — dokument jest ogólnym przewodnikiem wdrożeniowym (struktura projektu, polecenia budowania, bramka CI, konwencje commitów itd.).

**Zakres na poziomie katalogu.** Całkowicie pomiń kontekst wdrożenia do repozytorium. Czytelnik już zna repozytorium; potrzebuje zasad dotyczących *tego* katalogu. Przeorientuj analizę i wynik:

- **Najpierw analizuj lokalnie.** Sprawdź pliki faktycznie znajdujące się obok celu: sąsiednie pliki źródłowe, najbliższy `index.*`/`mod.rs`/`__init__.py`, testy współumieszczone, README katalogu nadrzędnego, jeśli istnieje, oraz wszelką zagnieżdżoną konfigurację (np. `tsconfig.json`, `.eslintrc`, manifesty tras), która nadpisuje domyślne ustawienia repozytorium. Korzystaj z dokumentów w katalogu głównym (`README.md`, `CLAUDE.md`) wyłącznie, aby **rozstrzygać konflikty** lub pobrać pojedyncze kanoniczne odwołanie `@` — nie traktuj ich jako głównego źródła.
- **Wywnioskuj lokalny wzorzec, czytając sąsiednie pliki.** Jaki kształt mają istniejące pliki w tym katalogu? Układ plików komponentów, nazewnictwo (`PascalCase.tsx`, `kebab-case.ts`, `*.handler.ts`), eksporty domyślne vs. nazwane, konwencje propsów/argumentów, położenie typów/stylów/testów względem jednostki, idiomy obsługi błędów, co jest importowane i skąd. AGENTS.md ma uchwycić zaobserwowaną konwencję, a nie ogólne porady.
- **Przeformułuj sekcje wokół lokalnej jednostki.** Zastąp sekcje poziomu repozytorium sekcjami istotnymi dla katalogu. Przydatne domyślne sekcje (dostosuj do tego, co istnieje):
  - *Dodawanie nowej \\<jednostki\\>* — konkretne kroki dla dominującego artefaktu w tym katalogu (komponentu, handlera trasy, migracji, hooka, workera itd.), wskazujące jeden istniejący sąsiedni plik jako wzorzec poprzez `@./<sibling-file>`.
  - *Układ plików i nazewnictwo* — wzorzec nazewnictwa, zasady współumieszczania (test obok źródła? style inline? typy w sąsiednim pliku?), polityka eksportów zbiorczych, jeśli istnieje.
  - *Lokalne konwencje* — kształt propsów/argumentów, zasady przepływu stanu/danych, dozwolone importy (oraz zabronione — np. „komponenty w tym katalogu nie mogą importować z `src/server/`”), reguły dostępności lub i18n widoczne w sąsiednich plikach.
  - *Testowanie tej jednostki* — wzorzec testów stosowany przez sąsiednie pliki, sposób uruchomienia testów tylko dla tego katalogu.
  - *Pułapki* — specyficzne dla katalogu zasady „nigdy nie rób X” widoczne w sąsiednich plikach lub pobliskim fragmencie CLAUDE.md.
- **Pomiń sekcje poziomu repozytorium.** Bez mapy struktury projektu najwyższego poziomu, bez listy pakietów monorepo, bez globalnego przeglądu budowania/CI, bez podsumowania konwencji commitów — należą one do głównego `AGENTS.md`. Jeśli czytelnik ich potrzebuje, podaj jedno odwołanie: `See @AGENTS.md at the repo root for repo-wide rules.`
- **Limit długości jest mniejszy.** Celuj w **120–250 słów** treści dla przewodników na poziomie katalogu; zakres powierzchni jest mniejszy, a wypełniacze są tu gorsze niż w katalogu głównym.

Quality guards nadal obowiązują, z jedną zmianą: strażnik 5 („Critical rules first”) staje się „Local rules first” — linią o największej dźwigni jest ta, która zapobiega dodaniu do tego katalogu sąsiedniego pliku o niewłaściwym kształcie.

## Interaktywne pytania — niezależne od hosta

Za każdym razem, gdy procedura mówi *„ask the user”*, użyj dowolnego narzędzia do pytań interaktywnych udostępnianego przez hosta agenta. Umiejętność jest niezależna od hosta; nie koduj na sztywno jednej nazwy narzędzia. Znane odpowiedniki (lista niepełna):

- Claude Code → `AskUserQuestion`
- Cursor → `ask_question`
- OpenAI Codex / Codex CLI → `request_user_input`
- Inne harnessy → szukaj narzędzia, którego opis wspomina o zadawaniu użytkownikowi ustrukturyzowanego pytania z opcjami.

**Zasada samodzielnego wykrywania.** Przed pierwszym krokiem interaktywnym przeskanuj własne dostępne narzędzia w poszukiwaniu takiego, które pasuje do powyższych wzorców (nazwy zawierające `ask`, `question`, `input`, `prompt_user` itd., z parametrem `question` lub `prompt` oraz polem `options`/`choices`). Użyj pierwszego dopasowania. Jeśli żadne nie jest dostępne, przejdź do zwykłej wiadomości konwersacyjnej z prośbą, aby użytkownik odpowiedział jedną z oznaczonych opcji — nie blokuj procedury.

Przy pierwszym zadaniu pytania podaj, które narzędzie wybrano (lub że nastąpił powrót do zwykłego czatu), aby użytkownik mógł to skorygować, jeśli istnieje lepsza opcja.

## Równoległe badanie przez subagentów (opcjonalne)

Jeśli host udostępnia narzędzie subagenta / uruchamiania zadań, kroki analizy i diffów można łatwo zrównoleglić — są to w większości niezależne odczyty. Znane odpowiedniki (lista niepełna):

- Claude Code → `Agent` (z typami subagentów `Explore`/`general-purpose`)
- Cursor → subagenci działający w tle
- OpenAI Codex → narzędzie delegowania zadań (jeśli dostępne)
- Inne harnessy → szukaj narzędzia uruchamiającego izolowanego agenta z własnym oknem kontekstu i zwracającego podsumowanie.

**Zasada samodzielnego wykrywania.** Przed rozpoczęciem analizy sprawdź, czy takie narzędzie istnieje. Jeśli tak, rozdziel niezależne odczyty w **jednym wywołaniu zbiorczym** (wielu subagentów w jednej wiadomości, nie sekwencyjnie):

- jeden subagent czyta `README.md`, `CLAUDE.md`, istniejący `AGENTS.md`, indeks `docs/` najwyższego poziomu;
- jeden sprawdza manifest oraz konfiguracje lint/format/type;
- jeden sprawdza konfigurację testów oraz workflowy CI;
- jeden uruchamia zapytania do historii git (konwencje commitów, ostatnia zmiana AGENTS.md, zakres diffów od `LAST_TOUCH`).

Każdy subagent powinien zwrócić **krótki ustrukturyzowany raport** (≤200 słów: tylko fakty, z cytatami `path:line`) — nie pełny zrzut pliku. Główny agent następnie syntetyzuje AGENTS.md na podstawie tych raportów.

**Kiedy nie używać subagentów.** Pomiń rozdzielenie zadań, jeśli:

- repozytorium jest małe (poniżej ~20 plików najwyższego poziomu) — narzut przewyższa oszczędności;
- host nie obsługuje subagentów — przejdź do sekwencyjnych odczytów w głównej pętli;
- większość istotnych plików została już załadowana do bieżącego kontekstu — ponowny odczyt przez subagenta tylko zużywa tokeny.

**Nie deleguj** kroku syntezy (tworzenia szkicu i kontroli Quality guards). Tworzenie szkicu wymaga utrzymania pełnego obrazu w jednym kontekście, aby egzekwować limit 200–400 słów, kolejność i politykę odwołań `@`.

## Czego ta umiejętność NIE robi

- Nie wymyśla faktów o projekcie. Każde twierdzenie w wyniku musi mieć źródło w pliku, poleceniu lub commicie, który faktycznie sprawdzono.
- Nie osadza wieloliniowych fragmentów kodu ani konfiguracji. Zamiast tego używa odwołań `@` do kanonicznych plików (np. `@package.json`, `@tsconfig.json`, `@docs/architecture.md`).
- Nie zapisuje ogólnych porad inżynieryjnych („write clean code”, „follow best practices”, „handle errors properly”). Jeśli zasady nie można zweryfikować względem diffu, usuń ją lub przepisz konkretnie.
- Nie powtarza domyślnych zachowań frameworków, tutoriali językowych ani niczego, co agent już zna z treningu. Tylko wiedza specyficzna dla projektu zasługuje na linię.
- Nie edytuje niepowiązanych plików. Umiejętność zapisuje jeden plik Markdown i kończy działanie.

## Procedura

**Najpierw rozgałęź według istnienia pliku.** Przed wykryciem czegokolwiek innego sprawdź, czy rozwiązana ścieżka docelowa już istnieje (użyj `Read` lub `ls`). Jeśli tak, wykonaj poniższy **Update path**. Jeśli nie, wykonaj **Create path**.

### Create path

1. **Analiza.** Czytaj w tej kolejności, pomijając elementy, które nie istnieją:
   - `README.md`, `CLAUDE.md`, istniejący `AGENTS.md`, indeks `docs/` najwyższego poziomu.
   - Manifest: `package.json` (skrypty, workspaces, engines) albo `pyproject.toml` / `Cargo.toml` / `go.mod` / `Gemfile` / odpowiednik.
   - Konfiguracje lint/format/type: `.eslintrc*`, `oxlint*`, `biome.json`, `tsconfig.json`, `ruff.toml`, `.editorconfig`.
   - Konfiguracja testów: `vitest.config.*`, `jest.config.*`, `pytest.ini`, `playwright.config.*`, lokalizacje `*.test.*`.
   - CI: `.github/workflows/*` (jeden lub dwa pliki; tylko tyle, by znać bramkę).
   - Układ: dwa najwyższe poziomy drzewa (`ls`/`find`-bounded), lista pakietów workspace, jeśli to monorepo.
   - Historia: `git log --oneline -n 30`, aby poznać konwencje komunikatów commitów; `git config remote.origin.url` dla celu PR.
2. **Wyodrębnij.** Na podstawie analizy zapisz dla siebie:
   - 1–3 polecenia, które agent uruchamia najczęściej (budowanie, testy, lint, serwer deweloperski).
   - Kilka konwencji, które recenzent faktycznie oznaczyłby podczas przeglądu PR (wzorce nazewnictwa, układ plików, styl prefiksów commitów).
   - Każdą twardą zasadę „nigdy nie rób X” widoczną w CLAUDE.md, README lub walidatorach CI.
   - Gdzie znajdują się szczegółowe dokumenty, aby AGENTS.md mógł do nich wskazywać zamiast je powielać.
3. **Szkic.** Zapisz plik zgodnie z poniższą sekcją „Output structure”.
4. **Samokontrola przed zapisem.** Uruchom pięć strażników z „Quality guards”. Jeśli którykolwiek nie przejdzie, popraw szkic; jeszcze nie zapisuj.
5. **Zapis.** Pojedyncze wywołanie `Write` do rozwiązanej ścieżki. Potwierdź użytkownikowi ścieżkę i liczbę słów.

### Update path

Uruchamiane, gdy plik docelowy już istnieje. Domyślnie wykonuj **chirurgiczną edycję**: zachowaj to, co nadal jest prawdziwe, popraw to, co nieaktualne, uzupełnij brakujące elementy i usuń to, co zostało usunięte z repozytorium. Nie przepisuj od zera, chyba że użytkownik o to poprosi.

1. **Zinwentaryzuj istniejący plik.**
   - `Read` całego pliku.
   - Wypisz jego obecne sekcje (nagłówki H1/H2/H3) oraz zasady/polecenia pod każdą z nich.
   - Wyodrębnij każde odwołanie `@` oraz każdą względną ścieżkę lub nazwę pliku, do której się odwołuje.

2. **Ustal datę pliku przez git.**
   - `git log --follow --format="%h %ad %s" --date=short -- <path>` — pełna historia edycji pliku.
   - Zanotuj hash i datę **ostatniego commita modyfikującego plik**. Nazwij je `LAST_TOUCH`.
   - Jeśli plik nie jest śledzony (`git ls-files --error-unmatch <path>` kończy się błędem), traktuj go jako świeżo utworzony: pomiń kroki git-diff i uruchom pełną analizę Create path, ale nadal zachowaj wszelką oczywiście specyficzną dla projektu treść napisaną przez użytkownika.

3. **Porównaj stan repozytorium od `LAST_TOUCH`.** Użyj tych kontroli (pomiń każdą, której celu plik nie wskazuje):
   - `git diff --stat LAST_TOUCH..HEAD -- README.md CLAUDE.md docs/` — czy dokumentacja najwyższego poziomu została przeniesiona lub zmieniona?
   - `git diff LAST_TOUCH..HEAD -- package.json pyproject.toml Cargo.toml go.mod` (którykolwiek istnieje) — dla **scripts**, **dependencies**, **engines**, **workspaces**. Zwróć szczególną uwagę na blok `scripts`: zmienione nazwy, dodane i usunięte skrypty są najczęstszym źródłem nieaktualnej treści AGENTS.md.
   - `git diff LAST_TOUCH..HEAD -- .eslintrc* oxlint* biome.json tsconfig.json ruff.toml .editorconfig` — czy toolchain lint/format/type się zmienił?
   - `git diff LAST_TOUCH..HEAD -- vitest.config.* jest.config.* pytest.ini playwright.config.*` — czy stos testowy lub układ testów się zmienił?
   - `git diff --stat LAST_TOUCH..HEAD -- .github/workflows/` — czy bramka CI się zmieniła?
   - `git log --oneline LAST_TOUCH..HEAD -- <commit-conventions-relevant-area>` oraz `git log --oneline -n 30` — czy obserwacja stylu commitów w pliku nadal odpowiada najnowszej historii?
   - Dla każdego odwołania `@` i ścieżki wymienionej w pliku: wykonaj `ls`/`Read` dla ścieżki. Jeśli już nie istnieje lub została zmieniona jej nazwa, ta linia jest nieaktualna.

4. **Sklasyfikuj każdą linię istniejącego pliku** do jednego z czterech koszyków:
   - **KEEP** — nadal dokładna; przytoczony plik/polecenie/ścieżka nadal istnieje w tym samym kształcie.
   - **UPDATE** — kierunek jest właściwy, ale szczegół jest nieaktualny (zmieniona nazwa skryptu, przeniesiona ścieżka, zmienione narzędzie, aktualizacja wersji). Zanotuj dokładne zastąpienie.
   - **REMOVE** — bazowy plik/polecenie/konwencja już nie istnieje albo zasadzie zaprzecza nowsze źródło (CLAUDE.md, README), któremu bardziej ufasz.
   - **MISSING** — elementu obecnie nie ma w pliku, ale powinien się znaleźć (nowy pakiet najwyższego poziomu, nowy wymagany skrypt, nowa zasada „nigdy nie rób X” wprowadzona przez walidator CI, nowa konwencja commitów widoczna w `git log`).
   Zachowaj tę klasyfikację jako krótką tabelę, którą możesz pokazać użytkownikowi. Cytuj `path:line` (w istniejącym AGENTS.md) dla każdego wpisu UPDATE/REMOVE oraz cytuj ścieżkę źródła prawdy (np. `package.json:42`) dla każdego wpisu UPDATE/MISSING.

5. **Potwierdź zakres przed edycją.** Użyj jednorazowo narzędzia interaktywnego pytania hosta (zobacz „Interactive prompts — host-agnostic” powyżej) z tymi opcjami:
   - **Apply the proposed updates** — wykonaj listę UPDATE/REMOVE/MISSING jako ukierunkowane wywołania `Edit`; linie KEEP nie są modyfikowane.
   - **Show me the change list first** — wyświetl tabelę klasyfikacji na czacie, bez edycji, następnie zapytaj ponownie.
   - **Full regenerate** — odrzuć istniejący plik i uruchom Create path. Używaj tylko, gdy istniejący plik jest w większości nieaktualny lub użytkownik wyraźnie chce zacząć od czystego stanu.
   - **Cancel** — bez zmian.

6. **Edytuj chirurgicznie.** Dla wyboru „Apply” preferuj wiele małych wywołań `Edit` (po jednym dla każdego wpisu UPDATE/REMOVE/MISSING) zamiast pojedynczego przepisania przez `Write`. Zachowuje to styl autora w sekcjach KEEP i tworzy diff nadający się do recenzji. Jeśli kolejność sekcji narusza strażnika „critical rules first” z Quality guards, a użytkownik zatwierdził aktualizacje, możesz przenieść całe sekcje — ale wyłącznie sekcje; nigdy nie zmieniaj po cichu sformułowania zasad.

7. **Uruchom ponownie Quality guards** na zaktualizowanym pliku. Obowiązuje tych samych pięć bramek. Jeśli strażnik teraz nie przejdzie wskutek aktualizacji (np. treść przekroczyła 400 słów po dodaniu MISSING), skróć treść KEEP, która stała się mało istotna, zamiast usuwać nową treść MISSING.

8. **Raportuj.** Potwierdź ścieżkę, nową liczbę słów i jednoliniowe podsumowanie zmian w każdym koszyku (np. *„3 zaktualizowane, 1 usunięta, 2 dodane; kolejność sekcji bez zmian”*).

## Struktura wyniku

Tytuł dokumentu to `# Repository Guidelines`. Docelowa długość to **200–400 słów** treści. Używaj nagłówków Markdown dla struktury. Dostosuj sekcje do tego, co repozytorium faktycznie zawiera — pomiń każdą sekcję, która byłaby pusta lub spekulacyjna.

Uporządkuj sekcje według **dźwigni dla nowego agenta**, a nie według tradycji. Krytyczne zasady i najczęściej używane polecenia są pierwsze; kontekst „dobrze wiedzieć” jest ostatni. Przydatna domyślna kolejność w razie wątpliwości:

1. **Hard rules / Agent-specific instructions** — lista „nigdy nie rób X” oraz wszelkie pułapki (uwzględniaj tylko, jeśli repozytorium faktycznie je zawiera; w przeciwnym razie pomiń i pozwól, aby konwencje miały znaczenie).
2. **Project Structure & Module Organization** — mapa katalogów najwyższego poziomu, lokalizacja źródeł/testów/zasobów, lista pakietów monorepo, jeśli ma znaczenie. Odwołuj się do głębszej dokumentacji przez `@path/to/doc.md`, zamiast wklejać jej treść.
3. **Build, Test, and Development Commands** — 3–6 poleceń, które agent faktycznie uruchomi, każde z jednoliniowym opisem celu. Preferuj `pnpm <script>` / `make <target>` / itd. zamiast bezpośrednich wywołań narzędzi, gdy projekt je opakowuje.
4. **Coding Style & Naming Conventions** — wcięcia, wersja języka, wzorce nazewnictwa (z jednym krótkim przykładem wzorca, nie blokiem kodu) oraz narzędzia lint/format, które je wymuszają.
5. **Testing Guidelines** — framework, lokalizacja testów, wzorzec nazewnictwa, sposób uruchomienia pojedynczego testu, każdy próg pokrycia, który repozytorium faktycznie sprawdza.
6. **Commit & Pull Request Guidelines** — konwencja zaobserwowana w `git log` (np. widoczne prefiksy Conventional Commits), oczekiwania dotyczące opisu PR, wymagane kontrole CI.
7. **Security & Configuration Tips** *(opcjonalne)* — obsługa sekretów, lokalizacja plików env, skrypty walidujące powodujące niepowodzenie CI.
8. **Architecture Overview** *(opcjonalne, tylko jeśli nie zostało już omówione przez odwołanie `@`)* — maksymalnie 3–6 punktów; w przeciwnym razie podaj link.

Rozpocznij plik krótkim akapitem (1–2 zdania) określającym, czym jest projekt i jaki jest główny stos — wystarczająco, aby agent trafiający do repozytorium po raz pierwszy miał kontekst. Bez deklaracji misji, przedstawiania zespołu ani wartości.

## Strażnicy jakości (uruchom przed `Write`)

Każdy strażnik jest twardą bramką. Jeśli którykolwiek nie przejdzie, popraw szkic.

1. **Długość.** Treść ma 200–400 słów. Poniżej 200 oznacza pominięcie szczegółów; powyżej 400 oznacza dodanie wypełniaczy lub wklejenie treści, która powinna być odwołaniem.
2. **Brak wieloliniowych fragmentów.** Żadnych ogrodzonych bloków kodu dłuższych niż pojedyncza linia polecenia. Zastąp przykładowe komponenty / konfiguracje / migracje przez `@path/to/file`. Krótkie jednoliniowe przykłady poleceń (`pnpm test`, `git rebase main`) są w porządku.
3. **Każdą zasadę można sprawdzić.** Przeczytaj ponownie każde zdanie i zapytaj: *czy recenzent mógłby oznaczyć diff na tej podstawie?* Jeśli nie, przepisz je, używając konkretnego wzorca, progu lub nazwanego narzędzia. Usuń zwroty takie jak „clean code”, „best practices”, „modern patterns”, „be consistent”, „handle errors properly”, „keep it simple”.
4. **Brak zbędnej wiedzy.** Usuń każdą linię, którą można było napisać bez otwierania repozytorium. Domyślne zachowania frameworków, tutoriale językowe i definicje powszechnych terminów nie zasługują na miejsce. Jeśli zasada powiela `README.md` / `package.json` / konfigurację lint, zastąp ją przez `@README.md` / `@package.json` / `@.eslintrc.json`.
5. **Najpierw krytyczne zasady.** Pierwsza jedna trzecia pliku musi zawierać zasady o najwyższej wadze oraz najczęściej używane polecenia. Jeśli jedyna zasada „nigdy nie rób X” jest na dole, przenieś ją wyżej. Jeśli na początku jest powitanie/misja/wartości, usuń je.

## Ton

Profesjonalny, instrukcyjny, zwięzły. Druga osoba („Run `pnpm test` before pushing”) albo tryb rozkazujący („Place new handlers in `src/api/<feature>/`”). Bez języka marketingowego, bez emoji, bez dekoracyjnych separatorów.

## Po zapisaniu

Zgłoś użytkownikowi:

- ścieżkę zapisanego pliku,
- liczbę słów treści,
- jednoliniowe podsumowanie wybranej kolejności sekcji,
- przypomnienie: *test the file by running a real task with a fresh agent session — onboarding docs only prove themselves on the next run.*

Nie proponuj dalszych kroków, chyba że użytkownik o nie poprosi.

## Przypadki brzegowe

- **Nie wykryto `README.md` ani manifestu.** Zatrzymaj się i powiedz użytkownikowi, że repozytorium wygląda na puste lub nieznane; przed utworzeniem szkicu poproś o jedn akapit opisu projektu.
- **Monorepo z README dla każdego pakietu.** Zapisz główny `AGENTS.md`, który wymienia pakiety i wskazuje `@`-odwołania do README każdego pakietu, zamiast powielać szczegóły poszczególnych pakietów. Zasugeruj zagnieżdżone `packages/<name>/AGENTS.md` dla każdego pakietu, którego zasady istotnie się różnią.
- **Istniejący rozbudowany `CLAUDE.md` w repozytorium.** Traktuj go jako autorytatywny materiał źródłowy. Nowy `AGENTS.md` powinien być bardziej zwięzłą, niezależną od narzędzia agenta syntezą, która dla szczegółów odsyła do `@CLAUDE.md`, a nie dosłowną kopią.
- **Istniejący `AGENTS.md` został ręcznie edytowany po ostatnim commicie.** `git diff HEAD -- <path>` pokaże niezacommitowane zmiany. Najpierw przeczytaj te zmiany i traktuj je jako KEEP, chyba że bezpośrednio zaprzeczają zasadzie wymuszanej przez CI — użytkownik jest w trakcie edycji i nie wolno nadpisać pracy w toku.
- **`LAST_TOUCH` jest początkowym commitem repozytorium.** Zakres diff staje się `LAST_TOUCH..HEAD` bez użytecznego sygnału. Wróć do sprawdzania bieżącego stanu repozytorium względem twierdzeń pliku, linia po linii, bez skrótu git-diff.
- **Plik istnieje, ale jest pusty lub stanowi szablon.** Pomiń Update path — uruchom Create path i nadpisz, ponieważ nie ma treści autora do zachowania.
- **Repozytorium bez historii commitów (`git log` jest puste).** Pomiń sekcję konwencji commitów zamiast zgadywać; w sekcji PR zaznacz, że konwencja ma zostać zdefiniowana.
- **Repozytorium poliglotyczne (bez pojedynczego manifestu).** Wybierz dominujący stos według liczby plików dla sekcji „Build/Test/Dev”; wspomnij o dodatkowych stosach tylko wtedy, gdy mają własne polecenia, których agent będzie potrzebować.