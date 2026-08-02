import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import {
  controlSnippet,
  groupedProperties,
  namespaceMembers,
  qmlImports,
  qmlPragmas,
  qmlSyntaxSnippets,
  qmlTypeMap,
  qmlTypes,
  recommendedChildren,
  type QmlPropertyDefinition,
} from './qmlCatalog'

interface QmlScopeObject {
  type: string | null
  id?: string
  /** property name → QML primitive type (int, bool, string, …) */
  declaredProperties: Map<string, string>
  /** function name → parameter name list */
  methods: Map<string, string[]>
}

interface QmlDocumentContext {
  currentType: string | null
  /** 当前对象在对象树中的父对象（QML parent 语义） */
  parentObject: QmlScopeObject | null
  ids: Map<string, string>
  /** property name → QML primitive type (int, bool, string, …) */
  declaredProperties: Map<string, string>
  /** function name → parameter name list */
  methods: Map<string, string[]>
  inCode: boolean
}

interface ContextHelpRequest {
  model: monaco.editor.ITextModel
  offset: number
  requestedAt: number
  kind: 'properties' | 'children'
}

let contextHelpRequest: ContextHelpRequest | null = null

const qmlColorValues = ['transparent', 'white', 'black', 'red', 'green', 'blue', 'steelblue']

function showQMLHelp(editor: monaco.editor.IStandaloneCodeEditor, kind: ContextHelpRequest['kind']): void {
  const model = editor.getModel()
  const position = editor.getPosition()
  if (!model || !position) return

  contextHelpRequest = {
    model,
    offset: model.getOffsetAt(position),
    requestedAt: Date.now(),
    kind,
  }
  editor.trigger('qml.contextHelp', 'editor.action.triggerSuggest', {})
}

export function showQMLContextHelp(editor: monaco.editor.IStandaloneCodeEditor): void {
  showQMLHelp(editor, 'properties')
}

export function showQMLChildHelp(editor: monaco.editor.IStandaloneCodeEditor): void {
  showQMLHelp(editor, 'children')
}

function consumeContextHelpRequest(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
): ContextHelpRequest['kind'] | null {
  const request = contextHelpRequest
  contextHelpRequest = null
  const matches = !!request &&
    request.model === model &&
    request.offset === model.getOffsetAt(position) &&
    Date.now() - request.requestedAt < 1000
  return matches ? request.kind : null
}

function maskNonCode(source: string): { text: string; inCode: boolean } {
  let output = ''
  let state: 'code' | 'single' | 'double' | 'lineComment' | 'blockComment' = 'code'
  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    const next = source[index + 1]
    const previous = source[index - 1]
    if (state === 'lineComment') {
      if (char === '\n') { state = 'code'; output += '\n' } else output += ' '
      continue
    }
    if (state === 'blockComment') {
      if (char === '*' && next === '/') { output += '  '; index++; state = 'code' }
      else output += char === '\n' ? '\n' : ' '
      continue
    }
    if (state === 'single' || state === 'double') {
      const quote = state === 'single' ? "'" : '"'
      if (char === quote && previous !== '\\') state = 'code'
      output += char === '\n' ? '\n' : ' '
      continue
    }
    if (char === '/' && next === '/') { output += '  '; index++; state = 'lineComment'; continue }
    if (char === '/' && next === '*') { output += '  '; index++; state = 'blockComment'; continue }
    if (char === "'") { output += ' '; state = 'single'; continue }
    if (char === '"') { output += ' '; state = 'double'; continue }
    output += char
  }
  return { text: output, inCode: state === 'code' }
}

function typeBeforeBrace(source: string, braceOffset: number): string | null {
  const match = source.slice(Math.max(0, braceOffset - 100), braceOffset).match(/([A-Z][A-Za-z0-9_]*)\s*$/)
  return match?.[1] || null
}

