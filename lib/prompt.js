/**
 * Pure prompt-building logic for `dsh-subagent-model-notes`.
 *
 * The host half runs this at every prompt assembly: given the exact subagent
 * routes a Session may select and the user-authored notes, it renders one
 * system-prompt section telling the delegating agent which child model fits.
 *
 * Kept free of DSH imports so the formatting rules can be exercised directly.
 */

/** Registered prompt-section name of the notes block. */
export const PROMPT_SECTION_NAME = 'subagent-model-notes'

/** Stable in-memory identity of one provider/model pair. */
export function routeKey(route) {
  return `${route.provider}\u0000${route.model}`
}

/** Normalize line endings and trim one note value. */
function noteText(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\r\n?/g, '\n').trim()
}

/**
 * Keep only notes whose route is currently selectable, in route order.
 * @param routes - exact provider/model routes the Session may select.
 * @param notes - user-authored `{provider, model, note}` entries.
 * @returns `{provider, model, note}` lines with non-empty notes.
 */
export function collectNotes(routes, notes) {
  const byRoute = new Map()
  for (const entry of Array.isArray(notes) ? notes : []) {
    if (entry === null || typeof entry !== 'object') continue
    if (typeof entry.provider !== 'string' || entry.provider === '') continue
    if (typeof entry.model !== 'string' || entry.model === '') continue
    const text = noteText(entry.note)
    if (text === '') continue
    byRoute.set(routeKey(entry), text)
  }
  const lines = []
  for (const route of Array.isArray(routes) ? routes : []) {
    if (route === null || typeof route !== 'object') continue
    if (typeof route.provider !== 'string' || typeof route.model !== 'string') continue
    const text = byRoute.get(routeKey(route))
    if (text === undefined) continue
    lines.push({ provider: route.provider, model: route.model, note: text })
  }
  return lines
}

/**
 * Render the model-facing section text.
 * @param lines - output of {@link collectNotes}.
 * @returns The section body, or `''` when no note applies.
 */
export function formatNotes(lines) {
  if (lines.length === 0) return ''
  const parts = [
    'Subagent model notes — the user\'s guidance for choosing a child model in this session:',
  ]
  for (const line of lines) {
    const body = line.note.split('\n').map((part, index) => (index === 0 ? part : `  ${part}`)).join('\n')
    parts.push(`- ${line.provider}/${line.model} — ${body}`)
  }
  parts.push(
    'When you delegate with the subagent tool that accepts `provider` and `model`, choose the route whose note fits the task. If no note fits, keep the configured or inherited default instead of picking an unrelated authorized model.',
  )
  return parts.join('\n')
}

/**
 * Build the section body for one assembly.
 * @param routes - exact routes the Session may select.
 * @param notes - user-authored note entries.
 * @returns The section body, or `''` when nothing applies.
 */
export function buildNoteSection(routes, notes) {
  return formatNotes(collectNotes(routes, notes))
}

/**
 * Names of the prompt tools that can select a child model: their description
 * advertises `list_subagent_models`. The notes only make sense next to them.
 * @param assembly - Prompt assembly carrying the tool schemas.
 * @returns Selectable delegation tool names, empty when the agent cannot select.
 */
export function delegationToolNames(assembly) {
  const tools = Array.isArray(assembly?.tools) ? assembly.tools : []
  return tools
    .filter((tool) => tool !== null && typeof tool === 'object' && typeof tool.name === 'string'
      && typeof tool.description === 'string' && tool.description.includes('list_subagent_models'))
    .map((tool) => tool.name)
}

/**
 * Insert the notes section directly after the delegation tool's own guidance
 * section, so the copy sits beside the tool it qualifies. Appends at the end
 * when the tool is selectable but its guidance section is absent.
 * @param assembly - Post-waterfall prompt assembly (`{ sections, tools, ... }`).
 * @param text - Section body from {@link buildNoteSection}.
 * @param toolNames - Selectable delegation tool names from {@link delegationToolNames}.
 * @returns A new assembly with the section inserted, or the input unchanged.
 */
export function insertNotesSection(assembly, text, toolNames) {
  if (text === '' || assembly === null || typeof assembly !== 'object' || !Array.isArray(assembly.sections)) {
    return assembly
  }
  if (!Array.isArray(toolNames) || toolNames.length === 0) return assembly
  const owned = new Set(toolNames.map((name) => `tool:${name}`))
  const sections = []
  let inserted = false
  for (const section of assembly.sections) {
    if (section !== null && typeof section === 'object' && section.name === PROMPT_SECTION_NAME) continue
    sections.push(section)
    if (!inserted && section !== null && typeof section === 'object' && owned.has(section.name)) {
      sections.push({ name: PROMPT_SECTION_NAME, text, interpolate: false })
      inserted = true
    }
  }
  if (!inserted) sections.push({ name: PROMPT_SECTION_NAME, text, interpolate: false })
  return { ...assembly, sections }
}

/**
 * One call from the host hook: build the body for these routes/notes and place
 * it in the assembly when this agent can select a child model at all.
 * @param assembly - Post-waterfall prompt assembly.
 * @param routes - exact routes the Session may select.
 * @param notes - user-authored note entries.
 * @returns The possibly extended assembly.
 */
export function applyNotes(assembly, routes, notes) {
  const text = buildNoteSection(routes, notes)
  if (text === '') return assembly
  return insertNotesSection(assembly, text, delegationToolNames(assembly))
}
