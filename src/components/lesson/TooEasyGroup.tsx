import { useState, type ReactNode } from "react";
import { Ban, ChevronRight, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { itemProblem, type DraftItem } from "@/lib/review-draft";
import { cn } from "@/lib/utils";

interface Props {
  /** All draft items; `indexes` picks the ones in the group. */
  items: DraftItem[];
  /** Original indexes (in `items`) of the too-easy proposals, in their original order. */
  indexes: number[];
  /** How many items are currently rejected as "too easy" by the bulk action. */
  rejectedCount: number;
  /** How many items the bulk reject would reject now (`tooEasyEligibleCount`). */
  eligibleCount: number;
  disabled: boolean;
  onRejectAll: () => void;
  onUndo: () => void;
  /** Renders one review item by its original index, the same way as in the main list. */
  renderItem: (index: number) => ReactNode;
}

const actionClass = "border-white/20 bg-white/10 text-white hover:bg-white/20";

/** The collapsed "too easy" group (FR-014): proposals below the user's level, with one bulk reject and one undo. */
export default function TooEasyGroup({
  items,
  indexes,
  rejectedCount,
  eligibleCount,
  disabled,
  onRejectAll,
  onUndo,
  renderItem,
}: Props) {
  // Open/closed is view state only; it is not stored in the draft.
  const [open, setOpen] = useState(false);
  // An item that blocks "Akceptuj zestaw" must never be hidden: the group stays open while one needs fixing.
  const problems = indexes.filter((index) => {
    const item = items.at(index);
    return item !== undefined && itemProblem(item) !== null;
  }).length;
  const expanded = open || problems > 0;

  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="too-easy-items"
          onClick={() => {
            setOpen((current) => !current);
          }}
          className="flex items-center gap-2 rounded-md py-1 text-left text-sm font-semibold text-white hover:text-purple-200"
        >
          <ChevronRight className={cn("size-4 shrink-0 transition-transform", expanded && "rotate-90")} />
          Za łatwe dla Ciebie ({indexes.length})
          {problems > 0 && <span className="font-normal text-red-300">· do poprawy: {problems}</span>}
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || eligibleCount === 0}
          onClick={onRejectAll}
          className={actionClass}
        >
          <Ban />
          Odrzuć wszystkie jako Za łatwe
        </Button>
      </div>

      {rejectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-blue-100/80" role="status">
          <span className="flex-1">Odrzucono {rejectedCount} jako Za łatwe</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onUndo}
            className={actionClass}
          >
            <Undo2 />
            Cofnij
          </Button>
        </div>
      )}

      {/* Kept mounted while collapsed, so an item being edited keeps its state. */}
      <ul id="too-easy-items" hidden={!expanded} className="space-y-3">
        {indexes.map((index) => renderItem(index))}
      </ul>
    </section>
  );
}
