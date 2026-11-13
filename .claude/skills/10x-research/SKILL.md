---
name: 10x-research
description: Investigate codebase questions with source-backed findings, scoped research and parallel sub-agents. Save research for implementation planning.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Agent
  - Task
  - Write
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---
# Badanie bazy kodu

Odpowiedz na pytanie badawcze użytkownika, korzystając z aktualnych ustaleń popartych źródłami. Zachowaj implementację, decyzje produktowe i zmiany cyklu życia poza zakresem badania, chyba że zostaną osobno zażądane.

## Zacznij od dostarczonego żądania

Jeśli dostarczono pytanie, change-id lub plik, zacznij od tego kontekstu; nie pytaj ponownie
o to samo żądanie. Dla `/10x-research <change-id>` użyj artefaktów
request/change/frame aktywnej zmiany, aby ustalić pytanie. Zapytaj o brakujące
pytanie tylko wtedy, gdy ani wiadomość, ani te artefakty go nie definiują.

Rozwiąż aktywną zmianę przed jakimikolwiek zapisami. Jawnie zarchiwizowana zmiana jest
tylko do odczytu: wyjaśnij, że potrzebna jest nowa zmiana, i zatrzymaj się przed zapisem.
Jeśli nie podano change-id, wyprowadź go z tematu podczas zapisywania dokumentu.

## 1. Ustal dowody i zakres

- Jeśli użytkownik wspomina konkretne pliki (tickety, dokumenty, JSON), najpierw przeczytaj je W CAŁOŚCI (bez limitu/offsetu)
- **KRYTYCZNE**: Przeczytaj te pliki samodzielnie w głównym kontekście przed uruchomieniem jakichkolwiek podzadań

Przeczytaj `context/foundation/lessons.md`, jeśli istnieje, i traktuj jego wpisy jako wcześniejsze znane wzorce podczas kształtowania obszarów badawczych — powtarzające się reguły już zaakceptowane przez zespół zawężają to, co warto ponownie badać.

Prowadź zwięzłą listę pytań wymagających odpowiedzi, istniejących dowodów, nierozstrzygniętych
sprzeczności i kolejnych sprawdzeń. Ukierunkowane pytanie może wymagać jednego lokalnego wyszukania;
kompleksowy zakres domyślnie wymaga objęcia każdego uzgodnionego obszaru,
delegowanego równolegle (krok 2).

Doprecyzuj tylko taką niejednoznaczność, która istotnie zmieniłaby badanie. Użyj
rzeczywistego narzędzia hosta do pytań strukturalnych, gdy jest dostępne (Claude AskUserQuestion,
Codex request_user_input, OpenCode question), przestrzegając jego schematu, wielkości rundy i
niestandardowego wejścia. Używaj krótkich nagłówków (maksymalnie 12 znaków) oraz konkretnych opcji z
opisami. W hoście bez takiej możliwości zadaj zwięzłe pytanie tekstowe w celu
wymaganego doprecyzowania zakresu; nie symuluj wywołania narzędzia. Jednoznaczne żądanie badawcze
nie wymaga wywiadu ani zmiany trybu. Preferencje użytkownika są decyzjami; zweryfikuj
skorygowane twierdzenia faktyczne względem wskazanego źródła.

## 2. Wybierz i przeprowadź badanie

