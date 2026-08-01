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
- Malformed JSON still recovers to the Rinaldi demo; the former reset control is
  now superseded by the portable archive menu.
- Verification: targeted onboarding/storage tests 11/11, full suite 19/19,
  `npm run lint`, `npx tsc --noEmit`, and `TMPDIR=/tmp npm run build` pass.

# Local media and portable archive

- [x] Define a versioned local-media model and compressed `.albero` contract.
- [x] Generate and persist original demo portraits and multimedia assets locally.
- [x] Store uploaded binary media in IndexedDB and resolve safe object URLs for display.
- [x] Add local photo/media controls to the person editor and fix comma entry for tags.
- [x] Replace the reset toolbar button with an accessible import/export archive menu.
- [x] Export snapshot plus every media blob into one compressed file.
- [x] Import one archive file transactionally and restore all data and media.
- [x] Add unit coverage for archive encoding, validation, tag entry, and media metadata.
- [x] Run fresh builder/critic rounds on storage, archive, and UI flows.
- [x] Verify export -> clear -> import -> reload in real browsers on desktop and mobile.

## Local media review

- The demo now includes ten generated local WebP portraits and ten distinct WAV
  sound postcards. The seed stores stable `media:` references, while IndexedDB
  owns the binary Blobs and the UI resolves only short-lived object URLs.
- The admin archive icon opens one accessible menu for export/import. `.albero`
  is a versioned gzip package containing the unchanged v1 snapshot and every
  referenced media asset; import validates closure before transactional replace.
- Editor tags preserve literal commas until submit. External image URLs are no
  longer editable, the file inputs expose an exact MIME allowlist, and invalid
  files fail inside the atomic rollback boundary without losing the draft.
- A separate versioned localStorage marker makes the legacy demo migration truly
  one-shot without changing snapshot v1: deliberate media removals and imports
  remain unchanged after remount.
- Fresh builder/critic rounds closed package closure, toolbar stacking, local-only
  editing, invalid-file rollback, and migration lifecycle gaps. Final verdict: WIN
  with no remaining P0/P1/P2.
- Browser proof exported an actual downloaded `.albero`, compared it byte-for-byte
  with the generated Blob, cleared localStorage and IndexedDB, imported, reloaded,
  and recovered 21 assets (2,508,450 bytes) with identical SHA-256 inventories.
- At 390x844 the page has zero horizontal overflow, the archive trigger is 44x44,
  its menu remains topmost, Escape restores focus, and visitor mode hides it.
- Verification: 12 files and 45 tests pass; TypeScript, lint, diff-check, and the
  production build pass; axe found zero serious or critical findings in four
  principal surfaces; final browser console errors: zero.

### Media/archive domain subtask

- [x] Add a versioned `MediaAssetRecord` model with safe MIME/size validation.
- [x] Add an IndexedDB-backed `MediaDB` with atomic `replaceAll`.
- [x] Add gzip `.albero` export/import with complete snapshot and base64 blobs.
- [x] Reject malformed compression/JSON, wrong format/version, unsafe media, and invalid snapshots.
- [x] Preserve `family-tree.snapshot.v1` and the existing `FamilyTreeSnapshot` shape.
- [x] Add focused model, IndexedDB, and archive round-trip/rejection tests.
- [x] Run targeted tests, lint, typecheck, and record exact results below.

#### Media/archive domain review

- Added a v1 Blob-backed media record with stable `media:` references, a
  conservative MIME allowlist, and canonical metadata plus per-file size checks.
- `MediaDB` stores records in IndexedDB and performs clear-plus-put replacement
  in one read/write transaction after validating the complete replacement set.
- `.albero` export/import uses browser-native gzip streams, bounded compressed
  and expanded reads, complete snapshot validation, and lossless base64 blobs.
- The existing `family-tree.snapshot.v1` key and `FamilyTreeSnapshot` schema
  were not changed.
- Verification: focused domain tests and the final full project checks pass;
  package references and media assets are closed in both directions.

# Modal simplification feedback

- [x] Remove every visible text button labelled `Chiudi` from product modals while preserving an explicit icon dismissal, Escape, backdrop, focus restoration, and dirty-state warnings.
- [x] Remove the legacy-attachment concept from editor, person sheet, seed content, save handling, and tests without changing the v1 media-reference contract.
- [x] Remove generic local-file editing from the person editor.
- [x] Make the editor portrait/placeholder the single entry point for add, replace, and remove photo actions.
- [x] Prove create/edit/remove photo flows, no legacy/file UI copy, all modal dismissal paths, desktop/mobile layout, console health, tests, lint, types, and build.
- [x] Run a fresh critic against the rendered output and close the largest remaining gap.

## Modal simplification review

- `PersonModal` and `PersonEditorModal` now share an icon-only 44x44 close
  control; Escape, backdrop, focus return, and the editor dirty-state guard
  still use the existing dialog lifecycle.