function scanStructure(source: string, cursorOffset: number): QmlDocumentContext {
  const maskedAll = maskNonCode(source)
  const maskedPrefix = maskNonCode(source.slice(0, cursorOffset))

  // 按出现顺序扫描对象层级与每层声明的 id/property/function
  const objectPattern = /[{}]|\bid\s*:\s*([A-Za-z_][A-Za-z0-9_]*)|\b(?:readonly\s+|required\s+|default\s+)?property\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s+([A-Za-z_]\w*)|\bfunction\s+([A-Za-z_]\w*)\s*\(([^)]*?)\)/g
  const buildObjectStack = (text: string): QmlScopeObject[] => {
    const stack: QmlScopeObject[] = []
    objectPattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = objectPattern.exec(text))) {
      const [full, idName, propType, propName, fnName, fnParams] = match
      if (full === '{') {
        stack.push({
          type: typeBeforeBrace(text, match.index),
          declaredProperties: new Map(),
          methods: new Map(),
        })
      } else if (full === '}') {
        stack.pop()
      } else {
        const top = stack[stack.length - 1]
        if (!top) continue
        if (idName) top.id = idName
        else if (propName) {
          if (top.type) top.declaredProperties.set(propName, propType)
        } else if (fnName) {
          if (top.type) {
            top.methods.set(
              fnName,
              fnParams.split(',').map(part => part.trim()).filter(Boolean),
            )
          }
        }
      }
    }
    return stack
  }

  // 光标处的对象栈（跳过 JS 块等 null 层，取最近两个对象作为当前对象与父对象）
  const objectStack = buildObjectStack(maskedPrefix.text)
  const objects = objectStack.filter(entry => entry.type !== null)
  const currentType = objects[objects.length - 1]?.type ?? null
  const parentObject = objects[objects.length - 2] ?? null

  const ids = new Map<string, string>()
  const fullStack: Array<string | null> = []
  const tokenPattern = /\bid\s*:\s*([A-Za-z_][A-Za-z0-9_]*)|[{}]/g
  let token: RegExpExecArray | null
  while ((token = tokenPattern.exec(maskedAll.text))) {
    if (token[0] === '{') fullStack.push(typeBeforeBrace(maskedAll.text, token.index))
    else if (token[0] === '}') fullStack.pop()
    else if (token[1]) {
      const type = [...fullStack].reverse().find(item => item !== null)
      if (type) ids.set(token[1], type)
    }
  }
  const declaredProperties = new Map<string, string>()
  const propDeclPattern = /\b(?:readonly\s+|required\s+|default\s+)?property\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s+([A-Za-z_]\w*)/g
  let propMatch: RegExpExecArray | null
  while ((propMatch = propDeclPattern.exec(maskedAll.text))) {
    declaredProperties.set(propMatch[2], propMatch[1])
  }

  const methods = new Map<string, string[]>()
  const fnPattern = /\bfunction\s+([A-Za-z_]\w*)\s*\(([^)]*?)\)/g
  let fnMatch: RegExpExecArray | null
  while ((fnMatch = fnPattern.exec(maskedAll.text))) {
    const params = fnMatch[2]
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
    methods.set(fnMatch[1], params)
  }

  return { currentType, parentObject, ids, declaredProperties, methods, inCode: maskedPrefix.inCode }
}

function snippetForProperty(item: QmlPropertyDefinition): string {
  if (item.kind === 'handler') return `${item.name}: {\n\t$0\n}`
  if (item.kind === 'string' || item.kind === 'url') return `${item.name}: "\${1}"`
  if (item.kind === 'color' || item.kind === 'boolean' || item.kind === 'enum' || item.kind === 'model' || item.kind === 'component') return `${item.name}: `
  if (item.kind === 'number') return `${item.name}: \${1:0}`
  if (item.kind === 'array') return `${item.name}: \${1:[]}`
  if (item.kind === 'date') return `${item.name}: \${1:new Date()}`
  if (item.kind === 'time') return `${item.name}: "\${1:12:00:00}"`
  return `${item.name}: \${1}`
}

function wordRange(model: monaco.editor.ITextModel, position: monaco.Position): monaco.Range {
  const word = model.getWordUntilPosition(position)
  return new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
}

