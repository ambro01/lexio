# Wyjaśniacz Skilli

Przeanalizuj skill, aby zrozumieć jego mechanikę, uzasadnienie projektowe oraz sposób budowy czegoś podobnego. Po wywołaniu odczytaj pliki źródłowe docelowego skilla i przygotuj ustrukturyzowany raport, który wyjaśnia, jak skill działa i dlaczego został zbudowany w ten sposób.

## Dane wejściowe

Użytkownik podaje nazwę skilla (np. `10x-plan`, `10x-shape`, `10x-new`). Akceptuj ją jako:
- Samą nazwę: `10x-plan`
- Nazwę z prefiksem ukośnika: `/10x-plan`
- Ścieżkę do pliku SKILL.md: `~/.claude/skills/10x-plan/SKILL.md`

Jeśli nie podano nazwy skilla, zapytaj:

```
Który skill chcesz, żebym wyjaśnił? Podaj nazwę skilla (np. `10x-plan`) lub ścieżkę do jego pliku SKILL.md.
```

Następnie poczekaj.

## Wykrywanie

Znajdź pliki źródłowe skilla:

1. **Zlokalizuj SKILL.md.** Wypróbuj te ścieżki w kolejności i zatrzymaj się przy pierwszym trafieniu:
   - `~/.claude/skills/<name>/SKILL.md`
   - `.claude/skills/<name>/SKILL.md` (lokalnie w projekcie)
   - `.agents/skills/<name>/SKILL.md` (Codex)
   - `.cursor/skills/<name>/SKILL.md` (Cursor)
   - Ścieżka podana przez użytkownika (jeśli podano pełną ścieżkę)

   Jeśli żadnej nie znaleziono, powiedz użytkownikowi:
   ```
   Nie udało mi się znaleźć pliku SKILL.md dla "<name>". Podaj pełną ścieżkę do pliku skilla.
   ```
   Następnie poczekaj.

2. **Przeczytaj cały plik SKILL.md** — bez obcinania, bez limitu/offsetu.

3. **Sprawdź, czy obok pliku SKILL.md znajduje się katalog `references/`.** Jeśli istnieje, wyświetl jego zawartość i w całości przeczytaj każdy znajdujący się w nim plik `.md`. Są to dokumenty towarzyszące (schematy, szablony, rejestry), które definiują kontrakty egzekwowane przez skill.

## Analiza

Po przeczytaniu wszystkich plików źródłowych przygotuj poniższy raport. Dostosuj poziom szczegółowości do złożoności skilla:

| Rozmiar skilla | Szczegółowość |
|-----------|-------|
| Poniżej 150 linii (prosty) | Zwięzła — każda sekcja ma 3–5 zdań. Pomiń sekcje, które nie mają zastosowania (np. proste skille rzadko mają orkiestrację sub-agentów lub bramki samooceny). |
| 150–400 linii (średni) | Standardowa — każda sekcja to krótki akapit. Omów wszystkie 7 sekcji. |
| Powyżej 400 linii (złożony/orkiestrator) | Szczegółowa — tabela anatomii, konkretne odwołania do linii, rozszerzona analiza mechaniki. Wszystkie 7 sekcji w pełni. |

Nie wypełniaj prostych skilli ogólnikowymi zapychaczami. Skill mający 95 linii powinien otrzymać zwarty, skoncentrowany raport. Orkiestrator mający 831 linii powinien otrzymać dogłębne omówienie.

## Struktura raportu

Przed szczegółowymi sekcjami rozpocznij krótkim blokiem przeglądowym, który zorientuje czytelnika. Wydrukuj go dokładnie raz, na początku raportu:

