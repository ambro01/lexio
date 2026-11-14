import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Eye, Info, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBox, Spinner, actionClass, inputClass, optionClass, requestJson } from "@/components/collection/shared";
import { REVIEW_LIMIT_MAX } from "@/lib/review/requests";
import {
  REVIEW_LIMIT_STORAGE_KEY,
  applyMastered,
  applyRating,
  currentCard,
  dropCurrent,
  isFinished,
  isMasteredResponse,
  isRateResponse,
  isSessionResponse,
  parseLimit,
  progress,
  reveal,
  startSession,
  storedLimitOrDefault,
  summary,
  type SessionRating,
  type SessionState,
} from "@/lib/review/session";
import { cn } from "@/lib/utils";
import type { Tag } from "@/types";

// The "Powtórka" island (S-06): the start screen, the session and the summary. The queue logic lives in
// session.ts; every rating is saved by the API right away, which does all FSRS work (ts-fsrs stays on the server).

interface Props {
  tags: Tag[];
}

type Mode = "general" | "tag";

type Screen = { kind: "start" } | { kind: "empty"; mode: Mode } | { kind: "session"; session: SessionState };

type Action = { kind: "rate"; rating: SessionRating } | { kind: "mastered" };

const primaryClass = "w-full bg-purple-600 text-white hover:bg-purple-500 sm:w-auto";
const wideActionClass = cn(actionClass, "w-full sm:w-auto");

const RATINGS: { rating: SessionRating; label: string; hint?: string }[] = [
  { rating: "again", label: "Nie pamiętam" },
  { rating: "hard", label: "Trudne", hint: "pamiętam, z trudem" },
  { rating: "good", label: "Łatwe" },
];

// The stored limit is read only in the browser; the server render and hydration use the default.
const subscribeNever = () => () => undefined;

function readStoredLimit(): number {
  try {
    return storedLimitOrDefault(window.localStorage.getItem(REVIEW_LIMIT_STORAGE_KEY));
  } catch {
    return storedLimitOrDefault(null);
  }
}

function storeLimit(limit: number): void {
  try {
    window.localStorage.setItem(REVIEW_LIMIT_STORAGE_KEY, String(limit));
  } catch {
    // Storage unavailable or full: the limit is simply not remembered.
  }
}

