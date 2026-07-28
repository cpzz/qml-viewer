import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'

const tokenTypes = [
  'type',
  'property',
  'signal',
  'handler',
  'method',
  'variable',
  'parameter',
  'enumMember',
] as const

type TokenType = typeof tokenTypes[number]

interface SemanticToken {
  offset: number
  length: number
  type: TokenType
  priority: number
}

const legend: monaco.languages.SemanticTokensLegend = {
  tokenTypes: [...tokenTypes],
  tokenModifiers: [],
}

function maskStringsAndComments(source: string): string {
  let output = ''
  let state: 'code' | 'single' | 'double' | 'lineComment' | 'blockComment' = 'code'
  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    const next = source[index + 1]
    const escaped = index > 0 && source[index - 1] === '\\'

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
      if (char === quote && !escaped) state = 'code'
      output += char === '\n' ? '\n' : ' '
      continue
    }
    if (char === '/' && next === '/') { output += '  '; index++; state = 'lineComment'; continue }
    if (char === '/' && next === '*') { output += '  '; index++; state = 'blockComment'; continue }
    if (char === "'") { output += ' '; state = 'single'; continue }
    if (char === '"') { output += ' '; state = 'double'; continue }
    output += char
  }
  return output
}

function collectSemanticTokens(source: string): SemanticToken[] {
  const masked = maskStringsAndComments(source)
  const tokens = new Map<string, SemanticToken>()
  const idNames = new Set<string>()
  const declaredProperties = new Set<string>()
  const signalNames = new Set<string>()

  const add = (offset: number, length: number, type: TokenType, priority: number) => {
    if (length <= 0) return
    const key = `${offset}:${length}`
    const existing = tokens.get(key)
    if (!existing || priority >= existing.priority) tokens.set(key, { offset, length, type, priority })
  }

  const objectPattern = /\b([A-Z][A-Za-z0-9_]*)\s*\{/g
  for (const match of masked.matchAll(objectPattern)) {
    add((match.index || 0) + match[0].indexOf(match[1]), match[1].length, 'type', 30)
  }

  const propertyDeclarationPattern = /\b(?:readonly\s+|required\s+|default\s+)?property\s+(?:alias|[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s+([A-Za-z_]\w*)/g
  for (const match of masked.matchAll(propertyDeclarationPattern)) {
    const offset = (match.index || 0) + match[0].lastIndexOf(match[1])
    declaredProperties.add(match[1])
    add(offset, match[1].length, 'property', 50)
  }

  const idPattern = /\bid\s*:\s*([A-Za-z_]\w*)/g
  for (const match of masked.matchAll(idPattern)) {
    const offset = (match.index || 0) + match[0].lastIndexOf(match[1])
    idNames.add(match[1])
    add(offset, match[1].length, 'variable', 60)
  }

  const signalPattern = /\bsignal\s+([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?/g
  for (const match of masked.matchAll(signalPattern)) {
    const matchOffset = match.index || 0
    const nameOffset = matchOffset + match[0].indexOf(match[1])
    signalNames.add(match[1])
    add(nameOffset, match[1].length, 'signal', 60)
    if (match[2]) {
      const paramsOffset = matchOffset + match[0].indexOf(match[2])
      for (const param of match[2].matchAll(/(?:[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\s+)?([A-Za-z_]\w*)/g)) {
        add(paramsOffset + (param.index || 0) + param[0].lastIndexOf(param[1]), param[1].length, 'parameter', 50)
      }
    }
  }

  const functionPattern = /\bfunction\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g
  for (const match of masked.matchAll(functionPattern)) {
    const matchOffset = match.index || 0
    add(matchOffset + match[0].indexOf(match[1]), match[1].length, 'method', 60)
    if (match[2]) {
      const paramsOffset = matchOffset + match[0].indexOf(match[2])
      for (const param of match[2].matchAll(/(?:^|,)\s*([A-Za-z_]\w*)/g)) {
        add(paramsOffset + (param.index || 0) + param[0].lastIndexOf(param[1]), param[1].length, 'parameter', 50)
      }
    }
  }

  const propertyPathPattern = /\b([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*:/g
  for (const match of masked.matchAll(propertyPathPattern)) {
    const path = match[1]
    if (path === 'id') continue
    const pathOffset = (match.index || 0) + match[0].indexOf(path)
    let relativeOffset = 0
    const parts = path.split('.')
    parts.forEach((part, index) => {
      const type: TokenType = index === 0 && /^[A-Z]/.test(part)
        ? 'type'
        : index === parts.length - 1 && /^on[A-Z]/.test(part)
          ? 'handler'
          : 'property'
      add(pathOffset + relativeOffset, part.length, type, type === 'handler' ? 55 : 40)
      relativeOffset += part.length + 1
    })
  }

  const enumDeclarationPattern = /\benum\s+([A-Z]\w*)\s*\{([^}]*)\}/g
  for (const match of masked.matchAll(enumDeclarationPattern)) {
    const matchOffset = match.index || 0
    add(matchOffset + match[0].indexOf(match[1]), match[1].length, 'type', 60)
    const bodyOffset = matchOffset + match[0].indexOf(match[2])
    for (const member of match[2].matchAll(/\b([A-Z]\w*)\b/g)) {
      add(bodyOffset + (member.index || 0), member[1].length, 'enumMember', 60)
    }
  }

  const enumReferencePattern = /\b([A-Z]\w*)\.([A-Z]\w*)\b/g
  for (const match of masked.matchAll(enumReferencePattern)) {
    const offset = match.index || 0
    add(offset, match[1].length, 'type', 45)
    add(offset + match[1].length + 1, match[2].length, 'enumMember', 45)
  }

  const methodCallPattern = /\b([a-z_][A-Za-z0-9_]*)\s*\(/g
  for (const match of masked.matchAll(methodCallPattern)) {
    if (['if', 'for', 'while', 'switch', 'catch', 'function'].includes(match[1])) continue
    add((match.index || 0) + match[0].indexOf(match[1]), match[1].length, 'method', 25)
  }

  const markKnownNames = (names: Set<string>, type: TokenType, priority: number) => {
    for (const name of names) {
      const pattern = new RegExp(`\\b${name}\\b`, 'g')
      for (const match of masked.matchAll(pattern)) add(match.index || 0, name.length, type, priority)
    }
  }
  markKnownNames(declaredProperties, 'property', 35)
  markKnownNames(idNames, 'variable', 45)
  markKnownNames(signalNames, 'signal', 45)

  const sorted = [...tokens.values()].sort((left, right) => left.offset - right.offset || right.priority - left.priority)
  const nonOverlapping: SemanticToken[] = []
  let endOffset = -1
  for (const token of sorted) {
    if (token.offset < endOffset) continue
    nonOverlapping.push(token)
    endOffset = token.offset + token.length
  }
  return nonOverlapping
}

function encodeTokens(model: monaco.editor.ITextModel, tokens: SemanticToken[]): Uint32Array {
  const data: number[] = []
  let previousLine = 0
  let previousColumn = 0
  for (const token of tokens) {
    const position = model.getPositionAt(token.offset)
    const line = position.lineNumber - 1
    const column = position.column - 1
    const deltaLine = line - previousLine
    const deltaColumn = deltaLine === 0 ? column - previousColumn : column
    data.push(deltaLine, deltaColumn, token.length, tokenTypes.indexOf(token.type), 0)
    previousLine = line
    previousColumn = column
  }
  return new Uint32Array(data)
}

export function registerQMLSemanticTokensProvider(): monaco.IDisposable {
  return monaco.languages.registerDocumentSemanticTokensProvider('qml', {
    getLegend: () => legend,
    provideDocumentSemanticTokens(model) {
      return { data: encodeTokens(model, collectSemanticTokens(model.getValue())) }
    },
    releaseDocumentSemanticTokens() {},
  })
}