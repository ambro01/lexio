---
name: 10x-implement
description: Implement technical plans from context/changes/<change-id>/plan.md with verification
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
# Wdrażanie planu

Masz za zadanie wdrożyć zatwierdzony plan techniczny z `context/changes/<change-id>/plan.md`. Plany te zawierają fazy z konkretnymi zmianami oraz kanoniczną sekcję `## Progress` na dole, która steruje stanem wykonania (zobacz `references/progress-format.md`).

## Konfiguracja początkowa

Po wywołaniu tego polecenia:

1. **Rozwiąż plan**:
   - Jeśli wywołano jako `/10x-implement <change-id> [phase N]`, rozwiąż do `context/changes/<change-id>/plan.md`.
   - Jeśli wywołano z `@context/changes/<change-id>/plan.md` lub pełną ścieżką, zaakceptuj ją.
   - **Odmów, jeśli rozwiązana ścieżka zaczyna się od `context/archive/`** — wyświetl „This change is archived. Open a new change with `/10x-new` instead.” i ZATRZYMAJ się.
   - Jeśli nic nie podano, odpowiedz poniższą wiadomością i **ZATRZYMAJ się oraz czekaj**:

```
I'll help you implement an approved technical plan. Please provide:

1. A change-id (e.g., `/10x-implement oauth-login phase 1`), or
2. A full path (e.g., `@context/changes/oauth-login/plan.md`).

You can list active changes with: `ls context/changes/`

Tip: Make sure the plan has been reviewed and approved before implementation.
```

## Rozpoczęcie pracy

Po otrzymaniu ścieżki do planu:

- Przeczytaj plan w całości. Sekcja `## Progress` na dole jest autorytatywna dla stanu wykonania — pola wyboru (`- [x]`) występują TYLKO tam. Bloki faz zawierają zwykłe wypunktowania `- ` (bez pól wyboru).
- Przeczytaj `context/foundation/lessons.md`, jeśli istnieje, i przyswój każdy wpis przed rozpoczęciem dowolnej fazy — są to zaakceptowane przez zespół powtarzające się zasady i muszą kształtować każdą decyzję implementacyjną podejmowaną w tym przebiegu.
- Przeczytaj wszystkie pliki wymienione w planie (przywołane badania, ramy, pliki źródłowe w tym samym folderze zmiany).
- **Czytaj pliki w całości** — nigdy nie używaj parametrów limit/offset, potrzebujesz pełnego kontekstu.
- Głęboko przemyśl, jak elementy współgrają ze sobą.
- **Wykonaj wstępną kontrolę bramek**: zbierz polecenia z kryteriów sukcesu Automated każdej fazy i sprawdź, czy każde z nich można tu uruchomić — istnieje binarium lub skrypt pakietu (`package.json` scripts, `command -v`, `Makefile` targets). Kryterium, którego polecenia nie można uruchomić, jest niedopasowaniem dla fazy, która go potrzebuje, a zgłoszenie tego teraz jest znacznie tańsze niż odkrycie tego po napisaniu kodu. Zgłoś każde niemożliwe do uruchomienia polecenie na wejściu (`PREFLIGHT: <command> not runnable — Phase <N> will need this`). Nigdy po cichu nie pomijaj nieweryfikowalnego kryterium.
- **Zaktualizuj `change.md`**: na wejściu ustaw `status: implementing` (tylko jeśli obecnie jest w `{planned, plan_reviewed}`) oraz `updated: <today>`.
- **Zsynchronizuj roadmapę** (w miarę możliwości, jednokrotnie na wejściu): jeśli `context/foundation/roadmap.md` zawiera pozycję, której `Change ID` jest równe `<change-id>`, zmień status tej pozycji na `Status: in-progress`. Zobacz „## Roadmap status sync” poniżej. Jest to odpowiednik dla otwartej pracy wobec zmiany na `done` przez `/10x-archive`; nigdy nie blokuje działania, a większość zmian nie będzie powiązana z roadmapą.
- Policz łączną liczbę faz (na podstawie nagłówków `## Phase N:`) i utwórz jeden wpis TaskCreate na fazę (pojawiają się one na pasku statusu użytkownika):
  - Dla każdej fazy utwórz zadanie z `subject: "Phase N: [Phase Name]"` oraz `activeForm: "Implementing Phase N"`
  - Przed rozpoczęciem pracy ustaw bieżącą fazę na `in_progress` przez TaskUpdate.
  - Oznacz każdą fazę jako `completed` przez TaskUpdate, gdy jej kryteria sukcesu przejdą.
- **Znajdź kolejny oczekujący krok**, skanując sekcję `## Progress`: pierwsza linia `- [ ]` w kolejności dokumentu wskazuje miejsce rozpoczęcia. Jeśli przekazano argument `phase N`, przejdź do pierwszego `- [ ]` wewnątrz `### Phase N:` zamiast tego.
- Rozpocznij implementację, jeśli rozumiesz, co należy zrobić.

## Tryb wykonania dla fazy

Pisanie kodu dla fazy to kosztowna część tej sesji: pełne czytanie plików źródłowych, rozumowanie o zmianach, stosowanie edycji. Uruchom to w podagencie, a główny kontekst pozostanie zwięzły w ramach długiego planu; uruchom to tutaj, a użytkownik może obserwować i przerwać pracę w trakcie fazy. Obie opcje są właściwe — użytkownik wybiera dla każdej fazy.

**Zapytaj przed pierwszą fazą przebiegu** (pierwszą oczekującą fazą lub wskazaną przez argument `phase N`):

AskUserQuestion:
- question: "Phase [N] — how should I implement it?"
  header: "Exec mode"
  options:
  - label: "Delegate to a subagent (Recommended)"
    description: "A subagent writes the code; I keep the gates, staging, commit and Progress here. Keeps this context lean across a long plan — you see the touched files, adaptations and gate verdicts when it returns."
  - label: "Implement in this context"
    description: "I write the code here so you can watch the edits land and redirect me mid-phase. Costs context — a long plan may need a clear between phases."
  multiSelect: false

