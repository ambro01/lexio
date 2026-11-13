---
name: 10x-frame
description: >
  Challenge framing assumptions about WHAT to build before planning HOW. Use
  when input is a "bug + proposed fix", a scope question, a design choice,
  or any case where the observation and the stated cause (or the problem and
  the solution) are presented as one. Trigger phrases: "fix", "bug",
  "broken", "root cause", "should we even", "is this the right", "challenge
  the assumption", "rethink", "before I plan". Use BEFORE /10x-plan, not in
  place of it.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Bash
  - Agent
  - Task
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---
# Ramy: Podważ założenia przed planowaniem

Plany zbudowane na błędnym opisie problemu są doskonałymi rozwiązaniami niewłaściwego pytania. Ta umiejętność istnieje w jednym celu: oddzielić **obserwację** od **podanej przyczyny** — oraz **problem** od **proponowanego rozwiązania** — zanim rozpocznie się jakiekolwiek planowanie.

Sytuacja, którą obejmuje ta umiejętność, jest ogólna: użytkownik opisuje coś (obserwację, postrzegany problem, zakres, którego chce się podjąć) i jednocześnie proponuje odpowiedź (przyczynę, podejście, strukturę planu). Te dwa elementy są traktowane jak jeden fakt. Doskonały /10x-plan dostarcza wtedy doskonałe rozwiązanie — a rzeczywisty problem pozostaje, ponieważ ramy były błędne; plan był poprawny; użytkownik stracił dzień.

Ta umiejętność stanowi etap ustalania ram. /10x-plan odpowiada na pytanie *jak to zbudować*. /10x-frame odpowiada na pytanie *co właściwie należy zaplanować*.

## Kiedy używać, kiedy pominąć

**Użyj, gdy**: dane wejściowe mają formę błędu („X jest zepsute, zbudujmy Y”), formę zakresu („powinniśmy podzielić to na dwa plany”, „czy to w ogóle jest właściwy zakres?”), formę projektu („jakie podejście w ogóle chcemy wybrać?”) lub formę założenia („zakładamy X — czy to prawda?”). Użyj również, gdy stawka jest wysoka, gdy system jest użytkownikowi nieznany albo gdy /10x-plan ma zaraz rozpocząć pracę nad zadaniem, które pachnie podaną przyczyną zamiast zweryfikowaną.

**Pomiń, gdy**: zadanie jest czysto mechaniczną zmianą („zmień nazwę tej funkcji”, „podnieś wersję zależności”), użytkownik sam już ustalił ramy i je zweryfikował („Potwierdziłem to — zaplanuj poprawkę”) albo prośba dotyczy jasno określonej funkcji bez ukrytej przesłanki do podważenia.

W razie wątpliwości ta umiejętność zadaje krótką serię pytań i tanio kończy działanie, jeśli ramy okażą się solidne. Koszt uruchomienia jej dla jasnej prośby: ~2–3 pytania. Koszt pominięcia jej dla źle ujętego zadania: błędny plan i stracony dzień.

## Relacja z innymi umiejętnościami

- `/10x-research` — szeroka eksploracja bazy kodu. Frame może przyjąć dokument badawczy jako dane wejściowe, ale go nie zastępuje.
- `/10x-plan` — przyjmuje wynik frame jako dane wejściowe. Frame Brief JEST prawidłowym pierwszym argumentem dla /10x-plan.
- `/10x-plan-review` — weryfikuje istniejący plan. Frame weryfikuje *przesłankę*, zanim plan powstanie.

Frame Brief jest użyteczny samodzielnie (jako artefakt do dyskusji lub do określenia zakresu szybkiej poprawki) — nie wymaga, aby później użyć /10x-plan.

## Początkowa odpowiedź

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli podano ścieżkę pliku lub change-id** (np. `/10x-frame @context/changes/foo/research.md` lub `/10x-frame foo`), rozwiąż go: `<change-id>` wskazuje na `context/changes/<change-id>/research.md` (przeczytaj go, jeśli istnieje). Przeczytaj plik W CAŁOŚCI i przejdź do Kroku 1.
2. **Jeśli opis problemu podano inline**, przejdź do Kroku 1.
3. **Jeśli nic nie podano**, odpowiedz:

