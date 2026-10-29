---
name: 10x-prd
description: >
  Generate context/foundation/prd.md from shape-notes.md (or raw notes) against
  the locked PRD schema. Auto-routes to greenfield (10 sections) or brownfield
  (11 sections) template based on context_type in shape-notes.md or cwd
  auto-detection. Use when the user has shaping notes ready and wants a
  schema-conformant PRD written to disk. Trigger phrases: "write the PRD",
  "generate PRD", "create the PRD from notes", "stwórz PRD", "turn notes into a
  PRD", "PRD from shape-notes". Use AFTER /10x-shape, not in place of it.
argument-hint: "[path-to-notes-file]"
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---
# PRD: Wygeneruj context/foundation/prd.md z shape-notes

Ta umiejętność jest drugim ogniwem w łańcuchu bootstrapowania. Dla greenfield: `/10x-shape → /10x-prd → 10x-tech-stack-selector → bootstrapper`. Dla brownfield: `/10x-shape → /10x-prd → 10x-stack-assess → 10x-health-check`. Jej jedyne zadanie: pobrać plik ukształtowanych notatek i wygenerować `context/foundation/prd.md`, który jest zgodny z zablokowanym schematem PRD, kierując każdą lukę do `## Open Questions` zamiast wymyślać treść.

Umiejętność automatycznie kieruje do właściwego szablonu na podstawie `context_type` w danych wejściowych:
- **greenfield** → 10-sekcyjny szablon PRD (produkt budowany od podstaw)
- **brownfield** → 11-sekcyjny szablon PRD (zmiana delta w istniejącym systemie)

Umiejętność jest **generatorem dokumentów**, a nie facylitatorem discovery. NIGDY nie wymyśla decyzji domenowych, reguł logiki biznesowej, kryteriów sukcesu ani historyjek użytkownika. Wszystko, czego brakuje w danych wejściowych, trafia dosłownie do `## Open Questions`, aby człowiek mógł to rozstrzygnąć.

Zablokowany schemat, z którym ta umiejętność jest zgodna, znajduje się w `../10x-shape/references/prd-schema.md` (względem tego SKILL.md). Przeczytaj go przed wygenerowaniem jakiegokolwiek artefaktu i ponownie sprawdź względem niego wygenerowany plik przed zapisaniem na dysku.

## Kiedy używać, kiedy pominąć

**Użyj, gdy**: użytkownik uruchomił `/10x-shape` (a `context/foundation/shape-notes.md` istnieje z blokiem checkpoint), LUB użytkownik ma surowy plik notatek, który chce przekształcić w szkic PRD, LUB użytkownik wyraźnie prosi o (ponowne) wygenerowanie `context/foundation/prd.md`.

**Pomiń, gdy**: użytkownik wciąż generuje pomysły i nie ma notatek — najpierw wskaż `/10x-shape`. Pomiń również, gdy użytkownik chce ręcznie *edytować* istniejące PRD — ta umiejętność zapisuje całe pliki; precyzyjne edycje są poza zakresem.

## Relacja z innymi umiejętnościami

- `/10x-shape` — tworzy `shape-notes.md`, kanoniczne dane wejściowe. Zawsze preferowane upstream tej umiejętności.
- `10x-tech-stack-selector` — odbiorca downstream `prd.md` dla **greenfield**. Odczytuje frontmatter na poziomie produktu jako priory, a następnie prowadzi własny pozostały wywiad dotyczący składu zespołu, preferencji językowych, wdrożenia i kształtu CI/CD.
- `10x-stack-assess` — odbiorca downstream `prd.md` dla **brownfield**. Ocenia istniejący stack względem przyjaznych agentom bramek jakości.
- `/10x-frame`, `/10x-plan` — niepowiązane; PRD jest artefaktem fundamentowym, a nie planem dla pojedynczej zmiany.

## Początkowa odpowiedź

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli podano argument ścieżki** (np. `/10x-prd @notes/raw.md` lub `/10x-prd context/foundation/shape-notes.md`), przechwyć go jako ścieżkę wejściową. Przejdź do Kroku 1.
2. **Jeśli nie podano argumentu**, ustaw domyślną ścieżkę wejściową na `context/foundation/shape-notes.md` i przejdź do Kroku 1. Nie pytaj jeszcze — Krok 1 obsługuje przypadek braku danych wejściowych.

## Proces

### Krok 1: Zlokalizuj dane wejściowe

Rozwiąż ścieżkę wejściową:

- Jeśli przekazano argument, użyj go dosłownie (usuń początkowy `@`, jeśli występuje).
- W przeciwnym razie domyślnie użyj `context/foundation/shape-notes.md`.