Pracuj lokalnie dla pojedynczego zlokalizowanego faktu lub rozumowania sekwencyjnego. Kompleksowe lub
wieloobszarowe badanie jest domyślnie delegowane, a nie traktowane jako wyjątek. Przed pierwszym
przydzieleniem przeczytaj [references/task-orchestration.md](references/task-orchestration.md)
i stosuj jego ograniczone przydziały, sprawdzenia dostępnego modelu/możliwości, awaryjne
rozwiązania oraz wymagania dotyczące dowodów. Uruchom 2–4 pracowników równolegle w jednej
wiadomości, każdego dla innego wymiaru badawczego, i poproś każdego o kotwice `file:line`
— na przykład jednego do zlokalizowania każdego pliku związanego z X, jednego do wyszukania wcześniejszych
decyzji dotyczących Y w `context/changes/**/` i `context/archive/**/`, jednego do przeanalizowania,
jak działa podsystem Z. Wysyłaj mniej tylko wtedy, gdy zakres rzeczywiście obejmuje
jeden obszar albo gdy luka zależy od warunku wstępnego, który nadal nie został rozwiązany.
W Claude Code deleguj za pomocą narzędzia `Agent` (`Task` w starszych wersjach Claude Code)
— `subagent_type: "Explore"` do lokalizowania kodu, `"general-purpose"`
do analizy; w innych hostach użyj natywnego odpowiednika. Używaj śledzenia zadań, gdy
pomaga koordynować kilka obszarów i host je udostępnia; w przeciwnym razie wystarcza lista
robocza.

Główny agent odpowiada za pytanie i syntezę. Agenci podrzędni prowadzą badanie tylko do odczytu
i zwracają kotwice, niepewność oraz faktyczny zakres objęcia. Nie proś każdego pracownika o
przeczytanie całego repozytorium lub tych samych dużych dokumentów. Kontynuuj niezależną pracę,
gdy działają; analizuj istotne dowody, gdy pojawiają się wyniki. Poczekaj na ukończenie przez WSZYSTKICH
uruchomionych pracowników przed syntezą — częściowe przeszukanie to wskazana luka, a nie odpowiedź.

Przy kontynuacji lub korekcie zakresu zaktualizuj dotknięte pytania i pracowników, zachowując
niepowiązane ustalenia. Późna odpowiedź oparta na zastąpionym zakresie nie może nadpisać
nowej decyzji. Podejmij dalsze kroki wobec konkretnej luki zamiast ponownie rozpoczynać szerokie poszukiwania.

## 3. Dokonaj syntezy i zakończ odkrywanie

Połącz dowody w odpowiedź na pierwotne pytanie. Rozróżniaj zaobserwowane
zachowanie, wnioski i nierozstrzygnięte fakty. Sprawdź rozstrzygające/sprzeczne ścieżki kodu
i wywołujących; sam brak wyników wyszukiwania nie dowodzi nieobecności. Cytuj sprawdzony zakres
przy formułowaniu negatywnego ustalenia. Poszerzaj zakres tylko wtedy, gdy może to rozstrzygnąć uzgodnione pytanie
lub istotną sprzeczność, a nie po to, by wypełnić opcjonalną sekcję dokumentu.

Gdy wymagane są rekomendacje, zachowaj ustalone wymagania i odrzucaj opcje, które osłabiają wymagane gwarancje. Rozróżniaj ustalone decyzje, rzeczywiste wybory i brakujące dowody.

Zatrzymaj się, gdy uzgodnione pytania mają wystarczające dowody, a znaczące konflikty
zostały rozwiązane. Zamknij lub anuluj przestarzałe zadania. Nadal brakujące wymagane dowody
oznaczają częściowe ustalenie z określoną luką i jej wpływem; nie twierdź, że praca została ukończona,
ani nie uruchamiaj bez końca równoważnych wyszukiwań. Nie uruchamiaj buildów ani testów,
chyba że ich wyniki odpowiadają na konkretne pytanie badawcze i host na to pozwala.

## 4. Zapisz i zweryfikuj artefakt badawczy

Gdy zapisy w repozytorium są dozwolone, zapisz
`context/changes/<change-id>/research.md`, zachowując istniejący materiał i edycje użytkownika.
Utwórz aktywny folder i `change.md` tylko wtedy, gdy ich brakuje, zgodnie z semantyką
`/10x-new`. Nigdy nie nadpisuj innej zmiany ani nie zapisuj w `context/archive/`.
Na tym etapie przeczytaj [references/research-document.md](references/research-document.md)
dla formatu wyjściowego; nie ładuj go wyłącznie na potrzeby odkrywania źródeł.

