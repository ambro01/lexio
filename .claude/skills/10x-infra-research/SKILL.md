---
name: 10x-infra-research
description: >
  Research and recommend an MVP deployment platform via a short interview plus
  parallel, bias-checked web research; writes context/foundation/infrastructure.md
  with a scored comparison and risk register. Trigger phrases: "choose a platform",
  "where should I deploy", "infra research", "wybierz platformę",
  "gdzie deployować", "jaka platforma do deploymentu". Use AFTER /10x-prd or
  /10x-tech-stack-selector, BEFORE /10x-implement.
argument-hint: "[path-to-tech-stack-or-prd]"
allowed-tools:
  - Read
  - Write
  - Bash
  - WebFetch
  - WebSearch
  - AskUserQuestion
  - Agent
  - TaskCreate
  - TaskUpdate
---
# Badanie platform: świadoma platforma wdrożeniowa dla MVP

Ta umiejętność tworzy **świadomą decyzję infrastrukturalną** — a nie rekomendację opartą na przeczuciu, lecz ugruntowaną w stosie technologicznym projektu, ograniczeniach operacyjnych dewelopera, aktualnych badaniach internetowych oraz trzech perspektywach anty-biasowych, które weryfikują zwycięską platformę przed zapisaniem decyzji.

Jedynym rezultatem jest `context/foundation/infrastructure.md` — trzeci kontrakt decyzyjny w łańcuchu fundamentów po `prd.md` (co i dla kogo) oraz `tech-stack.md` (czym budować). Zawiera: punktowane porównanie platform, uzasadnienie rekomendacji, opis operacyjny (podgląd / sekrety / wycofanie / zatwierdzenie / logi) oraz rejestr ryzyk z wstępnie wypełnionymi uwagami dotyczącymi mitygacji.

## Kiedy używać, kiedy pominąć

**Użyj, gdy**: użytkownik musi wybrać platformę wdrożeniową/hostingową dla MVP i chce ustrukturyzowanej decyzji opartej na badaniach. Umiejętność działa najlepiej, gdy istnieje `context/foundation/tech-stack.md` — używa stosu jako twardego ograniczenia podczas oceny platform.

**Pomiń, gdy**: platforma została już wybrana, a użytkownik chce pomocy w konfiguracji CI/CD lub pisaniu Dockerfile — to znajduje się poza zakresem tej umiejętności (zobacz Cele poza zakresem). Pomiń również, gdy użytkownik pyta o architekturę w skali produkcyjnej; ta umiejętność koncentruje się na wdrożeniach MVP.

## Relacja z innymi umiejętnościami

- `/10x-prd` — poprzedzająca. Tworzy `context/foundation/prd.md` z kontekstem produktu. Wejście opcjonalne.
- `/10x-tech-stack-selector` — poprzedzająca. Tworzy `context/foundation/tech-stack.md`. Główne wejście z twardymi ograniczeniami — wczytaj je, jeśli jest obecne.
- `/10x-stack-assess` — równorzędna. Ocenia istniejący stos pod kątem przyjazności dla agentów. Badanie infrastruktury jest uzupełnieniem dotyczącym wdrożenia.
- `/10x-implement` — następująca. Odczytuje `context/foundation/infrastructure.md`, aby informować o krokach wdrożeniowych podczas implementacji.

## Cele poza zakresem

Ta umiejętność **nie**:
- Tworzy obrazów Docker ani nie pisze Dockerfile.
- Konfiguruje potoków CI/CD.
- Nie planuje poza zakresem MVP (średnioterminowe prognozy kosztów są w porządku; wieloregionowe HA znajduje się poza zakresem).

## Wymagane wejścia

1. `references/agent-friendly-criteria.md` — dołączone. Pięć kryteriów platform używanych jako perspektywa oceny.

## Opcjonalne wejścia

1. `context/foundation/tech-stack.md` — jeśli obecne, umiejętność odczytuje język, framework i runtime, aby odfiltrować platformy, które ich nie obsługują.
2. `context/foundation/prd.md` — jeśli obecne, umiejętność odczytuje kontekst produktu (skalę użytkowników, wymagania dotyczące opóźnień), aby przypisać wagi badaniu.