- The editor portrait is the only visible photo surface. It supports add or
  replace through the image button, plus remove and staged undo from controls
  placed directly on the portrait.
- Generic file upload/removal and every legacy text attachment field/display
  were removed. Existing audio/media references remain playable and portable.
- Legacy text values are purged idempotently on load and import. The unchanged
  v1 attachment/media-reference contract remains covered by archive tests.
- Fresh read-only audit identified product-modal scope and compatibility risks.
  The largest conflict was resolved by preserving multimedia playback while
  removing only the editor and legacy concepts requested by the user.
- Browser proof at 1304x1035 and 390x844 found no removed copy, no horizontal
  overflow, no console errors, and 44px close/photo controls. Dirty-close
  cancel preserved the draft; confirm closed it.
- Verification: TypeScript passes, lint passes, all 45 tests pass, production
  build passes, and localhost:3000 is healthy with one dev server.

# Modal dismissal, multimedia, and deletion correction

- [x] Remove every explicit close button and icon from all product modals; retain Escape/backdrop dismissal and dirty-state protection.
- [x] Remove both annotated helper paragraphs from the editor header.
- [x] Restore a `Contenuti multimediali` editor section in both create and edit modes.
- [x] Support adding and staging removal/undo of local image, audio, video, and PDF assets.
- [x] Persist media additions/removals atomically with person changes and preserve `.albero` compatibility.
- [x] Ask for explicit confirmation before deleting a person or any related local media.
- [x] Update unit/integration coverage and run desktop/mobile browser verification.
- [x] Obtain a fresh independent critic verdict against the rendered output.

## Modal/media correction review

- Product modals expose no close text, X icon, or other explicit dismiss control.
  Escape and backdrop dismissal still share the dirty-state confirmation guard.
- Both editor modes expose `Contenuti multimediali` for local image, audio,
  video, and PDF files, including staged add, remove, and restore actions.
  Portrait editing remains a separate interaction and no legacy attachment UI
  or copy was reintroduced.
- Media asset writes and snapshot updates share the existing rollback boundary;
  `.albero` export/import remains compatible with the unchanged v1 data contract.
- Person deletion now asks for confirmation before reading, deleting, or
  replacing person/media state; cancellation is a verified no-op.
- Verification: targeted tests 20/20, full suite 48/48 across 12 files, ESLint,
  TypeScript, production build, and `git diff --check` pass.
- Real-browser proof at 1304x1035 and 390x844 covers create/edit media
  persistence, dirty Escape/backdrop dismissal, deletion cancel/confirm, 44px
  visible targets, zero page overflow, and zero serious/critical axe findings.
- A fresh source-and-render critic returned `WIN`. Its only remaining note is
  non-blocking native file-picker truncation on mobile.

# Single-file offline release

- [x] Add a dedicated Vite entry that reuses the production UI and defaults to visitor.
- [x] Enable admin only for the exact `?admin` query parameter with no visible switch.
- [x] Inline all JavaScript, CSS, and the 20 tracked demo-media assets into one HTML.
- [x] Preserve Next development and the web `/` and `/admin` routes.
- [x] Add durable/volatile persistence capability handling without changing snapshot v1 or `.albero`.
- [x] Add deterministic build, structural verification, browser verification, and release scripts.
- [x] Prove the artifact works through `file://` with networking disabled on desktop and mobile.
- [x] Verify visitor/admin boundaries, reload persistence, media, and `.albero` recovery.
- [x] Pass unit tests, lint, typecheck, Next build, offline build, and a fresh critic audit.

## Offline release review

- `npm run build` now emits only `dist-offline/archivio-famiglia.html`.
  The final artifact is 3,687,264 bytes, embeds 20 demo media, contains no
  external script/stylesheet/media references, and has SHA-256
  `1ba172dc9bf4438f07784087ad87d874e166a907aa2e1a63892e8ac115611abb`.
- The standalone entry uses visitor by default and admin only when the exact
  `admin` query key is present (`?admin` and `?admin=`); unrelated queries
  remain visitor and no mode-switch UI is rendered.
- Snapshot and media persistence expose `durable | volatile`. Security,
  availability, blocked-open, and quota failures fall back to session memory;
  unexpected data/transaction errors still surface. Admin receives the
  `.albero` export warning while visitor remains free of mode-status copy.
- Browser acceptance runs with Chromium networking disabled at 1440x900 and
  390x844. It covers onboarding, all views, route boundaries, CRUD, reciprocal
  parent saving, image/audio/video/PDF, reload durability, deletion, `.albero`
  import/export with equal media hashes, 20 embedded demo media, volatile
  export and recovery into a fresh durable context, zero non-local requests,
  zero runtime errors, zero horizontal overflow, and zero serious/critical axe
  findings.