```
Pomogę Ci sprawdzić, czy właściwie definiujesz problem przed zaplanowaniem rozwiązania.

Udostępnij proszę:
1. Obserwację — co się dzieje, co widzisz lub jaki zakres rozważasz?
2. Swoje początkowe ujęcie — co Twoim zdaniem to powoduje, jakie podejście masz na myśli lub jak podzieliłbyś pracę?
3. (Opcjonalnie) Powiązane badania, wcześniejsze incydenty lub pliki, które powinienem przeczytać

Wskazówka: przekaż badania bezpośrednio — `/10x-frame @context/changes/<change-id>/research.md` (lub po prostu `<change-id>`)
```

Następnie czekaj.

## Proces

### Krok 1: Uchwyć ramy — obserwację i podaną przyczynę utrzymuj ROZDZIELNIE

To najważniejszy krok. Nie pomijaj go. Nie scalaj tych elementów.

Przeczytaj `context/foundation/lessons.md`, jeśli istnieje, i użyj wcześniejszych lekcji dotyczących sposobu ujmowania problemów (powtarzających się pułapek w ustalaniu ram i zaakceptowanych zasad) jako wcześniejszych przesłanek podczas tworzenia mapy wymiarów w Kroku 2 — to kluczowy kontekst, a nie opcjonalna lektura.

Przeczytaj W CAŁOŚCI każdy plik wspomniany przez użytkownika. Następnie wyodrębnij i zapisz trzy rzeczy, **wyraźnie oddzielone**:

- **Zgłoszona obserwacja** — dosłownie obserwowalna rzecz. Nie przyczyna. Nie poprawka. Efekt widziany przez użytkownika lub operatora albo pytanie o zakres/projekt w podanym brzmieniu.
- **Podana przez użytkownika przyczyna lub podejście** — to, co według niego powoduje obserwację, albo ramy, które wnosi do pracy.
- **Proponowany przez użytkownika kierunek** — co chce z tym zrobić.

Powtórz je jako trzy oddzielne punkty i potwierdź:

```
Upewnijmy się, że dobrze to rozumiem:

  Obserwacja (co stwierdzono):     [dosłowny efekt lub pytanie o zakres/projekt]
  Twoje początkowe ujęcie:         [teoria lub podejście użytkownika]
  Twój proponowany kierunek:       [co użytkownik chce z tym zrobić]

Zanim zaplanujemy pracę, zakwestionuję przyjęte ramy. Obserwacja jest pewnym
gruntem — to wiemy. Wszystko pozostałe jest hipotezą, dopóki nie zostanie zweryfikowane.
```

Ramy są w tym momencie zablokowane. Nawet jeśli użytkownik nalega („po prostu zaplanuj poprawkę”), nie scalaj obserwacji z ujęciem problemu. Cała ta umiejętność opiera się na tym rozdzieleniu.

Jeśli użytkownik nie podał jasnego początkowego ujęcia („coś jest nie tak, napraw to”), pomiń punkt dotyczący ram i zaznacz, że przypadek opiera się wyłącznie na obserwacji — umiejętność staje się bardziej otwarta, ale protokół nadal obowiązuje.

### Krok 1.5: Pytania wyjaśniające przed delegowaniem

Ten krok jest wykonywany zawsze. Przed utworzeniem mapy wymiarów (Krok 2) lub delegowaniem równoległych pod-agentów (Krok 3), zatrzymaj się na jedną rundę pytań wyjaśniających przy każdym wywołaniu. Celem jest rozróżnienie *obserwacji i zakresu* — „która z tych pozycji jest główną obawą?”, „czy to jedna obserwacja, czy kilka?”, „czy obserwowalne zjawisko to pojedynczy objaw, czy klasa objawów?” — aby mapa wymiarów została zbudowana względem skupionej obserwacji, a nie wielotorowej listy zadań.

Użyj AskUserQuestion z **2–3 pytaniami** w jednej rundzie. Każda opcja opisuje obserwację lub pozycję dotyczącą zakresu — co użytkownik rzeczywiście widzi albo który wycinek pracy chce najpierw zbadać — nigdy przyczynę, podejście ani poprawkę. Zawsze uwzględnij opcję „Nie jestem pewien / jeszcze ich nie rozdzieliłem”, odzwierciedlającą zasadę pewności jako sygnału z Kroku 4.

