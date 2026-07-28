/**
 * QML Parser - Phase 1
 * Parses basic QML syntax into an element tree.
 * Supports: Rectangle, Text, Image, Item, Row, Column
 */

export interface QMLNode {
  type: string
  id?: string
  properties: Record<string, string>
  children: QMLNode[]
  /** Block-value properties: header: MenuBar { ... }, delegate: ItemDelegate { ... } */
  blockProperties?: Record<string, QMLNode>
  /** Inline JS function declarations inside element body */
  methods?: Record<string, string>
}

/**
 * Preprocess QML source: strip comments, import statements, blank lines
 */
function stripComments(input: string): string {
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
      }
      continue
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false
        index++
      } else if (char === '\n') {
        output += char
      }
      continue
    }
    if (!inSingle && !inDouble && char === '/' && next === '/') {
      inLineComment = true
      index++
      continue
    }
    if (!inSingle && !inDouble && char === '/' && next === '*') {
      inBlockComment = true
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
  return stripComments(input)
    .replace(/^\s*(?:pragma|import)\s+[^;\n]+;?\s*$/gm, '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .join('\n')
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
function parseValue(s: string, pos: number): [string, number] | null {
  pos = skipWS(s, pos)
  if (pos >= s.length) return null

  const ch = s[pos]

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
      return [s.slice(pos + 1, end), end + 1]
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
      return [s.slice(pos + 1, end), end + 1]
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

  while (pos < s.length) {
    const ch = s[pos]

    if (ch === '"' && !inSingle) {
      if (s[pos - 1] !== '\\') inDouble = !inDouble
      pos++
      continue
    }
    if (ch === "'" && !inDouble) {
      if (s[pos - 1] !== '\\') inSingle = !inSingle
      pos++
      continue
    }

    if (!inSingle && !inDouble) {
      if (ch === '{') braceDepth++
      else if (ch === '}') {
        if (braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) break
        braceDepth = Math.max(0, braceDepth - 1)
      } else if (ch === '[') bracketDepth++
      else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1)
      else if (ch === '(') parenDepth++
      else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1)
        else if (ch === ';' && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) break
      else if ((ch === '\n' || ch === '\r') && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) break
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

/**
 * Parse a single QML element starting at position pos.
 * Format: ElementName { ... properties ... children ... }
 * Returns [node, newPosition] or null
 */
function parseElement(s: string, pos: number): [QMLNode, number] | null {
  pos = skipWS(s, pos)
  const name = matchIdentifier(s, pos)
  if (!name) return null

  // Must be followed by {
  pos = skipWS(s, pos + name.length)
  if (pos >= s.length || s[pos] !== '{') return null

  const node: QMLNode = {
    type: name,
    properties: {},
    children: [],
  }

  pos++ // skip {
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
      const child = parseElement(s, pos)
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

    const rest = s.slice(pos)
    // Match typed property declaration: property int count: 0
    const typedPropMatch = rest.match(/^property\s+[A-Za-z_]\w*\s+([A-Za-z_]\w*)\s*:/)
    // Match qualified identifier (e.g., "border.color", "font.pixelSize")
    const propMatch = typedPropMatch || rest.match(/^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*:/)
    if (propMatch) {
      const key = typedPropMatch ? typedPropMatch[1] : propMatch[1]
      pos += propMatch[0].length

      // Skip whitespace after :
      pos = skipWS(s, pos)

      // Handle block-value properties: header: MenuBar { ... }, delegate: ItemDelegate { ... }
      if (pos < s.length) {
        if (s[pos] === '{') {
          const blockStart = pos
          let innerDepth = 1
          pos++
          while (pos < s.length && innerDepth > 0) {
            if (s[pos] === '{') innerDepth++
            else if (s[pos] === '}') innerDepth--
            pos++
          }
          if (/^on[A-Z]/.test(key)) {
            node.properties[key] = s.slice(blockStart, pos)
          }
          continue
        }
        // TypeName { ... } block value — parse as child element
        if (s[pos] >= 'A' && s[pos] <= 'Z') {
          const blockEl = parseElement(s, pos)
          if (blockEl) {
            node.blockProperties = node.blockProperties || {}
            node.blockProperties[key] = blockEl[0]
            pos = blockEl[1]
            continue
          }
        }
      }

      const val = parseValue(s, pos)
      if (val) {
        node.properties[key] = val[0]
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

  return [node, pos + 1] // skip closing }
}

/**
 * Parse QML source code into an array of QML element nodes
 */
export function parseQML(input: string): QMLNode[] {
  const cleaned = preprocess(input)
  const nodes: QMLNode[] = []
  let pos = skipWS(cleaned, 0)

  while (pos < cleaned.length) {
    const result = parseElement(cleaned, pos)
    if (result) {
      nodes.push(result[0])
      pos = skipWS(cleaned, result[1])
    } else {
      break
    }
  }

  return nodes
}
