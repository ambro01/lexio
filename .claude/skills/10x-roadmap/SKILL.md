---
name: 10x-roadmap
description: >
  Milestone-driven roadmap manager: open an outcome-scoped milestone from
  source materials (primary: the PRD), decompose it into vertical end-to-end
  slices in context/foundation/roadmap.md, track the milestone as connected
  slices complete, close it when every slice is done, and loop into the next
  milestone. Use AFTER /10x-prd (and after the tech-stack selection /
  bootstrap step, when applicable). Trigger phrases: "write the roadmap",
  "generate roadmap", "create the roadmap from PRD", "stwórz roadmapę",
  "open a milestone", "close the milestone", "milestone status", "what
  should I build first", "what's next on the roadmap". Do NOT use for
  per-change planning — that's /10x-plan's job.
argument-hint: "[path-to-prd]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Agent
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---
# Mapa drogowa: Mapa drogowa oparta na kamieniach milowych dla context/foundation/roadmap.md

Ta umiejętność jest pomostem między **produktem** (PRD lub innymi materiałami źródłowymi) a **planowaniem poszczególnych zmian** (`/10x-plan`) i działa jako **menedżer projektu na poziomie kamieni milowych**. Praca jest grupowana w **kamienie milowe**: ograniczony rezultatem pakiet powiązanych pionowych wycinków, z dokładnie jednym otwartym naraz, śledzonym w samym `roadmap.md`. Każde wywołanie najpierw przełącza się według stanu kamienia milowego (Krok 0): jeśli żaden kamień milowy nie jest otwarty, umiejętność prosi o materiały źródłowe i otwiera jeden; jeśli kamień milowy jest aktywny, raportuje status i rekomenduje następny ruch; jeśli każdy wycinek jest ukończony, zamyka kamień milowy i przechodzi do otwierania następnego — na podstawie zaktualizowanych materiałów źródłowych lub własnego opisu użytkownika.

W obrębie otwartego kamienia milowego zadanie dekompozycji pozostaje bez zmian: przeczytaj materiały źródłowe, automatycznie zbadaj punkt bazowy kodu, **wywnioskuj zdecydowaną propozycję sekwencjonowania** (główny cel, wycinek gwiazdy przewodniej, obszary inwestycji, największa blokada), ujawnij tylko rzeczywistą niepewność, której artefakty nie mogą rozstrzygnąć, i wygeneruj `context/foundation/roadmap.md`, zawierający pionowe, widoczne dla użytkownika wycinki w kolejności zależności — gotowe do przekazania do `/10x-plan <change-id>`.

## Warstwa kamieni milowych — maszyna stanów znajduje się w pliku referencyjnym

Cykl życia kamienia milowego (stany, reguły wykrywania, przejścia, niezmienniki) jest określony w **`references/milestone-state.md`**, celowo poza tym plikiem. **Czytaj go tylko wtedy, gdy wywołanie działa na poziomie kamienia milowego** — przy pierwszym uruchomieniu, wznowieniu/sprawdzeniu statusu, zamknięciu kamienia milowego lub otwieraniu następnego kamienia. Czysta ponowna dekompozycja już otwartego kamienia milowego go nie potrzebuje.

Dwa fakty potrzebne przed podjęciem decyzji, czy go załadować:

- Stan jest **wyprowadzany wyłącznie z `roadmap.md`** (frontmatter `milestone_id` / `milestone_status` + statusy elementów). Nie ma dodatkowego pliku stanu.
- Identyfikatory kamieni milowych mają postać `M-<seq>` z kebab-case `milestone_id`; kamienie milowe są **ograniczone rezultatem, nigdy czasem** — kamień milowy zamyka się, gdy jego wycinki są `done`, a nie gdy mija data. To nie jest sprint.

**Postawa: stanowczy rekomendujący, zwięzły wywiad.** Umiejętność działa jak starszy tech lead, który przeczytał PRD, zbadał kod i przychodzi z rekomendacją — ale nadal pyta człowieka o 2–3 kluczowe decyzje przed zatwierdzeniem. Reguły wywiadu (limit 3 pytań, silne rekomendacje, brak chochołów, wyjątek dla niestandardowego MVP) są określone raz, w Kroku 5.

To umiejętność **dekompozycji + sekwencjonowania**, a nie planista niskiego poziomu. NIGDY nie wybiera frameworków, ścieżek plików, schematów, bibliotek ani szczegółów implementacji — należą one do `/10x-plan`. NIGDY nie przypisuje estymacji czasu, rozmiarów t-shirtowych, punktów ani dat z ludzkiego kalendarza — agentowe wykonanie jest nieliniowe, a estymacje oparte na budżecie czasu byłyby kłamstwem. To, co ROBI, to: nazywa wycinki, sekwencjonuje je według zależności i wskazanego celu, ujawnia to, co blokuje, oraz kieruje otwarte pytania tam, gdzie mogą zostać rozwiązane.

Umiejętność jest **AI-native** na cztery konkretne sposoby: (1) wyraża kolejność jako graf zależności, a nie kalendarz; (2) oznacza wycinki, które mogą zostać wykonane równolegle przez osobne uruchomienia agentów; (3) przekazuje „blokujące niewiadome” wyżej, gdzie człowiek może je rozwiązać, zamiast pozwolić im po cichu przedostać się do implementacji; (4) inwentaryzuje istniejący kod za pomocą subagentów zamiast pytać użytkownika, co już istnieje.

## Kiedy używać, kiedy pominąć

**Używaj, gdy**: użytkownik chce otworzyć kamień milowy i go zdekomponować (typowe pierwsze źródło: nietrywialny `context/foundation/prd.md` z uzupełnionymi FR i historiami użytkownika), sprawdzić status kamienia milowego/mapy drogowej albo zamknąć ukończony kamień milowy i otworzyć następny. Typowe wyzwalacze: właśnie ukończono `/10x-prd`, właśnie ukończono bootstrap, powrót do projektu i pytanie „co dalej” lub zarchiwizowano wszystkie wycinki mapy drogowej.

**Pomiń, gdy**: PRD jest pusty w treści (duże `## Open Questions`, `# TODO: domain rule`) — najpierw wskaż `/10x-prd` (lub wcześniejsze `/10x-shape`); mapa drogowa z pustego PRD odziedziczy tę pustkę. Pomiń także, gdy użytkownik chce szczegółowo zaplanować *pojedynczą* zmianę — do tego służy `/10x-plan`. Mapa drogowa jest w liczbie mnogiej; plan jest w liczbie pojedynczej.

## Relacja z innymi umiejętnościami

- `/10x-shape` i `/10x-prd` — tworzą nadrzędny PRD konsumowany przez tę umiejętność. Jeśli `shape-notes.md` zawiera blok `## Forward: technical-roadmap` (gdzie shaping odkłada treści związane z mapą drogową), ta umiejętność je podnosi.
- `10x-tech-stack-selector` — uruchamia się między `/10x-prd` a tą umiejętnością w łańcuchu bootstrapu. Jeśli istnieje `context/foundation/tech-stack.md`, ta umiejętność czyta go jako wejście do wyprowadzenia `## Foundations` (szkielet auth, szkielet wdrożenia, obserwowalność — wszystko, co wynikało z kroku wyboru stosu technologicznego) oraz do skrócenia sond bazowych dla warstw już zadeklarowanych.
- `/10x-plan` — konsument downstream. Użytkownik wybiera element mapy drogowej i wywołuje `/10x-plan <change-id>`; ta umiejętność tworzy folder zmiany, generuje szczegółowy plan i zmienia `Status` dopasowanego elementu mapy drogowej na `planning`. Mapa drogowa NIE tworzy wcześniej folderów zmian; jeden wycinek może wygenerować wiele zmian, gdy `/10x-plan` odkryje, że element nadal jest zbyt szeroki (tylko pierwszy przesuwa status współdzielonego elementu).
- `/10x-implement` (oraz jego autonomiczny odpowiednik `/10x-goal-implement`) — dalszy downstream. Gdy implementacja *rozpoczyna się* dla zmiany, której `Change ID` pasuje do elementu mapy drogowej, zmienia jej `Status` na `in-progress` — otwarty odpowiednik zmiany na `done` wykonywanej przez `/10x-archive`. Ta umiejętność sama nadal generuje jedynie `proposed` / `ready` / `blocked`; pośrednie stany cyklu życia (`planning`, `in-progress`) są teraz zapisywane downstream, gdy zmiana przechodzi przez plan → implementację. Każda zmiana downstream dopasowuje według `Change ID`, działa best-effort (brak dopasowania oznacza ciche pominięcie) i tylko do przodu (nigdy nie cofa bardziej zaawansowanego statusu).
- `/10x-archive` — zamyka pętlę na końcu. Gdy zmiana, której `Change ID` pasuje do elementu mapy drogowej, zostaje zarchiwizowana, `/10x-archive` zmienia `Status` tego elementu na `done` (w `## At a glance` i w bloku treści elementu) oraz dopisuje wpis do `## Done`. Ta umiejętność nigdy nie wypełnia wcześniej `## Done`; `/10x-archive` jest jego jedynym autorem.
- `/10x-frame`, `/10x-research` — ortogonalne. Działają na pojedynczej zmianie, nie na mapie drogowej.

## Pierwsza odpowiedź — Krok 0: dyspozycja według stanu kamienia milowego

Gdy ta umiejętność jest wywoływana, rozdziel działanie PRZED wykonaniem jakiejkolwiek pracy dekompozycyjnej:

1. **Zbadaj stan kamienia milowego** (tanio, bez potrzeby pliku referencyjnego):

   ```bash
   test -f context/foundation/roadmap.md && head -20 context/foundation/roadmap.md
   ```

   - Brak pliku albo plik bez klucza frontmatter `milestone_id` → **brak otwartego kamienia milowego** (pierwsze uruchomienie albo starsza mapa drogowa).
   - `milestone_status: open` → kamień milowy aktywny lub gotowy do zamknięcia (zależy od statusów elementów — aby stwierdzić, przeczytaj cały plik).
   - `milestone_status: done` → poprzedni kamień milowy zamknięty, następny jeszcze nieotwarty.

2. **O ile kamień milowy nie jest otwarty z nieukończonymi elementami i użytkownik wyraźnie nie poprosił o świeżą dekompozycję** — tj. przy pierwszym uruchomieniu, adaptacji starszej wersji, sprawdzeniu statusu/następnego ruchu, zamknięciu lub otwieraniu następnego kamienia — **przeczytaj teraz `references/milestone-state.md`** i zastosuj pasujące przejście. Przejścia delegują z powrotem do Kroków 1–10 poniżej tam, gdzie potrzebna jest dekompozycja.

3. **Jeśli kamień milowy jest otwarty, a użytkownik poprosił o ponowne wygenerowanie dekompozycji** (lub przekazał argument ścieżki źródłowej, np. `/10x-roadmap @path/to/prd.md`), pomiń plik referencyjny: pobierz ścieżkę (usuń początkowe `@`), w przeciwnym razie domyślnie użyj `context/foundation/prd.md`, i przejdź bezpośrednio do Kroku 1. Ponowne generowanie zachowuje frontmatter kamienia milowego i `## Milestone History` dosłownie oraz przenosi statusy elementów według `Change ID` (tylko do przodu).

