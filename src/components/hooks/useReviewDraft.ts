import { useCallback, useMemo, useSyncExternalStore } from "react";
import { draftStorageKey, parseDraft, type ReviewDraft } from "@/lib/review-draft";

// The draft lives in localStorage so a review survives a reload or a killed tab. When storage is unavailable
// or full, it falls back to memory for the life of the page, without errors.
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab of the same user changed the draft.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readRaw(key: string): string | null {
  const inMemory = memory.get(key);
  if (inMemory !== undefined) {
    return inMemory;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, raw: string | null): void {
  if (raw === null) {
    memory.delete(key);
  }
  try {
    if (raw === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, raw);
      memory.delete(key);
    }
  } catch {
    if (raw !== null) {
      memory.set(key, raw);
    }
  }
  notify();
}

function toDraft(raw: string | null): ReviewDraft | null {
  if (raw === null) {
    return null;
  }
  try {
    return parseDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

const subscribeNever = () => () => undefined;

export type DraftUpdate = ReviewDraft | ((current: ReviewDraft) => ReviewDraft);

/**
 * The user's review draft, persisted per user in localStorage. `ready` is false during server rendering
 * and hydration, before the stored draft can be read.
 */
export function useReviewDraft(userId: string) {
  const key = draftStorageKey(userId);
  const ready = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );
  const draft = useMemo(() => toDraft(raw), [raw]);

  const setDraft = useCallback(
    (update: DraftUpdate) => {
      let next: ReviewDraft;
      if (typeof update === "function") {
        const current = toDraft(readRaw(key));
        if (!current) {
          return;
        }
        next = update(current);
      } else {
        next = update;
      }
      writeRaw(key, JSON.stringify(next));
    },
    [key],
  );

  const clearDraft = useCallback(() => {
    writeRaw(key, null);
  }, [key]);

  return { draft, ready, setDraft, clearDraft };
}
