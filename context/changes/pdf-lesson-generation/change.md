---
change_id: pdf-lesson-generation
title: PDF lesson generation
status: impl_reviewed
created: 2026-11-11
updated: 2026-11-11
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- 2026-11-11 (Phase 1 manual check): 3 of 4 real lesson PDFs are image-only exports (jsPDF, one image per page, no text layer); only a Ghostscript-made worksheet had text. Text cannot be copied out of them either, so the PRD's "paste the text" workaround does not help. Decision: finish S-02 for text-layer PDFs, then open a separate change for image-only PDFs (e.g. render pages in the browser and send them to the vision-capable AI model); it needs its own plan, a PRD non-goal change and a cost/60 s measurement.
- Phase 1 adaptations after the real-PDF check (user-approved): under 20 words of text counts as `no_text` (`MIN_TEXT_WORDS`, an image-only export carried one run-together label); repeated lines are also detected within the odd and the even pages (footers alternating left/right), each page set needing at least 3 pages.