## Interaktywne monity — niezależne od hosta

Za każdym razem, gdy procedura mówi *„zapytaj użytkownika”*, użyj dowolnego narzędzia strukturalnych pytań interaktywnych udostępnianego przez hosta agenta (Claude Code → `AskUserQuestion`; na innych hostach — dowolnego narzędzia zadającego użytkownikowi pytanie z opisanymi opcjami). Jeśli żadne nie jest dostępne, użyj zwykłej wiadomości konwersacyjnej z listą opisanych opcji — nie blokuj procedury. Przy pierwszym pytaniu powiedz, którego narzędzia wybrałeś (albo że użyłeś zwykłego czatu), aby użytkownik mógł to skorygować.

Bloki pytań pojawiają się w Krokach 1, 3, 4, 5 i 9 oraz w przejściach kamieni milowych z `references/milestone-state.md` — są to krótkie ustrukturyzowane wybory. Krok 5 zadaje każdą kotwicę jako osobne pytanie strukturalne; jego podsumowanie syntezy jest zwykłym markdownem (bez dodatkowego pytania).

## Równoległe badanie punktu bazowego — niezależne od hosta

Za każdym razem, gdy procedura mówi o użyciu subagentów lub uruchomieniu równoległych sond, użyj dowolnego narzędzia badań w tle / uruchamiania zadań udostępnianego przez hosta (Claude Code → `Agent` z typem subagenta Explore/general-purpose; na innych hostach — dowolnego narzędzia, które uruchamia izolowanego agenta i zwraca podsumowanie), rozgałęziając sondy w jednym wsadowym wywołaniu. Jeśli takie narzędzie nie istnieje, uruchom te same sondy sekwencyjnie w głównym kontekście. Każda ścieżka musi zwrócić ten sam kształt podsumowania bazowego z dowodami plikowymi.

## Proces

### Krok 1: Pozyskaj i przeczytaj materiały źródłowe

**Podczas otwierania kamienia milowego** (pierwsze uruchomienie lub przejście do następnego kamienia z `references/milestone-state.md`) zapytaj, na czym powinien być zbudowany kamień milowy — nie zakładaj tego, lecz zarekomenduj PRD:

Pytanie interaktywne:
- pytanie: „Jakie są materiały źródłowe dla tego kamienia milowego?”
  nagłówek: „Źródła”
  opcje:
  - etykieta: „PRD w context/foundation/prd.md (Rekomendowane)”
    opis: „Standardowa ścieżka: zakres kamienia milowego wynika z FR i historii użytkownika PRD. Najpierw uruchom /10x-prd, jeśli jeszcze nie istnieje.”
  - etykieta: „Inne dokumenty — podam ścieżki”
    opis: „Specyfikacje, briefy, dokumenty badawcze. Wycinki będą śledzone do ich treści, zapisanej jako kotwice zakresu w karcie kamienia milowego.”
  - etykieta: „Sam opiszę kamień milowy”
    opis: „Opis swobodny, bez dokumentu. Wyodrębnię z niego kotwice zakresu MS-NN, do których będą śledzone wycinki.”
  - etykieta: „Anuluj”
    opis: „Wyjdź bez zmian.”
  multiSelect: false

Dla kolejnych kamieni milowych `references/milestone-state.md` doprecyzowuje te opcje (zaktualizowany PRD kontra następna transza tego samego PRD). Gdy wywołanie zawierało jawny argument ścieżki, pomiń pytanie i użyj tej ścieżki.

Rozwiąż i zweryfikuj ścieżki wejściowe:

```bash
test -f "<resolved-path>"
```

Jeśli plik istnieje, **przeczytaj go W CAŁOŚCI** (bez `limit`/`offset`). Jeśli użytkownik wybrał samodzielny opis, przechwyć jego opis dosłownie — stanie się kartą `## Milestone` z numerowanymi kotwicami zakresu `MS-NN`, a kontrola gotowości PRD z Kroku 3 zostanie zastąpiona kontrolą kotwic (< 2 możliwe do wyodrębnienia kotwice `MS-NN` → poproś użytkownika o doprecyzowanie opisu, a następnie ZATRZYMAJ, jeśli nie może tego zrobić).

Jeśli wskazany plik nie istnieje, zapytaj przy użyciu wybranego narzędzia pytań interaktywnych:

Pytanie interaktywne:
- pytanie: „Nie znaleziono źródła pod `<resolved-path>`. Jak chcesz postąpić?”
  nagłówek: „Wejście?”
  opcje:
  - etykieta: „Najpierw uruchom /10x-prd (Rekomendowane)”
    opis: „Zatrzymaj się tutaj. Uruchom /10x-prd, aby utworzyć prd.md, a następnie ponownie wywołaj /10x-roadmap.”
  - etykieta: „Podaj inną ścieżkę”
    opis: „Poczekam, aż podasz ścieżkę.”
  - etykieta: „Anuluj”
    opis: „Wyjdź bez zmian.”
  multiSelect: false

Po „Najpierw uruchom /10x-prd”: wyświetl komunikat przekierowania i ZATRZYMAJ SIĘ.

### Krok 2: Przeczytaj dodatkowe wejścia (best effort)

Przeczytaj poniższe, jeśli istnieją; w przeciwnym razie odnotuj ich brak i kontynuuj:

- `context/foundation/shape-notes.md` — poszukaj sekcji `## Forward: technical-roadmap`. Jeśli istnieje, podnieś jej punkty dosłownie jako kandydackie wejścia mapy drogowej (użytkownik już odłożył je tam podczas shaping).
- `context/foundation/tech-stack.md` — informuje sekcję `## Foundations` ORAZ skraca sondy bazowe (warstwa już zadeklarowana tutaj jest raportowana jako „według tech-stack.md” bez ponownego badania).
- `context/foundation/roadmap.md` — jeśli już istnieje, zachowaj go dla Kroku 9 (obsługa kolizji). NIE modyfikuj go jeszcze.
- `context/foundation/lessons.md` — jeśli istnieje, przeskanuj pod kątem reguł dotyczących kolejności lub gotowości (np. „zawsze dostarczaj najpierw najbardziej ryzykowny wycinek”). Traktuj jako wcześniejsze założenia, nie jako dogmat.

### Krok 3: Kontrola gotowości PRD

Przed generowaniem oceń PRD według heurystyki gotowości 0–4. Każdy sygnał daje 1 punkt:

1. **Vision & Problem Statement jest nietrywialne** — sekcja istnieje, zawiera ≥ 2 zdania, NIE zawiera `# TODO`.
2. **Co najmniej jedna wypełniona historia użytkownika** — istnieje nagłówek `### US-NN:` z blokiem Given/When/Then pod nim (nie `# TODO`).
3. **Co najmniej jeden FR `must-have`** — istnieje linia pasująca do `^- FR-\d{3}: .* (P|p)riority: must-have$`.
4. **Business Logic wypełnione** — pierwsza niepusta linia sekcji `## Business Logic` jest zdaniem deklaratywnym (nie `# TODO: domain rule`).

Wyraźnie udokumentuj heurystykę w rozmowie:

```
Kontrola gotowości PRD (heurystyka, 4 sygnały, po 1 punkcie):
  [✓|✗] Vision & Problem Statement nietrywialne
  [✓|✗] ≥ 1 wypełniona historia użytkownika
  [✓|✗] ≥ 1 FR must-have
  [✓|✗] Business Logic wypełnione

  Wynik: <N>/4
  Otwarte pytania w PRD: <count>
```

**Wynik ≥ 3**: PRD jest gotowy na mapę drogową; przejdź do Kroku 4.

**Wynik < 3**: wyraźnie ostrzeż. Nazwij to, czego brakuje, i dlaczego ma to znaczenie dla mapy drogowej (NIE ogólne „twój PRD jest zbyt skąpy”):

```
Ten PRD uzyskał wynik <N>/4 w heurystyce gotowości na mapę drogową. Brakujące sygnały:

  - <nazwa sygnału>: <jednolinijkowa konsekwencja dla mapy drogowej>
  - ...

Mapa drogowa wygenerowana z pustego PRD będzie miała wiele wycinków oznaczonych Status:
blocked, z pierwszą Unknown będącą luką PRD. To prawidłowy stan pośredni
— mapa drogowa ujawnia, co blokuje — jednak jeśli masz czas najpierw
doprecyzować PRD, wynikowa mapa drogowa będzie znacznie bardziej użyteczna.
```

Następnie zapytaj przy użyciu wybranego narzędzia pytań interaktywnych:

Pytanie interaktywne:
- pytanie: „Jak chcesz postąpić?”
  nagłówek: „Cienki PRD”
  opcje:
  - etykieta: „Najpierw doprecyzuj PRD (Rekomendowane)”
    opis: „Zatrzymaj się tutaj. Rozwiąż Otwarte pytania / TODO w PRD, a następnie ponownie wywołaj /10x-roadmap.”
  - etykieta: „Mimo to kontynuuj”
    opis: „Wygeneruj na podstawie tego, co istnieje. Puste obszary pojawią się jako zablokowane wycinki z luką PRD jako ich Unknown.”
  - etykieta: „Anuluj”
    opis: „Wyjdź bez zmian.”
  multiSelect: false

Po „Najpierw doprecyzuj PRD”: wyświetl przekierowanie i ZATRZYMAJ SIĘ. Po „Mimo to kontynuuj”: kontynuuj z zapisanym wynikiem, aby Krok 6 mógł oznaczyć słabe obszary.

### Krok 4: Automatyczne badanie punktu bazowego

Ocena „co już jest na miejscu” nie powinna spadać na użytkownika — kod jest źródłem prawdy. Użyj wybranego narzędzia badań w tle / uruchamiania zadań, jeśli jest dostępne, aby równolegle zinwentaryzować każdą warstwę. Jeśli takie narzędzie nie istnieje, uruchom te same sondy sekwencyjnie w głównym kontekście. Każda sonda zwraca jednoakapitowy werdykt: **present** (z dowodami plikowymi), **absent** albo **partial** (szkielet istnieje, ale nie jest podłączony). Następnie pokaż inwentaryzację użytkownikowi do potwierdzenia, zanim zasili Foundations.

**Warstwy do zbadania** (pomiń warstwę, jeśli `tech-stack.md` już wskazuje wybór dla tej warstwy — raportuj „według tech-stack.md: <choice>” zamiast badać):

| Warstwa | Czego szuka sonda |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Frontend | Framework UI, narzędzia budowania, routing, biblioteki komponentów — zależności `package.json`, pliki konfiguracji frameworka |
| Backend / API | Framework serwera, trasy API, handlery żądań — entrypointy, pliki tras, kontrolery |
| Data | Sterownik DB, ORM/query builder, narzędzia schematu/migracji, dane seedowane — pliki schematów, katalogi migracji |
| Auth | Integracja dostawcy auth, obsługa sesji/tokenów, middleware auth — konfiguracja auth, pliki middleware |
| Deploy / infra | Cel hostingu, konfiguracja kontenerów, przepływy CI/CD, infra-as-code — `Dockerfile`, `.github/workflows`, YAML wdrożenia |
| Observability | Biblioteka logowania, śledzenie błędów, metryki, dashboardy — importy sentry/datadog/otel, middleware logowania |