Dla każdej późniejszej fazy wybór jest przenoszony wraz z pytaniem „Next phase decision” na końcu rytuału commitu — bez osobnego pytania. Jeśli użytkownik poprosił o kilka faz kolejno (więc to pytanie jest pomijane), przenieś ostatnio wybrany tryb dalej.

Niezależnie od aktywnego trybu, **wszystko, co użytkownik musi zdecydować lub przejrzeć, pozostaje tutaj**: wykonanie bramek i linie werdyktów, staging, rytuał commitu, zmiany w `## Progress`, pytania o niedopasowania. Delegowanie przenosi pisanie, nigdy podejmowanie decyzji.

### Delegowanie implementacji podagentowi

Gdy faza jest delegowana, wykonaj jedno wywołanie `Task` (`subagent_type: general-purpose`) przed stosem bramek, którego prompt zawiera:

- Change-id oraz numer i tytuł fazy.
- Pełną sekcję planu dla fazy dosłownie — Overview, Changes Required, Success Criteria. (Success Criteria stanowią kontekst, aby podagent znał cel; NIE uruchamia bramek — robisz to Ty.)
- **Dyscyplinę implementacji, której należy przestrzegać.** Rozwiąż `references/implementation-discipline.md` (znajduje się obok tego `SKILL.md`) do **ścieżki bezwzględnej** i poleć podagentowi, aby ją przeczytał i zastosował. Agent wywołany przez `Task` nie ma wiedzy o katalogu tego skilla, więc ścieżka względna lub „przeczytaj referencję tego skilla” nie zostanie rozwiązana. Wskaż plik; nie powtarzaj jego treści inline.
- Każdy wpis z `context/foundation/lessons.md`, jeśli istnieje — podagent nie może przeczytać pliku, jeśli nie wkleisz wpisów.
- Taksonomię niedopasowań z „Implementation Philosophy”: bezpośrednio dostosowuj i zgłaszaj niedopasowania **Minor**; przy niedopasowaniu **Structural** zatrzymaj się i zgłoś je, zamiast dostosowywać lub przeprojektowywać.
- Twarde granice: implementuj WYŁĄCZNIE zmiany w kodzie. Nie uruchamiaj stosu bramek, nie wykonuj stagingu, nie commituj, nie dotykaj sekcji `## Progress` ani żadnego pola wyboru, nie edytuj bloków faz, nie wychodź poza zakres planu. Nie wywołuj `AskUserQuestion` — użytkownik rozmawia z Tobą, nie z podagentem; otwarte pytanie wraca w wiadomości zwrotnej.

Wymagaj tej strukturalnej wiadomości końcowej jako wartości zwrotnej, a nie notatki dla człowieka:

```
STATUS: completed | structural-mismatch
TOUCHED: <repo-relative path>, <path>, ...      # every file created or edited
ADAPTATIONS: <one line each, or none>
STRUCTURAL: <plan assumption vs. what exists — only when STATUS is structural-mismatch>
UNCERTAINTIES: <ambiguous decisions, or none>
```

Po powrocie:

- **`completed`** → zainicjuj zbiór dotkniętych plików fazy z `TOUCHED` (zobacz „Tracking files touched during a phase”), przekaż użytkownikowi `ADAPTATIONS` i `UNCERTAINTIES` własnymi słowami — cicha adaptacja to taka, która później sprawia problemy — oraz przejdź do stosu bramek. Nigdy ślepo nie ufaj `TOUCHED`; uzgodnienie z `git status --porcelain` podczas stagingu jest kontrolą krzyżową dla pliku, którego podagent dotknął, ale nie umieścił na liście.
- **`structural-mismatch`** → nie uruchamiaj bramek. Przedstaw blok problemu z „Implementation Philosophy”, używając szczegółów `STRUCTURAL` podagenta, i zadaj pytanie o niedopasowanie. Następnie:
  - **Adapt and continue** → podagent, który zachował kontekst fazy, już nie istnieje, więc wyślij świeżego dla pozostałej części, przekazując decyzję użytkownika, szczegóły `STRUCTURAL` oraz częściową listę `TOUCHED`. Ponownie czyta to, czego potrzebuje; to ponowne czytanie jest uczciwą ceną tej ścieżki i występuje tylko przy niedopasowaniach strukturalnych. Jeśli faza była niemal ukończona, po prostu zakończ ją tutaj.
  - **Skip this part** / **Stop and re-plan** → jak opisano w „Implementation Philosophy”. Pozostaw częściową pracę w worktree; nie wykonuj stagingu ani commitu.

Naprawa bramki może być delegowana w ten sam sposób — wyślij skoncentrowanego podagenta z wyjściem nieudanej bramki i problematycznymi plikami, a następnie połącz jego zwrócone `TOUCHED` ze zbiorem fazy przed ponownym stagingiem. Trywialne mechaniczne poprawki (osierocony import, zmiana nazwy) szybciej zastosować tutaj. Tak czy inaczej budżet dwóch prób pozostaje bez zmian, a **kontrola celowego uszkodzenia zawsze uruchamia się tutaj** — jej edycja wyłącznie w worktree i bezwarunkowe przywrócenie nigdy nie są delegowane.

## Filozofia implementacji

Plany są starannie zaprojektowane, ale rzeczywistość może być chaotyczna. Twoim zadaniem jest:

- Podążać za intencją planu, dostosowując się do tego, co znajdujesz.
- Wdrażać każdą fazę w pełni przed przejściem do następnej.
- Weryfikować, że Twoja praca ma sens w szerszym kontekście kodu.
- Aktualizować pola wyboru w planie po ukończeniu sekcji.

[references/implementation-discipline.md](references/implementation-discipline.md) stanowi warstwę rzemiosła dla samej edycji — czytaj przywołany kod w całości, dostosowuj bez przeprojektowywania, dopasowuj zmianę do jej sąsiadów, przestrzegaj zaakceptowanych zasad zespołu, przeszukuj przed edycją nieznanego obszaru. Przeczytaj go przed pierwszą fazą implementowaną tutaj; gdy faza jest delegowana, podagent czyta go zamiast Ciebie (według ścieżki bezwzględnej — zobacz „Dispatching the implementation subagent”). Ta sekcja obejmuje wyłącznie to, co należy zrobić, gdy plan i rzeczywistość się nie zgadzają.