Przetestuj rozwiązaną ścieżkę:

```bash
test -f "<resolved-path>"
```

Jeśli plik istnieje, przeczytaj go W CAŁOŚCI (bez `limit`/`offset`) i przejdź do Kroku 1.5.

Jeśli plik nie istnieje, zapytaj:

AskUserQuestion:
- question: "Nie znaleziono pliku wejściowego pod `<resolved-path>`. Jak chcesz kontynuować?"
  header: "Dane wejściowe?"
  options:
  - label: "Najpierw uruchom /10x-shape (Zalecane)"
    description: "Zatrzymaj się tutaj. Uruchom /10x-shape, aby utworzyć shape-notes.md, a następnie ponownie wywołaj /10x-prd."
  - label: "Wklej surowe notatki"
    description: "Poczekam, aż wkleisz posiadane notatki. Kontrola thin-input ostrzeże o brakujących sygnałach."
  - label: "Anuluj"
    description: "Zakończ bez zmian."
  multiSelect: false

Dla „Najpierw uruchom /10x-shape”: wypisz „Zatrzymywanie. Uruchom `/10x-shape`, aby utworzyć shape-notes.md, a następnie ponownie wywołaj `/10x-prd`.” i ZATRZYMAJ SIĘ.

Dla „Wklej surowe notatki”: wyświetl monit „Wklej swoje notatki poniżej. Zakończ pustą linią.” i przechwyć tekst użytkownika jako dane wejściowe w pamięci. Przejdź do Kroku 1.5 z tą zawartością.

Dla „Anuluj”: ZATRZYMAJ SIĘ bez zmian.

### Krok 1.5: Określ typ kontekstu

Określ, czy wygenerować PRD greenfield czy brownfield:

1. **Jeśli dane wejściowe mają `context_type:` we frontmatter** — użyj tej wartości bezpośrednio. Nie jest potrzebne potwierdzenie.
2. **Jeśli we frontmatter nie ma `context_type:`** (surowe notatki, wklejone dane wejściowe) — automatycznie wykryj z cwd:

   Użyj tego samego wielosygnalowego wykrywania co `/10x-shape` (Krok 0.7): sprawdź historię git (Tier 1), lockfiles (Tier 2), pliki manifestów (Tier 3) i sygnały dodatkowe (katalogi źródeł, konfiguracje frameworków). Każde trafienie Tier 1 lub Tier 2 → zaproponuj brownfield. Tylko Tier 3 → zaproponuj brownfield z flagą niejednoznaczności. Brak sygnałów → zaproponuj greenfield.

   Potwierdź z użytkownikiem:

   AskUserQuestion:
   - question: "Nie znaleziono context_type w danych wejściowych. Na podstawie markerów cwd wygląda to na [greenfield|brownfield]. Zgadza się?"
     header: "Kontekst"
     options:
     - label: "[Wykryty tryb] — poprawny (Zalecane)"
       description: "Wygeneruj PRD [greenfield|brownfield]."
     - label: "[Inny tryb] — nadpisz"
       description: "Wygeneruj zamiast tego PRD [other]."
     multiSelect: false

Zapisz rozwiązaną wartość `context_type` do użycia w Krokach 2 i 3. Przejdź do Kroku 2.

### Krok 2: Oceń dane wejściowe

Oceń dane wejściowe za pomocą heurystyki 0–4 shaped-vs-thin. Każdy sygnał daje 1 punkt:

**Sygnały greenfield:**

1. **Obecny blok frontmatter `checkpoint:`** — najsilniejszy sygnał, że pochodzi to z `/10x-shape`. Szukaj dosłownego klucza `checkpoint:` wewnątrz ogrodzenia YAML frontmatter na początku pliku.
2. **Co najmniej jedno wymaganie w formacie FR-NNN** — grep dla `^- FR-\d{3}: ` (wypunktowana linia, trzycyfrowy indeks dopełniony zerami, dwukropek-spacja).
3. **Co najmniej jeden blok Given/When/Then** — grep dla `\*\*Given\*\*` ORAZ `\*\*When\*\*` ORAZ `\*\*Then\*\*` w dowolnym miejscu treści.
4. **Jawne uchwycenie logiki biznesowej** — istnieje sekcja `## Business Logic`, a jej pierwsza niepusta linia jest pojedynczym zdaniem deklaratywnym (heurystyka: ≤ 200 znaków, kończy się `.`, nie jest równa `# TODO: domain rule — see Open Questions` i nie jest pusta/placeholderem).

**Sygnały brownfield** (zastępują sygnał 1, gdy `context_type: brownfield`):

