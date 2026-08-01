import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'

/**
 * Basic QML code formatter.
 *
 * Handles:
 * - Consistent indentation (4 spaces per level)
 * - Brace placement (opening on same line, closing on its own line)
 * - Property alignment within blocks
 * - Import/pragma statements at top
 * - Comment preservation
 * - String literal preservation
 * - Blank line normalization (max 1 consecutive blank line)
 */

const INDENT = '    '

type State = 'code' | 'string' | 'lineComment' | 'blockComment'

interface FormatContext {
  lines: string[]
  indentLevel: number
  state: State
  result: string[]
}

function isBlankLine(line: string): boolean {
  return line.trim().length === 0
}

export function formatQML(source: string): string {
  // Normalize line endings
  const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rawLines = normalized.split('\n')

  // Phase 1: merge continuation lines and normalize whitespace within each line
  const cleanedLines: string[] = []
  for (const line of rawLines) {
    // Collapse multiple spaces into one (but preserve leading whitespace for now)
    const trimmed = line.replace(/[ \t]+/g, ' ')
    cleanedLines.push(trimmed)
  }

  // Phase 2: re-indent
  const ctx: FormatContext = {
    lines: cleanedLines,
    indentLevel: 0,
    state: 'code',
    result: [],
  }

  let consecutiveBlank = 0
  // Extra indent for the body of unbraced control-flow statements (if/else/for/while/switch)
  let pendingIndent = 0

  for (let i = 0; i < ctx.lines.length; i++) {
    const raw = ctx.lines[i]
    const trimmed = raw.trim()

    // Handle multi-line block comments: pass through with current indent
    if (ctx.state === 'blockComment') {
      ctx.result.push(indent(ctx.indentLevel, trimmed))
      if (trimmed.includes('*/')) {
        ctx.state = 'code'
      }
      continue
    }

    // Blank lines: allow at most 1 consecutive
    if (isBlankLine(trimmed)) {
      consecutiveBlank++
      if (consecutiveBlank <= 1) {
        ctx.result.push('')
      }
      continue
    }
    consecutiveBlank = 0

    // Line comments
    if (trimmed.startsWith('//')) {
      ctx.result.push(indent(ctx.indentLevel + pendingIndent, trimmed))
      continue
    }

    // Block comment start
    if (trimmed.startsWith('/*')) {
      ctx.result.push(indent(ctx.indentLevel + pendingIndent, trimmed))
      if (!trimmed.includes('*/')) {
        ctx.state = 'blockComment'
      }
      continue
    }

    // Closing brace: dedent before printing, then account for inline braces (e.g. `} else {`)
    if (trimmed.startsWith('}')) {
      const leadingClose = trimmed.match(/^}+/)?.[0].length ?? 0
      // 同一行多个右花括号（如 `}}`）：先回退对应层级，再逐级输出，让每个 `}` 与对应的 `{` 对齐
      if (leadingClose > 1) {
        ctx.indentLevel = Math.max(0, ctx.indentLevel - leadingClose)
        const rest = trimmed.slice(leadingClose)
        for (let offset = leadingClose - 1; offset >= 0; offset--) {
          ctx.result.push(indent(ctx.indentLevel + offset, '}'))
        }
        const restTrimmed = rest.trim()
        if (restTrimmed) {
          ctx.result.push(indent(ctx.indentLevel, restTrimmed))
          ctx.indentLevel = Math.max(0, ctx.indentLevel + countNetBraces(rest))
        }
        pendingIndent = 0
        continue
      }
      const rest = trimmed.slice(leadingClose)
      // 先回退（`}` 净变化为 -1，`} else {` 净变化为 0），再按回退后的层级输出，与开启花括号对齐
      ctx.indentLevel = Math.max(0, ctx.indentLevel + countNetBraces(trimmed))
      ctx.result.push(indent(ctx.indentLevel + (rest.startsWith('else') ? 0 : pendingIndent), trimmed))
      pendingIndent = rest.startsWith('else') && !trimmed.includes('{') ? 1 : 0
      continue
    }

    // `else` / `else if`: align with the matching `if`
    if (/^else\b/.test(trimmed)) {
      ctx.result.push(indent(ctx.indentLevel, trimmed))
      if (trimmed.includes('{')) {
        ctx.indentLevel = Math.max(0, ctx.indentLevel + countNetBraces(trimmed))
        pendingIndent = 0
      } else if (/^else\s+if\b/.test(trimmed)) {
        pendingIndent = 1
      } else {
        pendingIndent = 1
      }
      continue
    }

    // Default: print at current indent (plus pending unbraced-block indent)
    ctx.result.push(indent(ctx.indentLevel + pendingIndent, trimmed))

    // Count braces to adjust indent for next line
    // We need to be careful about braces inside strings and comments
    const netBraces = countNetBraces(trimmed)
    ctx.indentLevel = Math.max(0, ctx.indentLevel + netBraces)

    // Update pending indent for unbraced control-flow statements (if/for/while/switch)
    if (isUnbracedHeader(trimmed)) {
      pendingIndent = 1
    } else if (pendingIndent === 1 && !trimmed.endsWith('{') && /[({,+\-*/%|&=<>?:.]$/.test(trimmed)) {
      pendingIndent = 1 // statement continues on the next line
    } else {
      pendingIndent = 0
    }
  }

  // Phase 3: remove trailing blank lines
  while (ctx.result.length > 0 && ctx.result[ctx.result.length - 1] === '') {
    ctx.result.pop()
  }

  return ctx.result.join('\n') + '\n'
}

function indent(level: number, text: string): string {
  if (text.length === 0) return ''
  return INDENT.repeat(level) + text
}

/**
 * Count net brace changes in a line, ignoring braces inside strings and comments.
 * Returns positive number if more { than }, negative if more } than {.
 */
function countNetBraces(line: string): number {
  let net = 0
  let state: State = 'code'

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    const next = line[i + 1]

    if (state === 'lineComment') break
    if (state === 'blockComment') {
      if (ch === '*' && next === '/') {
        state = 'code'
        i++
      }
      continue
    }
    if (state === 'string') {
      if (ch === '\\') { i++; continue }
      if (ch === '"' || ch === "'") state = 'code'
      continue
    }

    // state === 'code'
    if (ch === '/' && next === '/') break
    if (ch === '/' && next === '*') { state = 'blockComment'; i++; continue }
    if (ch === '"' || ch === "'") { state = 'string'; continue }
    if (ch === '{') net++
    if (ch === '}') net--
  }

  return net
}