Pytania te podlegają zabezpieczeniu nr 4 poniżej („Pytania zawężające ≠ pytania o rozwiązanie”). Pytania przed delegowaniem opisują obserwacje lub pozycje dotyczące zakresu, nigdy przyczyny ani poprawki. Jeśli zauważysz, że tworzysz opcję proponującą poprawkę lub podejście, wkroczyłeś na terytorium /10x-plan — zatrzymaj się i przepisz ją jako obserwację.

Zapisz odpowiedzi w rejestrze ram obok zapisu z Kroku 1; Frame Brief z Kroku 6 zachowuje oba elementy jako oddzielne punkty w sekcji „Initial Framing (preserved)” (nowy wiersz `Pre-dispatch narrowing`). Pierwotna obserwacja, podana przyczyna i proponowany kierunek pozostają dosłownie takie jak w Kroku 1; zawężenie z Kroku 1.5 stanowi dodatkową warstwę, a nie zastępstwo.

Ten krok nie deleguje pod-agentów — to nadal zadanie Kroku 3.

### Krok 2: Zmapuj wymiary problemu

Utwórz **mapę** wymiarów, z których może wynikać obserwacja — dla TEJ sytuacji TEGO użytkownika. Nie sięgaj po ogólny szablon; wartość mapy wynika z jej dopasowania do systemu, bazy kodu lub przestrzeni projektowej, którą analizujesz.

Jak zbudować mapę:

- **Najpierw czytaj.** Otwórz pliki wspomniane przez użytkownika. Otwórz sąsiednie pliki. Prześledź ścieżkę od podanej przyczyny do obserwowanego efektu — *niezależnie od tego, czy jest to przepływ danych w czasie wykonywania, łańcuch decyzji projektowych, czy sekwencja założeń*. Wymiary wynikają z tego, co rzeczywiście istnieje: etapów wejścia, transformacji, stanu, efektów ubocznych; osi przestrzeni projektowej; lub warstw decyzji o zakresie. Nie wymieniaj wymiarów, dla których nie widziałeś dowodów.
- **Użyj pod-agentów, gdy obszar jest duży lub nieznany.** Uruchom jednego lub dwóch pod-agentów Explore z poleceniami takimi jak: „Prześledź ścieżkę od <stated cause> do <observed effect>. Wypisz każdy odrębny etap lub oś, przez które przechodzi ten łańcuch, z odniesieniami file:line lub document:section.” Mapa to wynik ich pracy — nie to, co zgadłeś przed lekturą.
- **Traktuj każdy wymiar jako możliwe źródło.** Użyteczny wymiar to taki, w którym, gdyby ujęcie problemu załamało się w tym punkcie, widziałbyś mniej więcej tę obserwację. Wymiary, które nie mogłyby wiarygodnie wywołać obserwacji, nie należą na mapę.

**Przypnij obserwację do mapy**: na którym wymiarze ląduje ujęcie użytkownika? Skąd jeszcze *mogłaby* pochodzić obserwacja? Ujęcie użytkownika jest jednym węzłem mapy; reszta mapy to przestrzeń hipotez.

Przedstaw mapę zwięźle w formie tekstu:

```
Obserwacja może pochodzić z każdego z tych wymiarów:

  1. [Wymiar A] — [co mogłoby pójść nie tak / co zakładają tu ramy]
  2. [Wymiar B] — [co mogłoby pójść nie tak / co zakładają tu ramy]   ← obecne ujęcie użytkownika
  3. [Wymiar C] — [co mogłoby pójść nie tak / co zakładają tu ramy]
  4. [Wymiar D] — [co mogłoby pójść nie tak / co zakładają tu ramy]

Zamierzam zbadać każdy równolegle, zanim podejmiemy decyzję.
```

### Krok 3: Uruchom równoległych agentów hipotez

Użyj TaskCreate, aby zarejestrować jedno zadanie dla każdego wiarygodnego wymiaru. Następnie uruchom równolegle pod-agentów — zazwyczaj 2–4, maksymalnie 5 — używając narzędzia Task, **wszystkich w jednej wiadomości**, aby zapewnić współbieżność.

