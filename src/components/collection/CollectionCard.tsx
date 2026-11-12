import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_TEXT_CHARS, MAX_WORD_CHARS } from "@/lib/ai/limits";
import { CEFR_LEVELS } from "@/lib/ai/proposals";
import type { EditRequestBody } from "@/lib/collection";
import { contentProblem } from "@/lib/review-draft";
import { cn } from "@/lib/utils";
import type { Flashcard } from "@/types";
import TagChips from "./TagChips";
import {
  ErrorBox,
  Spinner,
  actionClass,
  inputClass,
  isFlashcard,
  isNoContent,
  optionClass,
  requestJson,
} from "./shared";

interface Props {
  card: Flashcard;
  tagListId: string;
  /** Applies a change to this card in the list (always to its latest state). */
  onUpdate: (update: (card: Flashcard) => Flashcard) => void;
  /** Removes this card from the list, optionally with a notice for the user. */
  onRemove: (notice?: string) => void;
  onTagCreated: (name: string) => void;
}

type Busy = "saving" | "deleting" | "tags" | null;

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs text-blue-100/70">
        {label}
      </label>
      {children}
    </div>
  );
}

function draftOf(card: Flashcard): EditRequestBody {
  return {
    word: card.word,
    translation: card.translation,
    additionalMeanings: [...card.additionalMeanings],
    exampleSentence: card.exampleSentence,
    cefr: card.cefr,
  };
}

/** One card of the collection: view, in-place edit (content and CEFR), delete and tag chips. */
export default function CollectionCard({ card, tagListId, onUpdate, onRemove, onTagCreated }: Props) {
  const [draft, setDraft] = useState<EditRequestBody | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const disabled = busy !== null;
  const idPrefix = `card-${card.id}`;
  const problem = draft ? contentProblem(draft) : null;
  const url = `/api/flashcards/${encodeURIComponent(card.id)}`;

  async function save(body: EditRequestBody) {
    setError(null);
    setBusy("saving");
    const result = await requestJson(url, "PATCH", body, isFlashcard);
    if (!mounted.current) {
      return;
    }
    setBusy(null);
    if (!result.ok) {
      if (result.status === 404) {
        onRemove(result.message);
        return;
      }
      // A duplicate word (409) or any other failure keeps the form open with the user's input.
      setError(result.message);
      return;
    }
    const saved = result.data;
    onUpdate(() => saved);
    setDraft(null);
  }

  async function remove() {
    if (!window.confirm(`Usunąć fiszkę „${card.word}”?`)) {
      return;
    }
    setError(null);
    setBusy("deleting");
    const result = await requestJson(url, "DELETE", undefined, isNoContent);
    if (!mounted.current) {
      return;
    }
    // Already gone (404) is what the user wanted too.
    if (result.ok || result.status === 404) {
      onRemove();
      return;
    }
    setBusy(null);
    setError(result.message);
  }

  const meanings = card.additionalMeanings.filter((meaning) => meaning.trim() !== "");

  return (
    <li className={cn("space-y-3 rounded-xl border bg-white/5 p-4", problem ? "border-red-400/60" : "border-white/10")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-semibold break-words text-white">{card.word}</span>
        {card.cefr && (
          <span className="rounded-full bg-purple-500/30 px-2 py-0.5 text-xs font-medium text-purple-100">
            {card.cefr}
          </span>
        )}
      </div>

      {draft ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!disabled && problem === null) {
              void save(draft);
            }
          }}
        >
          <Field id={`${idPrefix}-word`} label="Słowo">
            <input
              id={`${idPrefix}-word`}
              disabled={disabled}
              value={draft.word}
              maxLength={MAX_WORD_CHARS}
              onChange={(e) => {
                setDraft({ ...draft, word: e.target.value });
              }}
              className={inputClass}
            />
          </Field>
          <Field id={`${idPrefix}-translation`} label="Tłumaczenie">
            <input
              id={`${idPrefix}-translation`}
              disabled={disabled}
              value={draft.translation}
              maxLength={MAX_TEXT_CHARS}
              onChange={(e) => {
                setDraft({ ...draft, translation: e.target.value });
              }}
              className={inputClass}
            />
          </Field>
          <Field id={`${idPrefix}-meanings`} label="Inne znaczenia (jedno w linii)">
            <textarea
              id={`${idPrefix}-meanings`}
              disabled={disabled}
              value={draft.additionalMeanings.join("\n")}
              rows={3}
              onChange={(e) => {
                setDraft({ ...draft, additionalMeanings: e.target.value.split("\n") });
              }}
              className={inputClass}
            />
          </Field>
          <Field id={`${idPrefix}-example`} label="Przykład">
            <textarea
              id={`${idPrefix}-example`}
              disabled={disabled}
              value={draft.exampleSentence}
              maxLength={MAX_TEXT_CHARS}
              rows={2}
              onChange={(e) => {
                setDraft({ ...draft, exampleSentence: e.target.value });
              }}
              className={inputClass}
            />
          </Field>
          <Field id={`${idPrefix}-cefr`} label="Poziom CEFR">
            <select
              id={`${idPrefix}-cefr`}
              disabled={disabled}
              value={draft.cefr ?? ""}
              onChange={(e) => {
                setDraft({ ...draft, cefr: CEFR_LEVELS.find((level) => level === e.target.value) ?? null });
              }}
              className={inputClass}
            >
              <option value="" className={optionClass}>
                brak
              </option>
              {CEFR_LEVELS.map((level) => (
                <option key={level} value={level} className={optionClass}>
                  {level}
                </option>
              ))}
            </select>
          </Field>

          {problem && <p className="text-xs text-red-300">{problem}</p>}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={disabled || problem !== null}
              className="bg-purple-600 text-white hover:bg-purple-500"
            >
              {busy === "saving" ? <Spinner /> : <Save />}
              Zapisz
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
              className={actionClass}
            >
              <X />
              Anuluj
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="text-white">{card.translation}</p>
          {meanings.length > 0 && <p className="text-blue-100/70">Inne znaczenia: {meanings.join(", ")}</p>}
          {card.exampleSentence.trim() !== "" && <p className="text-blue-100/70 italic">{card.exampleSentence}</p>}
        </div>
      )}

      {error && <ErrorBox message={error} />}

      <TagChips
        card={card}
        listId={tagListId}
        disabled={disabled}
        onBusyChange={(tagBusy) => {
          setBusy(tagBusy ? "tags" : null);
        }}
        onUpdate={onUpdate}
        onTagCreated={onTagCreated}
        onGone={onRemove}
      />

      {!draft && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              setError(null);
              setDraft(draftOf(card));
            }}
            className={actionClass}
          >
            <Pencil />
            Edytuj
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              void remove();
            }}
            className={actionClass}
          >
            {busy === "deleting" ? <Spinner /> : <Trash2 />}
            Usuń
          </Button>
        </div>
      )}
    </li>
  );
}