1. **Obecny blok frontmatter `checkpoint:` ORAZ `context_type: brownfield`** — najsilniejszy sygnał, że pochodzi to z `/10x-shape` w trybie brownfield. Sprawdź również obecność sekcji `## Current System` w treści.
2–4. Tak samo jak dla greenfield.

Oblicz sumę. Udokumentuj heurystykę jawnie w rozmowie, aby przyszły maintainer mógł ją dostroić:

```
Ocena danych wejściowych (heurystyka, 4 sygnały, po 1 punkcie):
  [✓|✗] Blok checkpoint we frontmatter      — <found|missing>
  [✓|✗] Wymagania w formacie FR-NNN         — <found N FRs|missing>
  [✓|✗] Historyjki użytkownika Given/When/Then — <found|missing>
  [✓|✗] Jawna jednozdaniowa reguła biznesowa — <found|missing>

  Wynik: <N>/4
```

**Wynik ≥ 2**: dane wejściowe są wystarczająco ukształtowane; przejdź do Kroku 3 bez komunikatu.

**Wynik < 2**: uruchom ostrzeżenie thin-input. Nazwij jawnie każdy brakujący sygnał (NIE wypisuj ogólnego „twoje notatki są skąpe” — nazwij, czego brakuje i dlaczego to ma znaczenie):

```
Te dane wejściowe uzyskały wynik <N>/4 w heurystyce kształtu. Brakujące sygnały:

  - <nazwa sygnału>: <jednoliniowa konsekwencja dla wygenerowanego PRD>
  - ...

PRD wygenerowane z ubogich danych wejściowych będzie zawierać wiele placeholderów
`# TODO` i długą sekcję `## Open Questions`. To prawidłowy stan pośredni, ale jeśli masz
czas, aby najpierw uruchomić /10x-shape, wynikowe PRD będzie znacząco lepsze.
```

Następnie zapytaj:

AskUserQuestion:
- question: "Jak chcesz kontynuować?"
  header: "Ubogie dane wejściowe"
  options:
  - label: "Najpierw uruchom /10x-shape (Zalecane)"
    description: "Zatrzymaj się tutaj. Użyj /10x-shape, aby uzupełnić brakujące sygnały, a następnie ponownie wywołaj /10x-prd."
  - label: "Mimo wszystko kontynuuj"
    description: "Wygeneruj PRD z tego, co jest. Brakujące elementy trafiają dosłownie do ## Open Questions."
  - label: "Anuluj"
    description: "Zakończ bez zmian."
  multiSelect: false

Dla „Najpierw uruchom /10x-shape”: wypisz komunikat przekierowania i ZATRZYMAJ SIĘ. Dla „Mimo wszystko kontynuuj”: przejdź do Kroku 3 z zapisanym `score < 2`, aby późniejsze kroki wiedziały, że należy oczekiwać TODOs. Dla „Anuluj”: ZATRZYMAJ SIĘ.

### Krok 3: Wygeneruj PRD

Przeczytaj referencję schematu W CAŁOŚCI jeszcze raz (`../10x-shape/references/prd-schema.md`), aby potwierdzić, że lista pól i nazwy sekcji nie uległy zmianie.

Zbuduj zawartość PRD **najpierw w pamięci** (jeszcze nie na dysku):

#### 3a. Frontmatter

Wypełnij każde wymagane pole frontmatter zgodnie ze schematem:

- `project` — wyodrębnij z wejściowego frontmatter `project:`, jeśli występuje; w przeciwnym razie z nagłówka Title (`# <Project>`); w przeciwnym razie `# TODO: project — see Open Questions`.
- `version` — `1` dla pierwszego PRD zapisywanego przez tę umiejętność. Krok kolizji (Krok 4) zwiększa tę wartość, jeśli użytkownik wybierze zapis wersjonowany.
- `status` — `draft`. Nigdy nie promuj do `reviewed`/`locked`; to decyzja downstream.
- `created` — dzisiejsza data w `YYYY-MM-DD` (użyj `Bash: date +%Y-%m-%d`).
- `context_type` — `greenfield` lub `brownfield` (z Kroku 1.5).
- `product_type` — pobierz z danych wejściowych, jeśli dostępne; w przeciwnym razie `# TODO: product_type — see Open Questions` (i dodaj wpis Open Question).
- `target_scale`, `timeline_budget` — ta sama reguła. Jeśli dane wejściowe mają to pole, skopiuj je dosłownie; jeśli nie, wygeneruj `# TODO: <field> — see Open Questions` i dodaj odpowiadające Open Question. Dla brownfield `timeline_budget` używa `delivery_weeks` zamiast `mvp_weeks`.