**Uruchom wszystkie sondy w jednej wsadowej delegacji, gdy host to obsługuje.** Każdy prompt jest krótki i samowystarczalny; delegowani agenci zwracają tylko po jednym akapicie, więc główny kontekst pozostaje mały. Przykład dla Auth:

> Zinwentaryzuj warstwę auth/tożsamości tego kodu. Zgłoś w mniej niż 100 słowach: (1) czy istnieje integracja dostawcy auth? Nazwij go. (2) Czy istnieją ścieżki kodu wydawania lub weryfikacji sesji/tokenów? Zacytuj plik:linia. (3) Czy istnieje middleware auth na poziomie tras? Zacytuj. Jeśli warstwa jest nieobecna, powiedz „absent” — nie spekuluj. Nie sugeruj zmian. Nie zapisuj ani nie edytuj plików.

Dostosuj ten sam szablon do każdej warstwy. Zawsze wymagaj: werdyktu present/absent/partial, ≤ 100 słów, dowodów plikowych, gdy warstwa istnieje, bez spekulacji, bez edycji.

Po zwróceniu wszystkich sond przedstaw użytkownikowi jednookranowe podsumowanie punktu bazowego:

```
Punkt bazowy kodu (zbadany automatycznie):

  Frontend:      <present | absent | partial> — <jedna linia, ze wskaźnikiem pliku>
  Backend/API:   <…>
  Data:          <…>
  Auth:          <…>
  Deploy/infra:  <…>
  Observability: <…>
```

Następnie potwierdź:

Pytanie interaktywne:
- pytanie: „Czy ten punkt bazowy odpowiada Twojemu rozumieniu? Czy jest coś do skorygowania lub dodania, zanim wpłynie na Foundations?”
  nagłówek: „Punkt bazowy”
  opcje:
  - etykieta: „Wygląda dobrze — kontynuuj”
    opis: „Użyj tego punktu bazowego jako wejścia dla Foundations i sekcji ## Baseline mapy drogowej.”
  - etykieta: „Popraw jedną lub więcej warstw — wyjaśnię”
    opis: „Opis swobodny. Ponownie zapiszę warstwę lub warstwy przed kontynuowaniem.”
  - etykieta: „Dodaj coś niewymienionego”
    opis: „Opis swobodny. Rzeczy pominięte przez sondy (zaplanowane, lecz niepodłączone, szkielet z innego repozytorium itd.).”
  multiSelect: true

Zapisz potwierdzony punkt bazowy. Zasila on bezpośrednio Krok 6a (Foundations): warstwy **present** → Foundations je pomija; **absent** lub **partial** → otwiera się miejsce w Foundations. Zasila też dosłownie sekcję `## Baseline` mapy drogowej.

### Krok 5: Zwięzły wywiad — 2–3 pytania kotwiczące, każde z silną Rekomendacją

PRD opisuje **produkt**. Punkt bazowy (Krok 4) opisuje **to, co już istnieje**. Ten krok tworzy ramy mapy drogowej — `main_goal`, `north_star`, obszary inwestycji, `top_blocker` — przez ograniczony wywiad: maksymalnie **trzy pytania kotwiczące**, każde zawierające jedną silną **Rekomendację** opartą na cytowanej linii artefaktu oraz 1–2 alternatywy z jednolinijkowym uzasadnieniem „dlaczego to także jest rozsądne”. Użytkownik wybiera Rekomendację, wybiera alternatywę albo swobodnie nadpisuje; obszary inwestycji są *wyprowadzane* z odpowiedzi, a nie zadawane. To optymalny punkt między dwoma trybami porażki, których ta umiejętność już doświadczyła: **cichym automatycznym ramowaniem** (podejmowaniem kluczowych decyzji bez ludzkiej bramki) i **nieograniczonym odkrywaniem** (pytaniem o to, na co artefakty już odpowiadają). Jeśli `shape-notes.md` zawierał blok `## Forward: technical-roadmap`, uwzględnij go w Rekomendacjach — nie pozyskuj ponownie treści, którą użytkownik już tam odłożył. Jeśli kotwica nadal jest nierozstrzygnięta po osiągnięciu limitu, **podejmij decyzję** zgodnie z Rekomendacją, zapisz ją we frontmatter z jednolinijkowym uzasadnieniem i kontynuuj — użytkownik może ją nadpisać w dowolnym momencie.

**5a. Wywnioskuj rekomendacje oraz rzeczywiście rozsądne alternatywy.**

Dla każdej poniższej kotwicy wyprowadź *zarówno* Rekomendację, JAK I alternatywy — oparte na konkretnych cytatach z frontmatter PRD / `## Vision` / `## Success Criteria` / `## NFRs` / `## Open Questions` / punktu bazowego / `tech-stack.md`. Alternatywa jest „rozsądna” tylko wtedy, gdy popiera ją rzeczywisty sygnał w artefaktach LUB jest powszechną, dającą się obronić domyślną wartością dla kształtu produktu. **Nie wymieniaj chochołów.** Jeśli tylko jedna wartość jest wiarygodna (żadna rzeczywista alternatywa nie jest możliwa do poparcia artefaktami), powiedz to — ta kotwica zostanie przedstawiona z jedną Rekomendacją i opcją zapasową „nadpisz własnymi słowami”.

- **`main_goal`** — wybierz spośród `market-feedback` | `quality` | `low-complexity` | `speed` | `learn` | `other`. Sygnały: `timeline_budget` (ciasny → speed lub low-complexity), `target_scale` (mały → low-complexity; rynek masowy → quality), sformułowanie Success Criteria („learn from real users” → market-feedback; „validate the riskiest assumption” → market-feedback; „no incidents at launch” → quality), ton Vision (eksploracyjne hobby → learn; twardy termin → speed). Alternatywy to *sąsiednie* wartości, które te same dowody mogą rozsądnie wspierać — np. `market-feedback` i `speed` często współistnieją, gdy PRD mówi „ship to learn fast”.

- **`north_star`** — najmniejszy widoczny dla użytkownika przepływ end-to-end, który dostarczony jako pierwszy dowodzi podstawowej hipotezy Vision z PRD. Zwykle odnosi się do US-NN o wysokim priorytecie ORAZ głównego Success Criterion. Rozsądne alternatywy to *inne* kandydackie wycinki, które także odnoszą się do głównego Success Criterion lub US-NN o wysokim priorytecie, z mniejszą liczbą Prerequisites albo z innymi konsekwencjami sekwencjonowania. Gdy istnieje więcej niż trzech kandydatów, przedstaw najlepszych trzech.

- **`top_blocker`** — wybierz spośród `skills` | `capacity` | `time` | `decisions` | `external` | `motivation` | `none`. Sygnały: ≥ 3 nierozwiązane PRD `## Open Questions` → `decisions`; ambitny zakres versus niedopasowanie `timeline_budget` → `time` lub `capacity`; zależność dostawcy wymieniona w PRD, która nie ma jeszcze umowy → `external`; tech-stack wymienia warstwę, której zespół nigdy nie dostarczył → `skills`; brak sygnałów → `none`. Rozsądne alternatywy to *sąsiednie* typy blokad aktywowane przez podobne sygnały — np. `time` i `capacity` często oba występują przy napięciu zakres–termin.

- **Obszary inwestycji** (NIE są zadawane — wyprowadzane w 5d) — dla każdego z `frontend`, `backend`, `data`, `infra`: zdecyduj `invest deeply` vs `go simple`. Sygnały: NFR PRD blokujące start w warstwie (prywatność / opóźnienie / poprawność → inwestuj tam), luki punktu bazowego mapujące się na FR must-have (brak auth + must-have dla wielu użytkowników → inwestuj w auth), Open Questions skoncentrowane w jednej warstwie (nierozwiązane decyzje tam → inwestuj) oraz wybrany `main_goal` (`quality` wzmacnia warstwy prywatności/obserwowalności; `learn` wzmacnia nieznaną warstwę; `speed` / `low-complexity` domyślnie utrzymuje wszystko prosto). NIE promuj warstwy do „invest” bez nazwania sygnału PRD/punktu bazowego/main_goal.

**5b. Pomijaj kotwicę tylko wtedy, gdy artefakt jest jednoznaczny.** Jeśli frontmatter PRD lub Success Criteria *dosłownie wskazuje* wartość (np. `timeline_budget: "1 week to ship"` plus „we need to launch before X” → `main_goal: speed`), pomiń to pytanie i ogłoś pominięcie z wybraną wartością oraz cytatem, który je przesądza. Nigdy nie pomijaj, gdy istnieje wiarygodna alternatywa — potwierdzenie użytkownika przy rzeczywistym wyborze jest warte więcej niż zaoszczędzone sekundy. W praktyce zwykle zadasz 2–3 pytania; możesz zadać mniej, ale NIGDY więcej niż 3.

**5c. Przeprowadź wywiad — jedno pytanie strukturalne na kotwicę, w kolejności.**

Dla każdej niepominiętej kotwicy — `main_goal`, następnie `north_star`, następnie `top_blocker` — użyj wybranego narzędzia pytań interaktywnych. Każde pytanie jest osobnym wywołaniem (sekwencyjnie, nie wsadowo). Format:

Pytanie interaktywne:
- pytanie: „<pytanie o kotwicę prostym językiem, w języku użytkownika>”
  nagłówek: „<krótki nagłówek — np. Cel | Gwiazda | Główne ryzyko / Goal | North star | Blocker>”
  opcje:
  - etykieta: „<wartość Rekomendacji> (Rekomendowane)”
    opis: „<Jednolinijkowe dlaczego, z cytatem/wskaźnikiem artefaktu uzasadniającym Rekomendację.>”
  - etykieta: „<wartość Alternatywy A>”
    opis: „Rozsądne, gdy <jednolinijkowy warunek częściowo poparty artefaktami>; wybierz to, gdy <konsekwencja dla sekwencjonowania/zakresu>.”
  - etykieta: „<wartość Alternatywy B>”
    opis: „Rozsądne, gdy <jednolinijkowy warunek>; wybierz to, gdy <konsekwencja>.”
  - etykieta: „Coś innego — wyjaśnię”
    opis: „Opis swobodny. Podaj wartość i powód; zapiszę oba i odpowiednio ułożę kolejność.”
  multiSelect: false

Reguły dla bloku opcji:
- **Rekomendacja jest zawsze opcją 1**, z przyrostkiem „(Rekomendowane)” w etykiecie.
- **Każda alternatywa ma własną klauzulę „dlaczego rozsądna”** powiązaną z sygnałem artefaktu — nie „alternatywa: quality”, lecz „alternatywa: quality — rozsądne, gdy poprawność podczas startu ma większe znaczenie niż sygnał od pierwszych użytkowników”. Alternatywa bez takiej klauzuli jest chochołem; usuń ją.
- **Maksymalnie 2 alternatywy** plus swobodna opcja zapasowa (łącznie 2–4 opcje). Dłuższe listy męczą użytkownika, nie dodając sygnału.
- **Opcje gwiazdy przewodniej nazywają kandydatów na wycinki, nie abstrakcyjne wartości** — każda etykieta ma postać `<US-NN candidate> — <one-line outcome>`.
- **Jeśli tylko jedna wartość jest wiarygodna** (5a nie znalazło rozsądnej alternatywy), przedstaw wyłącznie Rekomendację i „Coś innego — wyjaśnię”, a w tekście pytania ujawnij: „artefakty wspierają tutaj tylko jedną interpretację; zaznacz, jeśli odczytujesz to inaczej”.

