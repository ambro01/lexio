---
name: 10x-new
description: Initialize a new change folder under context/changes/<change-id> with a change.md identity file
argument-hint: "<change-id-or-path> [freeform intent]"
allowed-tools:
  - Read
  - Glob
  - Write
  - Bash
  - AskUserQuestion
---
# /10x-new — Rozpocznij nową zmianę

Uruchom nowy folder zmiany w `context/changes/<change-id>/`. Tworzy mały plik tożsamości (`change.md`) i wskazuje użytkownikowi następną umiejętność.

„Zmiana” to pojedyncza jednostka pracy od początku do końca — badanie, planowanie, implementacja i przegląd znajdują się w jednym folderze oznaczonym przez `<change-id>`.

## Początkowa odpowiedź

Gdy to polecenie zostanie wywołane:

1. **Sprawdź, czy podano jakikolwiek argument**:
   - Jeśli podano argument, przeanalizuj go (zobacz „Parsowanie argumentu” poniżej) i przejdź do „Walidacji”.
   - Jeśli NIE podano argumentu, odpowiedz następującą wiadomością i **ZATRZYMAJ SIĘ**:

```
I'll create a new change folder. Please provide a change-id (kebab-case slug):

Examples:
  /10x-new context-dir-restructure
  /10x-new oauth-login add Google sign-in so users skip the email-password step
  /10x-new @context/changes/oauth-login/

The first token becomes the change-id. Anything after it is freeform intent — used to write a richer title and to pick the next-step suggestion. Path-style references (with or without a leading `@`) are accepted; the last path segment is used as the change-id.

The change-id must be:
- kebab-case (lowercase letters, digits, hyphens; no leading/trailing hyphen, no double hyphens)
- unique across `context/changes/` and `context/archive/`
```

   Następnie **poczekaj**, aż użytkownik poda argument.

## Parsowanie argumentu

Podziel surowy ciąg argumentu przy pierwszym ciągu białych znaków:

- **Pierwszy token** = referencja `change-id`. Znormalizuj ją:
  1. Usuń początkowy znak `@`, jeśli występuje (`@context/changes/feature-x/` → `context/changes/feature-x/`).
  2. Usuń końcowy znak `/`, jeśli występuje.
  3. Jeśli wynik zawiera `/`, pobierz ostatni niepusty segment ścieżki (`context/changes/feature-x` → `feature-x`).
  4. Wynikiem jest `<change-id>`.
- **Wszystko po pierwszym tokenie** = dowolny zamiar. Może być pusty. Może być zdaniem lub akapitem. **Nie** traktuj go jako dosłownego tytułu do wstawienia bez zmian.

Przykłady:

| Surowe dane wejściowe | `<change-id>` | Zamiar |
|-----------|---------------|--------|
| `feature-x` | `feature-x` | (pusty) |
| `oauth-login add Google sign-in for faster onboarding` | `oauth-login` | `add Google sign-in for faster onboarding` |
| `@context/changes/oauth-login/` | `oauth-login` | (pusty) |
| `@context/changes/oauth-login/ revisit the token-refresh edge case` | `oauth-login` | `revisit the token-refresh edge case` |
| `My Feature add OAuth` | `My Feature` (nie przejdzie kontroli kebab-case) | `add OAuth` |

## Walidacja

Przed utworzeniem czegokolwiek:

1. **Kontrola kebab-case**: `<change-id>` musi pasować do `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` (zaczyna się literą, segmenty małych liter + cyfr rozdzielone pojedynczymi myślnikami, bez początkowego/końcowego myślnika, bez podwójnych myślników).
   - W przypadku niepowodzenia wypisz: `error: change-id "<id>" is not kebab-case. Use lowercase letters, digits, and single hyphens only (e.g., "oauth-login", not "OAuth Login").` i ZATRZYMAJ SIĘ.

2. **Kontrola unikalności**: ani `context/changes/<change-id>/`, ani `context/archive/<change-id>/` nie mogą już istnieć.
   - W przypadku kolizji wypisz: `error: change "<id>" already exists at <path>. Pick a different change-id or work inside the existing folder.` i ZATRZYMAJ SIĘ.

3. **Istnienie katalogu nadrzędnego `context/changes/`**: jeśli go brakuje, wypisz `error: context/changes/ not found — is this repo set up for the 10x context structure?` i ZATRZYMAJ SIĘ. (NIE twórz automatycznie katalogu nadrzędnego; to znak, że repozytorium nie jest gotowe).

