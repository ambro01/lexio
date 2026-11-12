// Request helper, type guards and small UI pieces shared by the "Kolekcja" island (same patterns as AddWord).
import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isRecord } from "@/lib/utils";
import type { Flashcard, FlashcardPage, Tag } from "@/types";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number | null; message: string };

const NETWORK_ERROR = "Nie udało się połączyć z serwerem. Spróbuj ponownie.";

export const inputClass =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-purple-400 focus:outline-none";
export const optionClass = "bg-slate-900 text-white";
export const actionClass = "border-white/20 bg-white/10 text-white hover:bg-white/20";

/**
 * Calls a JSON endpoint. A `204 No Content` answer is read as the body `null`. Errors carry the server's Polish
 * `message` when there is one, and the HTTP status (null for a network failure).
 */
export async function requestJson<T>(
  url: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  payload: unknown,
  isValid: (body: unknown) => body is T,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      ...(payload === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    });
  } catch {
    return { ok: false, status: null, message: NETWORK_ERROR };
  }

  const serverError = `Błąd serwera (HTTP ${String(response.status)}). Spróbuj ponownie.`;
  let body: unknown = null;
  if (response.status !== 204) {
    try {
      body = await response.json();
    } catch {
      return { ok: false, status: response.status, message: serverError };
    }
  }

  if (response.ok && isValid(body)) {
    return { ok: true, data: body };
  }
  if (isRecord(body) && typeof body.message === "string") {
    return { ok: false, status: response.status, message: body.message };
  }
  return { ok: false, status: response.status, message: serverError };
}

export function isNoContent(body: unknown): body is null {
  return body === null;
}

export function isTag(body: unknown): body is Tag {
  return isRecord(body) && typeof body.id === "string" && typeof body.name === "string";
}

export function isFlashcard(body: unknown): body is Flashcard {
  return (
    isRecord(body) &&
    typeof body.id === "string" &&
    typeof body.word === "string" &&
    typeof body.translation === "string" &&
    Array.isArray(body.additionalMeanings) &&
    typeof body.exampleSentence === "string" &&
    (body.cefr === null || typeof body.cefr === "string") &&
    Array.isArray(body.tags) &&
    body.tags.every(isTag)
  );
}

export function isFlashcardPage(body: unknown): body is FlashcardPage {
  return (
    isRecord(body) && typeof body.hasMore === "boolean" && Array.isArray(body.cards) && body.cards.every(isFlashcard)
  );
}

export function Spinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}

export function ErrorBox({
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
          className={actionClass}
        >
          <RotateCcw className="size-4" />
          Spróbuj ponownie
        </Button>
      )}
    </div>
  );
}
