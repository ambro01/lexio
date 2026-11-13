// Browser-only: draws pdf.js pages on a <canvas>. Import it only dynamically from an event handler guarded by
// `if (import.meta.env.SSR) return;`, like `browser.ts`, so it stays out of the server (Worker) bundle.
import type { PdfPage } from "@/lib/pdf/extract";

/** Width of a rendered page in pixels. With the quality below, the single knob for the endpoint's CPU cost. */
export const PAGE_IMAGE_WIDTH = 1240;
export const PAGE_IMAGE_QUALITY = 0.75;

/** Renders one page at `PAGE_IMAGE_WIDTH` px wide on a white background and returns it as a JPEG data URL. */
export async function renderPageJpeg(page: PdfPage): Promise<string> {
  const scale = PAGE_IMAGE_WIDTH / page.getViewport({ scale: 1 }).width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  try {
    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) {
      throw new Error("Canvas 2D context is not available");
    }
    // JPEG has no alpha: without a white fill, transparent areas would encode as black.
    canvasContext.fillStyle = "#ffffff";
    canvasContext.fillRect(0, 0, canvas.width, canvas.height);
    // Passing the context keeps pdf.js drawing on this canvas on the main thread (not an OffscreenCanvas in its
    // worker), so `toDataURL` can read it afterwards.
    await page.render({ canvas, canvasContext, viewport }).promise;
    return canvas.toDataURL("image/jpeg", PAGE_IMAGE_QUALITY);
  } finally {
    // Release the bitmap at once, so a phone does not hold one per page.
    canvas.width = 0;
    canvas.height = 0;
  }
}