Dla każdej hipotezy pod-agent bada: „**Gdyby ujęcie problemu załamało się w tym wymiarze, jakich dowodów należałoby się spodziewać i czy takie dowody istnieją?**”

- Użyj `subagent_type: "Explore"` dla „znajdź kod lub dokument obsługujący X, pokaż mi strukturę”.
- Użyj `subagent_type: "general-purpose"` dla „prześledź ten łańcuch i powiedz mi, czy założenie Y jest prawdziwe”.

Każde polecenie musi zawierać:

- Dosłowną obserwację z Kroku 1 (verbatim).
- Konkretną badaną hipotezę wymiaru.
- Ujęcie oczekiwanych dowodów: „Co zobaczylibyśmy, gdyby TO był wymiar, w którym ujęcie problemu się załamuje? Szukaj tego. Zgłoś, czy jest obecne, częściowe czy nieobecne, z odniesieniami file:line lub document:section.”
- Dyrektywę tylko do odczytu — bez edycji.

Gdy wszyscy wrócą, dokonaj syntezy: które hipotezy mają **silne**, **słabe** lub **żadne** dowody? Hipoteza mająca silne dowody, których nie ma początkowe ujęcie użytkownika, jest kandydatem do przeformułowania.

### Krok 4: Pytania zawężające (sokratyczne, nie dotyczące rozwiązania)

Użyj AskUserQuestion. **Pytania i opcje tutaj zasadniczo różnią się od tych w /10x-plan**: w /10x-plan opcje to *wybory rozwiązania*; tutaj opcje są *elementami rozróżniającymi hipotezy*. Odpowiedź użytkownika zawęża przestrzeń hipotez.

**Zasady pytań zawężających:**

- Każde pytanie powinno wyizolować jeden lub dwa wymiary mapy. Właściwe pytanie to takie, którego odpowiedź wyklucza lub potwierdza wymiary.
- Opcje opisują **obserwacje lub pozycje projektowe** — to, co użytkownik rzeczywiście widzi, albo po której stronie rzeczywistego kompromisu się znajduje — nie przyczyny ani rozwiązania.
- Zachowaj krótki `header`: np. „Pattern”, „When”, „Scope”, „Tradeoff”.
- Dąż do łącznie 2–5 pytań — wystarczająco, by triangulować, ale nie na tyle, by przeciągać sprawę.
- ZAWSZE uwzględnij opcję „Nie jestem pewien / nie sprawdzałem”. Pewność użytkownika sama w sobie jest sygnałem; fałszywa pewność jest wrogiem.

Pytanie zawężające, które nie zmienia rankingu hipotez, jest zmarnowane. **Projektuj każde pytanie tak, aby było rozstrzygające.** Jedno dobrze wymierzone pytanie, na które udzielono szczerej odpowiedzi, często samodzielnie rozstrzyga całe zagadnienie przeformułowania.

Jeżeli dowody dla hipotez z Kroku 3 są już rozstrzygające (jedna hipoteza ma silne dowody, pozostałe nie mają żadnych), możesz pominąć pytania i przejść do Kroku 5 — ale powiedz to wyraźnie: „Krok 3 znalazł silne dowody dla [hypothesis] i żadnych dla pozostałych. Pomijam etap pytań; przechodzę bezpośrednio do przeformułowania.”

### Krok 5: Kontrola między systemami — przetestuj wiodącą hipotezę pod presją

Przed sfinalizowaniem przeformułowania przetestuj je pod presją z innego kąta niż badanie, które je wykazało. Celem jest ujawnienie dowodów, których badanie hipotezy nie dostrzegło, a nie potwierdzenie tego, w co już wierzysz.

Wybierz te z poniższych działań, które są przydatne w danym przypadku:

