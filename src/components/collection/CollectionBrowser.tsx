import { useEffect, useRef, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appendPage, mergeTagName } from "@/lib/collection";
import type { Flashcard, FlashcardPage } from "@/types";
import CollectionCard from "./CollectionCard";
import { ErrorBox, Spinner, actionClass, isFlashcardPage, requestJson } from "./shared";

interface Props {
  initialPage: FlashcardPage;
  tagNames: string[];
}

const TAG_LIST_ID = "collection-tag-suggestions";

/** The "Kolekcja" island: the loaded cards, "Pokaż więcej" paging and the tag suggestions shared by every card. */
export default function CollectionBrowser({ initialPage, tagNames: initialTagNames }: Props) {
  const [cards, setCards] = useState<Flashcard[]>(initialPage.cards);
  const [hasMore, setHasMore] = useState(initialPage.hasMore);
  const [tagNames, setTagNames] = useState(initialTagNames);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function loadMore() {
    setLoadError(null);
    setLoading(true);
    // The offset is the number of cards loaded now: a delete shrinks it, so no card is skipped; cards that
    // come back again (e.g. moved by a rename) are dropped by `appendPage`.
    const result = await requestJson(
      `/api/flashcards?offset=${String(cards.length)}`,
      "GET",
      undefined,
      isFlashcardPage,
    );
    if (!mounted.current) {
      return;
    }
    setLoading(false);
    if (!result.ok) {
      setLoadError(result.message);
      return;
    }
    const page = result.data;
    setCards((current) => appendPage(current, page));
    setHasMore(page.hasMore);
  }

  function updateCard(id: string, update: (card: Flashcard) => Flashcard) {
    setCards((current) => current.map((card) => (card.id === id ? update(card) : card)));
  }

  function removeCard(id: string, message?: string) {
    setCards((current) => current.filter((card) => card.id !== id));
    setNotice(message ?? null);
  }

  return (
    <div className="space-y-4">
      {notice && (
        <p className="flex items-center gap-2 text-sm text-amber-200" role="status">
          <Info className="size-4 shrink-0" />
          {notice}
        </p>
      )}

      {cards.length === 0 && !hasMore ? (
        <div className="space-y-3 text-sm text-blue-100/80">
          <p>Kolekcja jest pusta. Dodaj fiszki z tekstu lekcji albo pojedyncze słowo.</p>
          <div className="flex flex-wrap gap-4">
            <a href="/generate" className="text-purple-300 hover:underline">
              Nowa lekcja
            </a>
            <a href="/add" className="text-purple-300 hover:underline">
              Dodaj słowo
            </a>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => (
            <CollectionCard
              key={card.id}
              card={card}
              tagListId={TAG_LIST_ID}
              onUpdate={(update) => {
                updateCard(card.id, update);
              }}
              onRemove={(message) => {
                removeCard(card.id, message);
              }}
              onTagCreated={(name) => {
                setTagNames((current) => mergeTagName(current, name));
              }}
            />
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => {
              void loadMore();
            }}
            className={actionClass}
          >
            {loading ? <Spinner /> : <ChevronDown className="size-4" />}
            Pokaż więcej
          </Button>
        </div>
      )}

      {loadError && (
        <ErrorBox
          message={loadError}
          retryDisabled={loading}
          onRetry={() => {
            void loadMore();
          }}
        />
      )}

      {/* One list for every card's tag input: up to 500 names, rendered once rather than per card. */}
      <datalist id={TAG_LIST_ID}>
        {tagNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}