**NIE umieszczaj** `team_profile`, `tech_preferences` ani `deployment_constraint` we frontmatter PRD, nawet gdy notatki wejściowe je zawierają. Pola te są zbierane przez downstreamowy etap tech-stack-selection (greenfield) lub stack-assessment (brownfield), a nie przez PRD. Jeśli dane wejściowe je zawierają, podsumuj je w komunikacie przekazania Kroku 5 pod „forward to tech-stack/stack-assess”, aby użytkownik wiedział, że treść jest kierowana dalej, a nie po cichu odrzucana — ale NIE umieszczaj ich we frontmatter PRD.

Nazwy kluczy pól są nośne zgodnie ze schematem. Wartości pól nie.

#### 3b. Wymagane sekcje (w kolejności schematu)

Lista sekcji zależy od `context_type`:

**Greenfield (10 sekcji):**

Wygeneruj dokładnie te 10 nagłówków na poziomie `##`, w tej dokładnej kolejności (kontrakt nazw sekcji schematu określa, według czego parsery downstream dzielą dokument):

1. `## Vision & Problem Statement`
2. `## User & Persona`
3. `## Success Criteria` (z `### Primary` / `### Secondary` / `### Guardrails`)
4. `## User Stories`
5. `## Functional Requirements`
6. `## Non-Functional Requirements`
7. `## Business Logic`
8. `## Access Control`
9. `## Non-Goals`
10. `## Open Questions`

**Brownfield (11 sekcji):**

Wygeneruj dokładnie te 11 nagłówków na poziomie `##`, w tej dokładnej kolejności:

1. `## Current System Overview` — co istnieje teraz: kluczowa architektura, tech stack, baza użytkowników. Ta sekcja nie ma odpowiednika greenfield; ustanawia punkt odniesienia, względem którego wszystkie kolejne sekcje opisują zmiany.
2. `## Problem Statement & Motivation` — co jest nieprawidłowe/brakuje, dlaczego teraz. Ujęcie delta: koncentruje się na luce między stanem obecnym a pożądanym.
3. `## User & Persona` — kogo dotyczy (obecni użytkownicy + nowi, jeśli są). Dla brownfield podkreśl istniejących użytkowników, których doświadczenie się zmienia.
4. `## Success Criteria` (z `### Primary` / `### Secondary` / `### Guardrails`) — jak wiemy, że zmiana zadziałała. Guardrails powinny jawnie obejmować istniejące zachowania, które nie mogą ulec regresji.
5. `## User Stories` — co zmienia się dla użytkownika. Ujęcie delta: Given/When/Then opisuje nowe zachowanie, z jawnymi uwagami o tym, co było inne wcześniej.
6. `## Scope of Change` — co jest modyfikowane/dodawane/usuwane. Jawna delta: sklasyfikuj każdy element jako `new`, `modified` lub `removed`. Zastępuje to ukryte założenie „wszystko jest nowe” z greenfield `## Functional Requirements`.
7. `## Constraints & Compatibility` — kompatybilność wsteczna, migracja danych, istniejące integracje, zachowane zachowanie. Specyficzna dla brownfield sekcja, która czyni zachowanie istniejących elementów jawnym.
8. `## Business Logic Changes` — dodatki/modyfikacje reguł domenowych (nie pełny model domeny). Jeśli zmiana dotyczy wyłącznie infrastruktury (bez zmiany logiki domenowej), stwierdź to jawnie.
9. `## Access Control Changes` — zmiany uprawnień, jeśli występują. Jeśli nie ma zmian, podaj: „No access control changes.”
10. `## Non-Goals` — czego NIE zmieniamy. Krytyczne dla brownfield: jawnie wskazuje aspekty istniejącego systemu, które są poza zakresem.
11. `## Open Questions`

**NIE generuj** sekcji `## Data Model`, `## Data Model Changes`, `## Implementation Decisions`, `## Testing Strategy` ani `## Deployment & CI/CD` w żadnym trybie — te kwestie nie należą do schematu PRD. Encje i ich cykle życia wyłaniają się z FRs i User Stories, a są ustalane podczas wyboru stacku / planowania implementacji, nie w PRD. Jeśli notatki wejściowe zawierają treść dotyczącą modelu danych lub implementacji, podsumuj ją w komunikacie przekazania Kroku 5 pod „forward to technical-roadmap”, aby użytkownik wiedział, że jest kierowana dalej, a nie po cichu odrzucana — ale NIE generuj tych sekcji w PRD.

#### Reguły zawartości sekcji (oba tryby)

Dla każdej sekcji:

- **Jeśli dane wejściowe zawierają pasującą treść** — przepisz ją wiernie do sekcji. Zachowaj sformułowania użytkownika. Konwertuj formatowanie tylko wtedy, gdy schemat wymaga określonego kształtu (np. format FR-NNN, Given/When/Then dla historyjek użytkownika, trzy podsekcje Success Criteria). Nie parafrazuj, nie podsumowuj ani nie „ulepszaj” słów użytkownika.
- **Jeśli dane wejściowe zawierają częściową treść** — przepisz to, co jest, a następnie zakończ `# TODO: <what's missing> — see Open Questions` wewnątrz sekcji i dodaj odpowiadający numerowany wpis pod `## Open Questions`.
- **Jeśli dane wejściowe nie zawierają pasującej treści** — wygeneruj tylko nagłówek oraz `# TODO: <section name> — see Open Questions` i dodaj odpowiadający numerowany wpis pod `## Open Questions`.

Jeśli `/10x-shape` zapisał cytaty blokowe Socrates pod FRs, zachowaj je dosłownie — są nośne dla downstreamowego przeglądu.

Jeśli shape-notes.md zawierał blok `## Quality cross-check` (z Kroku 7 `/10x-shape`), odzwierciedl każdą lukę w `## Open Questions` jako numerowany wpis wskazujący brakujący element i jego konsekwencję.

**Reguły zawartości specyficzne dla brownfield:**

- FRs z `Change: preserved` stają się jawnymi elementami zachowania w `## Scope of Change`, a nie w `## Non-Goals`.
- `## Current System Overview` mapuje się z sekcji `## Current System` w shape-notes.
- `## Constraints & Compatibility` mapuje się z sekcji `## Constraints & Preserved Behavior` w shape-notes.
- Konwencja ujęcia delta: sekcje opisują to, co się zmienia, a nie pełny system. „The auth model adds Google OAuth alongside existing email login” — nie „The system supports email login and Google OAuth.”

**Twarda reguła — nigdy nie wymyślaj**: jeśli dane wejściowe nie zawierają jednozdaniowej reguły biznesowej, sekcja `## Business Logic` / `## Business Logic Changes` MUSI brzmieć `# TODO: domain rule — see Open Questions`, a Open Questions MUSI zawierać „What is the one-sentence business rule? — TBD by user. Block: yes (PRD is hollow until resolved).” Nie zapisuj placeholdera reguły. Nie „ekstrapoluj” reguły z rzeczowników encji występujących w FRs lub User Stories. Całym celem tej umiejętności jest ujawnianie luk, a nie ich maskowanie.

Ta sama reguła dotyczy: kryteriów sukcesu, historyjek użytkownika, priorytetów FR, celów NFR, kontroli dostępu, non-goals. Jeśli czegoś nie ma w danych wejściowych, trafia to do Open Questions.

#### 3c. Autoprzegląd przed zapisem

Przed jakimkolwiek zapisem na dysku przeprowadź przegląd względem listy wymaganych sekcji schematu ORAZ lint na poziomie treści pod kątem przecieku technicznego:

**Kontrole strukturalne:**

1. Sparsuj zawartość PRD w pamięci. Wyodrębnij każdy nagłówek `## `.
2. Porównaj z kanoniczną listą sekcji dla aktywnego `context_type` (10 dla greenfield, 11 dla brownfield). Zweryfikuj, że WSZYSTKIE sekcje są obecne, we właściwej kolejności i z dokładną pisownią. PRD NIE może zawierać `## Data Model` ani `## Data Model Changes` — te sekcje zostały wycofane.
3. Zweryfikuj, że frontmatter deklaruje wszystkie wymagane klucze zgodnie ze schematem (`project`, `version`, `status`, `created`, `context_type`, `product_type`, `target_scale`, `timeline_budget`).
4. Zweryfikuj, że `## Success Criteria` zawiera podsekcje `### Primary`, `### Secondary`, `### Guardrails` (lub, jeśli ich brakuje, że są oznaczone jako TODO z odpowiadającymi wpisami Open Questions).

**Lint na poziomie treści pod kątem przecieku technicznego:**