Gdy coś nie odpowiada dokładnie planowi, zastanów się dlaczego i komunikuj się jasno. Plan jest Twoim przewodnikiem, ale Twój osąd również ma znaczenie.

**Sklasyfikuj niedopasowanie przed przerwaniem.** Nie każda luka zasługuje na pytanie:

- **Minor** — przeniesiony plik, zmieniona nazwa symbolu, dryf importów, trywialna różnica w API lub konfiguracji. Intencja planu pozostaje nienaruszona; zmieniła się tylko współrzędna. Dostosuj implementację do rzeczywistości, powiedz o tym w jednej linii (`ADAPT: plan says src/auth.ts, file is now src/auth/index.ts`) i kontynuuj. Nie zatrzymuj się z tego powodu; pytanie o każdą ścieżkę importu zasłania te istotne.
- **Structural** — brakująca zależność, architektura różniąca się od założonej przez plan, przywołany plik lub API, które nie istnieje, faza zależna od wyniku, którego wcześniejsza faza nigdy nie wytworzyła. Plan nie może być realizowany zgodnie z zapisem, a dostosowanie oznaczałoby jego przeprojektowanie. Zatrzymaj się i postępuj ścieżką strukturalną poniżej.

W razie wątpliwości między tymi dwoma typami traktuj problem jako strukturalny. Błędne „zapytanie” kosztuje jedną wymianę; błędne „dostosowanie” może dostarczyć przeprojektowanie, którego nikt nie zatwierdził.

W przypadku niedopasowania strukturalnego:

- ZATRZYMAJ się i głęboko przemyśl, dlaczego nie można realizować planu.
- Przedstaw problem jasno jako tekst:

  ```
  Issue in Phase [N]:
  Expected: [what the plan says]
  Found: [actual situation]
  Why this matters: [explanation]
  ```

- Następnie użyj `AskUserQuestion`, aby uzyskać ustrukturyzowaną decyzję:

  AskUserQuestion:
  - question: "How should I handle this mismatch?"
    header: "Mismatch"
    options:
    - label: "Adapt and continue"
      description: "Adjust the implementation to match reality. I'll explain the adaptation."
    - label: "Skip this part"
      description: "Move on to the next section/phase. This change isn't needed."
    - label: "Stop and re-plan"
      description: "This mismatch is too significant. We need to update the plan first."
      multiSelect: false

## Śledzenie plików dotkniętych podczas fazy

Rytuał commitu na końcu fazy (zobacz „Verification Approach” poniżej) wykonuje staging plików ze **zbioru dotkniętych plików**, który utrzymujesz w pamięci roboczej przez całą fazę. Ten zbiór jest kanonicznym wejściem dla `git add` — nigdy nie wracaj do heurystyk `git status` dla decyzji stagingu.

**Dyscyplina**:

- Za każdym razem, gdy wywołujesz `Edit` lub `Write` dla pliku podczas bieżącej fazy, dodaj jego ścieżkę względną względem repozytorium do zbioru dotkniętych plików.
- Gdy faza jest delegowana, zainicjuj zbiór z listy `TOUCHED` zwróconej przez podagenta i połącz z każdą ścieżką zwróconą przez delegowaną naprawę bramki. Pliki, które edytujesz tutaj bezpośrednio — pola wyboru `## Progress`, zmiana w `change.md` — dodawaj jak zwykle.
- Zbiór zawsze zawiera `context/changes/<change-id>/plan.md`, ponieważ każda faza generuje co najmniej jedną edycję jego sekcji `## Progress`. Dodaj go przy wejściu do fazy, nawet zanim zmienią się pola wyboru.
- **Bootstrap fazy 1**: w pierwszej fazie zmiany zainicjuj także zbiór dotkniętych plików wszystkimi nieśledzonymi lub zmodyfikowanymi plikami wewnątrz `context/changes/<change-id>/` — zwykle `change.md`, `research.md`, `plan.md` oraz wszelkimi innymi plikami kontekstowymi utworzonymi podczas planowania. Te pliki są częścią zmiany i powinny trafić do pierwszego commitu, zamiast pozostać jako nieśledzone pozostałości.
- Zbiór **resetuje się na każdej granicy fazy**. Po zakończeniu commitu na końcu fazy wyczyść go przed rozpoczęciem następnej fazy.
- Ta lista zastępuje każdą heurystykę z `git status`. Jeśli zbiór dotkniętych plików to `{a.md, b.md, plan.md}`, ale `git status --porcelain` zgłasza też brudny `c.md`, `c.md` nie jest powiązany — obsłuż go za pomocą pytania o brudne ścieżki w rytuale, nigdy po cichu nie dołączaj go do commitu.

## Śledzenie odwołań do zgłoszeń/zadań dla commitów

Przed zaproponowaniem wiadomości commitu na końcu fazy lub epilogu przeskanuj kontekst rozmowy pod kątem odwołań do zgłoszeń lub zadań systemu śledzenia powiązanych z tą pracą implementacyjną, w tym kluczy Jira (na przykład `ABC-123`), identyfikatorów zgłoszeń Linear (na przykład `ENG-123`), odwołań do issue/PR GitHub (na przykład `#123`, `GH-123` lub pełnych URL-i issue/PR GitHub) albo jawnych linków do zadań z Jira, Linear lub GitHub.

- Jeśli występuje jedno lub więcej odwołań, uwzględnij je w treści wiadomości commitu pod linią `Refs:`, zachowując dokładne identyfikatory/URL-e podane przez użytkownika, gdy to możliwe.
- Jeśli dotyczy wiele odwołań, wypisz je rozdzielone przecinkami w jednej linii `Refs:`.
- Nie wymyślaj ani nie wyprowadzaj odwołań do systemów śledzenia z change-id, nazwy gałęzi ani nazw plików. Używaj wyłącznie odwołań widocznych w bieżącym kontekście rozmowy lub jawnie podanych przez użytkownika.
- Stosuj tę samą linię `Refs:` do każdego commitu na końcu fazy i do commitu epilogu, chyba że użytkownik ograniczy odwołanie do konkretnej fazy.