## Początkowa odpowiedź

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli podano argument ścieżki** (np. `/10x-infra-research @context/foundation/tech-stack.md`), usuń wiodący `@`, jeśli występuje, i użyj ścieżki jako lokalizacji tech stacku dla tego uruchomienia.
2. **Jeśli nie podano argumentu**, sprawdź `context/foundation/tech-stack.md`. Wczytaj go, jeśli istnieje; kontynuuj bez niego, jeśli go nie ma.

## Przebieg pracy

### Krok 0 — Konfiguracja i wczytanie kontekstu

Wczytaj pliki kontekstowe. Dla każdego, który istnieje, odczytaj go i wyodrębnij odpowiednie pola:

- `context/foundation/tech-stack.md` → język, framework, runtime, baza danych (twarde ograniczenia zgodności platformy)
- `context/foundation/prd.md` → oczekiwana skala użytkowników, wymagania dotyczące opóźnień/dostępności (miękkie wagi dla punktacji platform)

Wczytaj `references/agent-friendly-criteria.md` — jest to perspektywa oceny używana w Kroku 3.

Wyświetl, co zostało wczytane:

```
Context loaded:
  Tech stack:    <language> / <framework> / <runtime>  [or "not found — will infer from cwd"]
  PRD context:   <scale / latency notes>               [or "not found — skipping"]
  Platform criteria: references/agent-friendly-criteria.md ✓
```

### Krok 1 — Wywiad z deweloperem (5 pytań)

Zadaj użytkownikowi pięć pytań Tak / Nie / Nie wiem. Użyj narzędzia `AskUserQuestion` dla każdego z nich, pojedynczo. Zbierz wszystkie odpowiedzi przed przejściem do badań.

**Pytanie 1**

AskUserQuestion:
- question: "Czy Twoja aplikacja wymaga trwałych połączeń po stronie serwera — WebSockets, long-polling lub procesów workerów działających w tle, które muszą pozostawać aktywne między żądaniami?"
  header: "Ograniczenia platformy"
  options:
  - label: "Tak"
    description: "Aplikacja potrzebuje procesów zawsze aktywnych lub długotrwałych połączeń."
  - label: "Nie"
    description: "Tylko żądanie/odpowiedź — każde żądanie jest bezstanowe."
  - label: "Nie wiem"
    description: "Nie jestem jeszcze pewien/pewna."
  multiSelect: false

**Pytanie 2**

AskUserQuestion:
- question: "Czy minimalizacja miesięcznego kosztu jest głównym priorytetem na etapie MVP, czy ważniejsze są doświadczenie deweloperskie i szybkość iteracji?"
  header: "Preferencja dotycząca kompromisów"
  options:
  - label: "Minimalizuj koszt"
    description: "Chcę najtańszą realną opcję, nawet jeśli DX będzie mniej wygodne."
  - label: "Priorytet dla DX"
    description: "Zapłacę rozsądną kwotę za płynniejszy cykl rozwoju."
  - label: "Nie wiem / mniej więcej równo"
    description: "Brak silnej preferencji."
  multiSelect: false

**Pytanie 3**

AskUserQuestion:
- question: "Czy Ty lub Twój zespół macie już praktyczne doświadczenie z konkretną platformą, na której wdrażanie byłoby dla Was komfortowe?"
  header: "Dotychczasowa znajomość"
  options:
  - label: "Tak — Vercel / Netlify"
    description: "Komfortowa praca z platformami w stylu JAMstack."
  - label: "Tak — Cloudflare (Workers / Pages)"
    description: "Komfortowa praca z wdrożeniami edge-first."
  - label: "Tak — Railway / Render / Fly.io"
    description: "Komfortowa praca z PaaS opartym na kontenerach."
  - label: "Tak — AWS / GCP / Azure"
    description: "Komfortowa praca z infrastrukturą hyperscalerów."
  - label: "Brak silnej znajomości"
    description: "Otwartość na rozwiązanie najlepiej dopasowane."
  multiSelect: false

**Pytanie 4**

AskUserQuestion:
- question: "Czy oczekujesz, że aplikacja będzie obsługiwać użytkowników globalnie (znaczenie ma edge/CDN), czy głównie z jednego regionu?"
  header: "Zasięg geograficzny"
  options:
  - label: "Globalnie — opóźnienia między regionami mają znaczenie"
    description: "Użytkownicy będą znajdować się na różnych kontynentach."
  - label: "Jeden region wystarczy"
    description: "Wszyscy użytkownicy są w jednym kraju / regionie."
  - label: "Jeszcze nie wiem"
    description: "Nie jestem pewien/pewna docelowej geografii."
  multiSelect: false