5. Przeskanuj treści wszystkich sekcji na poziomie `##` (z wyłączeniem brownfield `## Current System Overview`, gdzie nazwanie istniejącego stacku jest dozwolone) pod kątem tokenów wskazujących, że szczegóły implementacyjne przedostały się do PRD. Traktuj każde trafienie jako przeciek, chyba że jest częścią dosłownego cytatu użytkownika jawnie kierowanego do Open Questions:

   - **Nazwy dostawców / usług hostowanych**: `OpenRouter`, `Stripe`, `Auth0`, `Supabase`, `Firebase`, `Vercel`, `Cloudflare`, `AWS`, `GCP`, `Azure`, `OpenAI`, `Anthropic` itd. (dowolny produkt/usługa będąca nazwą własną).
   - **Notacja schematu / ORM**: `(FK)`, `nullable`, sufiksy kolumn `_hash`, `_at` przedstawiane jako listy pól, `password_hash`, `cascade`, `soft-delete`, `hard-delete`, `migration`, `backfill`.
   - **Lokalizacja wykonania**: `client-side`, `server-side`, `on the edge`, `in the cache`, `in the worker`.
   - **Mechanizm egzekwowania**: `per IP`, `per user-agent`, `token bucket`, `rate-limit per <axis>`.
   - **Element UI** (gdy jest używany do określenia NFR, a nie historyjki użytkownika): `spinner`, `progress bar`, `streaming response`, `modal`, `toast`.
   - **Transport / protokół**: `WebSocket`, `gRPC`, `GraphQL`, `REST endpoint`, `webhook`, `SSE`.
   - **Czasowniki implementacyjne w regułach domenowych**: „the LLM does X”, „the SRS library decides Y”, „the database stores Z” (nazywanie komponentu wykonującego regułę zamiast określania samej reguły).

   Dla każdego trafienia wygeneruj ustrukturyzowane ostrzeżenie. NIE przepisuj go po cichu — przerwij zapis, aby użytkownik mógł zobaczyć, co wyciekło.

Jeśli którakolwiek kontrola strukturalna LUB lint nie powiedzie się, **przerwij zapis** i zgłoś:

```
Autoprzegląd generowania PRD NIE POWIÓDŁ SIĘ:

  Strukturalne:
    - Brakująca sekcja: <name>
    - Sekcja poza kolejnością: <name> (oczekiwana pozycja N, znaleziona pozycja M)
    - Brakujący klucz frontmatter: <key>
    - Obecna wycofana sekcja: <name>

  Przeciek techniczny (lint treści):
    - <section name>: "<offending phrase>" — <category, e.g. vendor name / schema notation / runtime location>
    - ...

PRD NIE zostało zapisane. W przypadku błędów strukturalnych: schemat i generator
uległy rozjazdowi — ponownie przeczytaj ../10x-shape/references/prd-schema.md i uzgodnij je.
W przypadku błędów przecieku: notatki wejściowe zawierają szczegóły implementacyjne, których PRD
nie posiada. Albo (a) przepisz problematyczne sformułowania jako właściwości
obserwowalne z zewnątrz / decyzje zakresowe i uruchom ponownie, albo (b) przenieś wyciekłą treść do
bloków `## Forward: ...` w shape-notes, aby wykorzystała ją umiejętność downstream.
```

Następnie ZATRZYMAJ SIĘ. Nie przechodź do Kroku 4.

Jeśli wszystkie kontrole przejdą pomyślnie, przejdź do Kroku 4 z zatwierdzoną zawartością.

### Krok 4: Sprawdzenie kolizji

```bash
test -f context/foundation/prd.md
```

Jeśli plik nie istnieje, zapisz do `context/foundation/prd.md` i przejdź do Kroku 5.

Jeśli plik istnieje, zapytaj:

AskUserQuestion:
- question: "context/foundation/prd.md już istnieje. Jak chcesz kontynuować?"
  header: "Kolizja"
  options:
  - label: "Zapisz jako prd-vN.md (Zalecane)"
    description: "Zachowaj historię. Nowe PRD trafi do następnego dostępnego miejsca prd-vN.md. Niewersjonowany prd.md pozostanie bez zmian."
  - label: "Nadpisz prd.md"
    description: "Zastąp istniejący prd.md. Poprzednia wersja zostanie utracona (chyba że została zatwierdzona)."
  - label: "Przerwij"
    description: "Zakończ bez zapisów. Nie rozwiązuj kolizji."
  multiSelect: false

Dla „Zapisz jako prd-vN.md”: wybierz `N`, skanując `context/foundation/` pod kątem plików pasujących do `prd-v*.md`. Traktuj niewersjonowany `prd.md` jako v1. Następne miejsce to `N = (max existing N or 1) + 1`. Zapisz zatwierdzoną zawartość do `context/foundation/prd-v<N>.md` i zwiększ w treści pole frontmatter `version:` do `<N>`. Przejdź do Kroku 5.

Dla „Nadpisz prd.md”: zapisz zatwierdzoną zawartość do `context/foundation/prd.md`. Zachowaj `version: 1` (nadpisanie jest zastąpieniem, a nie nową wersją). Przejdź do Kroku 5.

Dla „Przerwij”: ZATRZYMAJ SIĘ bez zapisów.

### Krok 5: Przekaż dalej

Po zapisaniu podsumuj, co zostało wygenerowane:

```
═══════════════════════════════════════════════════════════
  PRD WYGENEROWANE
