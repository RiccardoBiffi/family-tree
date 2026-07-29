# Family archive redesign

- [x] Lock the approved visual references, tokens, copy, and interaction inventory.
- [x] Rebuild the compact app shell, search, view selector, and remove all mode UI.
- [x] Rework Diagramma for clear relationship semantics, responsive fit, and keyboard access.
- [x] Rework Timeline into a labeled generation grid with contained zoom/navigation.
- [x] Restyle Tabella and preserve sorting, column controls, search, and person details.
- [x] Improve modal focus, keyboard, reduced-motion, and responsive behavior.
- [x] Add the QA-only live progress page and round ledger.
- [x] Add/adjust unit and browser verification coverage.
- [x] Run builder/critic rounds and repair the largest remaining visual or UX gaps.
- [x] Run lint, tests, build, accessibility checks, and exact-size screenshot comparisons.

## Review

- Product routes remain `/` and `/admin`; `/progress` is QA-only and absent from product navigation.
- Blind A/B: candidate won 3/3 fresh-context critic reviews.
- Critic loop closed the diagram framing/mobile clipping, timeline density/mobile comparison, and admin header sizing gaps.
- Human task verdicts: Matteo ancestry 6–8s desktop and 10–12s mobile; Sofia/Marco 5–8s desktop and 7–12s mobile.
- Browser evidence: 1440×900 and 390×844, zero page overflow, 44px mobile targets, zero serious/critical axe findings, no console errors, dialog focus trapped/restored.
- Static verification: `npm run lint`, `TMPDIR=/tmp npm test` (6/6), `tsc --noEmit`, and `TMPDIR=/tmp npm run build` pass.
- Final renders and the approved concepts were inspected directly; the fidelity ledger is recorded on `/progress` and in the handoff.
