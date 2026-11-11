import { useEffect, useRef, useState } from "react";
import { CircleAlert, Info, RotateCcw, Save, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReviewDraft } from "@/components/hooks/useReviewDraft";
import PdfLessonInput, { type PdfText } from "@/components/lesson/PdfLessonInput";
import ProposalReviewItem from "@/components/lesson/ProposalReviewItem";
import { MAX_TAG_CHARS } from "@/lib/ai/outcomes";
import { countWords } from "@/lib/ai/proposals";
import { tagFromFileName } from "@/lib/pdf/lesson-text";
import {
  canAccept,
  counts,
  createDraft,
  editItem,
  revertItem,
  setDecision,
  toAcceptRequest,
  type ReviewDraft,
} from "@/lib/review-draft";
import { cn, isRecord } from "@/lib/utils";
import type { AcceptSetResult, ReviewProposal } from "@/types";

interface Props {
  userId: string;
  tagNames: string[];
  maxWords: number;
}

type Stage =
  | { name: "idle" }
  | { name: "generating" }
  | { name: "saving" }
  | { name: "done"; result: AcceptSetResult; tagName: string };

type Source = "text" | "pdf";

const SOURCES: Source[] = ["text", "pdf"];
const SOURCE_LABELS: Record<Source, string> = { text: "Tekst", pdf: "PDF" };

type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string };

const NETWORK_ERROR = "Nie udało się połączyć z serwerem. Spróbuj ponownie.";
const NO_PROPOSALS = "AI nie znalazło słów do nauki w tym tekście.";

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
    return { ok: false, message: NETWORK_ERROR };
  }

  const serverError = `Błąd serwera (HTTP ${String(response.status)}). Spróbuj ponownie.`;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, message: serverError };
  }

  if (response.ok && isValid(body)) {
    return { ok: true, data: body };
  }
  if (isRecord(body) && typeof body.message === "string") {
    return { ok: false, message: body.message };
  }
  return { ok: false, message: serverError };
}

interface GenerationResponse {
  proposals: ReviewProposal[];
  meta: { model: string };
}

function isGenerationResponse(body: unknown): body is GenerationResponse {
  return isRecord(body) && Array.isArray(body.proposals) && isRecord(body.meta) && typeof body.meta.model === "string";
}

function isAcceptSetResult(body: unknown): body is AcceptSetResult {
  return (
    isRecord(body) &&
    typeof body.created === "number" &&
    typeof body.merged === "number" &&
    typeof body.rejected === "number"
  );
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

function useElapsedSeconds(running: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) {
      return;
    }
    const started = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => {
      clearInterval(interval);
      setElapsed(0);
    };
  }, [running]);
  return elapsed;
}