**5d. Wyprowadź obszary inwestycji (bez pytania).**

Po otrzymaniu 2–3 odpowiedzi kotwiczących wyprowadź obszary inwestycji z: (1) wybranego `main_goal`, (2) NFR PRD blokujących start w warstwie, (3) luk punktu bazowego zmapowanych na FR must-have, (4) koncentracji Open Questions. Ogłoś wyprowadzoną inwestycję w podsumowaniu syntezy (5e). Użytkownik może ją nadpisać jedną linią; nie jest proszony o jej wybór.

**5e. Podsumowanie syntezy — potwierdź bez pytania.**

Wyślij pojedynczą wiadomość w zwykłym markdownie, która utrwala ramy. Bez nowych pytań. Odzwierciedlaj język użytkownika od początku do końca (polski PRD → polskie podsumowanie). Kształt:

```markdown
Ustalamy ramy mapy drogowej:

- **Cel sekwencjonowania: `<main_goal>`.** <Jednolinijkowe uzasadnienie wiążące odpowiedź użytkownika na kotwicę ze wskaźnikiem artefaktu.>
- **Gwiazda przewodnia: `<S-NN candidate> — <Outcome>`.** <Jedna linia wiążąca ten wycinek z głównym Success Criterion lub najbardziej ryzykownym założeniem.>
- **Główne ryzyko / blocker: `<top_blocker>`.** <Jedna linia z konkretnym sygnałem — liczbą Open Questions, nazwanym dostawcą, niedopasowaniem terminu itd.>
- **Inwestycje: w `<layer>` głęboko; reszta lekko.** <Jedna linia — wyprowadzona z main_goal + NFR + luki punktu bazowego; nie pytano o nią.>

Powiedz "go" żeby ruszyć dalej, albo nadpisz dowolną linię ("inwestycja powinna być w data, nie infra"). Nie będę pytał ponownie o to, co już ustaliliśmy.
```

Gdy użytkownik mówi „go” albo milczy po przekroczeniu granicy następnego kroku, kontynuuj z ustalonymi ramami. Nadpisania poszczególnych linii są akceptowane i ponownie zapisywane bez ponownego pytania o inne kotwice.

**5f. Wyjątek dla niestandardowego kształtu MVP.**

„Niestandardowy kształt MVP” to produkt, który nie odpowiada znanemu wzorcowi: nie jest panelem SaaS, aplikacją CRUD, platformą treści, oczywistym wrapperem AI ani stroną marketingową. Sygnały: PRD `## Vision` opisuje nową interakcję lub domenę; `## User Stories` nie grupują się wokół znanej encji (create/read/update/delete `<thing>`); `tech-stack.md` deklaruje nieoczywiste narzędzia (silniki gier, mosty sprzętowe, wyspecjalizowane runtime’y, nowe kształty agentów); sformułowania użytkownika podkreślają nową mechanikę, nie znany wzorzec.

Gdy PRD ma niestandardowy kształt:

1. **Rozpocznij wywiad, ujawniając to** w wiadomości poprzedzającej pierwsze pytanie kotwiczące: *„Ten PRD nie pasuje do znanego wzorca MVP (brak kształtu panelu SaaS / CRUD / treści / wrappera AI). Moje Rekomendacje dla kolejnych 2–3 pytań są słabsze niż zwykle — zdecydowanie zaprotestuj, jeśli źle to odczytuję.”*
2. **Złagodź Rekomendację dla `north_star` i każdego wyprowadzonego obszaru inwestycji.** Sformułuj opis Rekomendacji jako *„Moje najlepsze odczytanie to X, ale sygnał artefaktów jest słaby”* zamiast *„PRD §Vision mówi X”*.
3. **Zezwól na maksymalnie dwie dodatkowe wymiany** ponad trzy pytania kotwiczące. Niestandardowe MVP korzystają na dialogu; intuicja projektowa użytkownika wykonuje więcej pracy, niż mogą wykonać artefakty. Dopytania to swobodny tekst, nie nowe pytania strukturalne.

To jedyna ścieżka, na której umiejętność przechyla się ku dialogowi zamiast od niego — i jedyna ścieżka dopuszczająca dopytania. Łączny limit w tym wyjątku: 3 kotwice + 2 dopytania = 5 wymian; poza nim: 3 pytania kotwiczące, bez dopytań, jedno podsumowanie syntezy.

**5g. Zasady sformułowań i języka (stosuj do każdego pytania kotwiczącego i podsumowania).**

- **Odzwierciedlaj język użytkownika od początku do końca.** Polski PRD → polskie pytania, opcje i podsumowanie. Tłumacz nazwy sekcji (`Open Questions` → `Otwarte pytania`, `Functional Requirements` → `Wymagania funkcjonalne`, `Non-Goals` → `Poza zakresem`, `Success Criteria` → `Kryteria sukcesu`). W polskim pytaniu lub etykiecie opcji nie mogą występować angielskie fragmenty jak „north star”, „blocker”, „must-have” — parafrazuj („gwiazda przewodnia”, „główne ryzyko”, „konieczne”).
- **Tłumacz wewnętrzny żargon umiejętności na zwykły język produktu.** *„Privacy posture”* → *„polityka prywatności dostawcy AI”*. *„North star”* → *„pierwsza historyjka, która udowadnia, że produkt działa”*. *„Blocking unknowns”* → *„pytania bez odpowiedzi, które blokują dalsze planowanie”*. Użytkownik nigdy nie powinien potrzebować otwierać dokumentacji tej umiejętności, aby zrozumieć pytanie.
- **Cytaty w opisach opcji muszą zasłużyć na swoje miejsce.** Cytat taki jak *„tech-stack wskazuje Astro + Supabase + OpenRouter”* jest zrzutem nazw, jeśli następna klauzula nie mówi, dlaczego ma to znaczenie dla *tej* kotwicy. Albo dodaj implikację inline, albo usuń cytat.
- **Rekomendacja ma być obroniona, nie agresywna.** Jedna linia Rekomendacji opiera się na linii artefaktu, a nie na pewnym tonie. Jeśli nie możesz wskazać cytatu, obniż rangę — przedstaw kotwicę z dwiema alternatywami o równej wadze (oraz swobodną opcją zapasową) i pozwól użytkownikowi wybrać.

### Krok 6: Dekomponuj i sekwencjonuj

To krok, w którym umiejętność pokazuje swoją wartość. Zbuduj zawartość mapy drogowej **w pamięci** (jeszcze nie na dysku).

**6a. Zidentyfikuj Foundations.** Foundation to przekrojowy warunek wstępny, który sam nie ma widocznego dla użytkownika rezultatu, ale odblokowuje nazwane pionowe wycinki, zmniejsza nazwaną blokującą niewiadomą lub tworzy infrastrukturę weryfikacyjną wymaganą przez nazwany wycinek. To kontrakt umożliwiający, nie pozwolenie na horyzontalne planowanie. Źródła:

- Decyzje z `tech-stack.md`, które implikują pracę przygotowawczą (dostawca auth → szkielet auth; wybrany cel wdrożenia → szkielet wdrożenia; wybrany monitoring → punkt bazowy obserwowalności).
- PRD `## Non-Functional Requirements`, które potrzebują infrastruktury (np. NFR „p95 < 800ms” implikuje podstawowe instrumentowanie wydajności).
- PRD `## Access Control`, jeśli oznacza cokolwiek więcej niż „single user, no auth”.
- **Punkt bazowy z Kroku 4** — wszystko zgłoszone jako **absent** lub **partial** jest kandydatem do Foundations. Wszystko zgłoszone jako **present** jest pomijane (i odnotowane w `## Baseline`).
- **„Gdzie inwestować” z Kroku 5** — wybory „invest deeply” promują foundation do własnego jawnego wycinka (np. „data layer — invest deeply” + nieobecny punkt bazowy → jawne foundation projektu danych F-NN, nie tylko niejawny krok migracji).

Nie wymyślaj foundations, których PRD nie implikuje (żadnego „set up Storybook”, chyba że coś tego wymaga). Nie twórz generycznego foundation „data layer”, „API layer”, „UI layer” ani „auth system”, chyba że potrafisz wskazać downstreamowy element `S-NN`, który odblokowuje, blokującą niewiadomą, którą zmniejsza, lub ścieżkę weryfikacji, którą umożliwia.

**Limit zakresu Foundation.** Foundation musi być najmniejszym przekrojowym elementem umożliwiającym, który pozwala przejść do nazwanego pionowego wycinka. Może ustanowić minimalny kontrakt, szkielet, politykę lub ścieżkę weryfikacji; NIE może ukończyć całej warstwy architektonicznej przed pracą skierowaną do użytkownika. Jeśli rezultat foundation brzmi jak „warstwa data/API/UI/auth jest ukończona”, podziel go lub przenieś minimalnie potrzebną pracę do pierwszego wycinka `S-NN`, który ją wykorzystuje. Test: po dostarczeniu Foundation co najmniej jeden downstreamowy `S-NN` nadal powinien integrować i wykorzystywać tę warstwę przez rzeczywistą możliwość użytkownika.

**Reguła stopniowego ujawniania.** Preferuj wprowadzanie elementów technicznych w momencie, gdy pierwszy wycinek skierowany do użytkownika ich potrzebuje. Foundation jest uzasadnione tylko wtedy, gdy jego odroczenie uczyniłoby pierwszy pionowy wycinek niemożliwym do zaplanowania, niebezpiecznym albo nieweryfikowalnym. „Ta warstwa będzie nam kiedyś potrzebna” nie wystarczy.

Identyfikatory Foundation mają postać `F-NN` (dwucyfrowe, z zerem wiodącym, od `F-01`).

**6b. Zdekomponuj powierzchnię widoczną dla użytkownika na wycinki.** Przejdź przez PRD `## User Stories` oraz `## Functional Requirements`. Grupuj je w pionowe, end-to-end wycinki, gdzie każdy wycinek:

- Dostarcza **pojedynczą możliwość widoczną dla użytkownika**, sformułowaną jako „użytkownik może …”.
- Dotyka każdej warstwy potrzebnej, aby ta możliwość była rzeczywista (data + logika + interfejs), od góry do dołu.
- Jest wystarczająco mały, aby jedno wywołanie `/10x-plan` generowało wykonalny plan, ale wystarczająco duży, aby wycinek był sensowny sam w sobie (wycinek to zazwyczaj jedno US-NN, okazjonalnie dwa, gdy są mocno sprzężone — np. „create” i „list” tej samej encji).

NIE dziel horyzontalnie („wycinek bazy danych”, „wycinek API”, „wycinek UI”). Horyzontalne wycinki są antywzorcem, któremu ta umiejętność ma zapobiegać. Domyślna dekompozycja jest najpierw pionowa: każdy wycinek skierowany do użytkownika powinien tworzyć użyteczną możliwość, którą agent może wdrożyć i zweryfikować end-to-end. Praca horyzontalna jest dozwolona tylko jako nazwane Foundation z jawnym downstreamowym powodem.

