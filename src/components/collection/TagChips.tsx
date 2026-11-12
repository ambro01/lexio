import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_TAG_CHARS } from "@/lib/ai/limits";
import { withTag, withoutTag } from "@/lib/collection";
import { isRecord } from "@/lib/utils";
import type { Flashcard, Tag } from "@/types";
import { ErrorBox, Spinner, actionClass, inputClass, isNoContent, isTag, requestJson } from "./shared";

interface Props {
  card: Flashcard;
  /** Id of the page's one `<datalist>` with all the user's tag names. */
  listId: string;
  /** True while any request for this card is in flight (edit, delete or another tag change). */
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onUpdate: (update: (card: Flashcard) => Flashcard) => void;
  /** A tag name to add to the suggestions (the list dedupes it). */
  onTagCreated: (name: string) => void;
  /** The card no longer exists; it is removed from the list with this notice. */
  onGone: (message: string) => void;
}

interface AddTagResponse {
  tag: Tag;
  linked: boolean;
}

function isAddTagResponse(body: unknown): body is AddTagResponse {
  return isRecord(body) && isTag(body.tag) && typeof body.linked === "boolean";
}

/** The card's tags as chips that save at once: × removes a link, the input adds (and creates) a tag. */
export default function TagChips({ card, listId, disabled, onBusyChange, onUpdate, onTagCreated, onGone }: Props) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const canAdd = !disabled && name.trim() !== "";
  const base = `/api/flashcards/${encodeURIComponent(card.id)}/tags`;

  async function add() {
    setError(null);
    setAdding(true);
    onBusyChange(true);
    const result = await requestJson(base, "POST", { name }, isAddTagResponse);
    if (!mounted.current) {
      return;
    }
    setAdding(false);
    onBusyChange(false);
    if (!result.ok) {
      if (result.status === 404) {
        onGone(result.message);
        return;
      }
      setError(result.message);
      return;
    }
    const { tag } = result.data;
    onUpdate((current) => withTag(current, tag));
    onTagCreated(tag.name);
    setName("");
  }

  async function remove(tag: Tag) {
    setError(null);
    onBusyChange(true);
    const result = await requestJson(`${base}/${encodeURIComponent(tag.id)}`, "DELETE", undefined, isNoContent);
    if (!mounted.current) {
      return;
    }
    onBusyChange(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onUpdate((current) => withoutTag(current, tag.id));
  }

  const inputId = `tag-${card.id}`;

  return (
    <div className="space-y-2">
      {card.tags.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Tagi">
          {card.tags.map((tag) => (
            <li
              key={tag.id}
              className="flex max-w-full items-center gap-1 rounded-full bg-blue-500/20 py-0.5 pr-1 pl-3 text-xs text-blue-100"
            >
              <span className="break-all">{tag.name}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Usuń tag ${tag.name}`}
                title="Usuń tag"
                onClick={() => {
                  void remove(tag);
                }}
                className="rounded-full p-0.5 text-blue-100/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (canAdd) {
            void add();
          }
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Nowy tag
        </label>
        <input
          id={inputId}
          list={listId}
          value={name}
          maxLength={MAX_TAG_CHARS}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => {
            setName(e.target.value);
          }}
          placeholder="Dodaj tag…"
          className={inputClass}
        />
        <Button type="submit" variant="outline" size="sm" disabled={!canAdd} className={actionClass}>
          {adding ? <Spinner /> : <Plus />}
          Dodaj
        </Button>
      </form>

      {error && <ErrorBox message={error} />}
    </div>
  );
}