═══════════════════════════════════════════════════════════

  Projekt:           [project from frontmatter]
  Typ kontekstu:     [greenfield | brownfield]
  Ścieżka:           [context/foundation/prd.md | context/foundation/prd-vN.md]
  Sekcje schematu:   [10 / 10 | 11 / 11] obecne
  Frontmatter:       <K populated, M as TODO>  (łącznie 8 kluczy)
  Open Questions:    <count> wpisów

  Sekcje w pełni wypełnione z danych wejściowych:
    - <list of section names with non-trivial content>

  Sekcje oznaczone TODO (zobacz Open Questions):
    - <list of section names with TODO placeholders>

═══════════════════════════════════════════════════════════
```

Następnie skopiuj polecenie następnego kroku do schowka i ogłoś:

**Greenfield:**

```bash
echo -n "/10x-tech-stack-selector" | pbcopy 2>/dev/null || echo -n "/10x-tech-stack-selector" | clip.exe 2>/dev/null || echo -n "/10x-tech-stack-selector" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard "/10x-tech-stack-selector"
```

```
► Dalej:  /10x-tech-stack-selector  (✓ skopiowano do schowka)

          Pobiera skład zespołu, preferencje językowe,
          listę technologii do unikania, cel wdrożenia oraz kształt
          pipeline CI/CD. Żadne z nich nie znajduje się w tym PRD z założenia —
          PRD opisuje produkt, a następny krok opisuje,
          jak go zbudować.
```

**Brownfield:**

```bash
echo -n "/10x-stack-assess" | pbcopy 2>/dev/null || echo -n "/10x-stack-assess" | clip.exe 2>/dev/null || echo -n "/10x-stack-assess" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard "/10x-stack-assess"
```

```
► Dalej:  /10x-stack-assess  (✓ skopiowano do schowka)

          Ocenia istniejący stack względem przyjaznych agentom
          bramek jakości i tworzy plan kompensacyjny. Następnie
          /10x-health-check audytuje kondycję zależności, zestaw testów
          oraz pokrycie CI/CD. Żadne z nich nie znajduje się w tym PRD z
          założenia — PRD opisuje CO się zmienia, a kolejne kroki
          oceniają, CZY istniejący system jest gotowy.
```

Jeśli notatki wejściowe zawierały perspektywiczne kwestie (preferencje tech stacku, notatki implementacyjne, wskazówki wdrożeniowe), wymień je krótko, aby użytkownik wiedział, że są kierowane do następnego kroku, a nie odrzucane:

```
  Przekaż do następnego kroku (nie w PRD):
    • [one-line summary per detected item]
```

Pomiń cały blok, jeśli dane wejściowe nie zawierały żadnego z tych elementów.

ZATRZYMAJ SIĘ. Nie przechodź automatycznie do kolejnej umiejętności.

## Krytyczne zabezpieczenia

1. **Generator, nie autor.** Ta umiejętność zapisuje całe pliki na podstawie danych wejściowych zaakceptowanych już przez użytkownika. Nie wymyśla logiki biznesowej, kryteriów sukcesu, historyjek użytkownika ani priorytetów FR. Brakująca zawartość trafia dosłownie do `## Open Questions`. Sekcja `## Business Logic` PRD jest najściślej kontrolowanym obszarem: jeśli w danych wejściowych nie ma jednozdaniowej reguły, sekcja brzmi `# TODO: domain rule — see Open Questions`. Bez wyjątków.

2. **Schemat jest kontraktem.** `../10x-shape/references/prd-schema.md` definiuje klucze frontmatter, nazwy sekcji i kolejność sekcji. Czytaj go ponownie przy każdym wywołaniu. Ponownie waliduj względem niego PRD w pamięci w Kroku 3c przed zapisem. Rozjazd między tą umiejętnością a schematem jest trybem awarii, któremu ta umiejętność ma zapobiegać.