Identyfikatory wycinków mają postać `S-NN` (dwucyfrowe, z zerem wiodącym, od `S-01`).

Każde `F-NN` i `S-NN` otrzymuje też stabilne **Change ID** w kebab-case. Change ID jest mostem do `/10x-plan` i później elementem backlogu w Jira/Linear. Preferuj zwięzłe nazwy nastawione na rezultat, takie jak `first-gated-generation`, `minimal-auth-for-generation` lub `srs-review-session`.

**Granularność i równowaga wycinków.** Wycinki mapy drogowej powinny mieć w przybliżeniu porównywalny wysiłek planowania i wagę koncepcyjną, mimo że nie zawierają estymacji. Unikaj jednego wycinka pochłaniającego większość PRD, gdy późniejsze wycinki są drobnymi elementami dopracowania. Jeśli jeden kandydat na wycinek odnosi się do wielu FR must-have lub wielu niepowiązanych historii użytkownika, podziel go według widocznych dla użytkownika rezultatów, faz przepływu pracy, person lub granic ryzyka, aż każde `S-NN` będzie czymś, o czym jedno `/10x-plan <change-id>` może spójnie rozumować.

Użyj tych wyzwalaczy podziału:

- Wycinek obejmuje więcej niż jedno główne działanie użytkownika (np. „import, edit, share, and report”).
- Wycinek łączy konfigurację, główny przepływ pracy i administrację w jednym elemencie.
- Wycinek spełnia większość FR must-have, podczas gdy inne wycinki mają tylko po jednym drobnym FR.
- Linia Risk wycinka zawiera więcej niż jedno niezależne ryzyko.
- Wycinek wymaga niepowiązanych niewiadomych należących do różnych osób lub warstw.

NIE dziel według warstwy, aby naprawić rozmiar. Dziel według węższych pionowych rezultatów. Na przykład zastąp „complete recipe system” przez „user can save the first recipe”, „user can search saved recipes” oraz „user can share a recipe” — nie przez „recipe schema”, „recipe API” oraz „recipe UI”.

**6c. Zbuduj graf zależności.** Dla każdego wycinka i foundation określ Prerequisites:

- **Inne identyfikatory foundation**, które wycinek musi mieć na miejscu (np. S-03 potrzebuje auth F-01).
- **Inne identyfikatory wycinków**, których dane lub możliwości ten wycinek wykorzystuje (np. S-04 „rate a recipe” zależy od S-03 „see recipes”).
- **Stan zewnętrzny** (np. „a seeded ingredient table”). Konkretny, nie ogólnikowy.

Dla każdego foundation określ również **Unlocks**:

- jeden lub więcej downstreamowych pionowych wycinków `S-NN`, które foundation bezpośrednio umożliwia, LUB
- jedną lub więcej blokujących Unknowns, które zmniejsza, LUB
- jedną lub więcej nazwanych ścieżek weryfikacji wymaganych przez downstreamowy wycinek.

Jeśli foundation nie ma jasnych Unlocks, usuń go albo przenieś pracę do pierwszego pionowego wycinka, który jej potrzebuje.

Następnie dla każdego elementu wyprowadź **Parallel with** — wycinki, których Prerequisites są podzbiorem lub rodzeństwem Prerequisites tego wycinka i które od niego nie zależą. Agenci AI mogą rozgałęziać pracę między nimi. Jeśli dwa wycinki nie mają wspólnych zależności i żaden nie blokuje drugiego, są równoległe. Gdy blokadą nr 1 (Krok 5) jest **capacity**, bądź szczególnie hojny przy wyliczaniu parallel-with — to najpraktyczniejsza dźwignia użytkownika.

**6d. Sortowanie topologiczne, ukierunkowane przez główny cel.** Najpierw Foundations (w kolejności zależności między nimi), potem wycinki w kolejności zależności. Umieść wycinek **gwiazdy przewodniej** tak wcześnie, jak pozwalają jego Prerequisites — nie odkładaj go dla symetrycznej kolejności. Następnie rozstrzygaj remisy według głównego celu (Krok 5):

- **Market feedback** → remisy rozstrzygaj na korzyść wycinka ujawniającego najbardziej ryzykowne założenie (często integracja lub logika domenowa). Wczesne ujawnienie ryzyka jest ważniejsze niż maksymalizacja wartości demonstracyjnej wycinka 1.
- **Quality / craft** → Foundations sekwencjonuj bardziej ochoczo; foundations obserwowalności i kontroli dostępu NIE są odkładane za wycinkami skierowanymi do użytkownika.
- **Low complexity / quick win** → remisy rozstrzygaj na korzyść najmniejszego wykonalnego wycinka; agresywne Parked.
- **Speed to launch** → najpierw ścisła ścieżka must-have; nieistotne elementy trafiają do Parked, nie są sekwencjonowane później.
- **Learn the tech / explore** → remisy rozstrzygaj na korzyść wycinków, które najwcześniej wykorzystują nieznaną technologię; wartość nauki liczy się tutaj jako wartość dla użytkownika.

Jeśli `## Open Roadmap Questions` zawiera decyzję istotną dla sekwencjonowania (np. „do we ship for mobile first?”), NIE wybieraj sekwencji, która przesądza odpowiedź — pozostaw dotknięte wycinki ze statusem `Status: blocked`, aż pytanie zostanie rozwiązane.

**6e. Zidentyfikuj blokujące niewiadome.** Dla każdego wycinka wymień:

- **Blockers** (zewnętrzne, oczekujące) — zgoda dostawcy, asset projektowy, decyzja interesariusza. Jeśli brak, wpisz `—`. Odpowiedź „External” jako blokada nr 1 z Kroku 5 zasila te pola.
- **Unknowns** (pytania do zbadania) — rzeczy, na które mapa drogowa nie może odpowiedzieć i których `/10x-plan` także nie powinien próbować rozstrzygać. Każda niewiadoma zawiera: pytanie, właściciela, status blokowania (yes/no — czy planowanie jest zablokowane do czasu rozwiązania?). Odpowiedź „Decisions” jako blokada nr 1 z Kroku 5 zasila te pola.

Wycinek ze `Status: blocked` istnieje, gdy co najmniej jedna Unknown ma `Block: yes`. Zadaniem mapy drogowej jest ujawnienie ich, aby użytkownik mógł je rozwiązać, zanim `/10x-plan` zostanie zmarnowany na wycinek, którego nie da się zaplanować.

**6f. Wygeneruj `## Open Roadmap Questions`.** Dwa źródła:

- PRD `## Open Questions` — kopiuj dosłownie, w razie potrzeby ponumeruj ponownie. Nadal są otwarte.
- Nowe pytania ujawnione w Kroku 5, które obejmują wiele wycinków („should we actually ship for mobile?”).

Niewiadome przypisane do wycinka pozostają w wycinku; przekrojowe trafiają tutaj.

**6g. Wygeneruj `## Parked`.** Podnieś PRD `## Non-Goals`. Dodaj również wszystko, co Krok 5 ujawnił jako odroczone — szczególnie gdy głównym celem jest **speed to launch** albo blokadą nr 1 jest **time/capacity**, ta sekcja rośnie. Każdy wpis: jednolinijkowy element, jednolinijkowe uzasadnienie.

**6h. Wyprowadź `## Streams` (pomoc nawigacyjna).** Strumienie są *wyprowadzonym widokiem* grafu zależności — NIE zastępują kolejności topologicznej w `## Foundations` + `## Slices` i nie wprowadzają nowych ID. Ich zadanie: pokazać czytelnikowi proponowaną kolejność czytania przez równoległe ścieżki na jednym ekranie. Wyprowadzenie: jeden strumień na foundation, który zakotwicza odrębny łańcuch Prerequisites (`F-NN` → wycinki wymieniające go w Prerequisites, w kolejności zależności); wycinek bez prerequisite foundation jest własnym jednoelementowym strumieniem (nigdy koszykiem „Misc”); wycinek zależny od głów wielu strumieni dołącza do najbardziej pochodnego z nich, z połączeniem nazwanym w notatce tego strumienia („joins Stream A at S-01”) — nigdy nie jest duplikowany między strumieniami. Wygeneruj jeden wiersz tabeli markdown na strumień — `Stream | Theme | Chain | Note` — Chain łączący istniejące ID mapy drogowej przez `→`, Theme opisowe, nie promocyjne („Review loop”, nie „The killer feature”), Note z jedną klauzulą wiążącą strumień z `main_goal` lub nazywającą połączenie. Limit: 2–5 strumieni — więcej oznacza, że graf jest zbyt podzielony (złóż strumienie pojedynczych wycinków do strumienia sąsiedniego foundation); mniej niż 2 oznacza, że kolejność topologiczna już jest czytelna, więc pomiń sekcję. Strumienie NIE są kanoniczne: przy każdym konflikcie wygrywa kolejność topologiczna, a definicja strumienia jest błędna.

### Krok 7: Wygeneruj zawartość mapy drogowej

Użyj dokładnie tego szablonu (nazwy sekcji są kontraktem; narzędzia downstream i `/10x-plan` mogą je wyszukiwać przez grep):

````markdown
---
project: <from PRD frontmatter>
version: 1
status: draft                    # draft | active | locked
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
prd_version: <int from PRD frontmatter, or `—` for non-PRD sources>
main_goal: <market-feedback | quality | low-complexity | speed | learn | other>
top_blocker: <skills | capacity | time | decisions | external | motivation | none>
milestone_id: <kebab-case, outcome-oriented — e.g. first-usable-deck>
milestone_seq: <int, 1 for the first milestone>
milestone_status: open           # open | done
---

# Roadmap: <Project>

> Derived from <source materials> + auto-researched codebase baseline.
> Edit-in-place; the next milestone continues this file. Archive only when an independent roadmap replaces it.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-<seq>: <Milestone name>** — Status: open

- **Intent:** <1-2 sentences: the outcome this milestone proves or delivers — outcome-scoped, no dates>.
- **Source materials:** <`context/foundation/prd.md` (v<N>) | listed doc paths | "user description (anchors below)">
- **Done when:** every F-NN and S-NN below is `done`<, plus any explicit acceptance line the user gave>.
- **Scope anchors:** <PRD IDs this milestone draws from (FR-NNN, US-NN ranges) — or, for description-sourced milestones, numbered `MS-NN` items distilled verbatim from the user's description:>
  - MS-01: <one scope statement>
  - MS-02: <…>
  (Omit the MS list entirely when the source is a PRD or other document.)

## Vision recap

<2-3 sentences lifted from PRD's Vision & Problem Statement. NOT a re-statement —
just enough that a reader can orient without opening prd.md.

If the recap leans on a product-strategy term — most commonly "wedge", but also
"beachhead", "primary metric", "validation milestone", "north star" — define it
inline on first use, in one short sentence in plain language. Example:
"The product wedge — the one trait that, if removed, makes the product
indistinguishable from a generic AI tool — is that cards must be both
AI-grounded in the learner's own pasted text and human-gated before they
land in the deck." A reader who has not taken a product-strategy course must
be able to read the section cold.>