```
## Sekcje w tym raporcie

1. **Problem i cel** — Dlaczego ten skill istnieje i jaki problem eliminuje
2. **Pozycja w łańcuchu** — Gdzie znajduje się w workflow: co do niego trafia i co następuje później
3. **Przegląd anatomii** — Mapa pliku SKILL.md sekcja po sekcji
4. **Kluczowa mechanika** — Mechanizmy zachowania, które napędzają ten skill, ze wskazaniem elementów o wysokiej dźwigni
5. **Decyzje projektowe** — Dlaczego zbudowano go w ten sposób, a nie inaczej — odrzucone alternatywy
6. **Przewodnik adaptacji** — Co można zmienić (łatwe / średnie / trudne) wraz z konkretnymi przykładami
7. **Budowanie czegoś podobnego** — Ścieżka krok po kroku od pustego pliku do działającego skilla podobnego do tego
```

Następnie przejdź do każdej sekcji w pełni:

### 1. Problem i cel

Odpowiedz na pytanie: **„Dlaczego ten skill istnieje?”**

Wyciągnij z deklaracji roli oraz sekcji „Kiedy używać / kiedy pomijać”:
- Jaki problem rozwiązuje ten skill? Co działo się przed jego powstaniem?
- Kiedy użytkownik powinien po niego sięgnąć? Jakie są sygnały wyzwalające?
- Kiedy użytkownik NIE powinien go używać? Jaki jest niewłaściwy kontekst?
- Co by się stało, gdyby użytkownik próbował wykonać to zadanie ręcznie, bez skilla?

Nie opisuj jedynie, co skill robi — wyjaśnij, jaki problem eliminuje.

### 2. Pozycja w łańcuchu

Odpowiedz na pytanie: **„Gdzie ten skill znajduje się w workflow?”**

Wyciągnij z sekcji „Relacja z innymi skillami”:
- **Upstream**: Jakich plików lub artefaktów ten skill oczekuje jako danych wejściowych? Który skill je tworzy? (np. `/10x-shape` tworzy `shape-notes.md`, który wykorzystuje `/10x-prd`)
- **Downstream**: Co ten skill generuje? Który skill wykorzystuje to dalej? Do jakiego pliku zapisuje dane na dysku?
- **Model przekazania**: Skille komunikują się przez pliki na dysku, a nie przez pamięć. Każdy skill zapisuje artefakt, zatrzymuje się i przekazuje kontrolę człowiekowi, zanim uruchomiony zostanie kolejny skill. Wyjaśnij, jak ten skill wpisuje się w ten łańcuch.

Gdy jest to przydatne, pokaż wizualnie pozycję w łańcuchu:
```
[skill upstream] → artefakt wejściowy → TEN SKILL → artefakt wyjściowy → [skill downstream]
```

### 3. Przegląd anatomii

Odpowiedz na pytanie: **„Jakie są sekcje tego pliku SKILL.md i co robi każda z nich?”**

Podziel SKILL.md na sekcje i dla każdej przedstaw:
- **Nazwę sekcji** oraz przybliżony zakres linii
- **Co robi** — jedno zdanie
- **Dlaczego tam jest** — co by się zepsuło lub pogorszyło, gdyby tę sekcję usunąć

Dla średnich i złożonych skilli przedstaw to jako tabelę:

| Sekcja | Linie | Cel | Dlaczego ma znaczenie |
|---------|-------|---------|----------------|
| YAML frontmatter | 1-8 | Nazwa, opis, allowed-tools | `description` kontroluje, kiedy skill się aktywuje; `allowed-tools` jest twardą granicą bezpieczeństwa |
| Deklaracja roli | 10-15 | Jednozdaniowa filozofia | Ustala osobowość zachowania skilla |
| ... | ... | ... | ... |

Cel: wyjaśnić „tysiące linii”. Pokaż uczącej się osobie, że długi skill to w rzeczywistości N sekcji, z których każda ma jasno określone zadanie. Całość jest mniej onieśmielająca niż poszczególne części.

### 4. Kluczowa mechanika

Odpowiedz na pytanie: **„Jakie 3–5 mechanizmów zachowania napędza TEN konkretny skill i które części mają największą dźwignię?”**

Ta sekcja musi być specyficzna dla analizowanego skilla — nie może być ogólną listą wzorców skilli. Przeczytaj kroki procesu i zidentyfikuj, co napędza zachowanie TEGO skilla. Dla każdego mechanizmu:

1. **Nazwij go** — nadaj wzorcowi krótką, opisową nazwę
2. **Wyjaśnij, jak działa** — 2–3 zdania o mechanizmie
3. **Wskaż miejsce** — które linie lub sekcje SKILL.md go implementują
4. **Oznacz dźwignię** — zaznacz części, w których niewielka zmiana powoduje dużą zmianę zachowania. Typowe wzorce o wysokiej dźwigni obejmują:
   - Pole `description` (kontroluje aktywację), `allowed-tools` (granica bezpieczeństwa)
   - Krytyczne zabezpieczenia (twarde reguły zachowania)
   - Szablony/schematy (kształt wyjścia, od którego mogą zależeć skille downstream)
   - Bramki samooceny (osadzone testy przed zatwierdzeniem wyniku)

Przykłady mechanizmów występujących w rzeczywistych skillach (użyj jako odniesienia, nie jako checklisty):

- **Pytania skalowane złożonością** (`10x-plan`): ocenia zadanie jako LOW/MEDIUM/HIGH, skaluje liczbę pytań, pomija pytania diagnostyczne, gdy istnieją artefakty upstream
- **Orkiestracja sub-agentów** (`10x-research`): uruchamia równoległych agentów, każdy z ukierunkowanym promptem, syntezuje ustalenia
- **Maszyna stanów sterowana postępem** (`10x-implement`): pola wyboru `## Progress` są jedynym źródłem prawdy, bez bocznego pliku stanu
- **Sokratejska pętla odkrywania** (`10x-shape`): otwarte pytanie → ujawnienie szarych obszarów → rekomendacja → zakwestionowanie → zatwierdzenie decyzji
- **Mechanizmy antybiasowe** (`10x-infra-research`): adwokat diabła, pre-mortem, kontrole krzyżowe unknown-unknowns

### 5. Decyzje projektowe

Odpowiedz na pytanie: **„Dlaczego ten skill został zbudowany WŁAŚNIE w ten sposób, a nie inaczej?”**

To sekcja odpowiadająca na pytanie „czemu skill jest tak a nie inaczej budowany”. Dla każdego istotnego wyboru strukturalnego w skillu wyjaśnij:

1. **Dokonany wybór** — co robi skill
2. **Odrzuconą alternatywę** — co mógłby robić zamiast tego
3. **Dlaczego to podejście wygrywa** — konkretny kompromis, który czyni ten wybór lepszym

Szukaj decyzji w tych obszarach (nie wszystkie będą mieć zastosowanie):

- **Dobór narzędzi**: Dlaczego właśnie te `allowed-tools`, a nie inne? (np. dlaczego brak `Agent` w skillu, który teoretycznie mógłby używać sub-agentów?)
- **Zarządzanie stanem**: Dlaczego stan w pliku zamiast stanu w pamięci lub zewnętrznego pliku sidecar?
- **Zachowanie łańcucha**: Dlaczego „STOP, do not chain” zamiast automatycznego kontynuowania? Dlaczego pliki na dysku zamiast przekazywania stanu w pamięci?
- **Strategia walidacji**: Dlaczego walidować w tym punkcie, a nie wcześniej/później? Dlaczego właśnie te konkretne kontrole?
- **Format wyjścia**: Dlaczego taka struktura szablonu? Dlaczego YAML frontmatter zamiast zwykłego markdownu? Dlaczego szablony inline zamiast plików referencyjnych?
- **Model interakcji**: Dlaczego AskUserQuestion na tym kroku? Dlaczego nie podjąć decyzji automatycznie?

Celem jest ujawnienie inżynierskiego myślenia stojącego za skillem. Osoba ucząca się, która rozumie odrzucone alternatywy, rozumie przestrzeń projektową — i może podejmować własne decyzje podczas budowania czegoś podobnego.

### 6. Przewodnik adaptacji

Odpowiedz na pytanie: **„Co mogę zmienić i jakie ryzyko wiąże się z każdą zmianą?”**