export default function LessonGenerator({ userId, tagNames, maxWords }: Props) {
  const { draft, ready, setDraft, clearDraft } = useReviewDraft(userId);
  const [tagName, setTagName] = useState("");
  const [text, setText] = useState("");
  const [source, setSource] = useState<Source>("text");
  const [pdf, setPdf] = useState<PdfText | null>(null);
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const mounted = useRef(true);

  const elapsedSeconds = useElapsedSeconds(stage.name === "generating");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const words = countWords(text);
  const overLimit = words > maxWords;
  const generating = stage.name === "generating";
  const saving = stage.name === "saving";
  const hasInput = source === "text" ? words > 0 && !overLimit : pdf !== null;
  const canGenerate = !generating && tagName.trim() !== "" && hasInput;

  function onPdfText(result: PdfText | null) {
    setPdf(result);
    if (result) {
      setTagName((current) => (current.trim() === "" ? tagFromFileName(result.fileName) : current));
    }
  }

  async function generate() {
    const lessonTag = tagName.trim().replace(/\s+/g, " ");
    const lessonText = source === "text" ? text : (pdf?.text ?? "");
    setGenerateError(null);
    setNotice(null);
    setStage({ name: "generating" });
    // No model is sent: the server uses its default and reports it in meta.
    const result = await postJson("/api/ai/proposals", { text: lessonText }, isGenerationResponse);
    if (!mounted.current) {
      return;
    }
    setStage({ name: "idle" });
    if (!result.ok) {
      setGenerateError(result.message);
      return;
    }
    if (result.data.proposals.length === 0) {
      setNotice(NO_PROPOSALS);
      return;
    }
    setAcceptError(null);
    setDraft(createDraft(lessonTag, result.data.meta.model, result.data.proposals));
  }

  async function accept(current: ReviewDraft) {
    setAcceptError(null);
    setStage({ name: "saving" });
    const result = await postJson("/api/proposal-sets", toAcceptRequest(current), isAcceptSetResult);
    if (!mounted.current) {
      return;
    }
    if (!result.ok) {
      setStage({ name: "idle" });
      setAcceptError(result.message);
      return;
    }
    clearDraft();
    setStage({ name: "done", result: result.data, tagName: current.tagName });
  }

  function discard() {
    if (window.confirm("Odrzucić szkic? Propozycje z tej lekcji zostaną utracone i nic nie zostanie zapisane.")) {
      setAcceptError(null);
      clearDraft();
    }
  }

  function startNewLesson() {
    setTagName("");
    setText("");
    setPdf(null);
    setGenerateError(null);
    setNotice(null);
    setStage({ name: "idle" });
  }

  if (!ready) {
    return (
      <p className="flex items-center gap-2 text-sm text-blue-100/70" role="status">
        <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        Ładowanie…
      </p>
    );
  }

  if (stage.name === "done") {
    const { created, merged, rejected } = stage.result;
    return (
      <div className="space-y-4">
        <p className="text-lg font-semibold text-white">Zapisano lekcję „{stage.tagName}”.</p>
        <p className="text-sm text-blue-100/80">
          Nowe fiszki: {created} · Dodano tag do istniejących: {merged} · Odrzucone: {rejected}
        </p>
        <Button type="button" onClick={startNewLesson} className={primaryClass}>
          <Sparkles className="size-4" />
          Nowa lekcja
        </Button>
      </div>
    );
  }

  if (draft) {
    const { toSave, rejected } = counts(draft);
    const acceptable = canAccept(draft);
    return (
      <div className="space-y-4">
        <div className="sticky top-0 z-10 -mx-4 space-y-3 border-b border-white/10 bg-slate-900/80 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-blue-100/80">
              Tag: <span className="font-semibold text-white">{draft.tagName}</span>
            </p>
            <p className="text-xs text-blue-100/60">
              Do zapisania: {toSave} · Odrzucone: {rejected}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={saving || !acceptable}
              onClick={() => {
                void accept(draft);
              }}
              className={cn(primaryClass, "flex-1 sm:flex-none")}
            >
              {saving ? (
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Save className="size-4" />
              )}
              Akceptuj zestaw ({toSave})
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={discard} className={outlineClass}>
              <Trash2 className="size-4" />
              Odrzuć szkic
            </Button>
          </div>
          {!acceptable && <p className="text-xs text-red-300">Popraw zaznaczone propozycje, aby zapisać zestaw.</p>}
        </div>

        {acceptError && (
          <ErrorBox
            message={acceptError}
            retryDisabled={saving || !acceptable}
            onRetry={() => {
              void accept(draft);
            }}
          />
        )}

        <ul className="space-y-3">
          {draft.items.map((item, index) => (
            <ProposalReviewItem
              key={`${String(index)}-${item.original.word}`}
              item={item}
              index={index}
              disabled={saving}
              onEdit={(final) => {
                setDraft((current) => editItem(current, index, final));
              }}
              onDecision={(decision) => {
                setDraft((current) => setDecision(current, index, decision));
              }}
              onRevert={() => {
                setDraft((current) => revertItem(current, index));
              }}
            />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="lesson-tag" className="block text-sm font-medium text-blue-100/80">
          Tag lekcji
        </label>
        <input
          id="lesson-tag"
          list="lesson-tag-suggestions"
          value={tagName}
          maxLength={MAX_TAG_CHARS}
          disabled={generating}
          onChange={(e) => {
            setTagName(e.target.value);
          }}
          placeholder="np. Lekcja 12 — podróże"
          className={inputClass}
        />
        <datalist id="lesson-tag-suggestions">
          {tagNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div
        role="tablist"
        aria-label="Źródło lekcji"
        className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-white/5 p-1 sm:inline-grid"
      >
        {SOURCES.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`lesson-tab-${tab}`}
            aria-selected={source === tab}
            aria-controls={`lesson-panel-${tab}`}
            disabled={generating}
            onClick={() => {
              setSource(tab);
            }}
            className={cn(
              "rounded-md px-6 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
              source === tab ? "bg-purple-600 text-white" : "text-blue-100/70 hover:bg-white/10 hover:text-white",
            )}
          >
            {SOURCE_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Both panels stay mounted, so each tab keeps its state when switching. */}
      <div
        role="tabpanel"
        id="lesson-panel-text"
        aria-labelledby="lesson-tab-text"
        hidden={source !== "text"}
        className="space-y-2"
      >
        <label htmlFor="lesson-text" className="block text-sm font-medium text-blue-100/80">
          Tekst lekcji
        </label>
        <textarea
          id="lesson-text"
          value={text}
          disabled={generating}
          onChange={(e) => {
            setText(e.target.value);
          }}
          rows={10}
          placeholder="Wklej tekst lekcji po angielsku…"
          className={inputClass}
        />
        <p className={cn("text-right text-xs", overLimit ? "text-red-300" : "text-blue-100/60")}>
          {words} / {maxWords} słów
        </p>
      </div>

      <div role="tabpanel" id="lesson-panel-pdf" aria-labelledby="lesson-tab-pdf" hidden={source !== "pdf"}>
        <PdfLessonInput disabled={generating} result={pdf} onText={onPdfText} />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          onClick={() => {
            void generate();
          }}
          disabled={!canGenerate}
          className={primaryClass}
        >
          <Sparkles className="size-4" />
          Generuj
        </Button>

        {generating && (
          <span className="flex items-center gap-2 text-sm text-blue-100/80" role="status">
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Generuję… {elapsedSeconds} s
          </span>
        )}
      </div>

      {notice && (
        <p className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-100/80">
          <Info className="size-4 shrink-0" />
          {notice}
        </p>
      )}

      {generateError && (
        <ErrorBox
          message={generateError}
          retryDisabled={!canGenerate}
          onRetry={() => {
            void generate();
          }}
        />
      )}
    </div>
  );
}