## Synchronizacja statusu roadmapy

`context/foundation/roadmap.md` (tworzony przez `/10x-roadmap`) indeksuje każdy Foundation/Slice za pomocą stabilnego **Change ID**. `/10x-archive` już zamyka pętlę na dalszym końcu — gdy zmiana jest archiwizowana, zmienia pasującą pozycję roadmapy na `Status: done`. Ten krok obsługuje bliższy koniec: gdy implementacja *się rozpoczyna*, oznacz pasującą pozycję jako **`in-progress`**, aby roadmapa pokazywała aktywną pracę zamiast przejścia od razu z `ready` do `done`.

Uruchom to **jednokrotnie, na wejściu** do zmiany (tuż po oznaczeniu `change.md` → `implementing`) — nie dla każdej fazy. Wyszukanie jest **obowiązkowe**; „w miarę możliwości” dotyczy wyłącznie *edycji* — brak roadmapy lub nieznaleziony cel jest po cichu pomijany i nigdy nie blokuje, nie pyta, nie wycofuje ani nie przerywa przebiegu. Nie pomijaj sprawdzenia, zakładając, że nie ma roadmapy.

1. `test -f context/foundation/roadmap.md`. Jeśli plik nie istnieje, po cichu pomiń ten krok.
2. Ustal, czy plik jest już brudny: `ROADMAP_PREDIRTY=$(git status --porcelain context/foundation/roadmap.md 2>/dev/null)` — używane w kroku 5 do decyzji o stagingu.
3. Przeczytaj plik. Szukaj użycia `<change-id>` jako `Change ID`:
   - w tabeli `## At a glance` — wiersza, którego komórka kolumny **Change ID** dokładnie równa się `<change-id>`;
   - oraz w treściach `## Foundations` / `## Slices` — bloku `### <ID>: …`, który zawiera linię `- **Change ID:** <change-id>`.

   `<ID>` to lokalny identyfikator roadmapy dla tej pozycji (`F-NN` lub `S-NN`). Dopasowanie jest wyłącznie dokładnym ciągiem — slice może generować kilka zmian, więc niemal-dopasowanie celowo *nie* jest dotykane. **Brak dopasowania** → wyświetl `ℹ context/foundation/roadmap.md has no item with Change ID "<change-id>" — roadmap left untouched.` i pomiń resztę tego kroku.
4. **Znaleziono dopasowanie** → odczytaj bieżące `- **Status:**` pozycji. Jeśli jest już `in-progress` lub `done`, pozostaw je bez zmian (**wyłącznie do przodu**: nigdy nie cofaj bardziej zaawansowanego statusu) i przejdź do kroku 5. W przeciwnym wypadku zastosuj obie edycje narzędziem Edit — każda niezależnie i w miarę możliwości; jeśli cel nie znajduje się tam, gdzie umieszcza go szablon `/10x-roadmap` (roadmapa edytowana ręcznie lub w starszym formacie), pomiń tę podedycję, kontynuuj i odnotuj, co pominięto. Dotykaj tylko pola `Status`; pozostaw `Outcome`, `Prerequisites`, `Change ID` itd. bez zmian.
   1. **`## At a glance`** — w dopasowanym wierszu ustaw komórkę kolumny **Status** na `in-progress`.
   2. **Treść pozycji** — przepisz linię `- **Status:**` pozycji na `- **Status:** in-progress`.

   Następnie zmień roadmapowe frontmatter `updated:` na `<today>` (pozostaw każdy inny klucz bez zmian; pomiń to, jeśli plik nie ma frontmatter).
5. **Włącz zmianę do historii tej zmiany.** Jeśli `git` jest dostępny **i** `ROADMAP_PREDIRTY` (krok 2) był pusty, dodaj `context/foundation/roadmap.md` do zbioru dotkniętych plików bieżącej fazy, aby zmiana statusu trafiła do commitu fazy zamiast pozostawać jako brudna. Jeśli `ROADMAP_PREDIRTY` nie był pusty, plik miał już niezatwierdzone edycje: pozostaw zmianę w working tree, utrzymaj `context/foundation/roadmap.md` POZA zbiorem dotkniętych plików i wyświetl `⚠ context/foundation/roadmap.md had pre-existing uncommitted changes — flipped roadmap item <ID> to in-progress in the working tree but did NOT stage it. Commit it yourself.` Jeśli `git` jest niedostępny, edycja po prostu pozostaje w working tree.

## Podejście do weryfikacji

Po zaimplementowaniu fazy uruchom tę stałą sekwencję — kanoniczną kolejność wszystkiego między „kod napisany” a „commit wykonany”. Bramki uruchamiają się od najtańszych, staging znajduje się tam, gdzie potrzebuje go kontrola uszkodzenia, a rytuał commitu jest końcem. Po każdej bramce wyświetl jednoliniowy werdykt — `GATE <name>: PASS` lub `GATE <name>: FAIL (<summary>, attempt <k>/2)` — aby użytkownik widział, co faktycznie uruchomiono, bez ponownego czytania historii.

1. **(a) Kryteria planu** — uruchom po kolei polecenia kryteriów sukcesu `#### Automated` danej fazy z planu. Każde polecenie jest osobną bramką z własną linią werdyktu.

2. **Wykonaj staging zbioru dotkniętych plików** — uruchom kroki 2–4 rytuału commitu poniżej („Compute the staging set”, „Detect unrelated dirty paths”, „Stage explicitly by path”) *tutaj*, a nie w czasie commitu. Staging przed kontrolą uszkodzenia sprawia, że jej przywrócenie jest dokładne: `git checkout -- <file>` resetuje worktree do wersji ze stagingu, więc celowe uszkodzenie nigdy nie może przedostać się do commitu.