**Pytanie 5**

AskUserQuestion:
- question: "Czy wdrożenie będzie potrzebować współlokalizowanych usług zarządzanych — bazy danych, magazynu obiektowego, kolejek — od tej samej platformy, czy zewnętrzni dostawcy są w porządku?"
  header: "Współlokalizacja usług"
  options:
  - label: "Współlokalizacja preferowana"
    description: "Chcę DB, storage itd. od tego samego dostawcy, aby zachować prostotę."
  - label: "Zewnętrzni dostawcy są w porządku"
    description: "Użyję osobnych usług (np. Supabase, Upstash, Cloudflare R2)."
  - label: "Jeszcze nie wiem"
    description: "Nie podjąłem/podjęłam jeszcze decyzji o warstwie danych."
  multiSelect: false

Zapisz wszystkie pięć odpowiedzi jako ograniczenia badawcze przed przejściem do Kroku 2.

### Krok 2 — Równoległe badanie platform

Użyj subagentów do równoległego badania platform. Celem jest zebranie wystarczających sygnałów, aby ocenić każdą platformę względem pięciu kryteriów w `references/agent-friendly-criteria.md`, odfiltrowanych przez twarde ograniczenia ze stosu technologicznego i odpowiedzi z wywiadu.

**Pula kandydatów na platformy** (zbadaj je, a następnie oceń i zawęź):

| Platforma | Główny przypadek użycia |
|---|---|
| Cloudflare Workers + Pages | Edge-first, bezserwerowy JS/TS, globalny CDN |
| Vercel | Frontend + funkcje bezserwerowe, natywne dla Next.js |
| Netlify | Frontend + bezserwerowe, JAMstack, prymitywy formularzy/autoryzacji |
| Fly.io | PaaS oparty na kontenerach, trwałe procesy, wiele regionów |
| Railway | Full-stack PaaS, współlokalizowane bazy danych, szybki DX |
| Render | Hosting kontenerów/statyczny, darmowy plan, zadania cron |

Dla każdej platformy uruchom subagenta z ukierunkowanym promptem badawczym. Uruchom wszystkie sześć równolegle:

```
Research [Platform Name] as an MVP deployment target.

Focus on:
1. Supported runtimes and languages (especially: <language from tech stack>)
2. CLI tooling — what commands deploy, rollback, and tail logs?
3. Whether docs are available as markdown/llms.txt on GitHub
4. Free tier and estimated cost at 10k-100k monthly requests
5. Persistent process / WebSocket support (yes / no / limited)
6. Co-located managed services (database, storage, queues)
7. MCP server or Claude/AI agent integration (if any)
8. Known limitations or gotchas for <framework from tech stack>
9. Current status of every feature mentioned above: GA / beta / preview / deprecated / region-limited.
   For any non-GA feature, capture the explicit caveat and the date the status was checked.

Return: a brief factual summary (200-300 words) with evidence links. Mark every
beta/preview/region-limited capability inline so it carries forward into the risk register.
```

Użyj `WebSearch` lub `WebFetch`, aby znaleźć aktualne strony cenowe, oficjalną dokumentację i niedawne porównania społeczności (szukaj treści z lat 2024–2025).

Po ukończeniu pracy przez wszystkich subagentów zsyntetyzuj ich ustalenia w macierzy punktacji.

### Krok 3 — Oceń i utwórz krótką listę

Oceń każdą zbadaną platformę względem pięciu kryteriów z `references/agent-friendly-criteria.md`. Najpierw zastosuj twarde filtry:

**Twarde filtry** (platforma, która ich nie przejdzie, zostaje usunięta z krótkiej listy):
- Jeśli odpowiedź na pytanie 1 = „Tak (wymagane trwałe połączenia)” → usuń platformy, które nie mogą uruchamiać trwałych procesów (Netlify, Vercel wyłącznie bezserwerowy).
- Jeśli stos technologiczny używa runtime nieobsługiwanego przez platformę → usuń tę platformę.

**Punktacja** (Pass / Partial / Fail dla każdego kryterium):