Uporządkuj według poziomu trudności, z 1–2 konkretnymi przykładami na poziom, specyficznymi dla analizowanego skilla:

**Łatwe (niskie ryzyko, natychmiastowy efekt):**
- Co zmienić: np. frazy wyzwalające w `description`, nagłówki sekcji szablonu, etykiety opcji pytań, formatowanie raportu
- Przykład: „Aby dodać polskie frazy wyzwalające, edytuj pole `description` i dodaj „stwórz plan” obok „create plan””
- Co się zepsuje przy błędzie: nic krytycznego — w najgorszym przypadku skill będzie aktywować się w niewłaściwych momentach lub formatowanie wyjścia będzie wyglądać inaczej

**Średnie (wymaga zrozumienia łańcucha):**
- Co zmienić: np. kryteria bramki samooceny, wymiary punktacji, kategorie pytań, liczba sub-agentów
- Przykład: „Aby dodać wymiar „Security” do karty oceny, dodaj go do listy wymiarów w krokach procesu i zaktualizuj szablon raportu”
- Co się zepsuje przy błędzie: skill może generować niepełne lub niespójne wyjście, ale nie zepsuje innych skilli w łańcuchu

**Trudne (strukturalne, ryzyko złamania kontraktów łańcucha):**
- Co zmienić: np. lista `allowed-tools`, format pliku wyjściowego, nazewnictwo artefaktów, wartości cyklu życia statusu
- Przykład: „Zmiana nazwy pliku wyjściowego z `plan.md` na `implementation-plan.md` zepsułaby `/10x-implement`, który wyszukuje `plan.md`”
- Co się zepsuje przy błędzie: skille downstream zależne od dokładnych nazw plików, nagłówków sekcji lub wartości statusu zawiodą po cichu albo wygenerują nieprawidłowe wyjście

### 7. Budowanie czegoś podobnego

Odpowiedz na pytanie: **„Gdybym chciał zbudować własną wersję tego skilla, jak powinienem zacząć?”**

Przedstaw praktyczną ścieżkę budowy krok po kroku. Zacznij prosto i stopniowo rozbudowuj — to progresywna droga od „pustego pliku” do „działającego skilla”.

Zanim przejdziesz do ręcznych kroków, wspomnij o dwóch skrótach:
- **Podejście konwersacyjne**: Po prostu powiedz agentowi „let's build a skill that does X” i wspólnie iterujcie nad SKILL.md przez 3–4 rundy. To najszybsza ścieżka dla osobistych skilli.
- **`/skill-creator`**: Meta-skill Anthropic do budowania skilli z ustrukturyzowanymi ewaluacjami. Dostępny pod adresem `github.com/anthropics/skills/tree/main/skills/skill-creator`. Lepszy dla współdzielonych skilli lub skilli zintegrowanych z łańcuchem, w których potrzebujesz automatycznej weryfikacji.

Oba skróty tworzą ten sam SKILL.md — poniższe kroki wyjaśniają, co generują, abyś rozumiał wynik i potrafił go udoskonalić:

**Krok 1: Zacznij od promptu.** Przed utworzeniem pliku skilla zapisz główną instrukcję jako zwykły prompt. Przetestuj go w rozmowie. Czy generuje w przybliżeniu właściwy wynik? Iteruj, aż podstawowe zachowanie zacznie działać.

**Krok 2: Utwórz plik skilla.** Utwórz `<skill-name>/SKILL.md` w swoim katalogu skilli. Dodaj minimalny frontmatter:
```yaml
---
name: <skill-name>
description: <one-line description with trigger phrases>
allowed-tools:
  - Read
  - Bash
---
```

**Krok 3: Dodaj strukturę.** Przekształć prompt w sekcje: deklarację roli, kiedy używać/pomijać, odpowiedź początkową i kroki procesu. Deklaracja roli ustala osobowość; sekcja kiedy używać zapobiega niewłaściwemu zastosowaniu.

