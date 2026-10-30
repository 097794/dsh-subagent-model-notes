import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PROMPT_SECTION_NAME,
  applyNotes,
  buildNoteSection,
  collectNotes,
  delegationToolNames,
  insertNotesSection,
} from '../lib/prompt.js'

const routes = [
  { provider: 'agnes', model: 'agnes-3.0-flash' },
  { provider: 'huoshan', model: 'deepseek-v4-1-flash-economy-261017' },
]

const notes = [
  { provider: 'huoshan', model: 'deepseek-v4-1-flash-economy-261017', note: '  便宜档：适合样板化任务  ' },
  { provider: 'agnes', model: 'agnes-3.0-flash', note: '视觉、多模态任务' },
  { provider: 'someone', model: 'not-allowed', note: '这条路由没被授权，必须丢弃' },
  { provider: 'agnes', model: 'agnes-3.0-flash', note: '   ' },
]

/** Fabricate the post-waterfall assembly shape used by the Host. */
function assembly(extra = {}) {
  return {
    sections: [
      { name: 'persona', text: 'You are helpful.' },
      { name: 'tool:subagent', text: 'Start independent delegations with `subagent` or `subagent_fork` in one assistant message.' },
      { name: 'tool:present', text: 'Present files.' },
    ],
    contexts: [],
    tools: [
      {
        name: 'subagent',
        description: 'Delegate a task. Supply provider and model after using `list_subagent_models` to inspect routes.',
        parameters: {},
      },
      { name: 'present', description: 'Present files.', parameters: {} },
    ],
    variables: {},
    ...extra,
  }
}

test('collectNotes keeps only selectable routes, in route order', () => {
  const lines = collectNotes(routes, notes)
  assert.deepEqual(lines.map((line) => `${line.provider}/${line.model}`), [
    'agnes/agnes-3.0-flash',
    'huoshan/deepseek-v4-1-flash-economy-261017',
  ])
  assert.equal(lines[0].note, '视觉、多模态任务')
  assert.equal(lines[1].note, '便宜档：适合样板化任务')
})

test('collectNotes drops duplicates, empties, and malformed entries', () => {
  assert.deepEqual(collectNotes([], notes), [])
  assert.deepEqual(collectNotes(routes, undefined), [])
  assert.deepEqual(
    collectNotes(routes, [null, 42, { provider: '', model: 'x', note: 'y' }, { provider: 'agnes', model: 'agnes-3.0-flash' }]),
    [],
  )
})

test('buildNoteSection is empty when no authorized route has a note', () => {
  assert.equal(buildNoteSection([], notes), '')
  assert.equal(buildNoteSection([{ provider: 'other', model: 'other' }], notes), '')
  assert.equal(buildNoteSection(routes, []), '')
})

test('buildNoteSection renders framing, one line per route, and indented continuations', () => {
  const text = buildNoteSection(routes, [
    { provider: 'agnes', model: 'agnes-3.0-flash', note: '第一行\n第二行' },
  ])
  assert.match(text, /Subagent model notes/)
  assert.match(text, /- agnes\/agnes-3\.0-flash — 第一行\n  第二行/)
  assert.match(text, /child model/)
  assert.equal(text.includes('huoshan/'), false)
})

test('delegationToolNames finds only tools that advertise list_subagent_models', () => {
  assert.deepEqual(delegationToolNames(assembly()), ['subagent'])
  assert.deepEqual(delegationToolNames({ tools: [{ name: 'subagent', description: 'plain' }] }), [])
  assert.deepEqual(delegationToolNames({}), [])
})

test('insertNotesSection places the section after the delegation tool section', () => {
  const input = assembly()
  const output = applyNotes(input, routes, notes)
  assert.notEqual(output, input)
  assert.deepEqual(output.sections.map((section) => section.name), [
    'persona',
    'tool:subagent',
    PROMPT_SECTION_NAME,
    'tool:present',
  ])
  const inserted = output.sections[2]
  assert.equal(inserted.interpolate, false)
  assert.match(inserted.text, /agnes\/agnes-3\.0-flash/)
  // The original assembly is untouched.
  assert.equal(input.sections.length, 3)
})

test('insertNotesSection replaces a stale section instead of duplicating it', () => {
  const input = assembly()
  input.sections.splice(2, 0, { name: PROMPT_SECTION_NAME, text: 'old', interpolate: false })
  const output = applyNotes(input, routes, notes)
  assert.equal(output.sections.filter((section) => section.name === PROMPT_SECTION_NAME).length, 1)
  assert.equal(output.sections.find((section) => section.name === PROMPT_SECTION_NAME).text.includes('old'), false)
})

test('insertNotesSection appends when the tool is selectable but its guidance section is absent', () => {
  const input = assembly()
  input.sections = input.sections.filter((section) => section.name !== 'tool:subagent')
  const output = applyNotes(input, routes, notes)
  assert.equal(output.sections.at(-1).name, PROMPT_SECTION_NAME)
})

test('applyNotes leaves the assembly alone when the agent cannot select a child model', () => {
  const input = assembly({ tools: [{ name: 'present', description: 'Present files.', parameters: {} }] })
  assert.equal(applyNotes(input, routes, notes), input)
})

test('insertNotesSection keeps note text literal (no prompt interpolation)', () => {
  const output = applyNotes(assembly(), routes, [{ provider: 'agnes', model: 'agnes-3.0-flash', note: '使用 {{unknown}} 占位符' }])
  assert.equal(output.sections[2].interpolate, false)
  assert.match(output.sections[2].text, /\{\{unknown\}\}/)
})