| Platforma | CLI-first | Managed/Serverless | Dokumentacja czytelna dla agenta | Stabilne API wdrożeniowe | MCP / Integracja | Suma |
|---|---|---|---|---|---|---|
| Cloudflare | | | | | | |
| Vercel | | | | | | |
| Netlify | | | | | | |
| Fly.io | | | | | | |
| Railway | | | | | | |
| Render | | | | | | |

Nadaj miękkie wagi kryteriom zgodnie z odpowiedziami z wywiadu:
- P2 „minimalizuj koszt” → karz platformy z kosztownymi planami bazowymi.
- P3 „dotychczasowa znajomość” → rozstrzygaj remisy na korzyść znanej platformy.
- P4 „zasięg globalny” → preferuj platformy natywne dla edge.
- P5 „preferowana współlokalizacja” → preferuj platformy ze zintegrowanymi bazami danych.

**Utwórz krótką listę 3 najlepszych platform** według łącznej punktacji (po filtrach i wagach). Przed przejściem do weryfikacji krzyżowej przedstaw krótką listę wraz z jednoakapitowym uzasadnieniem dla każdej platformy.

Wyświetl użytkownikowi:

```
Shortlisted platforms:
  1. <Platform A> — <one-sentence rationale>
  2. <Platform B> — <one-sentence rationale>
  3. <Platform C> — <one-sentence rationale>

Running anti-bias cross-check on the top recommendation (<Platform A>)...
```

### Krok 4 — Weryfikacja anty-biasowa

Przeprowadź trzy prompty weryfikacyjne wobec najwyżej ocenionej platformy. Wykonaj je samodzielnie (nie uruchamiaj subagentów) — jesteś sceptykiem.

**Weryfikacja 1 — Adwokat diabła**

W myślach zastosuj tę perspektywę i zapisz wynik jako numerowaną listę słabości (3–5 pozycji):

> Act as an extremely skeptical and experienced software architect. Your only job is to find all possible weaknesses, hidden costs, technical risks, and reasons why deploying `<tech stack>` on `<Platform A>` could fail in practice for this MVP. Be specific — name the failure modes, not categories.

**Weryfikacja 2 — Pre-mortem**

W myślach zastosuj tę perspektywę i napisz krótką narrację (150–200 słów):

> The team deployed `<tech stack>` on `<Platform A>` for their MVP. Six months later, the decision turned out to be a complete disaster. Walk through the incorrect assumptions, technical decisions, and underestimated risks that led to this failure — step by step.

**Weryfikacja 3 — Nieznane niewiadome**

W myślach zastosuj tę perspektywę i przedstaw 3–5 rzeczy, których użytkownik może nie być świadomy:

> When deploying `<tech stack>` on `<Platform A>`, what are the 'unknown unknowns' — things the user should know before starting work that are not obvious from the platform's marketing page or docs?

Po wszystkich trzech weryfikacjach przedstaw użytkownikowi ustalenia i zapytaj:

AskUserQuestion:
- question: "Weryfikacja anty-biasowa ujawniła pewne ryzyka dla <Platform A>. Jak chcesz postąpić?"
  header: "Wynik weryfikacji"
  options:
  - label: "Kontynuuj z <Platform A> — ryzyka odnotowane"
    description: "Ryzyka są możliwe do opanowania. Uwzględnij je w rejestrze ryzyk wyniku."
  - label: "Zamiast tego wybierz <Platform B>"
    description: "Ryzyka są wystarczająco istotne, aby preferować drugą opcję."
  - label: "Zamiast tego wybierz <Platform C>"
    description: "Ryzyka są wystarczająco istotne, aby preferować trzecią opcję."
  multiSelect: false

Zastosuj wybór użytkownika. Jeśli wybierze B lub C, uruchom ponownie trzy weryfikacje dla nowego najlepszego wyboru i przedstaw wyniki (nie trzeba pytać ponownie — zapisz je i kontynuuj).

### Krok 5 — Zapisz wynik

Sprawdź kolizję:

```bash
test -f context/foundation/infrastructure.md
```

Jeśli plik istnieje, zapytaj:

AskUserQuestion:
- question: "context/foundation/infrastructure.md już istnieje. Jak chcesz postąpić?"
  header: "Kolizja"
  options:
  - label: "Nadpisz (zalecane)"
    description: "Zastąp istniejący plik. Poprzednia wersja zostanie utracona, chyba że została zapisana w commicie."
  - label: "Zapisz jako infrastructure-v2.md"
    description: "Zachowaj historię. Nowy plik trafi do następnego dostępnego slotu wersji."
  - label: "Przerwij"
    description: "Zakończ bez zapisywania. Rekomendacja zostanie zachowana wyłącznie w czacie."
  multiSelect: false

Zbuduj plik wynikowy:

```markdown
---
project: <project name from tech-stack.md, prd.md, or cwd directory name>
researched_at: <ISO 8601 date>
recommended_platform: <platform name>
runner_up: <platform name>
context_type: mvp
tech_stack:
  language: <language>
  framework: <framework>
  runtime: <runtime>
---

## Recommendation

**Deploy on <Platform Name>.**

<2-3 sentence rationale: why this platform for this specific tech stack and these specific constraints. Cite the scoring and interview answers that drove the decision.>

## Platform Comparison

<The full scoring matrix from Step 3, with one-paragraph notes per platform explaining each score.>

### Shortlisted Platforms

#### 1. <Platform A> (Recommended)

<Why it won: key strengths relative to the criteria and constraints.>

#### 2. <Platform B>

<Why it scored second: strengths and the gap vs. the recommendation.>

#### 3. <Platform C>

<Why it scored third: strengths and the gap vs. the recommendation.>

## Anti-Bias Cross-Check: <Recommended Platform>

### Devil's Advocate — Weaknesses

<Numbered list of 3-5 specific weaknesses surfaced in cross-check 1.>

### Pre-Mortem — How This Could Fail

<The 150-200 word failure narrative from cross-check 2.>

### Unknown Unknowns

<Bulleted list of 3-5 non-obvious risks from cross-check 3.>

## Operational Story

How the chosen platform actually operates day to day. One concrete answer per line — not a category.

- **Preview deploys**: <how PR / branch builds become preview URLs; whether they need protection (e.g. Cloudflare Access); any conditions on availability such as fork PRs>
- **Secrets**: <where env vars and tokens live (platform vault, GitHub Secrets, Workers Secrets); who can read them; rotation flow>
- **Rollback**: <command or click sequence to revert; typical time-to-revert; any data caveats such as DB migrations that don't roll back automatically>
- **Approval**: <which actions require a human (publish to production, rotate primary secret, drop a database); which an agent may perform unattended>
- **Logs**: <how the agent reads pipeline and runtime logs read-only — concrete CLI commands or MCP tools>

## Risk Register

For each identified risk: name, the cross-check lens that surfaced it, likelihood, impact, and a concrete mitigation step. Tying every risk back to a lens makes the register auditable — a future reader can see *why* each item is on the list.

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| <risk> | Devil's advocate / Pre-mortem / Unknown unknowns / Research finding | <L/M/H> | <L/M/H> | <concrete step> |

## Getting Started

<3-5 concrete first steps to deploy the project to the recommended platform. Specific to the tech stack — not generic. E.g., "Install wrangler: npm i -g wrangler", "Run: wrangler init <project-name>".>

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
```

Zapisz do `context/foundation/infrastructure.md` (lub ścieżki wersjonowanej, jeśli została wybrana). Utwórz `context/foundation/`, jeśli nie istnieje.

Po zapisie skopiuj wskazówkę następnego kroku do schowka:

```bash
echo -n "/10x-implement" | pbcopy 2>/dev/null || echo -n "/10x-implement" | clip.exe 2>/dev/null || echo -n "/10x-implement" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard "/10x-implement"
```

Wyświetl:

```
═══════════════════════════════════════════════════════════
  INFRASTRUCTURE DECISION RECORDED
═══════════════════════════════════════════════════════════

  Platform:      <recommended platform>
  Runner-up:     <runner-up>
  Bias checks:   3 / 3 passed

  ► Decision:    context/foundation/infrastructure.md
  ► Next:        /10x-implement  (✓ copied to clipboard)
═══════════════════════════════════════════════════════════
```

STOP. Nie przechodź automatycznie do `/10x-implement` — użytkownik uruchamia ją, gdy jest gotowy.

## Wynik

Zapisany pojedynczy plik: `context/foundation/infrastructure.md` (lub `infrastructure-vN.md`, jeśli wybrano zapis wersjonowany).

## Referencje

