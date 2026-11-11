---
change_id: cefr-too-easy-grouping
title: Cefr too easy grouping
status: impl_reviewed
created: 2026-11-11
updated: 2026-11-11
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Known risk (impl-review F2, accepted 2026-11-11): the review draft format is forward-only. Code from before S-03 reads only draft version 1, so after a code revert, or in a browser tab still running the old bundle, an open version-2 review is not shown and the next "Generuj" overwrites it. At most one unsaved review is lost; rollbacks are rare.
