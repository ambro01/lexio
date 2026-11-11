// The only module that imports pdf.js for the browser. Never import it statically from a component: load it with
// `await import("@/lib/pdf/browser")` inside an event handler guarded by `if (import.meta.env.SSR) return;`, so
// pdf.js stays out of the server (Worker) bundle. `npm run check:client-only` enforces this after a build.
import type { PdfJsModule } from "@/lib/pdf/extract";

let cached: PdfJsModule | undefined;

/** Loads the legacy pdf.js build (works on older mobile browsers) and points it at its bundled worker. */
export async function loadPdfjs(): Promise<PdfJsModule> {
  if (cached) {
    return cached;
  }
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.min.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  cached = pdfjs;
  return pdfjs;
}