## North star

**<Slice ID>: <Outcome>** — <one sentence on why this is the validation milestone, tied to main_goal>.

> A reader-facing one-liner explaining what "north star" means here: the smallest
> end-to-end slice whose successful delivery would prove the core product hypothesis
> — placed as early as Prerequisites allow because everything else only matters
> if this works. Include this gloss the FIRST time "north star" appears in the
> document body; do not repeat it later.

## At a glance

| ID    | Change ID              | Outcome (user can …)              | Prerequisites    | PRD refs       | Status   |
| ----- | ---------------------- | --------------------------------- | ---------------- | -------------- | -------- |
| F-01  | <kebab-case-change-id> | (foundation) <foundation outcome> | —                | NFR-XX         | proposed |
| F-02  | <kebab-case-change-id> | (foundation) <foundation outcome> | F-01             | NFR-YY         | proposed |
| S-01  | <kebab-case-change-id> | <user-can outcome>                | F-01             | US-01, FR-001  | ready    |
| S-02  | <kebab-case-change-id> | <user-can outcome>                | S-01             | US-02, FR-003  | proposed |
| S-03  | <kebab-case-change-id> | <user-can outcome>                | S-01, F-02       | US-03, FR-005  | blocked  |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme              | Chain                          | Note                                                      |
| ------ | ------------------ | ------------------------------ | --------------------------------------------------------- |
| A      | <Theme>            | `F-01` → `S-01` → `S-02`       | <One-line rationale tying the stream to main_goal.>       |
| B      | <Theme>            | `F-02` → `S-03`                | <Joins Stream A at `S-NN` if applicable, else standalone.> |
| C      | <Theme>            | `S-NN`                         | <Standalone slice with no foundation prerequisite.>       |

(2–5 streams; every `F-NN` and `S-NN` appears in exactly one stream. Omit this section entirely if the dep graph is too small for streams to add value — see Step 6h.)

## Baseline

What's already in place in the codebase as of `<YYYY-MM-DD>` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** <present | absent | partial> — <one line, file pointer if present>
- **Backend / API:** <…>
- **Data:** <…>
- **Auth:** <…>
- **Deploy / infra:** <…>
- **Observability:** <…>

## Foundations

### F-01: <Foundation title>

- **Outcome:** (foundation) <one sentence on what's now in place — not user-visible>.
- **Change ID:** <kebab-case-change-id>
- **PRD refs:** <NFR-NN, Access Control section, etc. — be specific>
- **Unlocks:** <downstream S-NN IDs, blocking unknown IDs/questions, or named verification paths>
- **Prerequisites:** <slice/foundation IDs and external state — or `—`>
- **Parallel with:** <IDs that can run alongside, or `—`>
- **Blockers:** <external pending, or `—`>
- **Unknowns:** <questions, or `—`>
- **Risk:** <one line: why sequenced here, what could go wrong>
- **Status:** proposed | ready | blocked

(Repeat for each F-NN.)

## Slices

### S-01: <Slice title>

- **Outcome:** <user can …>
- **Change ID:** <kebab-case-change-id>
- **PRD refs:** <FR-NNN, US-NN, NFR-N — every must-have FR this slice satisfies, every US-NN it advances>
- **Prerequisites:** <slice/foundation IDs and external state>
- **Parallel with:** <IDs, or `—`>
- **Blockers:** <external pending, or `—`>
- **Unknowns:**
  - <question> — Owner: <user|team|TBD>. Block: <yes|no>.
  - (or `—` if none)
- **Risk:** <one line>
- **Status:** proposed | ready | blocked

(Repeat for each S-NN, in dependency order.)

## Backlog Handoff

| Roadmap ID | Change ID              | Suggested issue title         | Ready for `/10x-plan` | Notes |
| ---------- | ---------------------- | ----------------------------- | --------------------- | ----- |
| F-01       | <kebab-case-change-id> | <issue title for Jira/Linear> | no                    | <why or `—`> |
| S-01       | <kebab-case-change-id> | <issue title for Jira/Linear> | yes                   | Run `/10x-plan <change-id>` |

This table is the clean handoff to Jira/Linear or any MCP-backed backlog. Include one row for every `F-NN` and `S-NN`. It should be compact enough to copy into issues, but it must not duplicate the detailed roadmap body.

## Open Roadmap Questions

1. **<Question>** — Owner: <who>. Block: <which slice IDs this gates, or `roadmap-wide`>.
2. ...

