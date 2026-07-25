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
}

/**
 * Preprocess QML source: strip comments, import statements, blank lines
 */
function preprocess(input: string): string {
  return input
    .replace(/\/\/.*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/import\s+[^;\n]+/g, '')
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
    let end = pos + 1
    while (end < s.length && s[end] !== '"') {
      if (s[end] === '\\') end++ // skip escaped chars
      end++
    }
    if (end < s.length) {
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
    const rest = s.slice(pos)
    const m = rest.match(/^[#a-zA-Z]\w*(?:\.[A-Za-z]\w*)?/)
    if (m) {
      const word = m[0]
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
    const rest = s.slice(pos)
    const m = rest.match(/^[A-Za-z]\w*(?:\.[A-Za-z]\w*)*/)
    if (m) {
      return [m[0], pos + m[0].length]
    }
  }

  return null
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
    const rest = s.slice(pos)
    // Match qualified identifier (e.g., "border.color", "font.pixelSize")
    const propMatch = rest.match(/^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*:/)
    if (propMatch) {
      const key = propMatch[1]
      pos += propMatch[0].length

      // Skip whitespace after :
      pos = skipWS(s, pos)

      // Handle block-value properties: header: MenuBar { ... }, delegate: ItemDelegate { ... }
      if (pos < s.length) {
        if (s[pos] === '{') {
          // Bare block: someProp { ... } — skip
          let innerDepth = 1
          pos++
          while (pos < s.length && innerDepth > 0) {
            if (s[pos] === '{') innerDepth++
            else if (s[pos] === '}') innerDepth--
            pos++
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