function propertyCompletionKind(item: QmlPropertyDefinition): monaco.languages.CompletionItemKind {
  if (item.readOnly) return monaco.languages.CompletionItemKind.Constant
  if (item.kind === 'handler') return monaco.languages.CompletionItemKind.Event
  const kindMap: Record<string, monaco.languages.CompletionItemKind> = {
    string: monaco.languages.CompletionItemKind.Text,
    url: monaco.languages.CompletionItemKind.File,
    number: monaco.languages.CompletionItemKind.Value,
    boolean: monaco.languages.CompletionItemKind.Keyword,
    color: monaco.languages.CompletionItemKind.Color,
    enum: monaco.languages.CompletionItemKind.EnumMember,
    array: monaco.languages.CompletionItemKind.Array,
    model: monaco.languages.CompletionItemKind.Array,
    component: monaco.languages.CompletionItemKind.Class,
    date: monaco.languages.CompletionItemKind.Value,
    time: monaco.languages.CompletionItemKind.Value,
    expression: monaco.languages.CompletionItemKind.Variable,
  }
  return kindMap[item.kind] ?? monaco.languages.CompletionItemKind.Property
}

function propertyItems(properties: QmlPropertyDefinition[], range: monaco.Range): monaco.languages.CompletionItem[] {
  return properties.map(item => {
    const kind = propertyCompletionKind(item)
    const detail = item.detail || `QML ${item.kind} property${item.readOnly ? ' [readonly]' : ''}`
    const sortPrefix = item.readOnly ? '2-' : '1-'

    return {
      label: item.name,
      kind,
      detail,
      // 只读属性兜底：即使混入也只插入名字，绝不自动加冒号
      insertText: item.readOnly ? item.name : snippetForProperty(item),
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      sortText: `${sortPrefix}${item.name}`,
      command: !item.readOnly && ['color', 'boolean', 'enum', 'model', 'component'].includes(item.kind) ? {
        id: 'editor.action.triggerSuggest',
        title: 'Show property values',
      } : undefined,
    }
  })
}

// 成员访问补全（`obj.` / `parent.` 之后）：显示所有属性（含只读，只读可读取），
// 只插入属性名、不自动加冒号；只读属性用锁图标区分。
function memberPropertyItems(properties: QmlPropertyDefinition[], range: monaco.Range): monaco.languages.CompletionItem[] {
  return properties.map(item => ({
    label: item.name,
    kind: propertyCompletionKind(item),
    insertText: item.name,
    detail: item.detail || `QML ${item.kind} property${item.readOnly ? ' [readonly]' : ''}`,
    range,
    sortText: `${item.readOnly ? '2-' : '1-'}${item.name}`,
  }))
}

function valueItems(values: string[], range: monaco.Range): monaco.languages.CompletionItem[] {
  return values.map(value => ({
    label: value,
    kind: monaco.languages.CompletionItemKind.EnumMember,
    insertText: value,
    range,
    sortText: `0-${value}`,
  }))
}

function colorValueItems(range: monaco.Range): monaco.languages.CompletionItem[] {
  return qmlColorValues.map(value => ({
    label: value,
    kind: monaco.languages.CompletionItemKind.Color,
    insertText: `"${value}"`,
    detail: 'QML color value',
    range,
    sortText: `0-${value}`,
  }))
}

function declaredPropertyKind(typeName?: string): QmlPropertyDefinition['kind'] | undefined {
  const normalized = typeName?.toLowerCase()
  if (!normalized) return undefined
  if (['int', 'real', 'double', 'float'].includes(normalized)) return 'number'
  if (normalized === 'bool') return 'boolean'
  if (normalized === 'string' || normalized === 'color' || normalized === 'url' || normalized === 'date') {
    return normalized
  }
  if (normalized === 'list' || normalized.startsWith('list<')) return 'array'
  return undefined
}

function literalItem(
  label: string,
  insertText: string,
  detail: string,
  range: monaco.Range,
  kind = monaco.languages.CompletionItemKind.Value,
): monaco.languages.CompletionItem {
  return { label, kind, insertText, detail, range, sortText: `0-${label}` }
}

