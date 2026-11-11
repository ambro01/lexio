import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, Info, Plus, RotateCcw, Save, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProposalReviewItem from "@/components/lesson/ProposalReviewItem";
import { MAX_TAG_CHARS, MAX_TEXT_CHARS, MAX_WORD_CHARS } from "@/lib/ai/outcomes";
import {
  createManualItem,
  revertManualItem,
  toManualAcceptRequest,
  wasCorrected,
  type ManualItem,
} from "@/lib/manual-word";
import { isEdited, itemProblem } from "@/lib/review-draft";
import { cn, isRecord } from "@/lib/utils";
import type { AcceptSetResult, ReviewProposal } from "@/types";

interface Props {
  tagNames: string[];
}

type Stage = { name: "idle" } | { name: "filling" } | { name: "saving" } | { name: "saved"; word: string };

interface Fill {
  item: ManualItem;
  typedWord: string;
  model: string;
  /** Changes on every fill, so a new card starts out of edit mode. */
  id: number;
}

type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number | null; message: string };

const NETWORK_ERROR = "Nie udało się połączyć z serwerem. Spróbuj ponownie.";
const IN_COLLECTION = "To słowo jest już w kolekcji.";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-blue-100/40 focus:border-purple-400 focus:outline-none";
const primaryClass = "rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500";
const outlineClass = "border-white/20 bg-white/10 text-white hover:bg-white/20";

async function postJson<T>(
  url: string,
  payload: unknown,
  isValid: (body: unknown) => body is T,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, status: null, message: NETWORK_ERROR };
  }

  const serverError = `Błąd serwera (HTTP ${String(response.status)}). Spróbuj ponownie.`;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, status: response.status, message: serverError };
  }

  if (response.ok && isValid(body)) {
    return { ok: true, data: body };
  }
  if (isRecord(body) && typeof body.message === "string") {
    return { ok: false, status: response.status, message: body.message };
  }
  return { ok: false, status: response.status, message: serverError };
}

interface WordFillResponse {
  proposal: ReviewProposal;
  typedWord: string;
  meta: { model: string };
}

function isWordFillResponse(body: unknown): body is WordFillResponse {
  return (
    isRecord(body) &&
    isRecord(body.proposal) &&
    typeof body.typedWord === "string" &&
    isRecord(body.meta) &&
    typeof body.meta.model === "string"
  );
}

function isAcceptSetResult(body: unknown): body is AcceptSetResult {
  return (
    isRecord(body) &&
    typeof body.created === "number" &&
    typeof body.merged === "number" &&
    typeof body.rejected === "number"
  );
}

function Spinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}

function ErrorBox({
  message,
  onRetry,
  retryDisabled,
}: {
  message: string;
  onRetry?: () => void;
  retryDisabled?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300"
      role="alert"
    >
      <CircleAlert className="size-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={retryDisabled}
          className={outlineClass}
        >
          <RotateCcw className="size-4" />
          Spróbuj ponownie
        </Button>
      )}
    </div>
  );
}

