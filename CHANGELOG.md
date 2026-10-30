# Changelog

## 0.1.0 — 2026-10-30

Initial public release.

- Settings page **Subagent model notes** beside the official Subagent page, one note per model.
- Host half injects authorized notes into the delegating agent's system prompt via the
  `system-prompt/assemble` waterfall, filtered by the Session's
  `subagentModelSelectionPolicy`.
- Notes are literal prompt text (`interpolate: false`).
- Pure prompt rules covered by `node --test`.