function localSymbolItems(
  context: QmlDocumentContext,
  range: monaco.Range,
): monaco.languages.CompletionItem[] {
  const items: monaco.languages.CompletionItem[] = []

  // IDs
  for (const [name, type] of context.ids) {
    items.push({
      label: name,
      kind: monaco.languages.CompletionItemKind.Variable,
      detail: `id · ${type}`,
      insertText: name,
      range,
      sortText: `1-id-${name}`,
    })
  }

  // Declared properties
  for (const [name, type] of context.declaredProperties) {
    items.push({
      label: name,
      kind: monaco.languages.CompletionItemKind.Property,
      detail: `property ${type}`,
      insertText: name,
      range,
      sortText: `1-prop-${name}`,
    })
  }

  // Functions
  for (const [name, params] of context.methods) {
    const snippet = params.length > 0
      ? `${name}(\${1:${params[0]}})`
      : `${name}($0)`
    items.push({
      label: name,
      kind: monaco.languages.CompletionItemKind.Function,
      detail: `function(${params.join(', ')})`,
      insertText: snippet,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      sortText: `1-fn-${name}`,
    })
  }

  return items
}

function referenceItems(values: string[], range: monaco.Range): monaco.languages.CompletionItem[] {
  return values.map(value => literalItem(
    value,
    value,
    'QML object reference',
    range,
    monaco.languages.CompletionItemKind.Variable,
  ))
}

function memberItems(typeName: string, range: monaco.Range): monaco.languages.CompletionItem[] {
  const definition = qmlTypeMap.get(typeName)
  if (!definition) return []
  const properties = memberPropertyItems(definition.properties, range)
  const methods = (definition.methods || []).map(method => ({
    label: method,
    kind: monaco.languages.CompletionItemKind.Method,
    insertText: method,
    detail: `${typeName} method`,
    range,
    sortText: `0-${method}`,
  }))
  return [...methods, ...properties]
}

/**
 * `parent.` 的成员补全：按 QML parent 语义，返回当前对象父对象
 * 的类型成员、声明的 property/function 以及 id。
 */
function parentMemberItems(context: QmlDocumentContext, range: monaco.Range): monaco.languages.CompletionItem[] {
  const parent = context.parentObject
  if (!parent?.type) return []
  const items: monaco.languages.CompletionItem[] = []
  const definition = qmlTypeMap.get(parent.type)
  if (definition) {
    const directProperties = definition.properties.filter(item => !item.name.includes('.'))
    const propertyGroups = [...new Set(
      definition.properties
        .filter(item => item.name.includes('.'))
        .map(item => item.name.split('.')[0]),
    )]
    items.push(...memberPropertyItems(directProperties, range).map(item => ({
      ...item,
      detail: `parent (${parent.type}) · ${item.detail}`,
    })))
    items.push(...propertyGroups.map(group => ({
      label: group,
      kind: monaco.languages.CompletionItemKind.Struct,
      detail: `parent (${parent.type}) · QML property group`,
      insertText: `${group}.`,
      range,
      sortText: `0-group-${group}`,
      command: {
        id: 'editor.action.triggerSuggest',
        title: 'Show property group members',
      },
    })))
    items.push(...(definition.methods || []).map(method => ({
      label: method,
      kind: monaco.languages.CompletionItemKind.Method,
      insertText: method,
      detail: `parent (${parent.type}) · method`,
      range,
      sortText: `0-fn-${method}`,
    })))
  }
  for (const [name, type] of parent.declaredProperties) {
    items.push({
      label: name,
      kind: monaco.languages.CompletionItemKind.Property,
      insertText: name,
      detail: `parent property ${type}`,
      range,
      sortText: `0-prop-${name}`,
    })
  }
  for (const [name, params] of parent.methods) {
    const snippet = params.length > 0
      ? `${name}(\${1:${params[0]}})`
      : `${name}($0)`
    items.push({
      label: name,
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: snippet,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      detail: `parent function(${params.join(', ')})`,
      range,
      sortText: `0-fn-${name}`,
    })
  }
  if (parent.id) {
    items.push({
      label: parent.id,
      kind: monaco.languages.CompletionItemKind.Variable,
      insertText: parent.id,
      detail: `parent id · ${parent.type}`,
      range,
      sortText: `0-id-${parent.id}`,
    })
  }
  return items
}