- `references/agent-friendly-criteria.md` — pięć kryteriów platformy, wskazówki punktacji i uwagi dotyczące wag.

## Krytyczne zabezpieczenia

1. **Najpierw badanie, potem rekomendacja.** Nigdy nie rekomenduj platformy wyłącznie na podstawie znajomości z danych treningowych. Zawsze przeprowadzaj równoległe badanie sieciowe (Krok 2) za pomocą `WebSearch` / `WebFetch` przed punktacją. Nieaktualne przekonania dotyczące cen lub obsługi funkcji prowadzą do błędnych rekomendacji.

2. **Stos technologiczny jest twardym ograniczeniem, a nie preferencją.** Jeśli stos technologiczny wymaga runtime, którego platforma nie obsługuje (np. Python na runtime edge wyłącznie dla JS), ta platforma zostaje odrzucona — żadna punktacja tego nie zmienia.

3. **Trzech kandydatów, nie jeden.** Zawsze twórz krótką listę trzech platform. Użytkownik potrzebuje alternatyw na wypadek, gdy najlepszy wybór zostanie zablokowany przez koszt, vendor lock-in lub ograniczenia organizacyjne.

4. **Anti-bias nie podlega negocjacji.** Trzy prompty weryfikacyjne (adwokat diabła, pre-mortem, nieznane niewiadome) są uruchamiane przy każdym wywołaniu. Nie pomijaj ich nawet wtedy, gdy najlepsza platforma jest oczywistym dopasowaniem. Weryfikacja ujawnia ryzyka, które oczywiste dopasowania ukrywają.

5. **Odpowiedzi z wywiadu determinują wagi, a nie wykluczenia.** Poza twardym filtrem dotyczącym trwałych połączeń względem serverless, odpowiedzi z wywiadu dostosowują wagi — nie dyskwalifikują platform. Użytkownik wrażliwy na koszty może nadal wybrać Fly.io, jeśli wynik DX jest wystarczająco wysoki; odpowiedź z wywiadu informuje punktację, a nie pulę kandydatów.

6. **Zakresem jest MVP, nie produkcja.** Umiejętność optymalizuje szybkość iteracji, niski narzut operacyjny i koszt przy małym ruchu. Nie wprowadzaj zagadnień skali produkcyjnej (failover wieloregionowy, zobowiązania SLA, dedykowane poziomy wsparcia), chyba że PRD wyraźnie ich wymaga.

7. **Wewnętrzne etykiety umiejętności pozostają wewnętrzne.** Rozmawiając z użytkownikiem, nigdy nie odwołuj się do numerów kroków ani wewnętrznych nazw pól. Używaj prostego języka: „porównanie platform”, „rekomendowana opcja”, „rejestr ryzyk”.

8. **Weryfikuj polecenia „Getting Started” względem dokładnych wersji w tech stacku, a nie ogólnej dokumentacji platformy.** Adaptery platform, CLI i łańcuchy narzędzi wdrożeniowych ewoluują szybko — przepływ pracy kanoniczny w jednej głównej wersji może zostać zastąpiony lub być aktywnie błędny w kolejnej. Przed zapisaniem dowolnego polecenia CLI lub rekomendacji dla lokalnego rozwoju w sekcji „Getting Started” sprawdź, co konkretna wersja adaptera/narzędzia w `tech-stack.md` faktycznie robi obecnie. Zwróć szczególną uwagę na: (a) czy serwer deweloperski frameworka zapewnia już zgodność runtime z docelową platformą (przez co osobne natywne dla platformy polecenie deweloperskie jest zbędne lub przestarzałe), (b) czy API, klucze konfiguracji lub wzorce dostępu do środowiska zmieniły się między głównymi wersjami oraz (c) czy narzędzia platformy zostały połączone, przemianowane lub wycofane między tym, co opisuje ogólna dokumentacja, a tym, co faktycznie zawierają przypięte wersje projektu. Przedstaw wszelkie różnice zachowania wynikające z wersji jako „Nieznane niewiadome” w weryfikacji krzyżowej i odzwierciedlaj wyłącznie poprawny, zgodny z wersją przepływ pracy w „Getting Started”. Nigdy nie kopiuj poleceń CLI dosłownie ze stron marketingowych platformy ani ogólnych tutoriali bez potwierdzenia, że dotyczą dokładnych wersji stosu będących w użyciu.