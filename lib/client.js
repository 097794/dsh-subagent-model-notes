window.__ModuleLoader__.load({
  id: 'dsh-subagent-model-notes',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    /** Settings namespace owned by this plugin: its Loader row id. */
    const ENTRY_NS = 'subagent-model-notes'
    /** Settings namespace of the official subagent model allowlist page. */
    const SELECTION_NS = 'subagent-model-selection-settings'
    /** Locale dictionary namespace owned by this page. */
    const LOCALE_NS = 'dsh-subagent-model-notes.page'
    /** Separator inside one opaque route key. */
    const SEP = '\u0000'

    /** Simplified Chinese copy (key source of truth). */
    const zh = {
      title: '子智能体模型说明',
      summary: '为子智能体可选的每个模型写一份说明；Agent 派生子智能体时会读到这些说明并按需选择。',
      intro: '说明只对「子智能体」页已授权给子智能体的模型路由生效。保存后，Agent 在下一步就能看到，并按说明选择子智能体的 provider / model。',
      loading: '正在读取设置…',
      readOnly: '当前配置不可写（可能被更高层的配置覆盖）。',
      selectionOff: '子智能体模型选择当前未开启：先到「子智能体」页开启并勾选模型，说明才会进入 Agent 的上下文。',
      noEffective: '还没有生效的说明：在已授权的模型下写一条说明并保存。',
      effectiveCount: '{count} 条说明会进入 Agent 上下文',
      saving: '保存中…',
      save: '保存',
      discard: '放弃修改',
      saveFailed: '保存失败，请重试。',
      conflict: '配置已在别处修改；请放弃修改后重新编辑。',
      loadFailed: '模型目录读取失败。',
      retry: '重试',
      loadingCatalog: '正在读取模型目录…',
      emptyCatalog: '模型目录为空。',
      catalogPartial: '部分提供方的模型目录读取失败，可稍后重试。',
      authorized: '已授权',
      unauthorized: '未授权给子智能体',
      unavailable: '不在当前模型目录中',
      placeholder: '例：便宜、响应快，适合样板化、低风险的任务',
    }

    /** English copy. */
    const en = {
      title: 'Subagent model notes',
      summary: 'Write one note per model agents may pick for subagents; the delegating agent reads these notes and chooses accordingly.',
      intro: 'A note applies only to routes the Subagent page authorizes for child agents. After saving, the agent sees the notes on its next step and chooses a child provider / model from them.',
      loading: 'Reading settings…',
      readOnly: 'This configuration is not writable right now (a higher configuration layer may override it).',
      selectionOff: 'Subagent model selection is off: enable it and authorize models on the Subagent page before these notes can reach the agent.',
      noEffective: 'No note is active yet: write one under an authorized model and save.',
      effectiveCount: '{count} note(s) reach the agent context',
      saving: 'Saving…',
      save: 'Save',
      discard: 'Discard',
      saveFailed: 'Save failed. Try again.',
      conflict: 'Settings changed elsewhere; discard this draft and edit again.',
      loadFailed: 'The model catalog could not be loaded.',
      retry: 'Retry',
      loadingCatalog: 'Loading the model catalog…',
      emptyCatalog: 'The model catalog is empty.',
      catalogPartial: 'Some providers failed to load; retry later.',
      authorized: 'Authorized',
      unauthorized: 'Not authorized for subagents',
      unavailable: 'Not in the current catalog',
      placeholder: 'e.g. cheap and fast — good for boilerplate and low-risk tasks',
    }

    /** Small framework-free observable the renderer binds into a selector hook. */
    function createStore(initial) {
      let value = initial
      const listeners = new Set()
      return {
        getSnapshot: () => value,
        subscribe(listener) {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
        set(next) {
          value = next
          for (const listener of [...listeners]) {
            try {
              listener()
            } catch (error) {
              console.error('subagent-model-notes: snapshot listener failed', error)
            }
          }
        },
      }
    }

    /** Opaque identity of one provider/model pair. */
    function routeKey(provider, model) {
      return `${provider}${SEP}${model}`
    }

    /** Split an opaque route key back into its provider and model. */
    function parseRouteKey(key) {
      const index = key.indexOf(SEP)
      return { provider: key.slice(0, index), model: key.slice(index + 1) }
    }

    /** Normalize one textarea value without trimming it (the user may still be typing). */
    function normalizeNote(value) {
      return typeof value === 'string' ? value.replace(/\r\n?/g, '\n') : ''
    }

    /** Normalize and trim one persisted note. */
    function trimmedNote(value) {
      return normalizeNote(value).trim()
    }

    /** Read the effective notes of one settings value, dropping empty entries. */
    function notesFromValue(value) {
      const result = []
      for (const entry of Array.isArray(value?.notes) ? value.notes : []) {
        if (entry === null || typeof entry !== 'object') continue
        if (typeof entry.provider !== 'string' || typeof entry.model !== 'string') continue
        const note = trimmedNote(entry.note)
        if (note === '') continue
        result.push({ provider: entry.provider, model: entry.model, note })
      }
      return result
    }

    /** Read every stored note of one settings value as a route-keyed draft map. */
    function noteMapFromValue(value) {
      const map = new Map()
      for (const entry of Array.isArray(value?.notes) ? value.notes : []) {
        if (entry === null || typeof entry !== 'object') continue
        if (typeof entry.provider !== 'string' || typeof entry.model !== 'string') continue
        map.set(routeKey(entry.provider, entry.model), normalizeNote(entry.note))
      }
      return map
    }

    /** Compare two note arrays as maps, ignoring their order. */
    function sameNotes(left, right) {
      if (left.length !== right.length) return false
      const byRoute = new Map(left.map((note) => [routeKey(note.provider, note.model), note.note]))
      for (const note of right) {
        if (byRoute.get(routeKey(note.provider, note.model)) !== note.note) return false
      }
      return true
    }

    /** Group rendered rows by provider, preserving catalog order. */
    function groupRows(rows) {
      const groups = []
      const byProvider = new Map()
      for (const row of rows) {
        let group = byProvider.get(row.provider)
        if (group === undefined) {
          group = { provider: row.provider, name: row.providerName, rows: [] }
          byProvider.set(row.provider, group)
          groups.push(group)
        }
        group.rows.push(row)
      }
      return groups
    }

    /** Page-scoped styles; every color comes from a theme token. */
    const PAGE_CSS = [
      '.dsmn-page{display:flex;flex-direction:column;gap:10px;max-width:780px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.55}',
      '.dsmn-intro{margin:0;color:var(--dsw-alias-label-secondary)}',
      '.dsmn-hint{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px}',
      '.dsmn-warn{margin:0;color:var(--dsw-alias-state-warn-primary);font-size:12px}',
      '.dsmn-error{margin:0;color:var(--dsw-alias-state-error-primary);font-size:12px}',
      '.dsmn-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dsmn-count{margin-right:auto;color:var(--dsw-alias-label-secondary);font-size:12px}',
      '.dsmn-button{appearance:none;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:5px 12px;cursor:pointer}',
      '.dsmn-button:disabled{opacity:.5;cursor:default}',
      '.dsmn-button--primary{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:#fff}',
      '.dsmn-groups{display:flex;flex-direction:column;gap:10px;max-height:460px;overflow:auto;padding-right:2px}',
      '.dsmn-group{display:flex;flex-direction:column;gap:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:8px 10px}',
      '.dsmn-provider{color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600}',
      '.dsmn-row{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.dsmn-rowHead{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}',
      '.dsmn-modelName{color:var(--dsw-alias-label-primary);font-size:13px}',
      '.dsmn-route{color:var(--dsw-alias-label-secondary);font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}',
      '.dsmn-badge{border:1px solid var(--dsw-alias-border-l2);border-radius:999px;color:var(--dsw-alias-label-secondary);font-size:10px;padding:1px 6px}',
      '.dsmn-badge--on{border-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}',
      '.dsmn-input{box-sizing:border-box;width:100%;min-height:38px;resize:vertical;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:1.5;padding:6px 8px}',
      '.dsmn-input:focus{outline:1px solid var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}',
      '.dsmn-empty{color:var(--dsw-alias-label-secondary);font-size:12px}',
    ].join('')

    /**
     * Bridges the two Host settings forms (this plugin's notes and the official
     * subagent allowlist), the live model catalog, and one staged draft.
     */
    class PageController {
      constructor(ctx) {
        this.ctx = ctx
        this.form = ctx.configForms.get(ENTRY_NS)
        this.selectionForm = ctx.configForms.get(SELECTION_NS)
        this.groups = []
        this.catalogStatus = 'idle'
        this.catalogFailures = 0
        this.draft = undefined
        this.draftRevision = undefined
        this.saving = false
        this.failed = false
        this.conflicted = false
        this.disposed = false
        this.writeGeneration = 0
        this.catalogGeneration = 0
        this.store = createStore(this.project())
        this.unsubscribers = [
          this.form.subscribe(() => this.onSettings()),
          this.selectionForm.subscribe(() => this.publish()),
        ]
        this.loadCatalog()
      }

      /** Props injected into the page component by the slot renderer. */
      face() {
        return {
          hooks: { subagentModelNotes: this.store },
          setNote: (key, text) => this.setNote(key, text),
          save: () => {
            void this.save()
          },
          discard: () => this.discard(),
          reloadCatalog: () => {
            this.loadCatalog()
          },
        }
      }

      /** Drop subscriptions and every late settlement. */
      dispose() {
        if (this.disposed) return
        this.disposed = true
        this.writeGeneration += 1
        this.catalogGeneration += 1
        for (const off of this.unsubscribers) {
          try {
            off()
          } catch (error) {
            console.error('subagent-model-notes: unsubscribe failed', error)
          }
        }
        this.unsubscribers = []
      }

      settings() {
        return this.form.getSnapshot()
      }

      selectionValue() {
        return this.selectionForm.getSnapshot().value
      }

      currentMap() {
        return noteMapFromValue(this.settings().value)
      }

      draftMap() {
        return this.draft ?? this.currentMap()
      }

      beginDraft() {
        if (this.draft === undefined) {
          this.draft = this.currentMap()
          this.draftRevision = this.settings().revision
        }
        return this.draft
      }

      clearDraft() {
        this.draft = undefined
        this.draftRevision = undefined
        this.failed = false
        this.conflicted = false
      }

      /** Route keys the official allowlist currently permits, or undefined while unknown. */
      authorizedKeys() {
        const value = this.selectionValue()
        if (value === undefined || value === null) return undefined
        const routes = Array.isArray(value.allowedModels) ? value.allowedModels : []
        return new Set(routes.map((route) => routeKey(route.provider, route.model)))
      }

      /** Every row the page renders: catalog, authorized, and stored-note extras. */
      rows() {
        const notes = this.draftMap()
        const authorized = this.authorizedKeys()
        const rows = new Map()
        const add = (provider, providerName, model, modelName, available) => {
          const key = routeKey(provider, model)
          if (rows.has(key)) return
          rows.set(key, {
            key,
            provider,
            providerName,
            model,
            modelName,
            available,
            authorized: authorized === undefined ? undefined : authorized.has(key),
            note: notes.get(key) ?? '',
          })
        }
        for (const group of this.groups) {
          for (const model of Array.isArray(group.models) ? group.models : []) {
            add(group.id, group.name || group.id, model.id, model.name || model.id, true)
          }
        }
        const value = this.selectionValue()
        if (Array.isArray(value?.allowedModels)) {
          for (const route of value.allowedModels) {
            add(route.provider, route.provider, route.model, route.model, false)
          }
        }
        for (const key of notes.keys()) {
          const route = parseRouteKey(key)
          add(route.provider, route.provider, route.model, route.model, false)
        }
        return [...rows.values()]
      }

      /** Effective stored notes: trimmed, non-empty. */
      currentNotes() {
        return notesFromValue(this.settings().value)
      }

      /** Notes the staged draft would persist, in page row order. */
      desiredNotes() {
        const result = []
        for (const row of this.rows()) {
          const note = trimmedNote(row.note)
          if (note === '') continue
          result.push({ provider: row.provider, model: row.model, note })
        }
        return result
      }

      effectiveCount(notes, authorized) {
        if (authorized === undefined) return notes.length
        return notes.filter((note) => authorized.has(routeKey(note.provider, note.model))).length
      }

      project() {
        const settings = this.settings()
        const selection = this.selectionValue()
        const authorized = this.authorizedKeys()
        const desired = this.desiredNotes()
        const current = this.currentNotes()
        const dirty = !sameNotes(desired, current)
        return {
          status: settings.status,
          writable: settings.writable === true,
          dirty,
          saving: this.saving,
          failed: this.failed,
          conflicted: this.conflicted,
          rows: this.rows(),
          effectiveCount: this.effectiveCount(dirty ? desired : current, authorized),
          selectionKnown: selection !== undefined && selection !== null,
          selectionEnabled: selection?.enabled === true,
          catalogStatus: this.catalogStatus,
          catalogPartial: this.catalogFailures > 0,
        }
      }

      publish() {
        this.store.set(this.project())
      }

      /** Keep a local draft in sync with external writes. */
      onSettings() {
        if (this.disposed) return
        const settings = this.settings()
        if (!this.saving && this.draft !== undefined && settings.revision !== this.draftRevision) {
          if (sameNotes(this.desiredNotes(), this.currentNotes())) this.clearDraft()
          else this.conflicted = true
        }
        this.publish()
      }

      /** Stage one textarea edit. */
      setNote(key, text) {
        const settings = this.settings()
        if (this.disposed || this.saving || settings.status !== 'ready' || settings.writable !== true) return
        this.beginDraft().set(key, normalizeNote(text))
        this.failed = false
        this.publish()
      }

      /** Commit the staged notes through one revision-fenced mutation. */
      async save() {
        const settings = this.settings()
        if (this.disposed || this.saving || settings.status !== 'ready' || settings.writable !== true) return
        const desired = this.desiredNotes()
        if (sameNotes(desired, this.currentNotes())) {
          this.clearDraft()
          this.publish()
          return
        }
        if (this.draft !== undefined && settings.revision !== this.draftRevision) {
          this.conflicted = true
          this.publish()
          return
        }
        const generation = ++this.writeGeneration
        this.saving = true
        this.failed = false
        this.conflicted = false
        this.publish()
        let accepted = false
        try {
          accepted = await this.form.mutate([{ op: 'set', path: ['notes'], value: desired }], this.draftRevision)
        } catch (error) {
          console.error('subagent-model-notes: settings write failed', error)
          accepted = false
        }
        if (this.disposed || generation !== this.writeGeneration) return
        this.saving = false
        const landed = sameNotes(this.currentNotes(), desired)
        if (landed) {
          this.draft = undefined
          this.draftRevision = undefined
          this.failed = false
        } else {
          this.failed = true
          if (!accepted) this.conflicted = false
        }
        this.publish()
      }

      /** Drop the staged draft. */
      discard() {
        if (this.disposed || this.saving) return
        this.clearDraft()
        this.publish()
      }

      /** Reload the live model catalog. */
      async loadCatalog() {
        if (this.disposed || this.catalogStatus === 'loading') return
        const generation = ++this.catalogGeneration
        this.catalogStatus = 'loading'
        this.publish()
        let response
        try {
          response = await this.ctx.remote.session.modelCatalog()
        } catch (error) {
          console.error('subagent-model-notes: model catalog failed', error)
          response = undefined
        }
        if (this.disposed || generation !== this.catalogGeneration) return
        if (response !== undefined && response.ok === true) {
          this.groups = Array.isArray(response.value?.groups) ? response.value.groups : []
          this.catalogFailures = Array.isArray(response.value?.failures) ? response.value.failures.length : 0
          this.catalogStatus = 'ready'
        } else {
          this.groups = []
          this.catalogFailures = 0
          this.catalogStatus = 'error'
        }
        this.publish()
      }
    }

    /** The settings page: a one-liner in the card list, the editor on its page. */
    function NotesPage(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key
      const state = props.useSubagentModelNotes((snapshot) => snapshot)
      if (props.view === 'summary') return h('span', null, t('summary'))
      const blocked = state.status !== 'ready' || state.writable !== true
      const dirty = state.dirty === true
      const groups = groupRows(state.rows)
      return h(
        'div',
        { className: 'dsmn-page' },
        h('style', null, PAGE_CSS),
        h('p', { className: 'dsmn-intro' }, t('intro')),
        state.status !== 'ready' ? h('p', { className: 'dsmn-hint' }, t('loading')) : null,
        state.status === 'ready' && state.writable !== true ? h('p', { className: 'dsmn-warn' }, t('readOnly')) : null,
        state.selectionKnown === true && state.selectionEnabled !== true
          ? h('p', { className: 'dsmn-warn' }, t('selectionOff'))
          : null,
        state.status === 'ready' && state.selectionKnown === true && state.selectionEnabled === true && state.effectiveCount === 0
          ? h('p', { className: 'dsmn-hint' }, t('noEffective'))
          : null,
        h(
          'div',
          { className: 'dsmn-toolbar' },
          h('span', { className: 'dsmn-count' }, t('effectiveCount').replace('{count}', String(state.effectiveCount))),
          h(
            'button',
            {
              type: 'button',
              className: 'dsmn-button',
              disabled: state.saving || !dirty || blocked,
              onClick: () => props.discard(),
            },
            t('discard'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsmn-button dsmn-button--primary',
              disabled: state.saving || !dirty || blocked,
              onClick: () => props.save(),
            },
            state.saving ? t('saving') : t('save'),
          ),
        ),
        state.failed === true ? h('p', { className: 'dsmn-error' }, t('saveFailed')) : null,
        state.conflicted === true ? h('p', { className: 'dsmn-error' }, t('conflict')) : null,
        state.catalogStatus === 'error'
          ? h(
              'div',
              { className: 'dsmn-rowHead' },
              h('p', { className: 'dsmn-error' }, t('loadFailed')),
              h('button', { type: 'button', className: 'dsmn-button', onClick: () => props.reloadCatalog() }, t('retry')),
            )
          : null,
        state.catalogStatus === 'loading' && state.rows.length === 0
          ? h('p', { className: 'dsmn-hint' }, t('loadingCatalog'))
          : null,
        state.catalogStatus === 'ready' && state.rows.length === 0
          ? h('p', { className: 'dsmn-empty' }, t('emptyCatalog'))
          : null,
        groups.length === 0
          ? null
          : h(
              'div',
              { className: 'dsmn-groups' },
              groups.map((group) =>
                h(
                  'section',
                  { className: 'dsmn-group', key: group.provider },
                  h('div', { className: 'dsmn-provider' }, group.name),
                  group.rows.map((row) =>
                    h(
                      'div',
                      { className: 'dsmn-row', key: row.key },
                      h(
                        'div',
                        { className: 'dsmn-rowHead' },
                        h('span', { className: 'dsmn-modelName' }, row.modelName),
                        row.available ? null : h('span', { className: 'dsmn-badge' }, t('unavailable')),
                        row.authorized === true
                          ? h('span', { className: 'dsmn-badge dsmn-badge--on' }, t('authorized'))
                          : null,
                        row.authorized === false
                          ? h('span', { className: 'dsmn-badge' }, t('unauthorized'))
                          : null,
                        h('span', { className: 'dsmn-route' }, `${row.provider}/${row.model}`),
                      ),
                      h('textarea', {
                        className: 'dsmn-input',
                        rows: 2,
                        value: row.note,
                        placeholder: t('placeholder'),
                        disabled: blocked || state.saving,
                        spellCheck: false,
                        'aria-label': `${row.provider}/${row.model}`,
                        onChange: (event) => props.setNote(row.key, event.target.value),
                      }),
                    ),
                  ),
                ),
              ),
            ),
        state.catalogPartial === true ? h('p', { className: 'dsmn-hint' }, t('catalogPartial')) : null,
      )
    }

    /** Required browser services (Cordis fiber injection). */
    const inject = ['slots', 'locale', 'remote', 'remote.session', 'configForms']

    /**
     * Mount the page beside the official Subagent settings page and keep its
     * catalog fresh when adapters change.
     * @param ctx - the browser plugin context.
     */
    function apply(ctx) {
      const t = ctx.locale.bind(LOCALE_NS)
      ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'subagent-model-notes: dictionaries')
      const controller = new PageController(ctx)
      ctx.effect(() => () => controller.dispose(), 'subagent-model-notes: page controller')
      const remote = ctx.remote
      if (remote !== undefined && typeof remote.$on === 'function') {
        ctx.effect(
          () => remote.$on('llm/adapters-updated', () => {
            void controller.loadCatalog()
          }),
          'subagent-model-notes: adapter refresh',
        )
      }
      ctx.effect(
        () => ctx.slots.inject('plugins.item', () => ctx.slots.register({
          name: 'plugins.item',
          id: ENTRY_NS,
          order: 11,
          label: () => t('title'),
          locale: LOCALE_NS,
          inject: () => controller.face(),
        }, NotesPage)),
        'subagent-model-notes: settings page',
      )
    }

    return { inject, apply }
  },
})
