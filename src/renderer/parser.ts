/**
 * QML Parser - Phase 1
 * Parses basic QML syntax into an element tree.
 * Supports: Rectangle, Text, Image, Item, Row, Column
 */

export interface QMLNode {
  type: string
  sourceRange?: QMLSourceRange
  id?: string
  properties: Record<string, string>
  literalProperties?: Record<string, boolean>
  propertyRanges?: Record<string, QMLSourceRange>
  propertyDeclarations?: Record<string, QMLPropertyDeclaration>
  children: QMLNode[]
  /** Block-value properties: header: MenuBar { ... }, delegate: ItemDelegate { ... } */
  blockProperties?: Record<string, QMLNode>
  objectListProperties?: Record<string, QMLNode[]>
  /** Inline JS function declarations inside element body */
  methods?: Record<string, string>
  signals?: Record<string, QMLSignalDeclaration>
  /** `Behavior on <property>` 的目标属性名 */
  behaviorOn?: string
}

export interface QMLSignalDeclaration {
  name: string
  parameters: Array<{ name: string; type?: string }>
}

export interface QMLPropertyDeclaration {
  name: string
  type: string
  isDefault: boolean
  isRequired: boolean
  isReadonly: boolean
  value?: string
}

export interface QMLImport {
  uri: string
  version?: string
  alias?: string
  isPath: boolean
  sourceRange?: QMLSourceRange
}

export interface QMLDocumentAst {
  imports: QMLImport[]
  nodes: QMLNode[]
  diagnostics: QMLDiagnostic[]
}

export interface QMLSourcePosition {
  offset: number
  line: number
  column: number
}

export interface QMLSourceRange {
  start: QMLSourcePosition
  end: QMLSourcePosition
}

export interface QMLDiagnostic {
  code: string
  message: string
  severity: 'error' | 'warning'
  range: QMLSourceRange
}

/**
 * Preprocess QML source: strip comments, import statements, blank lines
 */
function stripComments(input: string, preserveOffsets = false): string {
  let output = ''
  let inSingle = false
  let inDouble = false
  let inLineComment = false
  let inBlockComment = false

  for (let index = 0; index < input.length; index++) {
    const char = input[index]
    const next = input[index + 1]
    const escaped = index > 0 && input[index - 1] === '\\'

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false
        output += char
      } else if (preserveOffsets) {
        output += ' '
      }
      continue
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false
        if (preserveOffsets) output += '  '
        index++
      } else if (char === '\n') {
        output += char
      } else if (preserveOffsets) {
        output += ' '
      }
      continue
    }
    if (!inSingle && !inDouble && char === '/' && next === '/') {
      inLineComment = true
      if (preserveOffsets) output += '  '
      index++
      continue
    }
    if (!inSingle && !inDouble && char === '/' && next === '*') {
      inBlockComment = true
      if (preserveOffsets) output += '  '
      index++
      continue
    }
    if (char === "'" && !inDouble && !escaped) inSingle = !inSingle
    if (char === '"' && !inSingle && !escaped) inDouble = !inDouble
    output += char
  }

  return output
}

function preprocess(input: string): string {
  return stripComments(input, true).replace(
    /^\s*(?:pragma|import)\s+[^;\n]+;?\s*$/gm,
    statement => statement.replace(/[^\n\r]/g, ' '),
  )
}

export function parseQMLImports(input: string): QMLImport[] {
  const imports: QMLImport[] = []
  const source = stripComments(input, true)
  const lineStarts = createLineStarts(source)
  const pattern = /^[ \t]*import\s+(?:"([^"]+)"|([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*))(?:\s+(\d+(?:\.\d+)?))?(?:\s+as\s+([A-Za-z_]\w*))?[ \t]*;?[ \t]*$/gm
  for (const match of source.matchAll(pattern)) {
    imports.push({
      uri: match[1] ?? match[2],
      version: match[3],
      alias: match[4],
      isPath: match[1] !== undefined,
      sourceRange: createRange(lineStarts, match.index, match.index + match[0].length),
    })
  }
  return imports
}