const consoleMembers: Array<[string, string]> = [
  ['log', 'log("$1")'],
  ['info', 'info("$1")'],
  ['warn', 'warn("$1")'],
  ['error', 'error("$1")'],
  ['debug', 'debug("$1")'],
  ['trace', 'trace()'],
  ['assert', 'assert($1)'],
  ['count', 'count("$1")'],
  ['dir', 'dir($1)'],
  ['group', 'group("$1")'],
  ['groupCollapsed', 'groupCollapsed("$1")'],
  ['groupEnd', 'groupEnd()'],
  ['profile', 'profile("$1")'],
  ['profileEnd', 'profileEnd()'],
  ['table', 'table($1)'],
  ['time', 'time("$1")'],
  ['timeEnd', 'timeEnd("$1")'],
  ['clear', 'clear()'],
]

function consoleMemberItems(range: monaco.Range): monaco.languages.CompletionItem[] {
  return consoleMembers.map(([name, snippet]) => ({
    label: name,
    kind: monaco.languages.CompletionItemKind.Method,
    insertText: snippet,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    detail: `console.${name}()`,
    range,
    sortText: `0-${name}`,
  }))
}

function contextPropertyItems(typeName: string, range: monaco.Range): monaco.languages.CompletionItem[] {
  const definition = qmlTypeMap.get(typeName)
  if (!definition) return []
  // 绑定上下文：只读属性不能赋值，不显示
  const directProperties = definition.properties.filter(item => !item.name.includes('.') && !item.readOnly)
  const propertyGroups = [...new Set(
    definition.properties
      .filter(item => item.name.includes('.'))
      .map(item => item.name.split('.')[0]),
  )]
  const items = propertyItems(directProperties, range).map(item => ({
    ...item,
    detail: `${typeName} · ${item.detail}`,
    sortText: item.kind === monaco.languages.CompletionItemKind.Event
      ? `1-event-${String(item.label)}`
      : `0-property-${String(item.label)}`,
  }))
  const groups: monaco.languages.CompletionItem[] = propertyGroups.map(group => ({
    label: group,
    kind: monaco.languages.CompletionItemKind.Struct,
    detail: `${typeName} · QML property group`,
    insertText: `${group}.`,
    range,
    sortText: `0-group-${group}`,
    command: {
      id: 'editor.action.triggerSuggest',
      title: 'Show property group members',
    },
  }))
  return [...groups, ...items]
}

function childControlItems(parentType: string, range: monaco.Range): monaco.languages.CompletionItem[] {
  const recommended = new Set(recommendedChildren[parentType] || [])
  return qmlTypes.map(type => ({
    label: type.name,
    kind: monaco.languages.CompletionItemKind.Class,
    detail: recommended.has(type.name)
      ? `${parentType} · recommended child control`
      : `${parentType} · available child control`,
    insertText: controlSnippet(type.name),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    range,
    sortText: `${recommended.has(type.name) ? '0' : '1'}-${type.name}`,
  }))
}

function importInsertionEdit(model: monaco.editor.ITextModel, moduleName: string): monaco.editor.ISingleEditOperation {
  let lastImportLine = 0
  for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber++) {
    if (/^\s*import\s+/.test(model.getLineContent(lineNumber))) lastImportLine = lineNumber
  }

  if (lastImportLine > 0) {
    const column = model.getLineMaxColumn(lastImportLine)
    return {
      range: new monaco.Range(lastImportLine, column, lastImportLine, column),
      text: `\nimport ${moduleName}`,
    }
  }

  return {
    range: new monaco.Range(1, 1, 1, 1),
    text: `import ${moduleName}\n\n`,
  }
}

function pragmaInsertionEdit(model: monaco.editor.ITextModel, pragma: string): monaco.editor.ISingleEditOperation {
  let lastPragmaLine = 0
  for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber++) {
    if (/^\s*pragma\s+/.test(model.getLineContent(lineNumber))) lastPragmaLine = lineNumber
  }

  if (lastPragmaLine > 0) {
    const column = model.getLineMaxColumn(lastPragmaLine)
    return {
      range: new monaco.Range(lastPragmaLine, column, lastPragmaLine, column),
      text: `\npragma ${pragma}`,
    }
  }

  return {
    range: new monaco.Range(1, 1, 1, 1),
    text: `pragma ${pragma}\n\n`,
  }
}