- **Niezależne wyszukiwanie.** Uruchom świeżego pod-agenta Explore z poleceniem, które NIE wymienia wiodącej hipotezy. Opisz wyłącznie obserwację i zapytaj: „Co w tym systemie lub przestrzeni projektowej jest najprawdopodobniej odpowiedzialne? Szukaj bez uprzedzeń.” Jeśli agent niezależnie dochodzi do tej samej hipotezy, pewność rośnie. Jeśli ujawni coś innego, jest to sygnał, który warto uważnie przeanalizować.
- **Poszukaj wcześniejszych wystąpień.** Przeszukaj `context/changes/**/` i `context/archive/**/`, komunikaty commitów oraz historię zgłoszeń pod kątem podobnych obserwacji lub decyzji dotyczących zakresu w tym projekcie. Wcześniejsze incydenty i wcześniejsze decyzje często zawierają odpowiedź albo pozwalają coś wykluczyć.
- **Sprawdź odwrotność.** Jakie inne dowody przewidywałaby wiodąca hipoteza — których jeszcze nie sprawdziłeś? Zweryfikuj je. Co NIE powinno być widoczne, jeśli hipoteza jest prawdziwa? Potwierdź jego brak.
- **Ponownie sprawdź zgodność z podanym przez użytkownika ujęciem.** Jeśli jego pierwotne ujęcie nadal równie dobrze pasuje do dowodów, przeformułowanie może być niepotrzebne. Nie zastępuj działającego ujęcia bardziej eleganckim.

Jeśli testowanie pod presją wzmacnia wiodącą hipotezę, ustal poziom pewności. Jeśli ujawnia wiarygodną alternatywę lub przeczy hipotezie, **zatrzymaj się** i ponownie wykonaj Krok 3 z nową hipotezą na mapie. Przeformułowanie jest wartościowe tylko wtedy, gdy przetrwa uczciwą próbę jego podważenia.

### Krok 6: Zsyntetyzuj Frame Brief

Rozwiąż folder zmiany przed zapisem:

- Jeśli wywołano jako `/10x-frame <change-id>` i istnieje `context/changes/<change-id>/`, zapisz w nim.
- W przeciwnym razie wyprowadź kebab-case `<change-id>` z obserwacji i utwórz folder + `change.md` (odzwierciedlając semantykę `/10x-new`) przed zapisem.
- Odmów, jeśli rozwiązana ścieżka zaczyna się od `context/archive/` — wypisz: „This change is archived. Open a new change with `/10x-new` instead.” i ZATRZYMAJ SIĘ.

Zaktualizuj `change.md`: ustaw `updated: <today>` i tylko jeśli bieżący `status` to `new`, zmień go na `status: preparing`.

Zapisz brief w `context/changes/<change-id>/frame.md` (jeden artefakt na zmianę).

Użyj tego szablonu:

````markdown
# Frame Brief: [Temat]

> Etap ustalania ram przed /10x-plan. Ten dokument rejestruje, co jest *faktycznie*
> przedmiotem problemu, oddzielone od tego, co początkowo założono.

## Zgłoszona obserwacja

[Dosłownie obserwowalny efekt lub podane pytanie o zakres/projekt — skopiowane z
Kroku 1, bez zmian.]

## Początkowe ujęcie (zachowane)

- **Podana przez użytkownika przyczyna lub podejście**: [z Kroku 1]
- **Proponowany przez użytkownika kierunek**: [z Kroku 1]
- **Zawężenie przed delegowaniem**: [z Kroku 1.5 — pozycja dotycząca obserwacji/zakresu wybrana przez użytkownika, jego słowami; „jeszcze nie rozdzielono” samo w sobie jest prawidłową odpowiedzią wartą zapisania]

## Mapa wymiarów

Obserwacja może pochodzić z każdego z tych wymiarów:

1. **[Wymiar A]** — [co mogłoby pójść nie tak / co zakładają tu ramy]
2. **[Wymiar B]** — [...]  ← początkowe ujęcie
3. **[Wymiar C]** — [...]
4. **[Wymiar D]** — [...]

## Badanie hipotez

| Hipoteza | Dowody | Werdykt |
| --- | --- | --- |
| [Wymiar A: krótkie stwierdzenie] | [file:line / document:section / obserwacje] | SILNE / SŁABE / BRAK |
| [Wymiar B: początkowe ujęcie] | [dowody] | SILNE / SŁABE / BRAK |
| [Wymiar C] | [dowody] | SILNE / SŁABE / BRAK |
| [Wymiar D] | [dowody] | SILNE / SŁABE / BRAK |

## Sygnały zawężające