**Krok 4: Dodaj zabezpieczenia.** Czego ten skill NIGDY nie może robić? Zapisz 3–5 krytycznych zabezpieczeń. To linie o największej dźwigni — zapobiegają najbardziej szkodliwym trybom awarii.

**Krok 5: Dodaj granice zakresu.** Napisz sekcję „Czego ten skill NIE robi”. Jawne granice zapobiegają rozszerzaniu zakresu i czynią skill przewidywalnym.

**Krok 6: (W razie potrzeby) Dodaj referencje.** Jeśli skill egzekwuje schemat, szablon lub rejestr, umieść je w katalogu `references/`. Zachowaj skupienie pliku SKILL.md na zachowaniu; kontrakty danych umieść w plikach referencyjnych.

**Krok 7: (W razie potrzeby) Dodaj integrację z łańcuchem.** Jeśli ten skill jest częścią łańcucha, zdefiniuj wejście upstream (jaki plik odczytuje) oraz wyjście downstream (jaki plik zapisuje). Dodaj sekcję „Relacja z innymi skillami”. Dodaj „STOP, do not chain” do zabezpieczeń.

**Krok 8: (W razie potrzeby) Dodaj zaawansowane wzorce.** Na podstawie tego, co demonstruje ten skill, wskaż, które zaawansowane wzorce osoba ucząca się może dodać:
- Orkiestrację sub-agentów (jeśli skill uruchamia agentów)
- Skalowanie złożoności (jeśli skill dostosowuje się do rozmiaru wejścia)
- Bramki samooceny (jeśli skill waliduje własne wyjście)
- Wznawianie oparte na punktach kontrolnych (jeśli skill obsługuje pracę przez wiele sesji)
- AskUserQuestion dla decyzji interaktywnych

Dla każdego kroku zaznacz, co analizowany skill robi na tym poziomie, aby osoba ucząca się mogła zobaczyć zależność między krokami budowy a gotowym produktem.

**Typowe błędy, których należy unikać:**
- Zaczynanie od zaawansowanych wzorców, zanim podstawowe zachowanie zacznie działać
- Pisanie zbyt ogólnikowych zabezpieczeń („be careful”) zamiast konkretnych („NEVER auto-chain to the next skill”)
- Pomijanie sekcji „Czego ten skill NIE robi” — rozszerzanie zakresu to główny tryb awarii skilli
- Tworzenie zbyt szerokiego `description` (aktywuje się przy wszystkim) albo zbyt wąskiego (nigdy się nie aktywuje)

## Przypadki brzegowe

- **Skill nie ma katalogu references/**: pomiń analizę referencji. Nie wspominaj, że brakuje referencji — większość prostych skilli ich nie ma i to jest w porządku.
- **Skill jest plikiem promptu, a nie SKILL.md**: jeśli użytkownik wskaże plik `.claude/prompts/*.md`, wyjaśnij, że prompty są prostsze niż skille (bez frontmatteru, bez allowed-tools, bez pozycji w łańcuchu) i przeanalizuj to, co się w nim znajduje. Dostosuj raport, aby pominąć sekcje, które nie mają zastosowania.
- **Skill jest bardzo krótki (poniżej 50 linii)**: przygotuj minimalny raport — Problem i cel + Anatomia + Budowanie czegoś podobnego. Pomiń pozycję w łańcuchu, kluczową mechanikę i przewodnik adaptacji, jeśli nie ma nic znaczącego do powiedzenia.
- **Skill używa wzorców niewymienionych powyżej**: analizuj to, co widzisz. Lista mechanizmów w sekcji 5 ma charakter ilustracyjny, a nie wyczerpujący. Jeśli skill ma unikalny wzorzec, wyjaśnij go.

## Ton

Pisz dla programisty, który potrafi UŻYWAĆ skilla, ale chce zrozumieć, JAK i DLACZEGO działa. Nie wyjaśniaj, czym jest Claude Code ani jak działają polecenia slash — czytelnik używa ich codziennie. Skup się na decyzjach projektowych, elementach nośnych oraz praktycznej ścieżce budowy własnego skilla.