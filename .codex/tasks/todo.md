# Browser-feedback repair

- [x] Capture the comments as exact interaction and visual assertions at 1337×1059.
- [x] Make diagram selection/highlight visibly 2px without shifting the card layout.
- [x] Make the column chooser dismiss outside, reorderable, and reflected immediately in the table.
- [x] Hide Genitori by default and place it after Figli.
- [x] Compact the admin header and place icon-only archive actions beside search.
- [x] Make the editor header sticky, move Save into it, and remove the bottom Cancel action.
- [x] Guard every editor close path when the draft contains unsaved changes.
- [x] Fix relationship reconciliation and prove every editable field persists correctly.
- [x] Add first-run empty-archive onboarding and persist the family/archive name compatibly.
- [x] Run builder/critic loops on the real output and repair the largest remaining gaps.
- [x] Pass lint, typecheck, unit tests, build, axe, keyboard/dialog, desktop/mobile browser flows, and screenshot comparison.

## Review

- Exact 1337×1059 browser pass: header 104px, search and 44px icon actions share one row, selected and query-highlighted diagram cards compute to 2px borders.
- All nine table columns were reordered by a fresh critic; all 18 move controls measured 44×44, and outside click plus Escape dismiss correctly.
- Editor header scroll delta was 0px; Save stays visible, Annulla is absent, and dirty Close, Escape, and backdrop all warn before discarding.
- Real UI save plus full reload removed Elena as Sofia's parent and removed the reciprocal child edge while retaining Marco.
- 390×844 has zero page overflow and 44px action targets; axe reported no serious or critical findings and the console stayed clean.
- 1440×900 first-viewport checks pass for Diagramma, Tabella, and Timeline; Sofia and Marco were located in 12ms.
- Static verification passes: lint, TypeScript, production build, git diff check, and 19 of 19 tests.
- Builder and separate critic loops closed with PASS/WIN on table, persistence onboarding, and editor header diagram work.

## Relationship persistence subtask

- [x] Trace the editor save payload through graph reconciliation and localStorage persistence.
- [x] Add a focused failing test for changed and removed parents.
- [x] Reconcile parent, child, and partner edges symmetrically without changing the stored archive schema.
- [x] Prove every scalar/array editor field survives the relationship update.
- [x] Prove reciprocal edges update for changed parents, removed parents, children, and partners.
- [x] Run targeted tests, lint/typecheck as applicable, and record the result below.

### Relationship persistence review

- Root cause: additive normalization reintroduced stale reciprocal edges after an edited relation was removed.
- The edited record is now authoritative for incident parent, child, and partner edges before the existing v1 normalizer runs.
- Hook tests cover every scalar and list field plus changed and removed reciprocal relations after reload.
- Real browser proof removed an existing parent through the editor, saved, reloaded, and verified both sides of the graph.

## Empty-archive onboarding subtask

- [x] Define `senza dati` as an absent `family-tree.snapshot.v1` entry, not an
  archive whose stored `people` list happens to be empty.
- [x] Return the missing-key state explicitly from the storage layer without
  persisting demo records.
- [x] Preserve v1 snapshots, corrupt-payload demo recovery, and the explicit
  `Ripristina demo` path.
- [x] Persist the submitted family name through existing v1 metadata and use it
  as the archive title after remount/reload.
- [x] Add a focused, accessible onboarding form without changing the editor,
  table, or archive-header layout.
- [x] Prove first-run submit, reload persistence, stored-empty backcompat, and
  demo recovery/reset behavior with focused tests.
- [x] Run targeted tests, lint, typecheck, and record the result below.

### Empty-archive onboarding review

- Kept the storage key and schema at v1 because `familyName` already existed in
  metadata; no migration or parallel key is required.
- Missing-key loads now return an unpersisted empty snapshot plus explicit
  `missing` status. Stored snapshots, including `people: []`, return `stored`.
- First submit persists the trimmed family name, derived archive title, and an
  empty people list; remounting renders the persisted title without onboarding.
- Malformed JSON still recovers to the Rinaldi demo, and `Ripristina demo`
  continues to persist the same seed archive.
- Verification: targeted onboarding/storage tests 11/11, full suite 19/19,
  `npm run lint`, `npx tsc --noEmit`, and `TMPDIR=/tmp npm run build` pass.