(Each entry mirrors PRD's `## Open Questions` shape. Per-slice unknowns stay in the slice.)

## Parked

- **<Item>** — Why parked: <PRD §Non-Goals reference, or rationale from interview>.
- ...

## Milestone History

(Append-only. Carried forward verbatim into each successor milestone's roadmap; empty on the very first milestone. Closure entries are written by this skill's `READY_TO_CLOSE → CLOSED` transition. Format:)

- **M-<seq>: <Milestone name>** (`<milestone_id>`) — closed <YYYY-MM-DD>. <One-line outcome.>

## Done

(Empty on first generation. `/10x-archive` appends an entry here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches the item is archived. Do NOT pre-populate. Format:)

- **<Slice ID>: <Outcome>** — Archived <YYYY-MM-DD> → `context/archive/<YYYY-MM-DD-change-id>/`. Lesson: <pointer to lessons.md if any, or `—`>.
````

**Semantyka pól, szczegółowo:**

- **Outcome** zaczyna się od czasownika. Wycinki: *„user can sign in and see an empty fridge”*. Foundations: *„(foundation) auth scaffold landed; tokens issued via configured provider”*. Nigdy fraza rzeczownikowa („authentication system”); zawsze deklaracja stanu świata.
- **Change ID** jest w kebab-case, stabilne i odpowiednie dla `context/changes/<change-id>/`. Nie używaj `F-01` / `S-01` jako change id; to lokalne identyfikatory kolejności mapy drogowej.
- **Unlocks** występuje tylko w Foundations. Nazywa downstreamowy powód istnienia Foundation: konkretne wycinki `S-NN`, blokujące niewiadome lub ścieżki weryfikacji. Foundation bez Unlocks to horyzontalny dryf.
- **PRD refs** używa dosłownych ID z PRD (`FR-001`, `US-01`, `NFR-02`). Nie parafrazuj. Każdy FR must-have w PRD musi wystąpić w PRD refs co najmniej jednego wycinka po samokontroli z Kroku 8.
- **Prerequisites** miesza ID wycinków (`S-01`, `F-02`) oraz stan zewnętrzny, oddzielone przecinkami. Stan zewnętrzny to zwykły angielski („seeded ingredient table”, „design tokens published”). Jedno pole, nie podzielone.
- **Parallel with** ma charakter informacyjny. Jest obliczane z grafu zależności: każdy wycinek X, gdzie moje Prerequisites oraz Prerequisites X nie mają ścieżki między sobą. Puste = `—`.
- **Blockers** to tylko *zewnętrzne oczekiwania* (dostawca, projekt, decyzja interesariusza). Rzeczy, których zespół nie może jednostronnie rozwiązać. Jeśli zespół MOŻE to rozwiązać, to Unknown, nie Blocker.
- **Unknowns** to pytania do zbadania. Każde zawiera Owner oraz flagę Block. Block=yes podnosi Status wycinka do `blocked`.
- **Risk** to jedna linia: dlaczego kolejność jest taka, co może pójść nie tak, dlaczego to bezpieczniejsza kolejność niż alternatywy. Nie postmortem. Nie katastrofizacja. Tylko kluczowy powód, który przyszły czytelnik musi zrozumieć, aby zrozumieć sekwencję.
- **Status** — cykl życia: `proposed` (domyślnie przy pierwszym generowaniu) | `ready` (wszystkie Prerequisites spełnione, brak blokujących niewiadomych — `/10x-plan` może działać) | `planning` | `in-progress` | `done` | `blocked` (jedna lub więcej niewiadomych z `Block: yes`). Ta umiejętność generuje tylko `proposed`, `ready` i `blocked`; pozostałe są zapisywane downstream (zobacz „Relacja z innymi umiejętnościami”), best-effort i tylko do przodu.
- Frontmatter **`main_goal` / `top_blocker`** zapisują odpowiedzi z Kroku 5, aby przyszły odczyt (lub recenzent) mógł od razu zobaczyć nastawienie sekwencjonowania bez otwierania historii rozmowy.

**Twarda reguła — nigdy nie wymyślaj wycinków.** Każdy wycinek musi prowadzić do ID kotwicy źródłowej (bariera 1). Jeśli wywiad ujawnił coś, czego źródła nie deklarują („oh and we also need offline mode”), NIE staje się to wycinkiem — staje się Open Roadmap Question (rzeczywista luka) albo wpisem Parked (jawnie odroczonym). Mapa drogowa sekwencjonuje to, co deklarują źródła; nie powiększa ich.

**Bez jednostek czasu. Bez estymacji. Bez ocen złożoności.** (Bariera 5.) Kolejność jest zakodowana w Prerequisites; tempo w Blockers i Unknowns. Chęć napisania „this should take a few hours” oznacza, że przeszedłeś na terytorium `/10x-plan` — zatrzymaj się.

### Krok 8: Samokontrola

Przed jakimkolwiek zapisem na dysku zweryfikuj mapę drogową w pamięci:

1. **Frontmatter** — obecne wszystkie 11 kluczy (`project`, `version`, `status`, `created`, `updated`, `prd_version`, `main_goal`, `top_blocker`, `milestone_id`, `milestone_seq`, `milestone_status`).
2. **Wymagane sekcje** — te nagłówki `##` istnieją w tej kolejności: `Milestone`, `Vision recap`, `North star`, `At a glance`, `Streams` (opcjonalne — obecne wtedy i tylko wtedy, gdy Krok 6h uznał, że strumienie dodają wartość), `Baseline`, `Foundations`, `Slices`, `Backlog Handoff`, `Open Roadmap Questions`, `Parked`, `Milestone History`, `Done`. Przy obecnym `Streams` liczba wynosi 13; bez niego 12.
3. **Schemat na wpis** — każde S-NN ma 9 obowiązkowych pól (`Outcome`, `Change ID`, `PRD refs`, `Prerequisites`, `Parallel with`, `Blockers`, `Unknowns`, `Risk`, `Status`). Każde F-NN ma te pola oraz `Unlocks`.
4. **Pokrycie PRD** — każdy FR `must-have` z PRD (grep `^- FR-\d{3}: .* must-have$`) występuje w `PRD refs` co najmniej jednego wycinka. Tak samo dla każdego `### US-NN:`. Jeśli must-have nie jest pokryty, samokontrola kończy się BŁĘDEM.
5. **Integralność grafu zależności** — brak cykli. Każde ID wymienione w `Prerequisites` istnieje gdzieś w dokumencie. Kolejność w `## Foundations` i `## Slices` jest sortowaniem topologicznym: żaden wycinek nie zależy od czegoś, co występuje po nim.
6. **Zgodność tabeli At-a-glance** — wiersze tabeli odpowiadają treści sekcji. `Change ID`, `Prerequisites`, `PRD refs`, `Status` każdego wiersza odpowiadają polom treści dosłownie.
7. **Spójność statusów** — każdy wycinek `blocked` ma co najmniej jedną Unknown z `Block: yes`. Każdy wycinek `ready` ma wszystkie Prerequisites już w stanie `done` (obecnie oznacza to: brak Prerequisites LUB Prerequisites są wyłącznie foundations, które punkt bazowy zgłasza jako `present`).
8. **Brak wymyślonych wycinków** — `PRD refs` każdego wycinka zawiera co najmniej jedno rzeczywiste ID kotwicy źródłowej: ID PRD (`FR-\d{3}` lub `US-\d{2}`) dla kamieni milowych pochodzących z PRD albo kotwicę karty `MS-\d{2}` dla kamieni milowych pochodzących z opisu. Mieszane źródła mogą mieszać rodzaje ID, ale każda kotwica musi istnieć w dokumencie źródłowym lub karcie `## Milestone`.
9. **Spójność Baseline ↔ Foundations** — żadne Foundation nie tworzy ponownie szkieletu warstwy, którą sekcja `## Baseline` zgłasza jako `present`. Jeśli punkt bazowy mówi, że auth istnieje, a mimo to istnieje `F-NN` dla szkieletu auth, jest to błąd samokontroli (albo punkt bazowy jest błędny, albo foundation jest zbędne).
10. **Kontrakt umożliwiający Foundation** — każde Foundation ma `Unlocks` wypełnione co najmniej jednym downstreamowym `S-NN`, nazwaną blokującą niewiadomą albo nazwaną ścieżką weryfikacji. Generyczne foundation takie jak „database layer” bez downstreamowego powodu jest błędem samokontroli.
11. **Integralność Change ID** — każde F-NN i S-NN ma unikalne Change ID w kebab-case; każde F-NN i S-NN pojawia się dokładnie raz w `## Backlog Handoff`; każdy wiersz handoff odnosi się do istniejącego ID mapy drogowej i powtarza to samo Change ID. Żadnych spacji, dat, etykiet statusu ani ID mapy drogowej jako change ID.
12. **Równowaga granularności wycinków** — żadne `S-NN` nie może pochłaniać większości nietrywialnego PRD, gdy sąsiednie wycinki są wąskimi resztkami. Jeśli jeden wycinek odnosi się do większości FR must-have, więcej niż dwóch niepowiązanych wpisów US-NN, wielu głównych działań użytkownika albo niepowiązanych ryzyk/niewiadomych, samokontrola kończy się BŁĘDEM, chyba że PRD naprawdę ma tylko jeden przepływ pracy widoczny dla użytkownika. Napraw przez podział na węższe pionowe rezultaty, nie przez tworzenie wycinków warstw.
13. **Limit zakresu Foundation** — żadne Foundation nie może ukończyć całej warstwy z wyprzedzeniem. Outcome i Risk muszą pokazywać minimalny kontrakt umożliwiający, a `Unlocks` musi nazywać pionowe wycinki, które nadal zintegrują tę warstwę przez zachowanie użytkownika. Jeśli Foundation brzmi jak „build the data/API/UI/auth layer”, samokontrola kończy się BŁĘDEM. Podziel je, zawęź albo przenieś minimum wymaganej pracy do pierwszego konsumującego `S-NN`.
14. **Stopniowe ujawnianie elementów technicznych** — każdy przekrojowy element techniczny pojawia się albo w pierwszym pionowym wycinku, który go potrzebuje, albo w Foundation wymaganym przed tym wycinkiem do zaplanowania, weryfikacji lub zapewnienia bezpieczeństwa. Jeśli element techniczny jest wprowadzony tylko dlatego, że będzie użyteczny później, samokontrola kończy się BŁĘDEM, a praca przechodzi do pierwszego wycinka, który faktycznie go używa.
15. **Pokrycie Streams** (tylko jeśli wygenerowano sekcję `## Streams`) — każde `F-NN` i każde `S-NN` wymienione w `## At a glance` pojawia się dokładnie w jednym polu `Chain` strumienia. Duplikaty i pominięcia kończą się błędem. Pola Chain odnoszą się tylko do istniejących ID mapy drogowej (bez wymyślonych ID). Liczba strumieni wynosi 2–5. Jeśli dokument ma < 2 kandydackie strumienie, sekcja powinna zostać pominięta (limit Kroku 6h).
16. **Integralność kamienia milowego** — `milestone_status` podczas generowania to `open`; `milestone_seq` jest o 1 większe od najwyższego zamkniętego `M-<seq>` w `## Milestone History` (1, gdy historia jest pusta); `M-<seq>` karty `## Milestone` odpowiada `milestone_seq`; każda kotwica `MS-NN`, do której odnosi się dowolny wycinek, istnieje w karcie; `## Milestone History` zostało przeniesione dosłownie (nigdy nieedytowane, nigdy nieskrócone) przy ponownym generowaniu i otwarciu następnego kamienia milowego.
17. **Terminy strategiczne są definiowane inline** — przeskanuj wygenerowaną treść pod kątem listy żargonu z bariery 13; każdy wymieniony termin, który występuje, musi zawierać jednolinijkową definicję przy **pierwszym** wystąpieniu (identyfikatory takie jak `FR-001`/`S-02` i nazwy własne narzędzi/usług są wyłączone). Niezdefiniowane pierwsze użycie kończy się BŁĘDEM; termin, którego nie da się zdefiniować w jednym zdaniu, zastępuje się prostym językiem i generuje ponownie.

Jeśli dowolna kontrola nie powiedzie się, **przerwij zapis** i zgłoś konkretny błąd:

```
Samokontrola mapy drogowej NIE POWIODŁA SIĘ:

  - <konkretny błąd, np. "FR-007 (must-have) nie jest pokryty przez żaden wycinek"
     lub "Wycinek S-04 wymienia S-06 w Prerequisites, ale S-06 występuje później w dokumencie"
     lub "F-02 (auth scaffold) jest zbędne — Baseline zgłasza obecność auth">
  - ...

Mapa drogowa NIE została zapisana. Napraw błąd i wygeneruj ponownie albo — jeśli
kontrola jest błędna — zgłoś błąd umiejętności. Przerwania samokontroli chronią
narzędzia downstream przed dryfem.
```

Następnie ZATRZYMAJ SIĘ.

### Krok 9: Kontrola kolizji

**Pomiń ten krok podczas otwierania następnego kamienia milowego po zamknięciu poprzedniego** (`CLOSED → ACTIVE` w `references/milestone-state.md`): nowy kamień milowy kontynuuje mapę drogową i jest zapisywany w miejscu. Ten krok obejmuje ponowne generowanie — ponowną dekompozycję otwartego kamienia milowego lub zastępowanie starszej mapy drogowej — oraz niezależną mapę drogową, o którą użytkownik wyraźnie poprosił.

```bash
test -f context/foundation/roadmap.md
```

Jeśli plik nie istnieje, zapisz do `context/foundation/roadmap.md` i przejdź do Kroku 10.

Jeśli plik istnieje, konwencją dokumentów foundation jest **edycja w miejscu** dla przyrostowego dopracowania oraz **archiwizacja, a potem zastąpienie** dla pełnego ponownego generowania. Ta umiejętność tworzy *pełną* mapę drogową z PRD; chirurgiczne dopracowanie jest poza zakresem. Dlatego domyślnie archiwizuj, a następnie zastępuj, ale zapytaj przy użyciu wybranego narzędzia pytań interaktywnych:

Pytanie interaktywne:
- pytanie: „context/foundation/roadmap.md już istnieje. Jak chcesz postąpić?”
  nagłówek: „Kolizja”
  opcje:
  - etykieta: „Zarchiwizuj i zastąp (Rekomendowane)”
    opis: „Przenieś istniejący plik do context/foundation/archive/<today>-roadmap.md, a następnie zapisz nową mapę drogową. Historia zachowana zgodnie z konwencją foundation README.”
  - etykieta: „Nadpisz bez archiwizacji”
    opis: „Zastąp w miejscu. Istniejąca zawartość zostanie utracona (chyba że została zatwierdzona w commicie). Używaj tylko, jeśli istniejąca mapa drogowa jest pusta lub robocza.”
  - etykieta: „Anuluj”
    opis: „Wyjdź bez zapisu. Bez rozwiązania kolizji.”
  multiSelect: false

Po „Zarchiwizuj i zastąp”: utwórz `context/foundation/archive/`, jeśli brakuje, przenieś istniejący plik do `context/foundation/archive/<today>-roadmap-<milestone_id>.md` (dzisiejsza data w `YYYY-MM-DD`; usuń przyrostek `-<milestone_id>` dla starszych plików bez niego), a następnie zapisz nową zawartość. Jeśli plik już istnieje pod tą ścieżką archiwum (wygenerowano ponownie dwa razy jednego dnia), dodaj `-2`, `-3` itd.

Po „Nadpisz bez archiwizacji”: zapisz nową zawartość, nadpisując w miejscu.

Po „Anuluj”: ZATRZYMAJ SIĘ.

### Krok 10: Przekaż dalej

Po zapisaniu podsumuj:

```
═══════════════════════════════════════════════════════════
  MAPA DROGOWA WYGENEROWANA
═══════════════════════════════════════════════════════════

  Projekt:            <project>
  Kamień milowy:      M-<seq>: <name>  (<milestone_id>)  —  open
  Ścieżka:            context/foundation/roadmap.md
  Główny cel:         <main_goal>            (nastawienie sekwencjonowania)
  Blokada nr 1:       <top_blocker>          (co uwzględnić w planowaniu)
  Baseline present:   <warstwy zgłoszone jako present, rozdzielone przecinkami>
  Foundations:        <count>
  Wycinki:            <count>
  Rozkład statusów:   ready: N  |  proposed: M  |  blocked: K
  Pokrycie PRD:       <covered must-have FRs> / <total must-have FRs>
  Otwarte pyt. mapy:  <count>
  Parked items:       <count>

  Gwiazda przewodnia: <Slice ID> — <Outcome>

═══════════════════════════════════════════════════════════
```

Następnie **zarekomenduj jeden następny ruch** — nie oddawaj listy „ready” i nie proś użytkownika o wybór. Wybierz jeden element mapy drogowej do zaplanowania jako pierwszy i uzasadnij go w jednej linii. Użytkownik może to nadpisać, ale domyślna powierzchnia to rekomendacja, nie menu.

**Reguła wyboru rekomendowanego następnego ruchu** (stosuj kolejno, wygrywa pierwsze dopasowanie):

1. Jeśli gwiazda przewodnia ma status `ready`, zarekomenduj ją. Gwiazda przewodnia jest kamieniem milowym walidacji; jej odroczenie traci sygnał.
2. W przeciwnym razie, jeśli Foundation, od którego gwiazda przewodnia bezpośrednio zależy, ma status `ready`, zarekomenduj to Foundation i wyraźnie powiedz „this unlocks the north star <S-NN>”.
3. W przeciwnym razie, jeśli żaden wycinek nie ma statusu `ready`, zarekomenduj rozwiązanie Otwartego pytania lub Blockera o najwyższej dźwigni (tego, który odblokowuje najwięcej downstreamowych elementów). Do tego czasu nie jest dostępny żaden ruch planistyczny.
4. W przeciwnym razie zarekomenduj wycinek `ready`, który odblokowuje najwięcej downstreamowych elementów (najwyższy fan-out w grafie zależności). Remisy rozstrzygaj według głównego celu (Krok 6d).

Format:

```
► **Twój następny ruch:** `/10x-plan <change-id>` dla **<Roadmap ID>: <Outcome>**.

  Dlaczego właśnie to najpierw: <jedno zdanie — kluczowy powód: to JEST gwiazda
  przewodnia / odblokowuje gwiazdę przewodnią / ma najwyższy fan-out / to
  najmniejsza walidacja end-to-end, którą możemy dostarczyć teraz>.

  Następnie, w kolejności: <next ready ID>: <Outcome> → <next>: <Outcome>.
  (Pełna lista w `## Backlog Handoff`.)

  Zablokowane — pozostają zaparkowane, aż ich Unknowns zostaną rozwiązane:
    - <Slice ID>: <Unknown> (Owner: <who>)
    - ...
  (Rozwiązanie którejkolwiek z nich promuje jej wycinek do `ready` i zmienia moją
  rekomendację; wróć, a zarekomenduję ponownie.)
```

Jeśli żaden wycinek nie ma statusu `ready` i żadne Foundation także nie ma statusu `ready` (przypadek 3), zastąp rekomendację przez:

```
► **Żaden ruch planistyczny nie jest jeszcze dostępny.** Każdy wycinek jest zablokowany.
  Niewiadoma o najwyższej dźwigni do rozwiązania jako następna:

    <Question> — Owner: <who>. Unblocks: <S-NN, S-MM, ...>.

  Rozwiązanie tego promuje <count> wycinków i jest pojedynczą zmianą, która
  najbardziej otwiera mapę drogową. Rozwiąż to, a następnie ponownie wywołaj
  `/10x-roadmap`, aby otrzymać nową rekomendację.
```

ZATRZYMAJ SIĘ. Nie przechodź automatycznie do innej umiejętności — użytkownik wybiera, kiedy planować. Ale NIE degraduj rekomendacji do listy wielokrotnego wyboru; jeśli użytkownik chce inny wycinek, sam to powie.

## Krytyczne bariery

1. **Materiały źródłowe są źródłem.** Każdy wycinek prowadzi do ID kotwicy źródłowej — ID PRD (`FR-NNN`/`US-NN`) dla kamieni milowych pochodzących z PRD, kotwic karty `MS-NN` dla pochodzących z opisu. Ramowanie z Kroku 5 ujawnia kontekst celu/gwiazdy przewodniej/inwestycji/blokady wywnioskowany ze źródeł; punkt bazowy ujawnia to, co już istnieje; żadne nie rozszerza źródeł. Elementy mapy drogowej bez śladu źródłowego są błędem samokontroli.

2. **Najpierw pionowe wycinki.** Wycinek dostarcza widoczną dla użytkownika możliwość end-to-end. Horyzontalne wycinki („the API layer”, „the schema”) są antywzorcem, któremu ta umiejętność ma zapobiegać. Foundations są *jedynym* wyjątkiem — są jawnie przekrojowymi elementami umożliwiającymi, znajdują się we własnej sekcji, zawierają `Unlocks` i są oznaczone `(foundation)`, aby żaden czytelnik nie pomylił ich z pracą skierowaną do użytkownika.

3. **Zrównoważona granularność bez estymacji.** Wycinki nie otrzymują etykiet rozmiaru, ale ich zakres nadal musi być porównywalny. Mapa drogowa, w której `S-01` zawiera niemal cały PRD, a `S-02`/`S-03` są drobnymi resztkami, jest złą mapą drogową. Dziel za duże elementy według węższych rezultatów widocznych dla użytkownika, faz przepływu pracy, person lub granic ryzyka — nigdy według warstwy technicznej.

4. **Foundations są minimalnymi odblokowaniami, nie projektami ukończenia warstwy.** Foundation może tworzyć najmniejszy warunek wstępny potrzebny, zanim pionowa praca może ruszyć. Nie może wstępnie budować całej warstwy bazy danych/API/UI/auth. Jeśli element techniczny może zostać wprowadzony wewnątrz pierwszego wycinka skierowanego do użytkownika, który go potrzebuje, umieść go tam; utrzymuje to integrację pionową i stopniowo ujawnia tylko potrzebne elementy.

5. **Bez estymacji, bez jednostek czasu.** Żadnego „Day 1”, żadnych „2 weeks”, żadnych „small/medium/large”, żadnych punktów. Wykonanie przez agentów AI jest nieliniowe, a estymacje oparte na budżecie czasu kłamią. Kolejność jest zakodowana w Prerequisites; tempo ujawnia się przez Blockers i Unknowns. Mapa drogowa opisuje kształt, nie harmonogram.

6. **Bez szczegółów technicznych niskiego poziomu.** Bez nazw frameworków (są w `tech-stack.md`), bez ścieżek plików, definicji schematów, kodu ani wyborów bibliotek. Jeśli zaczynasz je pisać, przeszedłeś na terytorium `/10x-plan` — zatrzymaj się i pozwól `/10x-plan` wykonać swoją pracę downstream.

7. **Ujawniaj niewiadome, nie maskuj ich.** Unknowns przypisane do wycinków z `Block: yes` promują `Status: blocked`. Przekrojowe niewiadome trafiają do `## Open Roadmap Questions`. Jeśli PRD ma TODO, mapa drogowa dziedziczy je jako niewiadome zablokowanych wycinków. Wartość mapy drogowej częściowo polega na pokazaniu użytkownikowi, co NIE jest jeszcze możliwe do zaplanowania.

8. **Punkt bazowy jest badany automatycznie, nie zadawany.** Nie pytaj użytkownika „what's already in place?” — uruchom równoległe subagenty Explore (Krok 4) i pozwól kodowi odpowiedzieć. Następnie zapytaj użytkownika tylko o potwierdzenie lub korektę. To kontrakt, który czyni Foundations uczciwymi: foundation istnieje tylko wtedy, gdy punkt bazowy mówi, że warstwa jest absent lub partial.

9. **Samokontrola przerywa przy dryfie.** Brak wymaganych sekcji, uszkodzony graf zależności, niepokryte FR must-have, wymyślone wycinki, za duże wycinki, ukończenie warstwy przez Foundation, sprzeczności Baseline-vs-Foundations — wszystko przerywa zapis z konkretnym błędem. Bez cichego łatania.

10. **Konwencja dokumentów foundation.** `roadmap.md` jest dokumentem foundation zgodnie z `context/foundation/README.md`. Domyślna obsługa kolizji to archiwizacja, a następnie zastąpienie (historia trafia do `foundation/archive/<today>-roadmap.md`). Następny kamień milowy nie jest kolizją — kontynuuje mapę drogową w miejscu i pomija Krok 9 (zobacz `references/milestone-state.md`). Chirurgiczne dopracowanie jest poza zakresem tej umiejętności (edytuj ręcznie, jeśli go potrzebujesz).

11. **Tylko uniwersalny język.** W żadnym wyniku skierowanym do użytkownika ani artefakcie zapisanym na dysku nie mogą występować odniesienia do 10xDevs / cohort / certification. Umiejętność jest ogólnym generatorem map drogowych.

12. **Nigdy nie łańcuchuj automatycznie.** Krok 10 jest ogłoszeniem, nie wywołaniem. Użytkownik wybiera, kiedy (i który) wycinek przekazać do `/10x-plan`. Automatyczne łańcuchowanie pominęłoby ludzką recenzję wygenerowanej mapy drogowej.

13. **Definiuj terminy strategiczne inline przy pierwszym użyciu.** Słownictwo strategii produktu — `wedge`, `beachhead`, `north star`, `validation milestone`, `primary metric`, `must-have path`, `product-market fit`, `thin end of the wedge`, `riskiest assumption`, `core hypothesis` — jest skrótem wewnętrznym umiejętności i PRD, a nie powszechną wiedzą; mapa drogowa musi być czytelna od zera dla kolegi z zespołu (lub przyszłego siebie), który nie ukończył kursu strategii produktu. Przy PIERWSZYM wystąpieniu dowolnego takiego terminu w treści dokumentu dołącz jednolinijkową definicję inline (w nawiasie, objaśnieniu po półpauzie lub krótkim zdaniu następującym); nie powtarzaj jej później. Jeśli pojęcia nie da się zdefiniować w jednym zdaniu, zastąp je prostym językiem („the smallest end-to-end flow that proves the product works” jest lepsze niż „the wedge”, którego nie da się skompresować do jednej klauzuli). Dotyczy prozy skierowanej do użytkownika w wygenerowanym dokumencie — nie pytań wywiadu (obejmuje je 5g) ani semantyki pól tego pliku. Egzekwuje to kontrola samokontroli nr 17.

14. **Zwięzły wywiad z silnymi Rekomendacjami — nie ciche automatyczne ramowanie ani nieograniczone odkrywanie.** Reguły Kroku 5 są normatywne: maksymalnie 3 pytania kotwiczące (`main_goal`, `north_star`, `top_blocker`), obszary inwestycji wyprowadzane, nie pytane, każde pytanie zawiera jedną Rekomendację opartą na cytowanej linii artefaktu oraz 1–2 rzeczywiste alternatywy (chochoły zakazane), pominięcia tylko wtedy, gdy artefakty dosłownie wskazują wartość, dopytania tylko w ramach wyjątku niestandardowego MVP (5f). Rekomendowany następny ruch z Kroku 10 to ta sama zasada zastosowana do przekazania: jedna rekomendacja z jednolinijkowym powodem, nie lista „ready to plan”, którą użytkownik musi triage’ować.

15. **Kamienie milowe tworzą pętlę, ale nigdy nie są ograniczone czasem.** Dokładnie jeden kamień milowy jest otwarty naraz; zamyka się wyłącznie, gdy każde F-NN/S-NN ma status `done` (lub użytkownik jawnie go porzuci), następnie pętla otwiera się ponownie ze świeżymi materiałami źródłowymi lub opisem użytkownika. Stan kamienia milowego jest wyprowadzany wyłącznie z `roadmap.md` — bez dodatkowych plików. Specyfikacja cyklu życia znajduje się w `references/milestone-state.md`, ładowanym WYŁĄCZNIE dla operacji na poziomie kamienia milowego (dyspozycja Kroku 0). Umiejętności downstream pozostają nieświadome kamieni milowych; ta umiejętność wykrywa ukończenie kamienia milowego przy następnym wywołaniu.

## Uwagi

- Ta umiejętność jest **generatorem dokumentu oraz trackerem kamieni milowych**. Wynikiem jest `context/foundation/roadmap.md`, kropka. Planowanie poszczególnych zmian znajduje się downstream w `/10x-plan`.
- Sonda punktu bazowego (Krok 4) zastępuje dawne pytanie „what's already in place?”. Subagenci są tańsi niż uwaga użytkownika, a kod jest bardziej wiarygodny niż pamięć.
- Gdy umiejętność generuje ponownie istniejącą mapę drogową, zarchiwizowana poprzednia wersja jest najczystszym celem diff do zobaczenia, jak zmieniło się rozumienie projektu — to udogodnienie, dla którego zaprojektowano konwencję dokumentów foundation.