Rozstrzygające obserwacje z Kroku 4 (relacje użytkownika + ustalenia pod-agentów), które
zawęziły przestrzeń hipotez:

- [Obserwacja, która potwierdziła lub wykluczyła wymiar]
- [Obserwacja, która potwierdziła lub wykluczyła wymiar]

## Konwencja między systemami

[Jak zazwyczaj obsługiwana jest ta klasa obserwacji? Czy wiodąca
hipoteza odpowiada tej konwencji?]

## Przeformułowany (lub potwierdzony) opis problemu

> **Rzeczywisty problem, wokół którego należy planować, to**: [jedno zdanie — źródło, nie powierzchnia]

[2–3 zdania wyjaśniające, dlaczego to jest prawdziwy problem i co zmieniłoby się,
gdyby został rozwiązany. Jeśli pierwotne ujęcie się potwierdziło, powiedz to wyraźnie:
„Początkowe ujęcie było prawidłowe — kontynuuj w pierwotnie proponowanym
kierunku.” Nie twórz sztucznego przeformułowania, jeśli dowody go nie wspierają.]

## Pewność

- **WYSOKA** — silne dowody + zgodność z konwencją + rozstrzygający sygnał zawężający
- **ŚREDNIA** — dowody wskazują w jednym kierunku, ale konwencja lub sygnał są słabsze
- **NISKA** — dowody są niejednoznaczne; zalecane dalsze odtworzenie lub
  zbieranie dowodów przed planowaniem

[Wybierz jedną. Jeśli NISKA, wymień konkretny krok weryfikacji potrzebny przed /10x-plan.]

## Co zmienia się dla /10x-plan

[1–2 zdania: czego plan powinien faktycznie dotyczyć, biorąc pod uwagę przeformułowanie.
Jeśli przeformułowanie oznacza „brak zmiany”, stwierdź, że pierwotne ujęcie się potwierdziło.]

## Odniesienia

- Pliki źródłowe: [file:line]
- Powiązane badania: `context/changes/<change-id>/research.md` (jeśli istnieją)
- Zadania badawcze: [lista ID TaskCreate z Kroku 3]
````

Zachowaj zwięzłość briefu — celuj w ~80–150 wierszy. Tabela hipotez jest sednem; wszystko inne ją wspiera.

### Krok 7: Przedstaw i przekaż dalej

Wypisz podsumowanie mieszczące się na jednym ekranie, a następnie zaoferuj przekazanie:

```
═══════════════════════════════════════════════════════════
  FRAME COMPLETE: [Temat]
  Pewność: [WYSOKA/ŚREDNIA/NISKA]
═══════════════════════════════════════════════════════════

  Zgłoszona obserwacja: [jeden wiersz]
  Początkowe ujęcie:     [jeden wiersz]
  Przeformułowany problem: [jeden wiersz — lub „Początkowe ujęcie się potwierdziło”]

  ► Brief: context/changes/<change-id>/frame.md
═══════════════════════════════════════════════════════════
```

Następnie zapytaj:

AskUserQuestion:
- question: "Ramy gotowe. Jak chcesz kontynuować?"
  header: "Następny krok"
  options:
  - label: "Przekaż do /10x-plan"
    description: "Przekaż ten brief do /10x-plan i rozpocznij planowanie implementacji."
  - label: "Najpierw odtwórz / zweryfikuj"
    description: "Pewność jest zbyt niska albo przeformułowanie wymaga ręcznej kontroli przed planowaniem."
  - label: "Omów przed planowaniem"
    description: "Chcę zakwestionować przeformułowanie lub zbadać alternatywy."
  - label: "Zakończ tutaj"
    description: "Sam brief wystarczy — plan nie jest teraz potrzebny."
    multiSelect: false

Jeśli użytkownik wybierze „Przekaż do /10x-plan”, skopiuj polecenie do schowka:

```bash
echo -n "/10x-plan <change-id>" | pbcopy 2>/dev/null || echo -n "/10x-plan <change-id>" | clip.exe 2>/dev/null || echo -n "/10x-plan <change-id>" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard "/10x-plan <change-id>"
```

I wypisz: `→ /10x-plan <change-id> (✓ copied)`