function topLevelItems(
  model: monaco.editor.ITextModel,
  source: string,
  range: monaco.Range,
): monaco.languages.CompletionItem[] {
  const existingPragmas = new Set(
    [...source.matchAll(/^\s*pragma\s+([^\n;]+)/gm)].map(match => match[1].trim()),
  )
  const importedModules = new Set(
    [...source.matchAll(/^\s*import\s+([A-Za-z0-9_.]+)/gm)].map(match => match[1]),
  )
  const pragmas: monaco.languages.CompletionItem[] = qmlPragmas
    .filter(pragma => !existingPragmas.has(pragma))
    .map(pragma => ({
      label: `pragma ${pragma}`,
      kind: monaco.languages.CompletionItemKind.Keyword,
      detail: 'Add QML pragma before imports',
      insertText: '',
      range,
      additionalTextEdits: [pragmaInsertionEdit(model, pragma)],
      sortText: `0-pragma-${pragma}`,
    }))
  const imports: monaco.languages.CompletionItem[] = qmlImports
    .filter(moduleName => !importedModules.has(moduleName))
    .map(moduleName => ({
      label: `import ${moduleName}`,
      kind: monaco.languages.CompletionItemKind.Module,
      detail: 'Add QML module import at the top of the file',
      insertText: '',
      range,
      additionalTextEdits: [importInsertionEdit(model, moduleName)],
      sortText: `1-import-${moduleName}`,
    }))

  return [...pragmas, ...imports]
}