## Tworzenie

1. Utwórz katalog `context/changes/<change-id>/`.
2. Wyprowadź `<title>`:
   - Jeśli ciąg zamiaru jest pusty, przekształć `change-id` w formę czytelną dla człowieka: zamień myślniki na spacje i zapisz pierwszą literę wielką (np. `multi-course-access` → `Multi course access`).
   - Jeśli ciąg zamiaru nie jest pusty, napisz zwięzły, czytelny dla człowieka tytuł (≤ 80 znaków, wielkość liter jak w zdaniu, bez końcowej kropki), który oddaje temat zmiany. Zamiar jest *wskazówką*, a nie tekstem dosłownym — możesz go przeformułować. Nie wstawiaj akapitu do tytułu.
3. Wyprowadź treść `## Notes`:
   - Jeśli ciąg zamiaru jest pusty, dodaj komentarz podpowiedzi: `<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->`
   - Jeśli ciąg zamiaru nie jest pusty, wstaw go dosłownie jako treść Notes — słowa użytkownika są zalążkiem. W takim przypadku nie dodawaj również komentarza podpowiedzi (użytkownik pokazał, że wie, do czego służą Notes).
4. Zapisz `context/changes/<change-id>/change.md` w dokładnie takiej formie (miejsce `<notes-body>` zawiera wynik kroku 3):

```markdown
---
change_id: <change-id>
title: <title>
status: new
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
archived_at: null
---

## Notes

<notes-body>
```

`<YYYY-MM-DD>` to dzisiejsza data (użyj `date +%Y-%m-%d`).

Pełny opis schematu znajdziesz w `reference/change-md.md` (dozwolone wartości statusu, przejścia, co celowo NIE znajduje się w `change.md`).

## Sugestia następnego kroku

Po pomyślnym utworzeniu wyświetl monit o następnym kroku i skopiuj sugerowane polecenie do schowka.

Domyślnym następnym krokiem jest `/10x-plan <change-id>` — większość zmian przechodzi bezpośrednio do planowania. Pozostałe dwie umiejętności są sytuacyjne: `/10x-research`, gdy przeanalizowany zamiar (lub otaczająca tura) sugeruje, że zmiana wymaga znaczącej eksploracji bazy kodu przed napisaniem planu, oraz `/10x-frame`, gdy zamiar sygnalizuje, że ujęcie problemu jest podejrzane — albo ma formę błędu („fix”, „bug”, „broken”, „why is”, „root cause”, „regression”, „self-diagnosed solution”), albo formę zakresu/projektu („should we even”, „is this the right”, „what's actually broken”, „rethink”, „challenge the assumption”). Wybierz opcję sytuacyjną tylko wtedy, gdy sygnał jest wyraźny; w przeciwnym razie domyślnie użyj `/10x-plan`.

```bash
NEXT_CMD="/10x-plan <change-id>"   # default; see above for when to switch to /10x-research or /10x-frame
echo -n "$NEXT_CMD" | pbcopy 2>/dev/null || echo -n "$NEXT_CMD" | clip.exe 2>/dev/null || echo -n "$NEXT_CMD" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard $NEXT_CMD
```

Następnie wyświetl:

```
✓ Created context/changes/<change-id>/change.md (status: new)

Next step:
  → <NEXT_CMD>  (✓ copied to clipboard)

Other options:
  /10x-research <change-id>   — explore the codebase first (when planning needs grounding)
  /10x-frame <change-id>      — challenge the framing first (when the symptom and proposed fix are stated as one, or when the right scope to plan is unclear)
```

Jeśli żadne narzędzie schowka nie jest dostępne (`pbcopy`, `clip.exe`, `xclip`, `Set-Clipboard`), usuń adnotację `(✓ copied to clipboard)`, ale nadal wyświetl sugestię.

## Czego ta umiejętność NIE robi

- Nie zapisuje `frame.md`, `research.md`, `plan.md` ani żadnego innego artefaktu — są one tworzone przez odpowiednie umiejętności.
- Nie zapisuje do żadnego pliku pomocniczego stanu; sekcja `## Progress` w `plan.md` jest jedynym źródłem prawdy o stanie wykonania.
- Nie wymusza przejść statusów — `change.md` służy wyłącznie jako zapis.
- Nie tworzy katalogu nadrzędnego `context/changes/`; jeśli go brakuje, repozytorium nie zostało zainicjowane dla tej struktury i użytkownik powinien najpierw to rozwiązać.