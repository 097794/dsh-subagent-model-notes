/**
 * `dsh-subagent-model-notes` host half.
 *
 * The user writes one note per subagent-selectable model on the companion
 * settings page (browser half in `./client.js`). Those notes live in this
 * plugin's volatile `notes` config, and this half appends them — only for
 * routes the current Session may actually select — to the system prompt that
 * drives each delegation decision.
 */
import z from '@deepseek-ai/schemastery'
import { applyNotes } from './prompt.js'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'dsh-subagent-model-notes'

/** Services required by this plugin. */
export const inject = ['settings', 'sessionProjections', 'systemPrompt']

/**
 * Volatile `notes` keeps this row editable through the Host settings form the
 * browser half binds; the page registers `auto: false` so no generated form is
 * drawn for it.
 */
export const Config = z.object({
  notes: z.array(z.object({
    provider: z.string().min(1).required(),
    model: z.string().min(1).required(),
    note: z.string().default(''),
  })).default([]).volatile(),
})

/** Session projection written by `@deepseek-ai/dsh-tool-subagent`. */
export const POLICY_KEY = 'subagentModelSelectionPolicy'

/** Read the live notes list whether the config reference is plain or volatile. */
function currentNotes(config) {
  const notes = config?.notes
  if (notes === undefined || notes === null) return []
  if (typeof notes.get === 'function') return notes.get() ?? []
  return notes
}

/**
 * Append the notes section after the model-selection delegation-tool guidance.
 * Only runs for a Session whose delegation tool may select a child model: the
 * absence of a recorded route policy leaves the assembly untouched.
 * @param ctx - plugin context (`sessionProjections` is read here).
 * @param config - this plugin's live config.
 * @param assembled - post-waterfall prompt assembly.
 * @param context - prompt assembly context.
 * @returns The possibly extended assembly.
 */
export function attachNotes(ctx, config, assembled, context) {
  const session = context?.agent?.session
  if (session === undefined || session === null) return assembled
  const routes = ctx.sessionProjections.stateOf(session, POLICY_KEY)
  if (!Array.isArray(routes) || routes.length === 0) return assembled
  return applyNotes(assembled, routes, currentNotes(config))
}

/** Mount the prompt hook and opt this row out of generated settings forms. */
export function apply(ctx, config) {
  ctx.effect(() => ctx.settings.configure({ auto: false }, ctx.fiber), 'subagent-model-notes: settings presentation')

  ctx.on('system-prompt/assemble', async (assembly, context, next) => {
    const assembled = await next()
    return attachNotes(ctx, config, assembled, context)
  })
}
