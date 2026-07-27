import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import {
  controlSnippet,
  groupedProperties,
  namespaceMembers,
  qmlImports,
  qmlSyntaxSnippets,
  qmlTypeMap,
  qmlTypes,
  type QmlPropertyDefinition,
} from './qmlCatalog'

interface QmlDocumentContext {
  currentType: string | null
  ids: Map<string, string>
  inCode: boolean
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
  const stack: Array<string | null> = []
  for (let index = 0; index < maskedPrefix.text.length; index++) {
    if (maskedPrefix.text[index] === '{') stack.push(typeBeforeBrace(maskedPrefix.text, index))
    else if (maskedPrefix.text[index] === '}') stack.pop()
  }
  const currentType = [...stack].reverse().find(type => type !== null) || null

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
  return { currentType, ids, inCode: maskedPrefix.inCode }
}

function snippetForProperty(item: QmlPropertyDefinition): string {
  if (item.kind === 'handler') return `${item.name}: {\n\t$0\n}`
  if (item.kind === 'string' || item.kind === 'color') return `${item.name}: "\${1}"`
  if (item.kind === 'boolean') return `${item.name}: \${1|true,false|}`
  if (item.kind === 'number') return `${item.name}: \${1:0}`
  if (item.kind === 'enum' && item.values?.length) return `${item.name}: \${1:${item.values[0]}}`
  return `${item.name}: \${1}`
}

function wordRange(model: monaco.editor.ITextModel, position: monaco.Position): monaco.Range {
  const word = model.getWordUntilPosition(position)
  return new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
}

function propertyItems(properties: QmlPropertyDefinition[], range: monaco.Range): monaco.languages.CompletionItem[] {
  return properties.map(item => ({
    label: item.name,
    kind: item.kind === 'handler' ? monaco.languages.CompletionItemKind.Event : monaco.languages.CompletionItemKind.Property,
    detail: item.detail || `QML ${item.kind} property`,
    insertText: snippetForProperty(item),
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    range,
    sortText: `1-${item.name}`,
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

function memberItems(typeName: string, range: monaco.Range): monaco.languages.CompletionItem[] {
  const definition = qmlTypeMap.get(typeName)
  if (!definition) return []
  const properties = definition.properties.map(item => ({
    label: item.name,
    kind: monaco.languages.CompletionItemKind.Property,
    insertText: item.name,
    detail: `${typeName} property`,
    range,
  }))
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

export function registerQMLCompletionProvider(): monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider('qml', {
    triggerCharacters: ['.', ':', ' '],
    provideCompletionItems(model, position) {
      const source = model.getValue()
      const cursorOffset = model.getOffsetAt(position)
      const context = scanStructure(source, cursorOffset)
      if (!context.inCode) return { suggestions: [] }

      const line = model.getLineContent(position.lineNumber)
      const linePrefix = line.slice(0, position.column - 1)
      const range = wordRange(model, position)

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
        if (groupedProperties[owner]) return { suggestions: propertyItems(groupedProperties[owner], range) }
        if (namespaceMembers[owner]) return { suggestions: valueItems(namespaceMembers[owner], range) }
        if (owner === 'parent') return { suggestions: memberItems('Item', range) }
        const idType = context.ids.get(owner)
        return { suggestions: idType ? memberItems(idType, range) : [] }
      }

      const valueMatch = linePrefix.match(/^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*:\s*(.*)$/)
      if (valueMatch) {
        const propertyName = valueMatch[1]
        const definition = context.currentType ? qmlTypeMap.get(context.currentType) : undefined
        const propertyDefinition = definition?.properties.find(item => item.name === propertyName)
        const suggestions: monaco.languages.CompletionItem[] = []
        if (propertyDefinition?.kind === 'boolean') suggestions.push(...valueItems(['true', 'false'], range))
        if (propertyDefinition?.values) suggestions.push(...valueItems(propertyDefinition.values, range))
        if (propertyName.startsWith('anchors.') || propertyName === 'target' || propertyName.endsWith('Component')) {
          suggestions.push(...valueItems(['parent', ...context.ids.keys()], range))
        }
        if (propertyDefinition?.kind === 'color') {
          suggestions.push(...valueItems(['transparent', 'white', 'black', 'red', 'green', 'blue', 'steelblue'], range))
        }
        return { suggestions }
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

      if (context.currentType) {
        const definition = qmlTypeMap.get(context.currentType)
        if (definition) suggestions.push(...propertyItems(definition.properties, range))
        suggestions.push(...qmlSyntaxSnippets.map(snippet => ({
          label: snippet.label,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: snippet.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          sortText: `3-${snippet.label}`,
        })))
      }
      return { suggestions }
    },
  })
}