- The fresh critic's largest gap was packaged-runtime volatile recovery. The
  new E2E exposed and closed one real direct-localStorage crash in the demo
  migration marker, then proved the complete recovery path.
- Final `npm run release` passes: ESLint, TypeScript, 60/60 tests, Next static
  routes `/`, `/admin`, and `/progress`, standalone build, structural checks,
  and both offline browser suites.

# Visitor archive transfer and main publication

- [x] Expose `Gestisci archivio`, export, import, progress, and feedback in visitor mode.
- [x] Keep new-person, edit, and delete actions admin-only.
- [x] Prove visitor export/import through the real `.albero` package path.
- [x] Update unit and offline browser acceptance tests for the new capability boundary.
- [x] Keep generated release artifacts out of source control.
- [x] Run the complete release pipeline and a fresh critic audit.
- [x] Commit the complete coherent implementation and push `main`.

## Visitor archive transfer review

- Visitor and admin share the accessible `Gestisci archivio` menu, its
  progress/feedback states, and the `.albero` file input. `Nuova persona`,
  editing, and deletion remain admin-only.
- The packaged desktop browser flow exports as visitor, deletes a related
  person as admin, imports as visitor, and verifies restored data,
  relationships, media inventory, and SHA-256 hashes.
- Desktop 1440x900 and mobile 390x844 expose 44px targets with no horizontal
  overflow, external requests, console errors, mode switch, or serious/critical
  axe findings.
- The full `npm run release` pipeline passes: lint, TypeScript, 60/60 tests,
  Next routes, single-file build, structural validation, and offline browser
  acceptance.
- A fresh read-only critic returned PASS with no material gap. The complete
  transfer round-trip runs on desktop; mobile independently verifies the same
  controls, target sizes, layout, and offline policy.

# Zero-media offline distribution

- [x] Remove the tracked demo `.webp` and `.wav` files and their build embedding path.
- [x] Make the built-in Rinaldi seed contain no photo or multimedia references.
- [x] Remove automatic demo-media fetching/seeding from the runtime.
- [x] Keep user-selected images, audio, video, and PDFs stored through `MediaDB` in IndexedDB.
- [x] Export only the media records already held by the user media store.
- [x] Make structural verification require zero multimedia files and zero bundled demo-media paths in `dist-offline`.
- [x] Replace embedded-demo browser acceptance with a media-free baseline plus user-upload persistence and archive round-trip proof.
- [x] Run focused tests, lint, typecheck, the offline build, structural verification, browser acceptance, and the full release pipeline.

## Zero-media offline distribution review

- Removed the 10 tracked WebP portraits, 10 tracked WAV postcards, virtual Vite
  module, fetch shim, demo definitions, reference migration, and runtime seeding.
- The Rinaldi fallback seed now has `photo: null` and `attachments: null` for
  every person. User WebP/WAV support remains in the MIME allowlist and tests
  prove user-selected files are written through `MediaDB`.
- Archive export now reads the current media store directly. Media-free and
  media-bearing `.albero` round trips both pass without inventing assets.
- `dist-offline/archivio-famiglia.html` is the only release file: 583,781
  bytes, zero multimedia files, zero bundled multimedia payloads, SHA-256
  `98e784acb16d017bf902a6f1b22af3ade58fac492f7b048b6a2ca2ca936551b5`.
- Final `npm run release` passes lint, TypeScript, 57/57 tests, all Next static
  routes, standalone build, structural checks, and desktop/mobile offline
  browser acceptance including fresh zero-media IndexedDB state, user upload,
  reload, export/import hash equality, and volatile recovery.
- The in-app Browser runtime rejected the workspace path containing a space;
  the repository's Playwright acceptance suite was used as the documented
  fallback and passed outside the sandbox.

# Vercel Next.js deployment manifest

- [x] Keep Vercel's detected Next.js preset and add repository-owned deployment configuration.
- [x] Override Vercel's build command with `npm run build:web` without changing the offline `npm run build` contract.
- [x] Verify the web build creates `.next/routes-manifest.json` and the expected static routes.
- [x] Run config validation, lint, typecheck, and focused release checks.

## Vercel deployment review

- Root cause: Vercel detected Next.js but used the repository's `build` script,
  which intentionally produces only the standalone Vite artifact and therefore
  never created `.next/routes-manifest.json`.
- Added root `vercel.json` with `buildCommand: npm run build:web`. No custom
  Output Directory is set, so Vercel keeps the Next.js `.next` default.
- The local web build completed and produced routes-manifest version 3 with
  `/`, `/admin`, `/progress`, `/_not-found`, and `/favicon.ico` static routes.
- `npm run build` still produces only the verified offline HTML artifact with
  zero multimedia files or payloads.
- Verification passes: Vercel JSON/build-command validation, Next production
  build, manifest parsing, ESLint, TypeScript, offline build, structural checks,
  and `git diff --check`.
