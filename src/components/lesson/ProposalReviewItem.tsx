import { useState, type ReactNode } from "react";
import { Ban, Check, CircleAlert, Pencil, RotateCcw, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_TEXT_CHARS, MAX_WORD_CHARS } from "@/lib/ai/outcomes";
import { isEdited, itemProblem, type DraftItem } from "@/lib/review-draft";
import { cn } from "@/lib/utils";
import type { ProposalContent, ProposalDecision } from "@/types";

interface Props {
  item: DraftItem;
  index: number;
  disabled: boolean;
  onEdit: (final: ProposalContent) => void;
  onDecision: (decision: ProposalDecision) => void;
  onRevert: () => void;
}

const REJECT_LABELS: Record<Exclude<ProposalDecision, "accept">, string> = {
  reject_known: "Znam / nieprzydatne",
  reject_wrong: "Błędne",
  // Set only by the bulk action of the "too easy" group; there is no per-item button for it.
  reject_too_easy: "Za łatwe",
};

const inputClass =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-purple-400 focus:outline-none";

const actionClass = "border-white/20 bg-white/10 text-white hover:bg-white/20";

function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", className)}>{children}</span>;
}

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

export default function ProposalReviewItem({ item, index, disabled, onEdit, onDecision, onRevert }: Props) {
  const [editing, setEditing] = useState(false);
  const { original, final, decision } = item;
  const edited = isEdited(item);
  const problem = itemProblem(item);
  const idPrefix = `proposal-${String(index)}`;

  if (decision !== "accept") {
    return (
      <li className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
        <span className="min-w-0 flex-1 truncate text-blue-100/50 line-through">{original.word}</span>
        <Badge className="bg-white/10 text-blue-100/70">{REJECT_LABELS[decision]}</Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            onDecision("accept");
          }}
          className={actionClass}
        >
          <Undo2 />
          Cofnij
        </Button>
      </li>
    );
  }

  const reject = (next: Exclude<ProposalDecision, "accept">) => {
    setEditing(false);
    onDecision(next);
  };

  return (
    <li className={cn("space-y-3 rounded-xl border bg-white/5 p-4", problem ? "border-red-400/60" : "border-white/10")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-semibold break-words text-white">{final.word || original.word}</span>
        <Badge className="bg-purple-500/30 text-purple-100">{original.cefr}</Badge>
        {original.inCollection && <Badge className="bg-blue-500/30 text-blue-100">W kolekcji — dostanie tag</Badge>}
        {edited && <Badge className="bg-amber-500/30 text-amber-100">poprawione</Badge>}
      </div>

      {editing ? (
        <div className="space-y-3">
          <Field id={`${idPrefix}-word`} label="Słowo">
            <input
              id={`${idPrefix}-word`}
              disabled={disabled}
              value={final.word}
              maxLength={MAX_WORD_CHARS}
              onChange={(e) => {
                onEdit({ ...final, word: e.target.value });
              }}
              className={inputClass}
            />
          </Field>
          <Field id={`${idPrefix}-translation`} label="Tłumaczenie">
            <input
              id={`${idPrefix}-translation`}
              disabled={disabled}
              value={final.translation}
              maxLength={MAX_TEXT_CHARS}
              onChange={(e) => {
                onEdit({ ...final, translation: e.target.value });
              }}
              className={inputClass}
            />
          </Field>
          <Field id={`${idPrefix}-meanings`} label="Inne znaczenia (jedno w linii)">
            <textarea
              id={`${idPrefix}-meanings`}
              disabled={disabled}
              value={final.additionalMeanings.join("\n")}
              rows={3}
              onChange={(e) => {
                onEdit({ ...final, additionalMeanings: e.target.value.split("\n") });
              }}
              className={inputClass}
            />
          </Field>
          <Field id={`${idPrefix}-example`} label="Przykład">
            <textarea
              id={`${idPrefix}-example`}
              disabled={disabled}
              value={final.exampleSentence}
              maxLength={MAX_TEXT_CHARS}
              rows={2}
              onChange={(e) => {
                onEdit({ ...final, exampleSentence: e.target.value });
              }}
              className={inputClass}
            />
          </Field>
        </div>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="text-white">{final.translation || "—"}</p>
          {final.additionalMeanings.some((meaning) => meaning.trim() !== "") && (
            <p className="text-blue-100/70">
              Inne znaczenia:{" "}
              {final.additionalMeanings
                .map((meaning) => meaning.trim())
                .filter((meaning) => meaning !== "")
                .join(", ")}
            </p>
          )}
          {final.exampleSentence.trim() !== "" && <p className="text-blue-100/70 italic">{final.exampleSentence}</p>}
        </div>
      )}

      {problem && (
        <p className="flex items-center gap-1 text-xs text-red-300">
          <CircleAlert className="size-3" />
          {problem}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setEditing(false);
              }}
              className="bg-purple-600 text-white hover:bg-purple-500"
            >
              <Check />
              Gotowe
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || !edited}
              onClick={onRevert}
              className={actionClass}
            >
              <RotateCcw />
              Przywróć oryginał
            </Button>
          </>
        ) : (
          !original.inCollection && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setEditing(true);
              }}
              className={actionClass}
            >
              <Pencil />
              Edytuj
            </Button>
          )
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            reject("reject_known");
          }}
          className={actionClass}
        >
          <Ban />
          {REJECT_LABELS.reject_known}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            reject("reject_wrong");
          }}
          className={actionClass}
        >
          <X />
          {REJECT_LABELS.reject_wrong}
        </Button>
      </div>
    </li>
  );
}