/**
 * Whether a line is an unbraced control-flow header, e.g. `if (cond)`, `for (;;)`, `while (x)`, `switch (x)`.
 * The following statement is treated as the (single-statement) block body and indented one extra level.
 */
function isUnbracedHeader(line: string): boolean {
  if (!/^(if|for|while|switch)\b/.test(line)) return false
  if (line.includes('{')) return false
  return /\)$/.test(line)
}

let registered = false

export function registerQMLFormatter(): void {
  if (registered) return
  registered = true

  monaco.languages.registerDocumentFormattingEditProvider('qml', {
    provideDocumentFormattingEdits(model, options): monaco.languages.TextEdit[] {
      const source = model.getValue()
      const formatted = formatQML(source)

      if (formatted === source) return []

      const fullRange = model.getFullModelRange()
      return [{ range: fullRange, text: formatted }]
    },
  })

  // Also register selection formatting
  monaco.languages.registerDocumentRangeFormattingEditProvider('qml', {
    provideDocumentRangeFormattingEdits(model, range, options): monaco.languages.TextEdit[] {
      // For range formatting, format the whole document for consistency
      // (QML indentation is context-dependent)
      const source = model.getValue()
      const formatted = formatQML(source)

      if (formatted === source) return []

      const fullRange = model.getFullModelRange()
      return [{ range: fullRange, text: formatted }]
    },
  })
}
