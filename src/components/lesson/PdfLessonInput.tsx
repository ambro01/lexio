import { useRef, useState, type ChangeEvent } from "react";
import { CircleAlert, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { countWords } from "@/lib/ai/proposals";
import type { PdfFailure } from "@/lib/pdf/extract";
import { cn } from "@/lib/utils";

export interface PdfText {
  text: string;
  totalWords: number;
  truncated: boolean;
  fileName: string;
}

interface Props {
  disabled: boolean;
  /** The text read from the current file, kept by the parent so it survives this panel being remounted. */
  result: PdfText | null;
  onText: (result: PdfText | null) => void;
}

type Status = { name: "idle" } | { name: "reading"; page: number; pages: number } | { name: "error"; message: string };

// Browsers may cache a failed load of the pdf.js module, so a plain retry can keep failing until a reload.
const FAILED = "Nie udało się odczytać PDF. Odśwież stronę i spróbuj ponownie.";

const FAILURE_MESSAGES: Record<PdfFailure, string> = {
  too_large: "Plik jest za duży (maks. 20 MB).",
  no_text: "Ten PDF nie ma warstwy tekstowej (np. skan). Wklej tekst w zakładce Tekst.",
  password: "PDF jest zabezpieczony hasłem.",
  invalid: "To nie jest poprawny plik PDF.",
  failed: FAILED,
};

const outlineClass = "border-white/20 bg-white/10 text-white hover:bg-white/20";

/** The PDF tab: reads the picked file in memory only (nothing is uploaded) and hands its lesson text to the form. */
export default function PdfLessonInput({ disabled, result, onText }: Props) {
  const [status, setStatus] = useState<Status>({ name: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  // Only the latest pick may report its result.
  const pickId = useRef(0);

  const reading = status.name === "reading";

  async function read(file: File) {
    if (import.meta.env.SSR) {
      return;
    }
    const id = ++pickId.current;
    const current = () => id === pickId.current;
    // Generuj stays off while reading; if the new file fails, the previously loaded file is kept.
    const previous = result;
    const fail = (message: string) => {
      if (current()) {
        setStatus({ name: "error", message });
        onText(previous);
      }
    };
    onText(null);
    setStatus({ name: "reading", page: 0, pages: 0 });
    try {
      const { MAX_PDF_BYTES, extractLessonText } = await import("@/lib/pdf/extract");
      // Refuse a huge file before downloading pdf.js or reading it into memory.
      if (file.size > MAX_PDF_BYTES) {
        fail(FAILURE_MESSAGES.too_large);
        return;
      }
      const { loadPdfjs } = await import("@/lib/pdf/browser");
      const pdfjs = await loadPdfjs();
      // pdf.js transfers (detaches) the buffer to its worker, so it is created fresh for every file.
      const data = new Uint8Array(await file.arrayBuffer());
      const extraction = await extractLessonText(pdfjs, data, {
        onProgress: (page, pages) => {
          if (current()) {
            setStatus({ name: "reading", page, pages });
          }
        },
      });
      if (!current()) {
        return;
      }
      if (!extraction.ok) {
        fail(FAILURE_MESSAGES[extraction.reason]);
        return;
      }
      setStatus({ name: "idle" });
      onText({
        text: extraction.text,
        totalWords: extraction.totalWords,
        truncated: extraction.truncated,
        fileName: file.name,
      });
    } catch {
      // The library failed to load (e.g. offline) or the file could not be read.
      fail(FAILED);
    }
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Clear the input so picking the same file again triggers another read.
    event.target.value = "";
    if (file) {
      void read(file);
    }
  }

  function pickFile() {
    inputRef.current?.click();
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        id="lesson-pdf"
        type="file"
        accept="application/pdf,.pdf"
        disabled={disabled || reading}
        onChange={onChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {result && !reading ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
          <FileText className="size-4 shrink-0 text-purple-300" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-white">{result.fileName}</p>
            <p className={cn(result.truncated ? "text-amber-200" : "text-blue-100/60")}>
              {result.truncated
                ? `Użyto pierwszych ${String(countWords(result.text))} z ${String(result.totalWords)} słów`
                : `${String(result.totalWords)} słów`}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={pickFile}
            className={outlineClass}
          >
            <Upload className="size-4" />
            Zmień plik
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={disabled || reading}
          onClick={pickFile}
          className={cn(outlineClass, "h-auto w-full border-dashed py-6")}
        >
          <Upload className="size-4" />
          Wybierz plik PDF
        </Button>
      )}

      {status.name === "reading" && (
        <p className="flex items-center gap-2 text-sm text-blue-100/80" role="status">
          <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          {status.pages > 0 ? `Czytam PDF… strona ${String(status.page)} / ${String(status.pages)}` : "Czytam PDF…"}
        </p>
      )}

      {status.name === "error" && (
        <p
          className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/30 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          <CircleAlert className="size-4 shrink-0" />
          {status.message}
        </p>
      )}
    </div>
  );
}