export default function AddWord({ tagNames }: Props) {
  const [word, setWord] = useState("");
  const [context, setContext] = useState("");
  const [tagName, setTagName] = useState("");
  const [fill, setFill] = useState<Fill | null>(null);
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [fillError, setFillError] = useState<{ message: string; retry: boolean } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const mounted = useRef(true);
  const fillCount = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const filling = stage.name === "filling";
  const saving = stage.name === "saving";
  const busy = filling || saving;
  const canFill = !busy && word.trim() !== "";

  async function runFill() {
    if (
      fill &&
      isEdited(fill.item) &&
      !window.confirm("Uzupełnić ponownie? Twoje poprawki w tej fiszce zostaną utracone.")
    ) {
      return;
    }
    setFillError(null);
    setSaveError(null);
    setStage({ name: "filling" });
    const trimmedContext = context.trim();
    const result = await postJson(
      "/api/ai/word-fill",
      { word, ...(trimmedContext === "" ? {} : { context: trimmedContext }) },
      isWordFillResponse,
    );
    if (!mounted.current) {
      return;
    }
    setStage({ name: "idle" });
    if (!result.ok) {
      // A word already in the collection is not an error to retry: the user changes the word instead.
      setFillError(
        result.status === 409 ? { message: IN_COLLECTION, retry: false } : { message: result.message, retry: true },
      );
      return;
    }
    fillCount.current += 1;
    setFill({
      item: createManualItem(result.data.proposal),
      typedWord: result.data.typedWord,
      model: result.data.meta.model,
      id: fillCount.current,
    });
  }

  async function save(current: Fill) {
    setSaveError(null);
    setStage({ name: "saving" });
    const result = await postJson(
      "/api/proposal-sets",
      toManualAcceptRequest(current.item, tagName, current.model),
      isAcceptSetResult,
    );
    if (!mounted.current) {
      return;
    }
    if (!result.ok) {
      setStage({ name: "idle" });
      setSaveError(result.message);
      return;
    }
    setFill(null);
    setStage({ name: "saved", word: current.item.final.word.trim().replace(/\s+/g, " ") });
  }

  function discard() {
    setFill(null);
    setSaveError(null);
  }

  function addAnother() {
    setWord("");
    setContext("");
    setTagName("");
    setFill(null);
    setFillError(null);
    setSaveError(null);
    setStage({ name: "idle" });
  }

  if (stage.name === "saved") {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-lg font-semibold text-white" role="status">
          <Check className="size-5 text-green-300" />
          Zapisano: {stage.word}
        </p>
        <Button type="button" onClick={addAnother} className={primaryClass}>
          <Plus className="size-4" />
          Dodaj kolejne
        </Button>
      </div>
    );
  }

  const saveBlock = fill ? (fill.item.original.inCollection ? IN_COLLECTION : itemProblem(fill.item)) : null;

  return (
    <div className="space-y-6">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canFill) {
            void runFill();
          }
        }}
      >
        <div className="space-y-2">
          <label htmlFor="add-word" className="block text-sm font-medium text-blue-100/80">
            Słowo
          </label>
          <input
            id="add-word"
            value={word}
            maxLength={MAX_WORD_CHARS}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="none"
            onChange={(e) => {
              setWord(e.target.value);
            }}
            placeholder="np. give up"
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="add-context" className="block text-sm font-medium text-blue-100/80">
            Kontekst (opcjonalnie)
          </label>
          <textarea
            id="add-context"
            value={context}
            maxLength={MAX_TEXT_CHARS}
            disabled={busy}
            rows={2}
            onChange={(e) => {
              setContext(e.target.value);
            }}
            placeholder="Zdanie, w którym spotkałeś to słowo…"
            className={inputClass}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button
            type="submit"
            disabled={!canFill}
            variant={fill ? "outline" : "default"}
            className={fill ? outlineClass : primaryClass}
          >
            <Sparkles className="size-4" />
            {fill ? "Uzupełnij ponownie" : "Uzupełnij"}
          </Button>

          {filling && (
            <span className="flex items-center gap-2 text-sm text-blue-100/80" role="status">
              <Spinner />
              Uzupełniam…
            </span>
          )}
        </div>
      </form>

      {fillError && (
        <ErrorBox
          message={fillError.message}
          retryDisabled={!canFill}
          onRetry={
            fillError.retry
              ? () => {
                  void runFill();
                }
              : undefined
          }
        />
      )}

      {fill && (
        <div className="space-y-4">
          <ul>
            <ProposalReviewItem
              key={fill.id}
              item={fill.item}
              index={0}
              disabled={busy}
              allowReject={false}
              note={
                wasCorrected(fill.typedWord, fill.item.original.word) ? `poprawione z: ${fill.typedWord}` : undefined
              }
              onEdit={(final) => {
                setFill((current) =>
                  current && !current.item.original.inCollection
                    ? { ...current, item: { ...current.item, final } }
                    : current,
                );
              }}
              onRevert={() => {
                setFill((current) => (current ? { ...current, item: revertManualItem(current.item) } : current));
              }}
            />
          </ul>

          <div className="space-y-2">
            <label htmlFor="add-tag" className="block text-sm font-medium text-blue-100/80">
              Tag (opcjonalnie)
            </label>
            <input
              id="add-tag"
              list="add-tag-suggestions"
              value={tagName}
              maxLength={MAX_TAG_CHARS}
              disabled={busy}
              onChange={(e) => {
                setTagName(e.target.value);
              }}
              placeholder="np. Lekcja 12 — podróże"
              className={inputClass}
            />
            <datalist id="add-tag-suggestions">
              {tagNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || saveBlock !== null}
              onClick={() => {
                void save(fill);
              }}
              className={cn(primaryClass, "flex-1 sm:flex-none")}
            >
              {saving ? <Spinner /> : <Save className="size-4" />}
              Zapisz
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={discard} className={outlineClass}>
              <Trash2 className="size-4" />
              Odrzuć
            </Button>
          </div>

          {saveBlock && (
            <p className="flex items-center gap-2 text-sm text-blue-100/70">
              <Info className="size-4 shrink-0" />
              {saveBlock}
            </p>
          )}

          {saveError && (
            <ErrorBox
              message={saveError}
              retryDisabled={busy || saveBlock !== null}
              onRetry={() => {
                void save(fill);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
