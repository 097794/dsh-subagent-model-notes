# dsh-subagent-model-notes

Per-model notes for **subagent delegation** in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH): a settings page beside the official **Subagent** page, and the same notes injected into the delegating agent's system prompt so it can pick the child model you planned.

```
Settings → Plugins → Built-in plugin settings → Subagent model notes
```

## Why this exists

DSH lets you authorize an exact list of `provider/model` routes for child agents (`subagent-model-selection-settings`), and exposes `list_subagent_models` so the agent can discover them. But the authorized routes are only `{ provider, model }` pairs: there is no per-model description anywhere, and the model catalog carries no description for pi-ai providers. The delegating agent sees names and route ids — it has no idea when one model is the right choice.

This plugin adds that missing layer:

- a page listing every model the agent may choose, one editable note per model;
- the notes, filtered to the routes the **current Session** may actually select, appended to the system prompt right after the subagent tool guidance.

## Install

Requires a DSH build with the plugin system (`dsh.bundle` + client modules), e.g. DSH 0.2.1-rc.2 desktop.

1. Clone or copy this directory somewhere stable.
2. Install it as a profile bundle — either:
   - **Plugins page** → **Add plugin** → local directory → select this folder, or
   - the plugin manager tool: `install_bundle` with the absolute path of this folder.
3. Keep the folder where you installed it: a local-directory install is linked, not copied.

The bundle adds one row (`subagent-model-notes`) with a volatile `notes` config and the browser page that edits it.

## Use

1. Open **Settings → Plugins → Built-in plugin settings**. Right below the official **Subagent** entry there is now **Subagent model notes**.
2. Fill in a note for each model you authorized, for example *"cheap and fast — boilerplate and low-risk tasks"*.
3. Save. On the agent's next step, the note reaches the system prompt; only routes that are both authorized and noted are included.

Rows are marked:

| Mark | Meaning |
| --- | --- |
| **Authorized** | The route is in the current Subagent allowlist; its note will reach the agent. |
| **Not authorized for subagents** | The note is stored, but has no effect until you authorize the route. |
| **Not in the current catalog** | The model is temporarily unavailable; its note is retained. |

## How it works

**Host half** (`lib/index.js` + `lib/prompt.js`)

- `system-prompt/assemble` waterfall listener; runs for every agent.
- Reads the Session projection `subagentModelSelectionPolicy` written by `@deepseek-ai/dsh-tool-subagent`. No policy means subagent model selection is off for that Session, and the plugin does nothing.
- Keeps only notes whose route appears in that policy.
- Finds the tool whose description advertises `list_subagent_models`, then inserts a `subagent-model-notes` section after its guideline section. The section uses `interpolate: false`, so note text is literal (a `{{...}}` in a note cannot break the prompt).
- Pure logic lives in `lib/prompt.js` and is tested without a harness.

**Browser half** (`lib/client.js`)

- Registers a custom `plugins.item` page (`order: 11`, right after the official Subagent page).
- Reads and writes the volatile `notes` config through `ctx.configForms`, the same revision-fenced settings transport the official settings pages use.
- Loads the live model catalog through `ctx.remote.session.modelCatalog()` and reads the official allowlist through the `subagent-model-selection-settings` namespace, so the page always shows what the agent can actually choose.

## Compatibility and risk

- Developed and verified against **DSH 0.2.1-rc.2** (Windows desktop). It relies on plugin-facing APIs that are stable in that build (`system-prompt/assemble`, `plugins.item`, volatile Config fields, `subagentModelSelectionPolicy`), but they are not a public compatibility promise. An upgrade may change them; treat this as a community plugin.
- The notes are **guidance, not enforcement**: the real allowlist is still enforced by the official Subagent settings. The plugin never calls a model or changes a route.
- Presets that keep a `complete` persona (for example `minimal`) collapse the assembly to that persona after the waterfall, so the notes section is dropped there — a harness constraint shared with other `system-prompt/assemble` plugins.
- Only Sessions composed with subagent model selection enabled receive the section, and only on steps assembled after you save.

## Development

```sh
node --test test/prompt.test.mjs
```

`lib/prompt.js` has no DSH imports, so the routing/filtering/formatting rules and the section placement are testable with plain Node.

## License

MIT — see [LICENSE](LICENSE).