function createLineStarts(source: string): number[] {
  const starts = [0]
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '\n') starts.push(index + 1)
  }
  return starts
}

function createPosition(lineStarts: number[], offset: number): QMLSourcePosition {
  let low = 0
  let high = lineStarts.length
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)
    if (lineStarts[middle] <= offset) low = middle
    else high = middle
  }
  return { offset, line: low + 1, column: offset - lineStarts[low] + 1 }
}

function createRange(lineStarts: number[], start: number, end: number): QMLSourceRange {
  return {
    start: createPosition(lineStarts, start),
    end: createPosition(lineStarts, end),
  }
}

/**
 * Skip whitespace and newlines, return new position
 */
function skipWS(s: string, pos: number): number {
  while (pos < s.length && (s[pos] === ' ' || s[pos] === '\t' || s[pos] === '\n' || s[pos] === '\r')) {
    pos++
  }
  return pos
}

/**
 * Match an identifier at current position
 */
function matchIdentifier(s: string, pos: number): string | null {
  const rest = s.slice(pos)
  const m = rest.match(/^[A-Za-z_]\w*/)
  return m ? m[0] : null
}

/**
 * Parse a property value (string, number, boolean, color, etc.)
 * Returns [value, newPosition] or null if no value found
 */
function parseValue(s: string, pos: number): [string, number, boolean?] | null {
  pos = skipWS(s, pos)
  if (pos >= s.length) return null

  const ch = s[pos]

  if (ch === '`') return parseRawValue(s, pos)

  // String literal
  if (ch === '"') {
    const start = pos
    let end = pos + 1
    while (end < s.length && s[end] !== '"') {
      if (s[end] === '\\') end++ // skip escaped chars
      end++
    }
    if (end < s.length) {
      const nextPos = skipWS(s, end + 1)
      if (nextPos < s.length && /[+\-*/%?:|&=<>]/.test(s[nextPos])) {
        return parseRawValue(s, start)
      }
      return [s.slice(pos + 1, end), end + 1, true]
    }
    return null
  }

  // Single-quoted string literal
  if (ch === "'") {
    const start = pos
    let end = pos + 1
    while (end < s.length && s[end] !== "'") {
      if (s[end] === '\\') end++
      end++
    }
    if (end < s.length) {
      const nextPos = skipWS(s, end + 1)
      if (nextPos < s.length && /[+\-*/%?:|&=<>]/.test(s[nextPos])) {
        return parseRawValue(s, start)
      }
      return [s.slice(pos + 1, end), end + 1, true]
    }
    return null
  }

  // Number
  if (ch === '-' || ch === '+' || (ch >= '0' && ch <= '9') || ch === '.') {
    const rest = s.slice(pos)
    const m = rest.match(/^[-+]?\d*\.?\d+(?:\.\d+)?(?:px|pt|dp)?/)
    if (m) return [m[0], pos + m[0].length]
  }

  // Boolean, parent, enum values (words that end at space/brace/newline)
  if ((ch >= 'a' && ch <= 'z') || ch === '#') {
    const start = pos
    const rest = s.slice(pos)
    const m = rest.match(/^[#a-zA-Z_]\w*(?:\.[A-Za-z_]\w*)*/)
    if (m) {
      const word = m[0]
      const nextPos = skipWS(s, pos + word.length)
      if (nextPos < s.length && /[+\-*/%?:|&=<>()]/.test(s[nextPos])) {
        return parseRawValue(s, start)
      }
      // Check if this is a keyword or identifier
      if (['true', 'false', 'parent', 'transparent'].includes(word)) {
        return [word, pos + word.length]
      }
      // Color hex (#xxxxxx)
      if (word.startsWith('#')) {
        return [word, pos + word.length]
      }
      // Treat as identifier (e.g., color name "red", "steelblue")
      return [word, pos + word.length]
    }
  }

  // Array literal ["a", "b", "c"]
  if (ch === '[') {
    const start = pos
    let bracketDepth = 0
    let inSingle = false
    let inDouble = false
    while (pos < s.length) {
      const c = s[pos]
      if (c === '"' && !inSingle) {
        if (s[pos - 1] !== '\\') inDouble = !inDouble
      } else if (c === "'" && !inDouble) {
        if (s[pos - 1] !== '\\') inSingle = !inSingle
      } else if (!inSingle && !inDouble) {
        if (c === '[') bracketDepth++
        else if (c === ']') {
          bracketDepth--
          if (bracketDepth === 0) {
            const raw = s.slice(start, pos + 1)
            const body = raw.slice(1, -1)
            if (body.includes('{')) {
              return [raw, pos + 1]
            }
            break
          }
        }
      }
      pos++
    }

    // fallback to simple value-array normalization for ComboBox-like models
    pos = start
    pos++ // skip [
    const items: string[] = []
    while (pos < s.length) {
      pos = skipWS(s, pos)
      if (pos >= s.length || s[pos] === ']') break
      const val = parseValue(s, pos)
      if (val) {
        items.push(val[0])
        pos = val[1]
        // skip comma
        if (s[pos] === ',') pos++
      } else {
        pos++
      }
    }
    if (pos < s.length) pos++ // skip ]
    return [JSON.stringify(items), pos]
  }

  // Uppercase-starting values (Dialog.Ok, Text.AlignHCenter, etc.)
  if (ch >= 'A' && ch <= 'Z') {
    const start = pos
    const rest = s.slice(pos)
    const m = rest.match(/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*(?:\s*\|\s*[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)*/)
    if (m) {
      const nextPos = skipWS(s, pos + m[0].length)
      if (nextPos < s.length && /[+\-*/%?:&=<>()]/.test(s[nextPos])) {
        return parseRawValue(s, start)
      }
      return [m[0], pos + m[0].length]
    }
  }

  // Generic expression fallback (supports bindings, function calls, JS blocks)
  const raw = parseRawValue(s, pos)
  if (raw) return raw

  return null
}

function parseRawValue(s: string, pos: number): [string, number] | null {
  pos = skipWS(s, pos)
  if (pos >= s.length) return null

  const start = pos
  let braceDepth = 0
  let bracketDepth = 0
  let parenDepth = 0
  let inSingle = false
  let inDouble = false
  let inTemplate = false

  while (pos < s.length) {
    const ch = s[pos]

    if (ch === '`' && !inSingle && !inDouble && s[pos - 1] !== '\\') {
      inTemplate = !inTemplate
      pos++
      continue
    }
    if (ch === '"' && !inSingle && !inTemplate) {
      if (s[pos - 1] !== '\\') inDouble = !inDouble
      pos++
      continue
    }
    if (ch === "'" && !inDouble && !inTemplate) {
      if (s[pos - 1] !== '\\') inSingle = !inSingle
      pos++
      continue
    }

    if (!inSingle && !inDouble && !inTemplate) {
      if (ch === '{') braceDepth++
      else if (ch === '}') {
        if (braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) break
        braceDepth = Math.max(0, braceDepth - 1)
      } else if (ch === '[') bracketDepth++
      else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1)
      else if (ch === '(') parenDepth++
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1)
      else if (ch === ';' && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) break
      else if ((ch === '\n' || ch === '\r') && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
        // 行尾以运算符/左括号结尾说明表达式未完成，跨行继续；否则表达式结束
        let prev = pos - 1
        while (prev >= start && /\s/.test(s[prev])) prev--
        if (prev >= start && /[?:+\-*/%|&=<>,.([{]/.test(s[prev])) {
          pos++
          continue
        }
        break
      }
    }

    pos++
  }

  let value = s.slice(start, pos).trim()
  if (!value) return null
  if (value.endsWith(';')) value = value.slice(0, -1).trim()
  return [value, pos]
}

function parseFunctionDeclaration(s: string, pos: number): [string, string, number] | null {
  const rest = s.slice(pos)
  const m = rest.match(/^function\s+([A-Za-z_]\w*)\s*\(/)
  if (!m) return null

  const fnName = m[1]
  let cursor = pos + m[0].length
  let parenDepth = 1
  while (cursor < s.length && parenDepth > 0) {
    const ch = s[cursor]
    if (ch === '(') parenDepth++
    else if (ch === ')') parenDepth--
    cursor++
  }

  cursor = skipWS(s, cursor)
  if (cursor >= s.length || s[cursor] !== '{') return null

  const bodyStart = cursor
  let braceDepth = 1
  cursor++
  while (cursor < s.length && braceDepth > 0) {
    const ch = s[cursor]
    if (ch === '{') braceDepth++
    else if (ch === '}') braceDepth--
    cursor++
  }

  const source = s.slice(pos, cursor).trim()
  return [fnName, source, cursor]
}

function parseSignalDeclaration(s: string, pos: number): [QMLSignalDeclaration, number] | null {
  const match = s.slice(pos).match(/^signal\s+([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?\s*;?/)
  if (!match) return null

  const parameters = (match[2] || '')
    .split(',')
    .map(parameter => parameter.trim())
    .filter(Boolean)
    .map(parameter => {
      const parts = parameter.split(/\s+/)
      return parts.length > 1
        ? { name: parts.at(-1)!, type: parts.slice(0, -1).join(' ') }
        : { name: parts[0] }
    })
  return [{ name: match[1], parameters }, pos + match[0].length]
}

/**
 * Parse a single QML element starting at position pos.
 * Format: ElementName { ... properties ... children ... }
 * Returns [node, newPosition] or null
 */
function parseElement(s: string, pos: number, lineStarts: number[]): [QMLNode, number] | null {
  pos = skipWS(s, pos)
  const start = pos
  const name = matchIdentifier(s, pos)
  if (!name) return null

  // `Behavior on <property> { ... }`：Behavior 后跟随 on <目标属性名>
  let nextPos = pos + name.length
  let behaviorOn: string | undefined
  if (name === 'Behavior') {
    const onMatch = s.slice(nextPos).match(/^on\s+([A-Za-z_]\w*)\s*/)
    if (onMatch) {
      behaviorOn = onMatch[1]
      nextPos += onMatch[0].length
    }
  }

  // Must be followed by {
  nextPos = skipWS(s, nextPos)
  if (nextPos >= s.length || s[nextPos] !== '{') return null

  const node: QMLNode = {
    type: name,
    properties: {},
    children: [],
    ...(behaviorOn ? { behaviorOn } : {}),
  }

  pos = nextPos + 1 // skip {
  let depth = 1

  while (pos < s.length && depth > 0) {
    pos = skipWS(s, pos)
    if (pos >= s.length) break

    const ch = s[pos]

    if (ch === '}') {
      depth--
      if (depth === 0) break
      pos++
      continue
    }

    if (ch === '{') {
      depth++
      pos++
      continue
    }

    // Try to parse as child element (starts with uppercase)
    if (ch >= 'A' && ch <= 'Z') {
      const child = parseElement(s, pos, lineStarts)
      if (child) {
        node.children.push(child[0])
        pos = child[1]
        continue
      }
    }

    // Try to parse as property (identifier: value)
    const fnDecl = parseFunctionDeclaration(s, pos)
    if (fnDecl) {
      const [fnName, fnSource, nextPos] = fnDecl
      node.methods = node.methods || {}
      node.methods[fnName] = fnSource
      pos = nextPos
      continue
    }

    const signalDecl = parseSignalDeclaration(s, pos)
    if (signalDecl) {
      const [declaration, nextPos] = signalDecl
      node.signals = node.signals || {}
      node.signals[declaration.name] = declaration
      pos = nextPos
      continue
    }

    const propertyStart = pos
    const rest = s.slice(pos)
    const typedPropMatch = rest.match(
      /^((?:(?:default|required|readonly)\s+)*)property\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*(?:\s*<\s*[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\s*>)?)\s+([A-Za-z_]\w*)\s*(:)?/,
    )
    // Match qualified identifier (e.g., "border.color", "font.pixelSize")
    const propMatch = rest.match(/^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*:/)
    if (typedPropMatch || propMatch) {
      const key = typedPropMatch ? typedPropMatch[3] : propMatch![1]
      pos += (typedPropMatch || propMatch)![0].length

      if (typedPropMatch) {
        const modifiers = new Set(typedPropMatch[1].trim().split(/\s+/).filter(Boolean))
        node.propertyDeclarations = node.propertyDeclarations || {}
        node.propertyDeclarations[key] = {
          name: key,
          type: typedPropMatch[2].replace(/\s+/g, ''),
          isDefault: modifiers.has('default'),
          isRequired: modifiers.has('required'),
          isReadonly: modifiers.has('readonly'),
        }
        if (!typedPropMatch[4]) continue
      }

      // Skip whitespace after :
      pos = skipWS(s, pos)

      // Handle block-value properties: header: MenuBar { ... }, delegate: ItemDelegate { ... }
      if (pos < s.length) {
        if (s[pos] === '[') {
          let cursor = pos + 1
          const elements: QMLNode[] = []
          while (cursor < s.length) {
            cursor = skipWS(s, cursor)
            if (s[cursor] === ']') {
              cursor++
              break
            }
            const element = parseElement(s, cursor, lineStarts)
            if (element) {
              elements.push(element[0])
              cursor = skipWS(s, element[1])
              if (s[cursor] === ',') cursor++
            } else {
              cursor++
            }
          }
          if (elements.length) {
            node.objectListProperties = node.objectListProperties || {}
            node.objectListProperties[key] = elements
            node.propertyRanges = node.propertyRanges || {}
            node.propertyRanges[key] = createRange(lineStarts, propertyStart, cursor)
            pos = cursor
            continue
          }
        }
        if (s[pos] === '{') {
          const blockStart = pos
          let innerDepth = 1
          pos++
          while (pos < s.length && innerDepth > 0) {
            if (s[pos] === '{') innerDepth++
            else if (s[pos] === '}') innerDepth--
            pos++
          }
          if (/^(?:[A-Za-z_]\w*\.)?on[A-Z]/.test(key) || key === 'Component.onCompleted') {
            node.properties[key] = s.slice(blockStart, pos)
            node.propertyRanges = node.propertyRanges || {}
            node.propertyRanges[key] = createRange(lineStarts, propertyStart, pos)
          }
          continue
        }
        // TypeName { ... } block value — parse as child element
        if (s[pos] >= 'A' && s[pos] <= 'Z') {
          const blockEl = parseElement(s, pos, lineStarts)
          if (blockEl) {
            node.blockProperties = node.blockProperties || {}
            node.blockProperties[key] = blockEl[0]
            pos = blockEl[1]
            node.propertyRanges = node.propertyRanges || {}
            node.propertyRanges[key] = createRange(lineStarts, propertyStart, pos)
            continue
          }
        }
      }

      const val = parseValue(s, pos)
      if (val) {
        node.properties[key] = val[0]
        if (val[2]) {
          node.literalProperties = node.literalProperties || {}
          node.literalProperties[key] = true
        }
        node.propertyRanges = node.propertyRanges || {}
        node.propertyRanges[key] = createRange(lineStarts, propertyStart, val[1])
        const declaration = node.propertyDeclarations?.[key]
        if (declaration) declaration.value = val[0]
        pos = val[1]
        continue
      }
    }

    // If nothing matched, skip ahead
    pos++
  }

  // Extract id
  if (node.properties['id']) {
    node.id = node.properties['id']
  }

  const end = pos < s.length ? pos + 1 : pos
  node.sourceRange = createRange(lineStarts, start, end)
  return [node, end]
}

/**
 * Parse QML source code into an array of QML element nodes
 */
export function parseQML(input: string): QMLNode[] {
  const cleaned = preprocess(input)
  const lineStarts = createLineStarts(input)
  const nodes: QMLNode[] = []
  let pos = skipWS(cleaned, 0)

  while (pos < cleaned.length) {
    const result = parseElement(cleaned, pos, lineStarts)
    if (result) {
      nodes.push(result[0])
      pos = skipWS(cleaned, result[1])
    } else {
      pos++
    }
  }

  return nodes
}

function collectDiagnostics(input: string, nodes: QMLNode[], imports: QMLImport[]): QMLDiagnostic[] {
  const diagnostics: QMLDiagnostic[] = []
  const lineStarts = createLineStarts(input)
  const braces: number[] = []
  let quote: string | undefined
  let quoteStart = 0
  let lineComment = false
  let blockComment = false
  let blockCommentStart = 0

  const report = (code: string, message: string, start: number, end = start + 1) => {
    diagnostics.push({ code, message, severity: 'error', range: createRange(lineStarts, start, end) })
  }

  for (let index = 0; index < input.length; index++) {
    const char = input[index]
    const next = input[index + 1]
    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index++
      }
      continue
    }
    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = undefined
      continue
    }
    if (char === '/' && next === '/') {
      lineComment = true
      index++
    } else if (char === '/' && next === '*') {
      blockComment = true
      blockCommentStart = index
      index++
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char
      quoteStart = index
    } else if (char === '{') {
      braces.push(index)
    } else if (char === '}') {
      if (braces.length) braces.pop()
      else report('unexpected-closing-brace', 'Unexpected closing brace.', index)
    }
  }

  if (quote) {
    report(
      quote === '`' ? 'unterminated-template' : 'unterminated-string',
      quote === '`' ? 'Unterminated template literal.' : 'Unterminated string literal.',
      quoteStart,
      input.length,
    )
  }
  if (blockComment) report('unterminated-comment', 'Unterminated block comment.', blockCommentStart, input.length)
  for (const start of braces) report('unterminated-object', 'Object body is missing a closing brace.', start)

  const importPattern = /^\s*import\b.*$/gm
  for (const match of input.matchAll(importPattern)) {
    if (!parseQMLImports(match[0]).length) {
      report('invalid-import', 'Invalid QML import statement.', match.index, match.index + match[0].length)
    }
  }

  const uncovered = stripComments(input, true).split('')
  const preserve = (start: number, end: number) => {
    for (let index = start; index < end; index++) uncovered[index] = ' '
  }
  for (const node of nodes) {
    if (node.sourceRange) preserve(node.sourceRange.start.offset, node.sourceRange.end.offset)
  }
  for (const entry of imports) {
    if (entry.sourceRange) preserve(entry.sourceRange.start.offset, entry.sourceRange.end.offset)
  }
  for (const match of input.matchAll(/^\s*(?:pragma|import)\b.*$/gm)) {
    preserve(match.index, match.index + match[0].length)
  }
  const emptyPropertyPattern = /(?:^|\n)[ \t]*(?:(?:default|required|readonly)[ \t]+)*?(?:property[ \t]+[\w.<>]+[ \t]+)?[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*[ \t]*:[ \t]*(?=\r?\n|$)/g
  for (const match of input.matchAll(emptyPropertyPattern)) {
    const colon = match.index + match[0].lastIndexOf(':')
    let next = colon + 1
    while (next < input.length && /\s/.test(input[next])) next++
    if (input[next] !== '{') report('missing-property-value', 'Property requires a value expression.', colon)
  }
  const visible = stripComments(input, true)
  for (let index = 0; index < visible.length;) {
    if (/\s/.test(visible[index]) || uncovered[index] === ' ') {
      index++
      continue
    }
    const start = index
    while (index < visible.length && visible[index] !== '\n') index++
    let end = index
    while (end > start && /\s/.test(uncovered[end - 1])) end--
    report('unexpected-token', 'Unexpected token at document level.', start, end)
  }
  return diagnostics.sort((left, right) => left.range.start.offset - right.range.start.offset)
}

export function parseQMLDocument(input: string): QMLDocumentAst {
  const imports = parseQMLImports(input)
  const nodes = parseQML(input)
  return {
    imports,
    nodes,
    diagnostics: collectDiagnostics(input, nodes, imports),
  }
}