3. **(b) Kontrola celowego uszkodzenia** — tylko dla faz, które dodają lub zmieniają testy. Gdy pliki fazy są w stagingu, zweryfikuj, że nowy lub zmieniony test faktycznie coś chroni:

   1. Odwróć lub osłab chronione zachowanie w kodzie produkcyjnym — edycja wyłącznie w worktree, nigdy w stagingu.
   2. Uruchom odpowiedni test (uruchomienie zawężone, np. pojedynczy plik testowy).
   3. Potwierdź, że kończy się niepowodzeniem. Czerwony wynik jest tu warunkiem przejścia: `GATE break-check: PASS (test went red on broken code)`.
   4. Przywróć bezwarunkowo przez `git checkout -- <file>` — resetuje to worktree dokładnie do wersji ze stagingu, więc uszkodzenie nigdy nie może przedostać się do commitu.
   5. Zgłoś sekwencję (co zostało uszkodzone, że test stał się czerwony, że plik przywrócono).

   Jeśli test **pozostaje zielony** na uszkodzonym kodzie, asercja niczego nie chroni — to niepowodzenie bramki. Napraw je przez wzmocnienie asercji, nigdy przez osłabienie kodu produkcyjnego lub pominięcie kontroli. Edycja uszkodzenia nigdy nie może być commitowana; przywrócenie w kroku 4 jest bezwarunkowe, także na ścieżce niepowodzenia.

4. **(c) Kontrole dla całego repozytorium** — pełny zestaw testów, lint, typecheck, wszędzie tam, gdzie definiuje je plan lub repozytorium (np. skrypt `ci:local`, `make check test`). Jedna linia werdyktu dla każdego.

5. **(d) Commit** — niezmiennik commitowania wyłącznie na zielono: nigdy nie rozpoczynaj rytuału commitu, gdy którakolwiek bramka powyżej jest czerwona. Nie ma wyjątku, a „naprawię to w następnej fazie” nim nie jest. Jeśli poprawka bramki (b) lub (c) zmieniła pliki, uruchom ponownie krok 2, aby je uwzględnić, a następnie wykonaj rytuał commitu na końcu fazy poniżej — jego kroki stagingu są no-op, gdy nic nie zmieniło się od tego czasu.

**Gdy bramka nie przejdzie**, napraw ją samodzielnie najwyżej dwa razy; numeruj próby w liniach werdyktów (`attempt 1/2`, `attempt 2/2`). Jeśli ta sama bramka zawiedzie trzeci raz, przestań naprawiać i przekaż ją użytkownikowi z nieudanym wyjściem — problem jest głębszy niż mechaniczny dryf, a trzecia ślepa próba zwykle pogarsza diff. Nigdy nie osłabiaj asercji, nie usuwaj testu ani nie rozluźniaj reguły lint lub typecheck, aby bramka przeszła, chyba że plan wyraźnie tak mówi: napraw kod, aby spełniał kontrolę, a nie kontrolę, aby spełniała kod. Gdy oczekiwana wartość testu jest faktycznie niejednoznaczna — plan i implementacja się nie zgadzają, a nie istnieje niezależne źródło prawidłowej odpowiedzi — nie zgaduj; pozostaw werdykt uczciwy i zapytaj.

Równolegle z sekwencją:

- Aktualizuj postęp w swoich zadaniach todo oraz w sekcji `## Progress` planu.
- **Modyfikuj WYŁĄCZNIE sekcję `## Progress`.** Bloki faz (Overview, Changes Required, Success Criteria) są tylko do odczytu. Używaj Edit, aby zmienić `- [ ] N.M <title>` → `- [x] N.M <title>` w Progress po ukończeniu każdego kroku. NIE edytuj wypunktowań bloków faz, NIE dodawaj znaczników postępu HTML na dole planu i NIE zapisuj żadnego pliku pomocniczego stanu.
- **Uruchom rytuał commitu na końcu fazy**: bramka (d) powyżej. Gdy każda bramka jest zielona, przejdź przez ten uporządkowany rytuał, aby utworzyć jeden commit Conventional Commits i wpisać końcowy krótki SHA z powrotem do każdego wiersza Progress zmienionego podczas fazy.

  1. **Bramka ręcznego potwierdzenia.** Poinformuj człowieka, że automatyczna weryfikacja przeszła, i wypisz elementy ręcznej weryfikacji z planu. Zatrzymaj się tutaj. Nie kontynuuj, dopóki człowiek nie potwierdzi powodzenia testów ręcznych. Użyj tego formatu:

     ```
     Phase [N] Complete - Ready for Manual Verification

     Automated verification passed:
     - [List automated checks that passed]

     Please perform the manual verification steps listed in the plan:
     - [List manual verification items from the plan]

     Let me know when manual testing is complete so I can proceed to the commit step.
     ```

     **Międzyfazowe zestawienie ręczne (tylko faza końcowa).** Przed wyświetleniem wiadomości bramki ustal, czy bieżąca faza jest ostatnią fazą: przeskanuj sekcję `## Progress` pod kątem nagłówków `### Phase M:` i traktuj bieżącą fazę jako końcową wtedy i tylko wtedy, gdy w kolejności dokumentu nie występuje nagłówek z `M > N`. Jeśli bieżąca faza **nie** jest końcowa, wiadomość bramki jest dokładnie w formacie powyżej — bez zestawienia. Jeśli bieżąca faza **jest** końcowa, po bloku „Please perform the manual verification steps listed in the plan:” przeskanuj całą sekcję Progress pod kątem wierszy `- [ ]` znajdujących się pod podsekcją `#### Manual` w dowolnej fazie **innej niż bieżąca**. Jeśli istnieją takie wiersze, dopisz do wiadomości bramki następujący blok (w kolejności dokumentu, jeden wiersz na linię, sformatowany jako `<phase>.<index> <title>` — usuń dowolny prefiks `- [ ]` oraz dowolny końcowy sufiks ` — <sha>`):

     ```
     Pending manual checks from earlier phases:
     - [phase.index title]
     ```

     Jeśli nie ma oczekujących ręcznych wierszy z wcześniejszych faz, całkowicie pomiń blok zestawienia. Bramka nadal czeka na potwierdzenie człowieka; jest to informacyjne, a nie twarde blokowanie. Fazy pośrednie (każda faza, która nie jest ostatnią) zachowują oryginalny format bramki bez zestawienia.

  2. **Oblicz zbiór stagingu.** Kroki 2–4 zostały już wykonane raz jako krok 2 stosu bramek; uruchom je ponownie tutaj, aby uwzględnić wszystko, czego dotknęła poprawka bramki. Gdy nic nie zmieniło się od tego czasu, są no-op. Weź zbiór dotkniętych plików utrzymywany podczas fazy (zobacz „Tracking files touched during a phase” powyżej) i połącz go z `{context/changes/<change-id>/plan.md}`. Plik planu jest zawsze w stagingu, ponieważ każda faza generuje co najmniej jedną edycję sekcji `## Progress`.

  3. **Wykryj niepowiązane brudne ścieżki.** Uruchom `git status --porcelain` i wykonaj część wspólną ze ścieżkami *poza* zbiorem stagingu. Jeśli zbiór brudnych, ale niedotkniętych plików nie jest pusty, wypisz problematyczne ścieżki (z ich kodami `git status --short`) w widocznej wiadomości czatu, a następnie użyj `AskUserQuestion`, podając także ścieżki w tekście pytania:

     - question: "<N> unrelated path(s) are dirty: <path>, <path>, ... How should I handle them?"
       header: "Dirty paths"
       options:
       - label: "Continue — stage only the planned set (Recommended)"
         description: "Commit only files this phase touched. Leave the unrelated paths dirty for you to handle separately."
       - label: "Stage all"
         description: "Add the unrelated paths to this commit. You take responsibility for the broader scope."
       - label: "Abort"
         description: "Stop the phase commit. Resolve the dirty paths first, then re-run the ritual."
       multiSelect: false

     Jeśli zbiór brudnych, ale niedotkniętych plików jest pusty, pomiń ten krok.

  4. **Wykonaj staging jawnie według ścieżki.** Dodaj `git add` każdy plik w wybranym zbiorze po nazwie. NIE używaj `git add -A` ani `git add .` — wyłącznie jawne ścieżki.

  5. **Sprawdź pusty diff.** Uruchom `git diff --cached --quiet`. Kod wyjścia 0 oznacza brak diffu w stagingu. Jeśli pusty, wyświetl:

     ```
     Phase [N] had no diff to commit; rows remain SHA-less; archive warn-only will surface them.
     ```

     Ustaw `SHA=""` i przejdź do kroku 8.

  6. **Zaproponuj wiadomość Conventional Commits.** Zbuduj linię tematu w formacie `<type>(<change-id>): <phase title> (p<N>)`, gdzie `<type>` to jedno z `feat / fix / chore / refactor / docs`, wybrane na podstawie charakteru fazy (np. `feat` dla nowego zachowania widocznego dla użytkownika, `chore` dla edycji promptów/dokumentacji, `refactor` dla restrukturyzacji bez zmiany zachowania). Tytuł fazy jest znaczącą częścią i występuje jako pierwszy; sufiks `(p<N>)` zawiera indeks fazy. Zbuduj krótką treść wymieniającą dotknięte pliki oraz linię `Refs:` z „Tracking issue/task references for commits”, gdy ma zastosowanie.

     **Pokaż, co zostanie commitowane przed zapytaniem.** Uruchom `git diff --cached --stat` (zbiór w stagingu jest dokładnie tym, co będzie zawierał commit) i zapisz to jako zwykły tekst asystenta w tej samej odpowiedzi, przed wywołaniem narzędzia — odpowiedź, która otwiera się tu wywołaniem narzędzia pytania, jest nieprawidłowa:

     ```
     Proposed commit for Phase [N]:

     Files (git diff --cached --stat):
      <path> | <changes>
      ...
      <N> files changed, <X> insertions(+), <Y> deletions(-)

     Message:
     <subject>

     <body>
     ```

     Następnie użyj `AskUserQuestion`, powtarzając temat i pliki w stagingu wraz z ich liczbami `--stat` w tekście pytania, aby były widoczne nawet tam, gdzie host pokazuje tylko okno dialogowe. Bez natywnego narzędzia pytań zadaj to samo pytanie zwykłym tekstem po tej wiadomości i czekaj na odpowiedź:

     - question: "Approve commit message?\n<subject>\nFiles (<N>, +<X> −<Y>): <path> (+a −b), <path> (+c −d), ..."
       header: "Commit msg"
       options:
       - label: "Approve as proposed (Recommended)"
         description: "Use the message as drafted."
       - label: "Edit subject line"
         description: "Override the subject; keep the body."
       - label: "Override entirely"
         description: "Replace both subject and body."
       multiSelect: false

  7. **Wykonaj commit przez heredoc.** Uruchom `git commit` zgodnie z globalnym protokołem wiadomości commitu:

     ```bash
     git commit -m "$(cat <<'EOF'
     <type>(<change-id>): <phase title> (p<N>)

     <short body listing touched files>
     <Refs: issue/task references, if applicable>
     EOF
     )"
     ```

     Nigdy nie przekazuj flag `--no-verify`, `--amend` ani flag obchodzących podpisywanie. Jeśli hook pre-commit zawiedzie, napraw podstawowy problem i utwórz NOWY commit — oryginalny commit NIE nastąpił, więc amend zmieniłby commit poprzedniej fazy.

  8. **Pobierz krótki SHA.** Uruchom `git rev-parse --short HEAD` i zapisz jako `SHA`, następnie wyświetl `Committed: <SHA> <subject>`. Pomiń ten krok, jeśli `SHA=""` zostało ustawione przez krok 5.

  9. **Zapisz SHA z powrotem w Progress.** Dla każdego wiersza Progress zmienionego podczas tej fazy wykonaj ukierunkowaną edycję:

     - Znajdź: `- [x] N.M <title>` (bez istniejącego sufiksu ` — <sha>` na końcu linii)
     - Zastąp przez: `- [x] N.M <title> — <SHA>`

     Pomiń wiersze, które już mają sufiks SHA (bezpieczeństwo wznawiania: jeśli rytuał zostanie ponownie rozpoczęty po częściowym przebiegu, nie dopisuj podwójnie). Jeśli `SHA=""`, całkowicie pomiń dopisanie — wiersze pozostają bez SHA, a `/10x-archive` pokaże je jako ostrzeżenia informacyjne w ramach kontroli miękkiego ostrzeżenia o brakującym SHA.

  10. **Zaktualizuj `change.md`.** Ustaw `updated: <today>`; zachowaj `status: implementing` (idempotentne do ostatniej fazy). W ostatniej fazie ustaw `status: implemented` po zapisaniu SHA (zobacz „After all phases” poniżej).

  11. **Zresetuj zbiór dotkniętych plików.** Wyczyść go przed rozpoczęciem następnej fazy. Rytuał jest samowystarczalny dla każdej fazy.

