---
name: 10x-lesson
description: Capture a recurring rule or pattern into context/foundation/lessons.md. Use when you spot a class of bug or design pitfall worth surfacing for future reviews and implementations.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
---
# /10x-lesson — Utrwal powtarzającą się regułę

Dodaj pojedynczy wpis do `context/foundation/lessons.md`, aby przyszłe uruchomienia `/10x-frame`, `/10x-research`, `/10x-plan`, `/10x-plan-review`, `/10x-implement` i `/10x-impl-review` ponownie odczytywały go jako wcześniejszą wskazówkę. To proaktywny odpowiednik opcji triage „Accept as recurring rule” w `/10x-impl-review` — wywołaj go inline, gdy zauważysz wzorzec wart uwidocznienia bez czekania na ustrukturyzowany przegląd.

„Lekcja” to powtarzająca się reguła — nie jednorazowa poprawka błędu. Kryterium brzmi: „to zmieniłoby sposób ujęcia problemu lub poprawkę w przeszłych pracach i będzie wciąż wracać”. Jeśli to opis pojedynczego incydentu, jest to niewłaściwa umiejętność.

## Odpowiedź początkowa

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli opis swobodny został podany inline** (np. `/10x-lesson feature flags should always have a kill date`), użyj go jako zalążka pola Reguła i przejdź do wywiadu.
2. **Jeśli nic nie podano**, odpowiedz:

```
I'll record a recurring rule into context/foundation/lessons.md.

I'll ask four short questions and then append the entry. The four fields are:
  1. Context — where this rule applies (subsystem / phase / file pattern)
  2. Problem — what goes wrong without the rule
  3. Rule — the rule itself, in one or two sentences
  4. Applies to — which skills should weigh this most (frame / plan / implement / review)

Then wait.
```

## Proces

### Krok 1: Wywiad

Użyj AskUserQuestion, aby zebrać cztery pola. Możesz zadać je zbiorczo w jednej rundzie czterech swobodnych promptów (każdy zestaw opcji to tylko `["I'll fill it in"]` — tj. użytkownik wybiera „Other”, aby wpisać odpowiedź) albo przeprowadzić cztery sekwencyjne rundy. Obie formy są poprawne; celem jest, aby to użytkownik, a nie umiejętność, sformułował treść.

Nie wstępnie uzupełniaj niczego. Użytkownik podaje każde pole. Jeśli w wywołaniu przekazano swobodną intencję, pokaż ją jako sugestię obok promptu Reguła — nie jako wartość domyślną.

Cztery pola wraz z jednolinijkowymi wskazówkami:

- **Kontekst** — gdzie ta reguła ma zastosowanie? Podsystem / faza / wzorzec pliku. Bądź wystarczająco konkretny, aby przyszła umiejętność mogła dopasować wzorzec (np. „any phase that adds a feature flag”, „research on multi-tenant systems”, a nie „everywhere”).
- **Problem** — co konkretnie idzie źle, jeśli reguła zostanie naruszona? Przytocz przeszły incydent lub powtarzający się kształt awarii. Jedno lub dwa zdania.
- **Reguła** — sama reguła, w trybie rozkazującym („Always …”, „Never …”, „Before X, do Y”). Jedno lub dwa zdania. Osoba czytająca przyszły przegląd powinna móc wkleić to dosłownie do ustalenia.
- **Dotyczy** — rozdzielona przecinkami lista nazw umiejętności, dla których ta reguła powinna mieć największą wagę: `frame`, `research`, `plan`, `plan-review`, `implement`, `impl-review`. Użyj `all`, jeśli reguła obejmuje cały cykl życia.

### Krok 2: Wyświetl i potwierdź

Wyrenderuj proponowany wpis jako blok markdown i pokaż go użytkownikowi. Użyj AskUserQuestion, aby potwierdzić:

- question: "Append this lesson to `context/foundation/lessons.md`?"
  header: "Confirm"
  options:
  - label: "Append"
    description: "Save the entry as shown."
  - label: "Edit"
    description: "Let me revise one or more fields before saving."
  - label: "Cancel"
    description: "Discard — don't save anything."
    multiSelect: false

Kształt proponowanego wpisu (jest to kanoniczny format wpisu lekcji):

```markdown
## <Rule title — short imperative phrase, derived from the Rule field>

- **Context**: <Context field>
- **Problem**: <Problem field>
- **Rule**: <Rule field>
- **Applies to**: <Applies-to field>
```

Nagłówek H2 JEST tytułem reguły. Zachowaj jego zwięzłość — lista H2 jest tym, co przyszłe umiejętności skanują najpierw.

### Krok 3: Samoczynne utworzenie i dodanie

Jeśli `context/foundation/lessons.md` nie istnieje, utwórz go z tym kanonicznym 5-wierszowym nagłówkiem (osadzonym inline — bez osobnego pliku szablonu; ten sam nagłówek jest używany przez gałąź triage „Accept as recurring rule” w `/10x-impl-review` oraz tutaj):

```
# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

```

Jeśli plik istnieje, pozostaw go bez zmian i dodaj wpis na końcu. Nie zmieniaj kolejności, nie usuwaj duplikatów ani nie formatuj ponownie istniejących wpisów — plik jest wyłącznie do dopisywania.

Użyj Edit (lub Write w przypadku utworzenia) do wprowadzenia zmiany. Po dodaniu ponownie odczytaj plik i potwierdź, że nowy H2 jest ostatnią sekcją.

### Krok 4: Wyświetl wynik

Wypisz ścieżkę i tytuł reguły:

```
Appended to context/foundation/lessons.md:
  ## <Rule title>
```

Zatrzymaj się. Nie przechodź do innych umiejętności. Użytkownik wywołał to w celu pojedynczego utrwalenia; respektuj zakres.

## Uwagi

- **Tylko dopisywanie.** Nigdy nie edytuj ani nie usuwaj istniejących lekcji za pomocą tej umiejętności. Jeśli reguła wymaga poprawy, użytkownik otwiera plik i edytuje go bezpośrednio — to celowe utrudnienie, ponieważ przepisywanie powtarzających się reguł bez namysłu jest trybem awarii, któremu ta konwencja zapobiega.
- **Jeden wpis na wywołanie.** Jeśli użytkownik ma wiele lekcji do utrwalenia, wywołuje umiejętność wielokrotnie. Grupowanie sprzyja wpisom napisanym tylko częściowo.
- **Samoczynne utworzenie jest domyślne.** Nie mów użytkownikowi „run /10x-init first” — utwórz plik z kanonicznym nagłówkiem przy pierwszym użyciu. (`/10x-init` tworzy szkielet katalogu `/context`; ta umiejętność obsługuje `lessons.md` kompleksowo.)
- **Nie uzupełniaj wstępnie niczego.** W przeciwieństwie do gałęzi triage `/10x-impl-review` (która wstępnie uzupełnia Kontekst i Problem na podstawie ustalenia), ta proaktywna umiejętność oczekuje, że użytkownik wykona pisanie. To cena utrwalania reguł poza ustrukturyzowanym przeglądem.