export default function ReviewSession({ tags }: Props) {
  const storedLimit = useSyncExternalStore(subscribeNever, readStoredLimit, () => storedLimitOrDefault(null));
  const [mode, setMode] = useState<Mode>("general");
  const [tagId, setTagId] = useState(tags[0]?.id ?? "");
  const [limitInput, setLimitInput] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "start" });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action["kind"] | null>(null);
  const [failed, setFailed] = useState<{ message: string; action: Action } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);
  // Guards a double tap before the disabled buttons re-render (the API also rejects a second rating with 409).
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const limitValue = limitInput ?? String(storedLimit);
  const limit = parseLimit(limitValue);
  const tagMode = mode === "tag";
  const canStart = limit !== null && (!tagMode || tagId !== "") && !starting;

  function backToStart() {
    setScreen({ kind: "start" });
    setFailed(null);
    setNotice(null);
  }

  async function start() {
    if (limit === null || (tagMode && tagId === "")) {
      return;
    }
    storeLimit(limit);
    setStartError(null);
    setNotice(null);
    setStarting(true);
    const payload = tagMode ? { tagId, limit } : { limit };
    const result = await requestJson("/api/review/session", "POST", payload, isSessionResponse);
    if (!mounted.current) {
      return;
    }
    setStarting(false);
    if (!result.ok) {
      setStartError(result.message);
      return;
    }
    const { cards } = result.data;
    setScreen(cards.length === 0 ? { kind: "empty", mode } : { kind: "session", session: startSession(cards) });
  }

  async function run(session: SessionState, action: Action) {
    const card = currentCard(session);
    if (!card || inFlight.current) {
      return;
    }
    setFailed(null);
    setNotice(null);
    inFlight.current = true;
    setBusy(action.kind);
    const result =
      action.kind === "rate"
        ? await requestJson("/api/review/rate", "POST", { flashcardId: card.id, rating: action.rating }, isRateResponse)
        : await requestJson(
            `/api/flashcards/${encodeURIComponent(card.id)}/mastered`,
            "PUT",
            { mastered: true },
            isMasteredResponse,
          );
    inFlight.current = false;
    if (!mounted.current) {
      return;
    }
    setBusy(null);
    if (result.ok) {
      const next = action.kind === "rate" ? applyRating(session, action.rating) : applyMastered(session);
      setScreen({ kind: "session", session: next });
      return;
    }
    if (result.status === 404) {
      // Deleted in another tab: skip it and carry on.
      setNotice(result.message);
      setScreen({ kind: "session", session: dropCurrent(session) });
      return;
    }
    if (result.status === 409 && action.kind === "rate") {
      // Rated in another tab or by an overlapping request: skip it and carry on, as for a deleted card.
      setNotice("Ta karta została już oceniona — pomijam ją.");
      setScreen({ kind: "session", session: dropCurrent(session) });
      return;
    }
    // Any other failure keeps the card on screen and lets the user try again.
    setFailed({ message: result.message, action });
  }

  if (screen.kind === "start") {
    return (
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canStart) {
            void start();
          }
        }}
      >
        <fieldset className="space-y-2">
          <legend className="mb-2 block text-sm font-medium text-blue-100/80">Rodzaj powtórki</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                ["general", "Ogólna"],
                ["tag", "Według tagu"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant="outline"
                aria-pressed={mode === value}
                disabled={starting}
                onClick={() => {
                  setMode(value);
                }}
                className={cn(
                  actionClass,
                  "w-full",
                  mode === value && "border-purple-400 bg-purple-600/40 hover:bg-purple-600/50",
                )}
              >
                {label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-blue-100/60">
            {tagMode
              ? "Wszystkie karty wybranego tagu, także opanowane."
              : "Karty do powtórki i nowe karty z całej kolekcji, bez opanowanych."}
          </p>
        </fieldset>

        {tagMode && (
          <div className="space-y-2">
            <label htmlFor="review-tag" className="block text-sm font-medium text-blue-100/80">
              Tag
            </label>
            <select
              id="review-tag"
              value={tagId}
              disabled={tags.length === 0 || starting}
              onChange={(e) => {
                setTagId(e.target.value);
              }}
              className={inputClass}
            >
              {tags.length === 0 && (
                <option value="" className={optionClass}>
                  brak tagów
                </option>
              )}
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id} className={optionClass}>
                  {tag.name}
                </option>
              ))}
            </select>
            {tags.length === 0 && (
              <p className="text-xs text-blue-100/60">Nie masz jeszcze tagów. Dodaj je w Kolekcji.</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="review-limit" className="block text-sm font-medium text-blue-100/80">
            Liczba kart (1–{REVIEW_LIMIT_MAX})
          </label>
          <input
            id="review-limit"
            type="number"
            inputMode="numeric"
            min={1}
            max={REVIEW_LIMIT_MAX}
            step={1}
            value={limitValue}
            disabled={starting}
            onChange={(e) => {
              setLimitInput(e.target.value);
            }}
            aria-invalid={limit === null}
            className={cn(inputClass, "sm:w-32")}
          />
          {limit === null && <p className="text-xs text-red-300">Podaj liczbę całkowitą od 1 do {REVIEW_LIMIT_MAX}.</p>}
        </div>

        <Button type="submit" disabled={!canStart} className={primaryClass}>
          {starting ? <Spinner /> : <Play className="size-4" />}
          Zacznij
        </Button>

        {startError && <ErrorBox message={startError} />}
      </form>
    );
  }

  if (screen.kind === "empty") {
    return (
      <div className="space-y-4" role="status">
        <p className="flex items-center gap-2 text-lg font-semibold text-white">
          <Info className="size-5 shrink-0 text-amber-300" />
          Brak kart do powtórki
        </p>
        <p className="text-sm text-blue-100/80">
          {screen.mode === "tag"
            ? "Ten tag nie ma jeszcze żadnych kart."
            : "Teraz nie ma kart do powtórki ani nowych kart. Wróć później albo dodaj nowe słowa."}
        </p>
        <Button type="button" variant="outline" onClick={backToStart} className={wideActionClass}>
          <RotateCcw className="size-4" />
          Zacznij od nowa
        </Button>
      </div>
    );
  }

  const { session } = screen;

  if (isFinished(session)) {
    const result = summary(session);
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-lg font-semibold text-white" role="status">
          <Check className="size-5 text-green-300" />
          Koniec powtórki
        </p>
        {notice && <p className="text-sm text-amber-200">{notice}</p>}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:max-w-xs">
          <dt className="text-blue-100/70">Powtórzone karty</dt>
          <dd className="text-right font-semibold text-white">{result.reviewed}</dd>
          <dt className="text-blue-100/70">Nie pamiętam</dt>
          <dd className="text-right text-white">{result.again}</dd>
          <dt className="text-blue-100/70">Trudne</dt>
          <dd className="text-right text-white">{result.hard}</dd>
          <dt className="text-blue-100/70">Łatwe</dt>
          <dd className="text-right text-white">{result.good}</dd>
          <dt className="text-blue-100/70">Opanowane</dt>
          <dd className="text-right text-white">{result.mastered}</dd>
        </dl>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button type="button" onClick={backToStart} className={primaryClass}>
            <RotateCcw className="size-4" />
            Zacznij od nowa
          </Button>
          <Button asChild variant="outline" className={wideActionClass}>
            <a href="/dashboard">Dashboard</a>
          </Button>
        </div>
      </div>
    );
  }

  const card = currentCard(session);
  if (!card) {
    return null;
  }
  const { current, total } = progress(session);
  const meanings = card.additionalMeanings.filter((meaning) => meaning.trim() !== "");
  const locked = busy !== null;

  return (
    <div className="space-y-5">
      <p className="text-sm text-blue-100/70" role="status">
        Karta {current} / {total}
      </p>

      {notice && (
        <p className="flex items-center gap-2 text-sm text-amber-200">
          <Info className="size-4 shrink-0" />
          {notice}
        </p>
      )}

      <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-5 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-3xl font-bold break-words text-white">{card.word}</span>
          {card.cefr && (
            <span className="rounded-full bg-purple-500/30 px-2 py-0.5 text-xs font-medium text-purple-100">
              {card.cefr}
            </span>
          )}
          {card.isNew && (
            <span className="rounded-full bg-blue-500/30 px-2 py-0.5 text-xs font-medium text-blue-100">nowa</span>
          )}
        </div>

        {session.revealed && (
          <div className="space-y-1 text-sm">
            <p className="text-lg text-white">{card.translation}</p>
            {meanings.length > 0 && <p className="text-blue-100/70">Inne znaczenia: {meanings.join(", ")}</p>}
            {card.exampleSentence.trim() !== "" && <p className="text-blue-100/70 italic">{card.exampleSentence}</p>}
          </div>
        )}
      </div>

      {session.revealed ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {RATINGS.map(({ rating, label, hint }) => (
            <Button
              key={rating}
              type="button"
              variant="outline"
              disabled={locked}
              onClick={() => {
                void run(session, { kind: "rate", rating });
              }}
              className={cn(actionClass, "h-auto min-h-11 w-full flex-col gap-0 py-2")}
            >
              <span>{label}</span>
              {hint && <span className="text-xs font-normal text-blue-100/70">{hint}</span>}
            </Button>
          ))}
        </div>
      ) : (
        <Button
          type="button"
          disabled={locked}
          onClick={() => {
            setScreen({ kind: "session", session: reveal(session) });
          }}
          className={cn(primaryClass, "min-h-11 sm:w-full")}
        >
          <Eye className="size-4" />
          Pokaż
        </Button>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {card.mastered ? (
          // Tag sessions include mastered cards; marking one again would only inflate the summary.
          <span className="flex items-center gap-2 text-sm text-emerald-200/80">
            <Check className="size-4" />
            Opanowana
          </span>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={locked}
            onClick={() => {
              void run(session, { kind: "mastered" });
            }}
            className={wideActionClass}
          >
            {busy === "mastered" ? <Spinner /> : <Check className="size-4" />}
            Opanowane
          </Button>
        )}
        {busy === "rate" && (
          <span className="flex items-center gap-2 text-sm text-blue-100/70">
            <Spinner />
            Zapisuję ocenę…
          </span>
        )}
      </div>

      {failed && (
        <ErrorBox
          message={failed.message}
          retryDisabled={busy !== null}
          onRetry={() => {
            void run(session, failed.action);
          }}
        />
      )}
    </div>
  );
}