Przed zapisaniem `research.md` zastosuj kontrole ograniczonych twierdzeń i prozy/JSON z
tej referencji. Każde ilościowe lub uniwersalne twierdzenie w prozie wymaga jawnego
warunku, kwantyfikatora (dokładny zbiór, liczba lub „ta sprawdzona ścieżka”) oraz kotwicy
źródłowej. Nie pisz „zawsze”, „nigdy”, „każdy”, „tylko” ani „przy pierwszej próbie”,
chyba że nazwany warunek i sprawdzona ścieżka rzeczywiście mają taki zakres. Rozstrzygaj
każde twierdzenie historyczne osobno: dokument nieaktualny pod względem liczebności może nadal
być poprawny w innym polu; lista pozytywna nie jest zbiorem wyłącznym, chyba że
źródło tak stwierdza.

Gdy zażądano pliku faktów strukturalnych (JSON lub tabeli), przed zapisaniem któregokolwiek pliku
wykonaj osobne przejście proza-kontra-JSON: dla każdego liścia sformułuj
zdanie w prozie, które dana wartość oznaczałaby, gdyby była prawdziwa, potwierdź, że to samo zdanie jest w
`research.md`, i potwierdź, że wartość JSON odpowiada temu samemu źródłu. Zgodność JSON
nie poświadcza otaczającej prozy. Uruchom raz dołączony sprawdzacz Node:

```sh
node <loaded-skill-dir>/scripts/prose-json-check.mjs <research.md> <facts.json>
```

Sprawdza on jedynie, czy każda liczba i wartość logiczna JSON występuje w prozie; nie
dowodzi poprawności kwantyfikatorów. Brakujące liście lub dodatkowe uniwersalne sformułowania nadal wymagają
ręcznej korekty. Jeśli Node jest niedostępny, wykonaj tę samą listę kontrolną ręcznie.

Zbierz metadane z rzeczywistego repozytorium i bieżącego zegara tylko raz; nie twórz fikcyjnych
informacji o branchu, commicie, znaczniku czasu ani tożsamości badacza. Zapisuj metadane change.md
**wyłącznie** za pomocą dołączonego [scripts/metadata-guard.mjs](scripts/metadata-guard.mjs)
z Node — nigdy nie przepisuj istniejącego YAML z szablonu ani nie usuwaj pól tożsamości:

```sh
node <loaded-skill-dir>/scripts/metadata-guard.mjs inspect <change-dir>
node <loaded-skill-dir>/scripts/metadata-guard.mjs mark-researched <change-dir> --expected-sha256 <inspected-change-sha256> --date <YYYY-MM-DD>
```

`mark-researched` przesuwa tylko `new` do `preparing`, ustawia `updated` na dzisiaj, dodaje
brakujące posiadane pola i zachowuje `change_id`, `title`, `created`, niezwiązany YAML,
treść oraz późniejsze stany cyklu życia. Wymaga zapisanego `research.md`. Nieaktualny odcisk
wymaga ponownego przeczytania zmienionych metadanych. Jeśli Node jest niedostępny lub składnia nie jest obsługiwana,
sprawdź plik i dokonaj wyłącznie tej samej wąskiej edycji statusu/daty; nigdy nie zastępuj
frontmatter. Pomocnik używa optymistycznych odcisków i atomowego zastępowania, a nie
transakcji z zewnętrznymi edytorami. Dokument badawczy może być kompletny lub częściowy
niezależnie od cyklu życia zmiany.

Przejrzyj końcowy artefakt raz, aby sprawdzić jego odpowiedź, cytowania, luki i metadane:
odczytaj z powrotem zapisaną treść albo przejrzyj kompletny szkic, gdy prezentujesz go niezapisany
w rozmowie. W tym samym przebiegu ponownie wykonaj kontrolę ograniczonych twierdzeń oraz
listę kontrolną proza/JSON (nie pomijaj jej, ponieważ pierwszy szkic już istniał):