## Krytyczne zabezpieczenia

1. **Dozwolony wniosek: „ramy były prawidłowe”.** Ta umiejętność nie tworzy wartości wyłącznie wtedy, gdy prowadzi do przeformułowania. Jeśli badanie hipotez potwierdza początkowe ujęcie użytkownika, to JEST udane ustalenie ram — powiedz to wprost i zakończ. Sztucznie tworzone przeformułowania są gorsze niż brak ram: wprowadzają zamieszanie, które użytkownik musi później rozplątać.

2. **Obserwacja i podana przyczyna pozostają rozdzielone.** Na każdym etapie. Frame Brief zachowuje pierwotne ujęcie dosłownie — nawet po przeformułowaniu — ponieważ przyszli czytelnicy (oraz /10x-plan-review) muszą widzieć, co założono, a co odkryto.

3. **Bez projektowania rozwiązania.** Ta umiejętność nigdy nie wybiera podejścia implementacyjnego. Nie proponuje faz, zmian plików ani decyzji technicznych. Tworzy JEDEN artefakt: przeformułowany (lub potwierdzony) opis problemu. Właścicielem rozwiązania jest /10x-plan.

4. **Pytania zawężające ≠ pytania o rozwiązanie.** /10x-plan pyta „które podejście?”. /10x-frame pyta „w którym miejscu mapy wymiarów znajduje się rzeczywisty problem?”. Ta zasada wiąże zarówno Krok 1.5 (zawężanie zakresu/obserwacji przed delegowaniem), jak i Krok 4 (zawężanie hipotez po delegowaniu). Opcje opisują obserwacje lub pozycje projektowe, a nie wybory dotyczące sposobu rozwiązania problemu. Jeśli zauważysz, że tworzysz pytanie, którego odpowiedź zmienia *kierunek*, wkroczyłeś na terytorium /10x-plan — zatrzymaj się.

5. **Przeczytaj materiał źródłowy, zanim sięgniesz po wcześniejsze przesłanki.** Materiał źródłowy oznacza kod, dokumentację, wcześniejsze decyzje lub cokolwiek, na czym faktycznie opierają się ramy. Łatwo jest rozpoznać wzorzec na podstawie znajomości danych treningowych i zaproponować przeformułowanie przed badaniem. Nie rób tego. Hipotezy muszą wynikać z mapy wymiarów utworzonej w Kroku 2 na podstawie TEGO materiału, a dowody muszą pochodzić z odczytów pod-agentów w TYM projekcie. Pewnie brzmiące przeformułowanie bez dowodów file:line lub document:section to tryb porażki, któremu ta umiejętność ma zapobiegać.

6. **Bez wypełniania hipotezami.** Jeśli wiarygodne są tylko dwa wymiary, zbadaj dwa. Uruchamianie agentów do badania hipotez bez wiarygodności marnuje budżet i stwarza pozory rygoru.

7. **Ogranicz czas badania.** Frame powinien zwykle zostać ukończony w 2–4 rundach pod-agentów i 2–5 pytaniach. Jeśli trwa to dłużej, przypadek prawdopodobnie wymaga odtworzenia lub zebrania dowodów przed dalszą analizą — zalecaj to i zakończ.

## Uwagi

- To umiejętność **ustalania ram**. Badaj i raportuj — nie edytuj kodu, nie pisz planów.
- Bądź konkretny. Konkretne informacje z `file:line` lub `document:section` są lepsze niż ogólniki.
- Rozróżniaj „dowody znalezione w tym projekcie” (weryfikowalne, z file:line lub document:section) od „mam przeczucie z wcześniejszych systemów, które widziałem” (wcześniejsza przesłanka, niezweryfikowana). Wcześniejsze przesłanki są przydatne do tworzenia hipotez; tylko zweryfikowane dowody należą do Frame Brief.
- Jeśli użytkownik kwestionuje przeformułowanie, potraktuj to poważnie — może znać kontekst, którego badanie nie uwzględniło. Ponownie wykonaj Krok 3 wobec jego zastrzeżenia, zamiast bronić przeformułowania.
- Frame Brief jest jedynym artefaktem. Zachowaj go krótki, łatwy do przejrzenia i użyteczny dla /10x-plan.