3. **Otwartość stacku jest wiążąca — i szersza niż same nazwy stacków.** Zabronione słownictwo w wygenerowanym PRD obejmuje siedem kategorii, a nie tylko frameworki:

   - **Frameworki, bazy danych, platformy hostingowe, konkretne biblioteki** — pierwotna reguła.
   - **Nazwy dostawców / usług hostowanych** — OpenRouter, Stripe, Auth0, Supabase, Firebase, Vercel, Cloudflare, AWS/GCP/Azure, OpenAI, Anthropic oraz każdy inny produkt lub usługa będąca nazwą własną.
   - **Notacja schematu / ORM** — listy na poziomie pól, `(FK)`, `nullable`, kolumny `_hash`, `password_hash`, `cascade-delete`, `soft-delete`, `hard-delete`, `migration`, `backfill`. (Encje naturalnie pojawiają się w FRs i User Stories; schemat na poziomie kolumn jest kwestią downstream.)
   - **Lokalizacja wykonania** — `client-side`, `server-side`, `on the edge`, `in the cache`, `in the worker`. PRD opisuje, co musi być prawdziwe na zewnętrznej granicy produktu, a nie gdzie w stacku jest to egzekwowane.
   - **Mechanizm egzekwowania** — `per IP`, `per user-agent`, `token bucket`, `rate-limit per <axis>`. NFR jest właściwością; mechanizm jest decyzją projektową downstream.
   - **Element UI w NFRs** — `spinner`, `progress bar`, `streaming response`, `modal`, `toast`. NFRs wskazują obserwowalną dla użytkownika jakość (np. „continuous feedback during long operations”); element UI jest kwestią downstream.
   - **Transport / protokół** — `WebSocket`, `gRPC`, `GraphQL`, `REST endpoint`, `webhook`, `SSE`. PRD opisuje przepływ informacji tak, jak doświadcza go użytkownik, a nie format przesyłania.

   Frontmatter PRD jest wyłącznie na poziomie produktu (`product_type`, `target_scale`, `timeline_budget` + metadane); rodzina języków, frameworki, wdrożenie, profil zespołu i każda lista technologii do unikania należą do kroku downstream (tech-stack-selector dla greenfield, stack-assess dla brownfield), NIE do PRD. Jeśli dane wejściowe zawierają zabronione słownictwo, pozostaw je w blokach `## Forward: ...` w shape-notes, aby krok downstream mógł je wykorzystać — NIE przekładaj ich na frontmatter ani sekcje PRD. Wyjątek: brownfield `## Current System Overview` może wymieniać istniejący stack i dostawców, ponieważ opisuje stan obecny, a nie wybór stacku. Lint treści Kroku 3c mechanicznie egzekwuje to zabezpieczenie.

4. **Kolizje faworyzują historię.** Monit o kolizji zaleca zapis wersjonowany (`prd-vN.md`) zamiast nadpisania. Utracone wcześniejsze wersje są nieodwracalnym trybem awarii; zduplikowany plik w `context/foundation/` nie jest nim.

5. **Autoprzegląd przerywa przy rozjeździe.** Jeśli PRD w pamięci nie ma sekcji, ma sekcję w złej kolejności albo nie ma klucza frontmatter, zapis zostaje PRZERWANY — nie jest po cichu poprawiany. Błąd wskazuje konkretny rozjazd, aby maintainer mógł uzgodnić schemat i umiejętność.

6. **Wyłącznie uniwersalny język.** Żadnych odniesień do 10xDevs / cohort / certification w żadnym materiale skierowanym do użytkownika ani artefakcie zapisywanym na dysku. Ta umiejętność jest ogólnym generatorem PRD.

7. **Nigdy nie łącz automatycznie.** Przekazanie jest ogłoszeniem, nie wywołaniem. Użytkownik wybiera, kiedy (i czy) uruchomić następny krok (10x-tech-stack-selector dla greenfield, 10x-stack-assess dla brownfield). Automatyczne łączenie pominęłoby przegląd wygenerowanego PRD przez człowieka.

## Uwagi

- To jest umiejętność **generatora dokumentów**. Wynikiem jest `context/foundation/prd.md` (lub `prd-vN.md`), kropka.
- Referencja schematu (`../10x-shape/references/prd-schema.md`) jest jedynym źródłem prawdy. Każda nazwa pola, nazwa sekcji lub klucz frontmatter wymienione w tej treści MUSZĄ istnieć w dokumencie schematu — jeśli nie istnieją, najpierw popraw dokument schematu.
- Heurystyka thin-input (Krok 2) jest celowo konserwatywna. Fałszywie dodatnie wyniki (ostrzeżenie dla ukształtowanych danych wejściowych) można skorygować przez nadpisanie „Proceed anyway”; fałszywie ujemne wyniki (ciche generowanie z ubogich danych wejściowych) tworzą puste PRD, które wprowadzają użytkownika w błąd. Dostrajaj heurystykę tak, aby ostrzegała częściej, nie rzadziej.
- Wzorzec `# TODO: <field-name> — see Open Questions` jest nośny. Narzędzia downstream (umiejętności przeglądu, 10x-tech-stack-selector / 10x-stack-assess) mogą użyć grep dla `^# TODO: `, aby zliczać nierozwiązane luki i zdecydować, czy PRD jest gotowe do przeglądu.