export function registerQMLCompletionProvider(): monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider('qml', {
    triggerCharacters: ['.', ':', ' '],
    provideCompletionItems(model, position) {
      const source = model.getValue()
      const cursorOffset = model.getOffsetAt(position)
      const context = scanStructure(source, cursorOffset)
      if (!context.inCode) return { suggestions: [] }
      const contextHelpKind = consumeContextHelpRequest(model, position)

      const line = model.getLineContent(position.lineNumber)
      const linePrefix = line.slice(0, position.column - 1)
      const range = wordRange(model, position)

      const pragmaMatch = linePrefix.match(/^\s*pragma\s+([A-Za-z0-9_: ]*)$/)
      if (pragmaMatch) {
        const valueStartColumn = linePrefix.indexOf(pragmaMatch[1], linePrefix.indexOf('pragma') + 6) + 1
        const pragmaRange = new monaco.Range(position.lineNumber, valueStartColumn, position.lineNumber, position.column)
        return {
          suggestions: qmlPragmas.map(pragma => ({
            label: pragma,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: pragma,
            detail: 'QML pragma',
            range: pragmaRange,
          })),
        }
      }

      // property <type> → offer type keyword list
      const propertyTypeMatch = linePrefix.match(/(?:^|\n)\s*(?:readonly\s+|required\s+|default\s+)?property\s+([A-Za-z0-9_]*)$/)
      if (propertyTypeMatch) {
        const typePrefix = propertyTypeMatch[1]
        const typeStart = linePrefix.lastIndexOf(typePrefix)
        const typeRange = new monaco.Range(position.lineNumber, typeStart + 1, position.lineNumber, position.column)
        const propertyTypes = [
          { name: 'int',      detail: 'integer number' },
          { name: 'real',     detail: 'floating-point number' },
          { name: 'double',   detail: 'floating-point number' },
          { name: 'bool',     detail: 'boolean true/false' },
          { name: 'string',   detail: 'text string' },
          { name: 'var',      detail: 'generic / any type' },
          { name: 'color',    detail: 'color value' },
          { name: 'url',      detail: 'URL / file path' },
          { name: 'date',     detail: 'date value' },
          { name: 'list',     detail: 'list<Type>' },
          { name: 'alias',    detail: 'property alias' },
          { name: 'size',     detail: 'width × height' },
          { name: 'point',    detail: 'x, y coordinate' },
          { name: 'rect',     detail: 'x, y, width, height' },
          { name: 'font',     detail: 'font object' },
          { name: 'vector2d', detail: '2D vector' },
          { name: 'vector3d', detail: '3D vector' },
          { name: 'vector4d', detail: '4D vector' },
        ]
        return {
          suggestions: propertyTypes
            .filter(t => t.name.startsWith(typePrefix))
            .map((t, index) => ({
              label: t.name,
              kind: monaco.languages.CompletionItemKind.TypeParameter,
              detail: `QML type · ${t.detail}`,
              insertText: t.name + ' ',
              range: typeRange,
              sortText: `0-${String(index).padStart(3, '0')}-${t.name}`,
            })),
        }
      }

      const importMatch = linePrefix.match(/^\s*import\s+([A-Za-z0-9_.]*)$/)
      if (importMatch) {
        const moduleStartColumn = linePrefix.lastIndexOf(importMatch[1]) + 1
        const importRange = new monaco.Range(position.lineNumber, moduleStartColumn, position.lineNumber, position.column)
        return {
          suggestions: qmlImports.map(name => ({
            label: name,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: name,
            detail: 'QML module',
            range: importRange,
          })),
        }
      }

      const memberMatch = linePrefix.match(/\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z0-9_]*)$/)
      if (memberMatch) {
        const owner = memberMatch[1]
        // `myLabel.font.` 属于成员访问（读取语义），裸 `font.` 属于绑定位置
        const isNestedMemberAccess = /\.$/.test(linePrefix.slice(0, memberMatch.index))
        const contextualGroup = context.currentType
          ? qmlTypeMap.get(context.currentType)?.properties
            .filter(item => item.name.startsWith(`${owner}.`))
            .map(item => ({ ...item, name: item.name.slice(owner.length + 1) }))
          : undefined
        if (contextualGroup?.length) {
          return {
            suggestions: isNestedMemberAccess
              ? memberPropertyItems(contextualGroup, range)
              : propertyItems(contextualGroup.filter(item => !item.readOnly), range),
          }
        }
        if (owner === 'console') return { suggestions: consoleMemberItems(range) }
        if (groupedProperties[owner]) {
          return {
            suggestions: isNestedMemberAccess
              ? memberPropertyItems(groupedProperties[owner], range)
              : propertyItems(groupedProperties[owner].filter(item => !item.readOnly), range),
          }
        }
        if (namespaceMembers[owner]) return { suggestions: valueItems(namespaceMembers[owner], range) }
        if (owner === 'parent') return { suggestions: parentMemberItems(context, range) }
        const idType = context.ids.get(owner)
        return { suggestions: idType ? memberItems(idType, range) : [] }
      }

      const declaredValueMatch = linePrefix.match(
        /^\s*(?:(?:readonly|required|default)\s+)?property\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s+([A-Za-z_]\w*)\s*:\s*(.*)$/,
      )
      const valueMatch = linePrefix.match(/^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*:\s*(.*)$/)
      if (declaredValueMatch || valueMatch) {
        const propertyName = declaredValueMatch?.[2] ?? valueMatch![1]
        const declaredType = declaredValueMatch?.[1] ?? context.declaredProperties.get(propertyName)
        const definition = context.currentType ? qmlTypeMap.get(context.currentType) : undefined
        const propertyDefinition = definition?.properties.find(item => item.name === propertyName)
        const propertyKind = propertyDefinition?.kind ?? declaredPropertyKind(declaredType)
        const suggestions: monaco.languages.CompletionItem[] = []
        if (propertyKind === 'string') suggestions.push(literalItem('empty string', '""', 'QML string value', range, monaco.languages.CompletionItemKind.Text))
        if (propertyKind === 'url') suggestions.push(literalItem('empty URL', '""', 'QML URL value', range, monaco.languages.CompletionItemKind.File))
        if (propertyKind === 'number') suggestions.push(literalItem('0', '0', 'QML numeric value', range, monaco.languages.CompletionItemKind.Value))
        if (propertyKind === 'boolean') suggestions.push(
          literalItem('true', 'true', 'QML boolean value', range, monaco.languages.CompletionItemKind.Keyword),
          literalItem('false', 'false', 'QML boolean value', range, monaco.languages.CompletionItemKind.Keyword),
        )
        if (propertyDefinition?.kind === 'enum' && propertyDefinition.values) suggestions.push(...valueItems(propertyDefinition.values, range))
        if (propertyKind === 'array') suggestions.push(literalItem('empty array', '[]', 'QML array value', range, monaco.languages.CompletionItemKind.Value))
        if (propertyDefinition?.kind === 'model') {
          suggestions.push(
            literalItem('empty model', '[]', 'QML array model', range, monaco.languages.CompletionItemKind.Value),
            literalItem('numeric model', '0', 'QML item-count model', range, monaco.languages.CompletionItemKind.Value),
          )
          suggestions.push(...referenceItems(
            [...context.ids].filter(([, type]) => type === 'ListModel').map(([id]) => id),
            range,
          ))
        }
        if (propertyDefinition?.kind === 'component') {
          suggestions.push(...referenceItems(
            [...context.ids].filter(([, type]) => type === 'Component').map(([id]) => id),
            range,
          ))
        }
        if (propertyKind === 'date') suggestions.push(literalItem('new Date()', 'new Date()', 'QML date value', range, monaco.languages.CompletionItemKind.Constructor))
        if (propertyDefinition?.kind === 'time') suggestions.push(literalItem('12:00:00', '"12:00:00"', 'QML time value', range, monaco.languages.CompletionItemKind.Value))
        if (propertyDefinition?.kind === 'handler') suggestions.push({
          ...literalItem('handler block', '{\n\t$0\n}', 'QML signal handler block', range, monaco.languages.CompletionItemKind.Snippet),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        })
        if (propertyName.startsWith('anchors.') || propertyName === 'target' || propertyName.endsWith('Component')) {
          suggestions.push(...referenceItems(['parent', ...context.ids.keys()], range))
        }
        if (propertyKind === 'color') {
          suggestions.push(...colorValueItems(range))
        }
        // Always offer local symbols (ids, declared properties, functions) as candidates
        suggestions.push(...localSymbolItems(context, range))
        return { suggestions }
      }

      if (contextHelpKind === 'properties' && context.currentType) {
        return { suggestions: contextPropertyItems(context.currentType, range) }
      }

      if (contextHelpKind === 'children' && context.currentType) {
        return { suggestions: childControlItems(context.currentType, range) }
      }

      if (contextHelpKind === 'children') {
        return { suggestions: topLevelItems(model, source, range) }
      }

      const suggestions: monaco.languages.CompletionItem[] = qmlTypes.map(type => ({
        label: type.name,
        kind: monaco.languages.CompletionItemKind.Class,
        detail: type.detail,
        insertText: controlSnippet(type.name),
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        sortText: `2-${type.name}`,
      }))

      // Local document symbols: ids, declared properties, functions
      suggestions.push(...localSymbolItems(context, range))

      // Global QML/JS objects
      suggestions.push({
        label: 'console',
        kind: monaco.languages.CompletionItemKind.Variable,
        detail: 'QML console object',
        insertText: 'console',
        range,
        sortText: `1-global-console`,
      })
      if (context.parentObject?.type) {
        suggestions.push({
          label: 'parent',
          kind: monaco.languages.CompletionItemKind.Variable,
          detail: `QML parent · ${context.parentObject.type}`,
          insertText: 'parent',
          range,
          sortText: `1-global-parent`,
          command: {
            id: 'editor.action.triggerSuggest',
            title: 'Show parent members',
          },
        })
      }

      if (context.currentType) {
        const definition = qmlTypeMap.get(context.currentType)
        if (definition) {
          // 绑定上下文：只读属性不能赋值，不显示
          suggestions.push(...propertyItems(definition.properties.filter(item => !item.readOnly), range))
        }
        suggestions.push(...qmlSyntaxSnippets.map(snippet => ({
          label: snippet.label,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: snippet.insertText,
          insertTextRules: snippet.insertText.includes('$')
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : undefined,
          range,
          sortText: `3-${snippet.label}`,
          command: snippet.command,
        })))
      }
      suggestions.push(...topLevelItems(model, source, range))
      return { suggestions }
    },
  })
}