- **Decyzja o następnej fazie**: jeśli istnieje następna faza, pomóż użytkownikowi zdecydować, czy kontynuować, czy rozpocząć od nowa.

  Użyj `AskUserQuestion`, aby przedstawić decyzję:

  AskUserQuestion:
  - question: "Phase [N] complete (commit <SHA> <subject>; \"no commit\" for an empty diff). How to proceed?"
    header: "Next phase"
    options:
    - label: "Continue to Phase [N+1] — delegate"
      description: "Proceed to the next phase with a subagent writing the code. Keeps this context lean; you see the touched files, adaptations and gate verdicts when it returns."
    - label: "Continue to Phase [N+1] — in context"
      description: "Proceed to the next phase and write the code here, where you can watch the edits land and redirect mid-phase."
    - label: "Clear context first"
      description: "Copy resume command to clipboard. Start fresh for Phase [N+1]."
    - label: "Review this phase first"
      description: "Run /10x-impl-review to verify implementation against the plan before proceeding."
      multiSelect: false

  **Jeśli użytkownik wybierze przegląd**: uruchom `/10x-impl-review @[path-to-plan] phase [N]`, aby przejrzeć właśnie ukończoną fazę. Po zakończeniu przeglądu ponownie przedstaw decyzję kontynuacji/wyczyszczenia (tym razem bez opcji przeglądu).

  **Jeśli użytkownik wybierze którąkolwiek opcję kontynuacji**: przejdź bezpośrednio do następnej fazy — przeczytaj sekcję planu dla kolejnej fazy, ustaw zadanie na `in_progress` i implementuj w wybranym trybie wykonania (zobacz „Per-phase execution mode”). Nie trzeba ponownie czytać całego planu ani już załadowanych plików; delegowana faza nadal otrzymuje własną sekcję planu dosłownie w prompcie delegowania.

  **Jeśli użytkownik wybierze wyczyszczenie**: skopiuj polecenie wznowienia do schowka i wyświetl je:
  1. Kopiuj:
     ```bash
     echo -n "/10x-implement <change-id> phase [next-phase-number]" | pbcopy 2>/dev/null || echo -n "/10x-implement <change-id> phase [next-phase-number]" | clip.exe 2>/dev/null || echo -n "/10x-implement <change-id> phase [next-phase-number]" | xclip -selection clipboard 2>/dev/null || true
     ```

     ```powershell
     # PowerShell (Windows)
     Set-Clipboard "/10x-implement <change-id> phase [next-phase-number]"
     ```
  2. Wyświetl:
     ```
     → /10x-implement <change-id> phase [next-phase-number] (✓ copied)
     ```

Jeśli otrzymasz polecenie wykonania wielu faz kolejno, pomiń AskUserQuestion między fazami i przenieś ostatnio wybrany tryb wykonania dalej.

nie oznaczaj pozycji w krokach testów ręcznych jako ukończone, dopóki użytkownik ich nie potwierdzi.

## Śledzenie stanu

**Sekcja `## Progress` w `plan.md` jest jedynym źródłem prawdy.** Żaden plik stanu. Żadne znaczniki komentarzy. Zobacz `references/progress-format.md`, aby poznać kontrakt formatu.

### Po każdym kroku

Użyj Edit, aby zmienić dokładnie jedną linię Progress naraz:

- Znajdź: `- [ ] N.M <title>`
- Zastąp przez: `- [x] N.M <title>`

Nie dodawaj sufiksu SHA podczas edycji pojedynczego kroku — SHA jest wpisywane z powrotem na końcu fazy przez rytuał commitu (zobacz „Verification Approach” powyżej), a tylko SHA końcowego commitu trafia do każdego wiersza zmienionego podczas fazy. W trakcie fazy ukończone wiersze są `[x]` bez sufiksu SHA; jest to prawidłowy stan pośredni.

### Po każdej fazie

Gdy wszystkie elementy `- [ ]` wewnątrz `### Phase N:` są teraz `- [x]`:

1. Uruchom rytuał commitu na końcu fazy (zobacz „Verification Approach” powyżej): ręczne potwierdzenie → staging → pytanie o brudne ścieżki → commit → zapis SHA.
2. `change.md.updated` jest aktualizowane jako część kroku 10 rytuału.

Fazy z pustym diffem (tylko ręczna weryfikacja lub fazy no-op po adaptacji) nie commitują niczego i pozostawiają swoje wiersze bez SHA; `/10x-archive` pokaże je jako ostrzeżenia informacyjne w ramach kontroli miękkiego ostrzeżenia o brakującym SHA. Jest to zamierzone — nie każda faza produkuje kod.

### Po wszystkich fazach

Gdy każdy element `- [ ]` w całej sekcji `## Progress` jest teraz `- [x]`:

1. **Defensywne ujawnienie oczekujących pozycji.** Ponownie przeskanuj całą sekcję `## Progress` po raz ostatni pod kątem wierszy `- [ ]`. W normalnym przebiegu jest to no-op — warunkiem wyzwalającym „After all phases” jest już „każdy `- [ ]` jest `- [x]`”, więc ujawnienie nie powinno nic znaleźć. Istnieje po to, aby wszelkie nieoczekiwane pozostałości były jawne zamiast po cichu zagubione (np. gdy częściowy przebieg, ręczna edycja lub ścieżka wznowienia ominęły wyzwalacz). Jeśli liczba nie jest zerowa, wypisz każdy wiersz jako `<phase>.<index> <title>`, pogrupowany według podsekcji Automated vs Manual w kolejności dokumentu, następnie zapytaj przez `AskUserQuestion`:

   - question: "<N> Progress item(s) still pending. How to proceed?"
     header: "Stragglers"
     options:
     - label: "Pause (Recommended)"
       description: "STOP without flipping change.md.status. Address the stragglers manually, then re-enter the epilogue path."
     - label: "Proceed to epilogue"
       description: "Flip status: implemented and run the epilogue commit anyway. Stragglers will surface as warnings under /10x-archive."
     multiSelect: false

   Przy „Pause”: ZATRZYMAJ się natychmiast. NIE aktualizuj `change.md`, NIE uruchamiaj commitu epilogu. Przy „Proceed to epilogue”: kontynuuj krokami 2–4 poniżej. Jeśli liczba wynosi zero, pomiń ten krok i kontynuuj.

2. Zaktualizuj `change.md`: ustaw `status: implemented`, `updated: <today>`. (NIE ustawiaj `archived_at` — należy to do `/10x-archive`.)
3. NIE zapisuj żadnego znacznika postępu jako komentarza HTML na dole planu.
4. **Uruchom commit epilogu.** Commit ostatniej fazy nie może zawierać własnego SHA (problem kury i jajka), więc zapis SHA z powrotem do wierszy Progress ostatniej fazy oraz zmiana statusu `change.md` pozostają jako brudne w working tree po powrocie rytuału ostatniej fazy. Utwórz jeden zamykający commit, aby je zapisać — w przeciwnym razie twarda bramka odmowy `/10x-archive` (niezatwierdzone ścieżki wewnątrz folderu zmiany) zablokuje działanie. Kroki:
   1. Dodaj do stagingu dokładnie `context/changes/<change-id>/plan.md` oraz `context/changes/<change-id>/change.md` (jawne ścieżki, bez `git add -A`).
   2. Uruchom `git diff --cached --quiet`; jeśli kod wyjścia to 0, pomiń epilog (nic końcowego do commitowania) i zatrzymaj się tutaj.
   3. Zaproponuj temat `chore(<change-id>): close out plan (epilogue)` z krótką treścią wskazującą końcowy zapis SHA planu + `change.md` → implemented oraz linię `Refs:` z „Tracking issue/task references for commits”, gdy ma zastosowanie. Pokaż, co zostanie commitowane, dokładnie jak w rytuale fazy (widoczna wiadomość z `git diff --cached --stat` i pełną wiadomością, następnie temat i ścieżki plików w tekście pytania), a następnie użyj AskUserQuestion, aby zatwierdzić zgodnie z propozycją / edytować temat / całkowicie nadpisać (te same opcje co rytuał fazy).
   4. Wykonaj commit przez heredoc zgodnie z globalnym protokołem (nigdy `--no-verify` / `--amend`).
   5. NIE zapisuj własnego SHA epilogu z powrotem do planu — jego jedynym zadaniem jest czyste zapisanie końcowych edycji.

### „Gdzie jestem?” — wyprowadzane, nie przechowywane

Przeanalizuj sekcję `## Progress`. Pierwsza linia `- [ ]` jest następnym krokiem. Bieżąca faza to nagłówek `### Phase N:` bezpośrednio nad nią. Ukończenie to `count([x]) / count([ ] + [x])`. Bez JSON, bez znaczników, bez sidecar — tylko sekcja Progress.

## Ukończenie planu

Gdy WSZYSTKIE fazy są zaimplementowane i zweryfikowane (każde pole wyboru Progress to `[x]`):

1. Potwierdź, że `change.md.status` ma teraz wartość `implemented`.
2. Przedstaw podsumowanie ukończenia, a następnie zaoferuj końcowy przegląd:

```
All phases implemented! 🎉

Summary:
- Phases completed: [N]
- Files changed: [list key files]
```

Użyj AskUserQuestion:

```
question: "Plan complete. Would you like a final implementation review?"
header: "Plan Complete"
options:
  - label: "Run full review (/10x-impl-review)"
    description: "Comprehensive review of all phases against the plan. Catches cross-phase issues."
  - label: "Skip review — I'm satisfied"
    description: "No review needed. Mark the plan as done."
multiSelect: false
```

Jeśli użytkownik wybierze przegląd → uruchom `/10x-impl-review <change-id>` (brak numeru fazy = przegląd całego planu).

## Jeśli utkniesz

Gdy coś nie działa zgodnie z oczekiwaniami:

- Najpierw upewnij się, że przeczytałeś i zrozumiałeś cały odpowiedni kod.
- Rozważ, czy baza kodu ewoluowała od czasu napisania planu.
- Przedstaw niedopasowanie jasno i poproś o wskazówki.

Zobacz „When you're stuck or in unfamiliar territory” w [references/implementation-discipline.md](references/implementation-discipline.md), aby poznać sekwencję szukaj-potem-rozumuj oraz sposób postępowania, gdy właściwa wartość jest faktycznie niejednoznaczna.

Poza delegowaną fazą (zobacz „Per-phase execution mode”), sięgaj po podzadanie, gdy jest to uzasadnione — ukierunkowane debugowanie albo eksplorowanie nieznanego obszaru:

- **Explore** (`subagent_type: "Explore"`) — szybkie wyszukiwanie plików, wzorców, podobnego kodu.
- **general-purpose** (`subagent_type: "general-purpose"`) — głęboka analiza wymagająca wieloetapowego rozumowania.

## Wznawianie pracy

Jeśli sekcja `## Progress` planu ma istniejące oznaczenia `[x]`:

- Zaufaj, że ukończona praca jest wykonana.
- Podejmij pracę od pierwszej linii `- [ ]`.
- Weryfikuj wcześniejszą pracę tylko wtedy, gdy coś wydaje się nie tak.

Pamiętaj: wdrażasz rozwiązanie, a nie tylko odhaczasz pola. Miej na uwadze cel końcowy i utrzymuj tempo pracy.