# Lessons

- Treat browser annotations as executable acceptance criteria: preserve the exact viewport and add an interaction assertion for each requested behavior.
- Relationship editing is graph editing, not a single-record update; verify both the edited record and every reciprocal parent, child, and partner edge after persistence and reload.
- Admin-only surfaces need their own desktop and mobile browser pass; visitor-route fidelity does not prove editor, archive actions, or storage behavior.
- For forms with multiple close paths, route backdrop, Escape, header controls, and dialog helpers through one dirty-state guard and test both cancel and discard outcomes.

- Never normalize delimiter-based controlled inputs on every keystroke: preserve raw text while editing, then parse only on submit or blur so commas remain typeable.
- Treat portable archive support as a data-boundary feature: test the full snapshot and every binary blob across export, destructive replacement, import, and reload rather than validating JSON metadata alone.
- For local-only media, derive every file input from the domain MIME allowlist, remove writable URL escape hatches, and keep asset validation inside the same rollback boundary as persistence.