- Przed wyprowadzeniem wyniku powiąż przykład liczbowy z jego nazwanymi wejściami, jednostkami i warunkami;
  rozróżniaj sumy od dodatkowych operacji. Nie wnioskuj znaczenia wartości
  wyłącznie z nazwy pola lub znajomej liczby.
- Dla każdej istotnej wartości logicznej opisz twierdzenie, które oznaczałaby, gdyby była prawdziwa,
  a następnie sprawdź, czy przejrzane źródło potwierdza to twierdzenie przed przypisaniem
  wartości. Pole opisujące, czy twierdzenie historyczne jest poparte, odpowiada na
  pytanie o to poparcie, a nie na pytanie, czy dokument historyczny zawiera to twierdzenie.
- Poprawiaj twierdzenia historyczne indywidualnie. Niektóre twierdzenia w nieaktualnym dokumencie mogą
  nadal obowiązywać: dołącz bieżący werdykt do każdego istotnego twierdzenia historycznego
  zamiast oznaczać cały akapit jako nieaktualny. Prześledź istotnych konsumentów, zanim uznasz
  współdzieloną regułę za wyłączną dla jednego komponentu. Preferuj dokładnie zaobserwowany zbiór lub
  predykat zamiast szerszego sformułowania, takiego jak „wszystkie błędy” lub „każdy status w klasie”.

Wykorzystaj ponownie kotwice źródłowe i obliczenia już zweryfikowane. Niezgodność wywołuje tylko
sprawdzenie i korektę dotkniętego źródła/wywołującego w każdym wyniku, a nie nowe przejście odkrywcze.
Jeśli pozostaje nierozstrzygnięta, opatrz twierdzenie zastrzeżeniem i konsekwentnie wskaż lukę.
Ta kontrola domyślnie nie wymaga dodatkowego artefaktu, pracownika ani uruchomienia testów.
Używaj zwięzłego wyniku walidacji zamiast wielokrotnego jego wypisywania. Uruchom wszelkie stosowne
kontrole dokumentów repozytorium raz. Dodawaj permalinki commitów tylko wtedy, gdy cytowane bajty
odpowiadają temu commitowi i wiadomo, że remote go zawiera; lokalne niezatwierdzone dowody
zachowują lokalne referencje file:line. Nie twórz permalinku na podstawie nazwy brancha.

Jeśli host zabrania zapisów, przedstaw badanie i jawny status niezapisania w
rozmowie. Nie twórz pliku zastępczego ani nie deleguj zapisu. Wznów zapisywanie w trybie umożliwiającym zapis
w tej samej rozmowie po sprawdzeniu bieżących plików docelowych i dostępnego kontekstu; nie rozpoczynaj
ponownie ustalonego badania ani nie obiecuj odzyskania brakującej treści rozmowy.

## 5. Przedstaw ustalenia i obsłuż kontynuacje

Zacznij od odpowiedzi, lokalizacji artefaktu lub stanu niezapisania, rozstrzygających referencji i
istotnych ograniczeń. Badanie nie oznacza zatwierdzenia planu ani implementacji.
Przy przekazaniu do planowania przedstaw ustalone fakty, ich źródła, dotknięte kontrakty
i nierozstrzygnięte wybory produktowe, aby `/10x-plan` mógł na nich budować bez ponownego odkrywania.

Dopisz ustalenia z kontynuacji do tego samego dokumentu badawczego, zaktualizuj `last_updated`,
`last_updated_by` i `last_updated_note`, a także wskaż wnioski zastąpione przez
nowe dowody. Wykorzystaj ponownie niezmienione wyniki; badaj tylko nowe lub unieważnione
pytania. Zachowaj zakres, uprawnienia hosta i wszelkie wprowadzone pośrednio edycje ludzkie.