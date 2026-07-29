/**
 * QML Renderer - Phase 1
 * Combines parser, element mappings, and layout engine to generate HTML
 */

import type { QMLNode } from './parser'
import { parseQML } from './parser'
import { ELEMENT_MAP, type StyleMap, escapeHTML, escapeAttr } from './elements'
import { computeLayoutStyles } from './layouts'

type ListModelRow = Record<string, string>
type ListModelMap = Record<string, ListModelRow[]>
type ComponentMap = Record<string, QMLNode>
type PreviewSurface = { node: QMLNode; key: string; label: string }

function displayProperty(value?: string): string {
  const text = (value || '').trim()
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1)
  }
  return text
}

function dialogButtons(value?: string): Array<{ label: string; action: 'accept' | 'reject'; primary: boolean }> {
  if (!value) return []
  const affirmative = new Set(['Ok', 'Open', 'Save', 'SaveAll', 'Yes', 'YesToAll', 'Retry'])
  const negative = new Set(['Cancel', 'Close', 'No', 'NoToAll', 'Abort', 'Discard'])
  const labels: Record<string, string> = { Ok: 'OK', SaveAll: 'Save All', YesToAll: 'Yes to All', NoToAll: 'No to All' }

  return value.split('|').map(part => part.trim().replace(/^Dialog\./, '')).filter(Boolean).map(name => ({
    label: labels[name] || name,
    action: negative.has(name) ? 'reject' as const : 'accept' as const,
    primary: affirmative.has(name),
  }))
}

function splitPreviewSurfaces(nodes: QMLNode[]): { roots: QMLNode[]; surfaces: PreviewSurface[] } {
  const surfaces: PreviewSurface[] = []
  const counts: Record<string, number> = { Dialog: 0, Popup: 0 }

  const cloneWithoutSurfaces = (node: QMLNode): QMLNode | null => {
    if (node.type === 'Dialog' || node.type === 'Popup') {
      counts[node.type] += 1
      const key = node.id || `qml-preview-${node.type.toLowerCase()}-${counts[node.type]}`
      const label = displayProperty(node.properties.title) || node.id || `${node.type} ${counts[node.type]}`
      surfaces.push({ node, key, label })
      return null
    }

    const blockProperties = node.blockProperties
      ? Object.fromEntries(
          Object.entries(node.blockProperties)
            .map(([name, child]) => [name, cloneWithoutSurfaces(child)] as const)
            .filter((entry): entry is readonly [string, QMLNode] => entry[1] !== null)
        )
      : undefined

    return {
      ...node,
      properties: { ...node.properties },
      children: node.children.map(cloneWithoutSurfaces).filter((child): child is QMLNode => child !== null),
      blockProperties,
      methods: node.methods ? { ...node.methods } : undefined,
    }
  }

  return {
    roots: nodes.map(cloneWithoutSurfaces).filter((node): node is QMLNode => node !== null),
    surfaces,
  }
}

/**
 * Full element style computation:
 * element-specific styles + layout styles + common dimensions
 */
function computeAllStyles(node: QMLNode): StyleMap {
  const elemStyles = ELEMENT_MAP[node.type]
  const styles: StyleMap = {
    // Default position for non-absolute children
    'box-sizing': 'border-box',
  }

  // Element-specific visual styles
  if (elemStyles) {
    Object.assign(styles, elemStyles.computeStyles(node.properties))
  }

  // Layout styles (anchors, width, height, x, y, etc.)
  Object.assign(styles, computeLayoutStyles(node.properties))

  return styles
}

/**
 * Convert styles object to inline CSS string
 */
function stylesToString(styles: StyleMap): string {
  return Object.entries(styles)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ')
}

/**
 * Generate a CSS class id for node type reference
 */
function nodeClass(type: string): string {
  return `qml-${type.toLowerCase()}`
}

function toRootCssSize(v: string | undefined): string | undefined {
  if (!v) return undefined
  const n = parseFloat(v.replace(/px|pt|dp/gi, '').trim())
  return isNaN(n) ? undefined : `${n}px`
}

function hasAlignmentFlag(alignment: string, flag: string): boolean {
  return alignment.includes(flag) || alignment.includes(`Qt.${flag}`)
}

function looksLikeBindingExpression(raw?: string): boolean {
  if (!raw) return false
  const value = raw.trim()
  if (!value) return false
  if (value === 'true' || value === 'false') return false
  if (/^[-+]?\d+(\.\d+)?$/.test(value)) return false
  if (/^#?[a-zA-Z_]\w*$/.test(value)) return false
  return /[+\-*/%()?:=!<>|&]/.test(value) || value.includes('.') || /^['"].*['"]\s*\+/.test(value)
}

/**
 * Deep-clone a QML node with optional index substitution in property values.
 * Replaces "${index}" tokens with the given number.
 */
function cloneNodeWithIndex(node: QMLNode, idx: number): QMLNode {
  const props: Record<string, string> = {}
  for (const [k, v] of Object.entries(node.properties)) {
    props[k] = replaceIdentifierOutsideStrings(v.replace(/\$\{index\}/g, String(idx)), 'index', String(idx))
  }
  props.__index = String(idx)
  return {
    type: node.type,
    properties: props,
    children: node.children.map(c => cloneNodeWithIndex(c, idx)),
  }
}

function replaceIdentifierOutsideStrings(source: string, identifier: string, replacement: string): string {
  let result = ''
  let quote = ''
  let escaped = false
  for (let index = 0; index < source.length;) {
    const character = source[index]
    if (escaped) {
      result += character
      escaped = false
      index++
      continue
    }
    if (quote && character === '\\') {
      result += character
      escaped = true
      index++
      continue
    }
    if (character === '"' || character === "'") {
      quote = quote === character ? '' : quote || character
      result += character
      index++
      continue
    }
    const before = index === 0 ? '' : source[index - 1]
    const after = source[index + identifier.length] || ''
    if (!quote && source.startsWith(identifier, index) && !/[\w$]/.test(before) && !/[\w$]/.test(after)) {
      result += replacement
      index += identifier.length
      continue
    }
    result += character
    index++
  }
  return result
}

function cloneNodeWithContext(node: QMLNode, idx: number, row?: ListModelRow): QMLNode {
  const props: Record<string, string> = {}
  for (const [k, raw] of Object.entries(node.properties)) {
    let value = raw.replace(/\$\{index\}/g, String(idx))
    if (row) {
      for (const [role, roleVal] of Object.entries(row)) {
        value = value.replace(new RegExp(`\\$\\{${role}\\}`, 'g'), roleVal)
      }
      const trimmed = value.trim()
      if (trimmed === 'index') {
        value = String(idx)
      } else if (trimmed === 'modelData') {
        value = row.modelData ?? ''
      } else if (trimmed.startsWith('model.') && row[trimmed.slice(6)] !== undefined) {
        value = row[trimmed.slice(6)]
      } else if (row[trimmed] !== undefined) {
        value = row[trimmed]
      } else {
        value = replaceIdentifierOutsideStrings(value, 'index', String(idx))
        for (const [role, roleVal] of Object.entries(row)) {
          value = replaceIdentifierOutsideStrings(value, role, JSON.stringify(roleVal))
        }
      }
    }
    props[k] = value
  }
  return {
    type: node.type,
    id: node.id,
    properties: props,
    children: node.children.map(c => cloneNodeWithContext(c, idx, row)),
    blockProperties: node.blockProperties
      ? Object.fromEntries(Object.entries(node.blockProperties).map(([k, n]) => [k, cloneNodeWithContext(n, idx, row)]))
      : undefined,
    methods: node.methods ? { ...node.methods } : undefined,
  }
}

function collectListModels(nodes: QMLNode[]): ListModelMap {
  const models: ListModelMap = {}

  const walk = (node: QMLNode) => {
    if (node.type === 'ListModel' && node.id) {
      const rows: ListModelRow[] = []
      for (const child of node.children) {
        if (child.type !== 'ListElement') continue
        const row: ListModelRow = {}
        for (const [k, v] of Object.entries(child.properties)) {
          row[k] = v
        }
        if (row.modelData === undefined) {
          row.modelData = row.text ?? row.name ?? ''
        }
        rows.push(row)
      }
      models[node.id] = rows
    }
    for (const child of node.children) walk(child)
    if (node.blockProperties) {
      for (const blockNode of Object.values(node.blockProperties)) walk(blockNode)
    }
  }

  for (const root of nodes) walk(root)
  return models
}

function collectComponents(nodes: QMLNode[]): ComponentMap {
  const components: ComponentMap = {}

  const walk = (node: QMLNode) => {
    if (node.type === 'Component' && node.id) {
      components[node.id] = node
    }
    for (const child of node.children) walk(child)
    if (node.blockProperties) {
      for (const blockNode of Object.values(node.blockProperties)) walk(blockNode)
    }
  }

  for (const root of nodes) walk(root)
  return components
}

/**
 * Expand item-view content: if blockProperties.delegate exists and model is numeric,
 * generate repeated children.
 */
function expandItemView(node: QMLNode, modelMap: ListModelMap): QMLNode[] {
  if (!node.blockProperties?.delegate) return node.children

  const delegate = node.blockProperties.delegate
  const modelVal = node.properties.model

  // Integer model: model: 20
  const count = parseInt(modelVal || '', 10)
  if (!isNaN(count) && count > 0 && count < 1000) {
    const items: QMLNode[] = []
    for (let i = 0; i < count; i++) {
      items.push(cloneNodeWithIndex(delegate, i))
    }
    return items
  }

  if (modelVal && modelVal.startsWith('[') && modelVal.endsWith(']')) {
    try {
      const values = JSON.parse(modelVal)
      if (Array.isArray(values)) {
        return values.map((value, index) => {
          const row = value && typeof value === 'object'
            ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)]))
            : { modelData: String(value) }
          if (row.modelData === undefined) row.modelData = row.text ?? row.name ?? ''
          return cloneNodeWithContext(delegate, index, row)
        })
      }
    } catch {
      // Keep explicit child content when an array expression cannot be evaluated statically.
    }
  }

  if (modelVal && modelMap[modelVal]) {
    return modelMap[modelVal].map((row, i) => cloneNodeWithContext(delegate, i, row))
  }

  return node.children
}

function expandRepeater(node: QMLNode, modelMap: ListModelMap): QMLNode[] {
  if (!node.blockProperties?.delegate) return node.children

  const delegate = node.blockProperties.delegate
  const modelVal = node.properties.model

  const count = parseInt(modelVal || '', 10)
  if (!isNaN(count) && count > 0 && count < 5000) {
    const items: QMLNode[] = []
    for (let i = 0; i < count; i++) {
      items.push(cloneNodeWithIndex(delegate, i))
    }
    return items
  }

  if (modelVal && modelVal.startsWith('[') && modelVal.endsWith(']')) {
    try {
      const arr = JSON.parse(modelVal)
      if (Array.isArray(arr)) {
        return arr.map((_, i) => cloneNodeWithIndex(delegate, i))
      }
    } catch {
      // ignore invalid model JSON
    }
  }

  if (modelVal && modelMap[modelVal]) {
    return modelMap[modelVal].map((row, i) => cloneNodeWithContext(delegate, i, row))
  }

  return node.children
}

function expandLoader(node: QMLNode, componentMap: ComponentMap): QMLNode[] {
  const active = (node.properties.active || 'true').trim()
  if (active === 'false') return []

  let sourceComponent = node.blockProperties?.sourceComponent
  if (!sourceComponent && node.properties.sourceComponent) {
    sourceComponent = componentMap[node.properties.sourceComponent]
  }
  if (!sourceComponent) return node.children

  if (sourceComponent.type === 'Component') {
    return sourceComponent.children
  }

  return [sourceComponent]
}

function samplePath(node: QMLNode): Array<[number, number]> {
  const path = node.blockProperties?.path
  if (!path || path.type !== 'Path') return []
  let x = parseFloat(path.properties.startX || '0') || 0
  let y = parseFloat(path.properties.startY || '0') || 0
  const points: Array<[number, number]> = [[x, y]]
  for (const segment of path.children) {
    const endX = parseFloat(segment.properties.x || String(x)) || 0
    const endY = parseFloat(segment.properties.y || String(y)) || 0
    const startX = x
    const startY = y
    const steps = segment.type === 'PathLine' ? 1 : 16
    for (let step = 1; step <= steps; step++) {
      const t = step / steps
      if (segment.type === 'PathQuad') {
        const controlX = parseFloat(segment.properties.controlX || String(startX)) || 0
        const controlY = parseFloat(segment.properties.controlY || String(startY)) || 0
        points.push([(1 - t) ** 2 * startX + 2 * (1 - t) * t * controlX + t ** 2 * endX, (1 - t) ** 2 * startY + 2 * (1 - t) * t * controlY + t ** 2 * endY])
      } else if (segment.type === 'PathCubic') {
        const control1X = parseFloat(segment.properties.control1X || String(startX)) || 0
        const control1Y = parseFloat(segment.properties.control1Y || String(startY)) || 0
        const control2X = parseFloat(segment.properties.control2X || String(endX)) || 0
        const control2Y = parseFloat(segment.properties.control2Y || String(endY)) || 0
        points.push([(1 - t) ** 3 * startX + 3 * (1 - t) ** 2 * t * control1X + 3 * (1 - t) * t ** 2 * control2X + t ** 3 * endX, (1 - t) ** 3 * startY + 3 * (1 - t) ** 2 * t * control1Y + 3 * (1 - t) * t ** 2 * control2Y + t ** 3 * endY])
      } else {
        points.push([startX + (endX - startX) * t, startY + (endY - startY) * t])
      }
    }
    x = endX
    y = endY
  }
  return points
}

function renderChart(node: QMLNode): string {
  const width = 320
  const height = 160
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']
  let svg = `<svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img" aria-label="ChartView">`
  svg += '<line x1="32" y1="12" x2="32" y2="136" stroke="currentColor" opacity=".35"/><line x1="32" y1="136" x2="310" y2="136" stroke="currentColor" opacity=".35"/>'
  node.children.forEach((series, seriesIndex) => {
    const color = series.properties.color || colors[seriesIndex % colors.length]
    if (series.type === 'LineSeries' || series.type === 'SplineSeries') {
      const points = series.children.filter(child => child.type === 'XYPoint').map(child => [parseFloat(child.properties.x || '0') || 0, parseFloat(child.properties.y || '0') || 0] as [number, number])
      if (points.length) {
        const maxX = Math.max(1, ...points.map(point => point[0]))
        const maxY = Math.max(1, ...points.map(point => point[1]))
        const path = points.map((point, index) => `${index ? 'L' : 'M'} ${32 + point[0] / maxX * 270} ${136 - point[1] / maxY * 116}`).join(' ')
        svg += `<path d="${path}" fill="none" stroke="${escapeAttr(color)}" stroke-width="2"/>`
      }
    } else if (series.type === 'BarSeries') {
      const values = series.children.filter(child => child.type === 'BarSet').flatMap(child => {
        try { const parsed = JSON.parse(child.properties.values || '[]'); return Array.isArray(parsed) ? parsed.map(Number) : [] } catch { return [] }
      })
      const max = Math.max(1, ...values)
      values.forEach((value, index) => { const barWidth = 250 / Math.max(1, values.length); const barHeight = value / max * 110; svg += `<rect x="${38 + index * barWidth}" y="${136 - barHeight}" width="${Math.max(3, barWidth - 4)}" height="${barHeight}" fill="${escapeAttr(color)}"/>` })
    } else if (series.type === 'PieSeries') {
      const slices = series.children.filter(child => child.type === 'PieSlice').map(child => Math.max(0, parseFloat(child.properties.value || '0') || 0))
      const total = slices.reduce((sum, value) => sum + value, 0) || 1
      let angle = -Math.PI / 2
      slices.forEach((value, index) => { const next = angle + value / total * Math.PI * 2; const large = next - angle > Math.PI ? 1 : 0; const x1 = 170 + Math.cos(angle) * 58, y1 = 76 + Math.sin(angle) * 58, x2 = 170 + Math.cos(next) * 58, y2 = 76 + Math.sin(next) * 58; svg += `<path d="M170 76 L${x1} ${y1} A58 58 0 ${large} 1 ${x2} ${y2} Z" fill="${colors[index % colors.length]}"/>`; angle = next })
    }
  })
  return svg + '</svg>'
}

function shouldSkipDirectRender(type: string): boolean {
  return ['ListModel', 'ListElement', 'Connections', 'Component', 'Action', 'ActionGroup', 'Shortcut', 'Timer', 'Path', 'PathLine', 'PathQuad', 'PathCubic', 'LineSeries', 'SplineSeries', 'BarSeries', 'BarSet', 'PieSeries', 'PieSlice', 'XYPoint', 'NumberAnimation', 'ColorAnimation', 'PropertyAnimation'].includes(type)
}

function renderNode(node: QMLNode, parentType?: string, modelMap: ListModelMap = {}, componentMap: ComponentMap = {}): string {
  if (shouldSkipDirectRender(node.type)) {
    return ''
  }
  const mapping = ELEMENT_MAP[node.type]
  const styles = computeAllStyles(node)

  const isRowParentLayout = parentType === 'RowLayout' || parentType === 'Row'
  const isColumnParentLayout = parentType === 'ColumnLayout' || parentType === 'Column'
  const isFlowLayoutParent = isRowParentLayout || isColumnParentLayout
  const hasPositioningAnchors = (
    node.properties['anchors.fill'] !== undefined ||
    node.properties['anchors.left'] !== undefined ||
    node.properties['anchors.right'] !== undefined ||
    node.properties['anchors.top'] !== undefined ||
    node.properties['anchors.bottom'] !== undefined ||
    node.properties['anchors.horizontalCenter'] !== undefined ||
    node.properties['anchors.verticalCenter'] !== undefined ||
    node.properties['anchors.centerIn'] !== undefined
  )
  const hasX = node.properties.x !== undefined
  const hasY = node.properties.y !== undefined
  const useFlowOffset = isFlowLayoutParent && styles['position'] === 'absolute' && !hasPositioningAnchors && (hasX || hasY)

  if (useFlowOffset) {
    delete styles['position']
    delete styles['left']
    delete styles['top']
    delete styles['right']
    delete styles['bottom']
    delete styles['inset']
    if (hasX) styles['margin-left'] = `${parseFloat(node.properties.x || '0') || 0}px`
    if (hasY) styles['margin-top'] = `${parseFloat(node.properties.y || '0') || 0}px`
  }

  const alignmentRaw = node.properties['Layout.alignment']
  if (alignmentRaw && !styles['position']) {
    const alignment = alignmentRaw.replace(/\s+/g, '')
    const alignHCenter = hasAlignmentFlag(alignment, 'AlignHCenter') || hasAlignmentFlag(alignment, 'AlignCenter')
    const alignVCenter = hasAlignmentFlag(alignment, 'AlignVCenter') || hasAlignmentFlag(alignment, 'AlignCenter')
    const alignLeft = hasAlignmentFlag(alignment, 'AlignLeft')
    const alignRight = hasAlignmentFlag(alignment, 'AlignRight')
    const alignTop = hasAlignmentFlag(alignment, 'AlignTop')
    const alignBottom = hasAlignmentFlag(alignment, 'AlignBottom')

    const isRowParent = isRowParentLayout
    const isColumnParent = isColumnParentLayout

    if (isRowParent) {
      if (alignBottom) styles['align-self'] = 'flex-end'
      else if (alignVCenter) styles['align-self'] = 'center'
      else if (alignTop) styles['align-self'] = 'flex-start'

      if (alignRight) {
        styles['margin-left'] = 'auto'
        styles['margin-right'] = '0'
      } else if (alignHCenter) {
        styles['margin-left'] = 'auto'
        styles['margin-right'] = 'auto'
      } else if (alignLeft) {
        styles['margin-right'] = 'auto'
      }
    }

    if (isColumnParent) {
      if (alignRight) styles['align-self'] = 'flex-end'
      else if (alignHCenter) styles['align-self'] = 'center'
      else if (alignLeft) styles['align-self'] = 'flex-start'

      if (alignBottom) {
        styles['margin-top'] = 'auto'
        styles['margin-bottom'] = '0'
      } else if (alignVCenter) {
        styles['margin-top'] = 'auto'
        styles['margin-bottom'] = 'auto'
      } else if (alignTop) {
        styles['margin-bottom'] = 'auto'
      }
    }
  }

  const styleStr = stylesToString(styles)
  const cls = nodeClass(node.type)
  const idAttr = node.id ? ` id="${escapeHTML(node.id)}"` : ''

  // Build extra attributes from element mapping
  let extraAttrStr = ''
  if (mapping?.getAttributes) {
    const attrs = mapping.getAttributes(node.properties)
    extraAttrStr = ' ' + Object.entries(attrs)
      .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
      .join(' ')
  }

  const signalAttrs = Object.entries(node.properties)
    .filter(([k]) => /^on[A-Z]/.test(k))
    .map(([k, v]) => {
      const signalName = k.slice(2).toLowerCase()
      return `data-qml-on${signalName}="${escapeAttr(v)}"`
    })
  if (signalAttrs.length > 0) {
    extraAttrStr += (extraAttrStr ? ' ' : ' ') + signalAttrs.join(' ')
  }
  const completedHandler = node.properties['Component.onCompleted']
  if (completedHandler) {
    extraAttrStr += `${extraAttrStr ? ' ' : ' '}data-qml-oncompleted="${escapeAttr(completedHandler)}"`
  }

  const runtimeAttrs: string[] = []
  if (useFlowOffset) {
    runtimeAttrs.push('data-qml-flow-pos="true"')
  }
  if (node.type === 'PathView') {
    const pathPoints = samplePath(node)
    if (pathPoints.length > 1) runtimeAttrs.push(`data-qml-pathpoints="${escapeAttr(JSON.stringify(pathPoints))}"`)
  }
  if ((node.type === 'ListView' || node.type === 'GridView' || node.type === 'PathView' || node.type === 'Repeater') && node.blockProperties?.delegate) {
    const modelRef = (node.properties.model || '').trim()
    if (modelRef && !/^\d+$/.test(modelRef) && !(modelRef.startsWith('[') && modelRef.endsWith(']'))) {
      runtimeAttrs.push(`data-qml-model-ref="${escapeAttr(modelRef)}"`)
      runtimeAttrs.push(`data-qml-view-type="${node.type.toLowerCase()}"`)
      const delegateText = node.blockProperties.delegate.properties?.text || ''
      runtimeAttrs.push(`data-qml-delegate-text="${escapeAttr(delegateText)}"`)
      runtimeAttrs.push(`data-qml-delegate-item="${escapeAttr(node.blockProperties.delegate.type)}"`)
    }
  }
  if (runtimeAttrs.length > 0) {
    extraAttrStr += (extraAttrStr ? ' ' : ' ') + runtimeAttrs.join(' ')
  }

  if (node.properties.text && looksLikeBindingExpression(node.properties.text)) {
    extraAttrStr += `${extraAttrStr ? ' ' : ' '}data-qml-bind-text="${escapeAttr(node.properties.text)}"`
  }

  // Determine tag to use
  const tag = mapping?.tag || 'div'
  const isInput = tag === 'input'
  const isTextarea = tag === 'textarea'
  const isDialog = node.type === 'Dialog'

  // Start the element tag
  let html: string
  if (isInput) {
    // Self-closing tag
    html = `<${tag}${idAttr}${extraAttrStr} class="qml-node ${cls}" style="${styleStr}" />`
  } else {
    html = `<${tag}${idAttr}${extraAttrStr} class="qml-node ${cls}" style="${styleStr}">`
  }

  // Render inner content
  if (isTextarea) {
    // textarea uses text content, not HTML children
    html += escapeHTML(node.properties.text || '') + '</textarea>'
    return html
  }

  if (isDialog) {
    const title = displayProperty(node.properties.title) || node.id || 'Dialog'
    html += `<div class="qml-dialog-titlebar"><div class="qml-dialog-title">${escapeHTML(title)}</div></div><div class="qml-dialog-content">`
  }

  if (isInput) {
    // Self-closing, no content or children
    return html
  }

  // Normal content rendering
  if (node.type === 'ChartView') {
    html += renderChart(node)
  } else if (mapping?.renderContent) {
    html += mapping.renderContent(node.properties)
  } else if (node.properties.text) {
    // Fallback: show text for unknown element types (Label, Button, etc.)
    html += escapeHTML(node.properties.text)
  }

  const isWindowRootType = node.type === 'Window' || node.type === 'ApplicationWindow'
  const headerNode = isWindowRootType ? node.blockProperties?.header : undefined
  const footerNode = isWindowRootType ? node.blockProperties?.footer : undefined
  const attachedScrollBars = (node.type === 'Flickable' || node.type === 'ScrollView') && node.blockProperties
    ? Object.entries(node.blockProperties)
      .filter(([key, child]) => child.type === 'ScrollBar' && (key === 'ScrollBar.vertical' || key === 'ScrollBar.horizontal'))
      .map(([key, child]) => ({
        ...child,
        properties: {
          ...child.properties,
          __attached: 'true',
          orientation: key.endsWith('.horizontal') ? 'Qt.Horizontal' : 'Qt.Vertical',
        },
      }))
    : []

  // Render children
  if (node.children.length > 0 || attachedScrollBars.length > 0 || (['ListView', 'GridView', 'PathView'].includes(node.type) && node.blockProperties?.delegate) || (node.type === 'Repeater' && node.blockProperties?.delegate) || (node.type === 'Loader' && (node.blockProperties?.sourceComponent || node.properties.sourceComponent)) || headerNode || footerNode) {
    // Determine if parent is a layout type — needed by children for auto-stretch
    const layoutParent = (
      node.type === 'ColumnLayout' || node.type === 'Column' ||
      node.type === 'RowLayout' || node.type === 'Row'
    ) ? node.type : undefined

    // Expand item-view delegate/model pairs into preview children.
    const effectiveChildren = node.type === 'ListView' || node.type === 'GridView' || node.type === 'PathView'
      ? expandItemView(node, modelMap)
      : node.type === 'Repeater'
        ? expandRepeater(node, modelMap)
        : node.type === 'Loader'
          ? expandLoader(node, componentMap)
          : [...node.children, ...attachedScrollBars]

    if (headerNode || footerNode) {
      const headerHeight = headerNode ? 32 : 0
      const footerHeight = footerNode ? 32 : 0

      if (headerNode) {
        html += `<div style="position:absolute; top:0; left:0; right:0; height:${headerHeight}px; z-index:2;">${renderNode(headerNode, undefined, modelMap, componentMap)}</div>`
      }
      if (footerNode) {
        html += `<div style="position:absolute; left:0; right:0; bottom:0; height:${footerHeight}px; z-index:2;">${renderNode(footerNode, undefined, modelMap, componentMap)}</div>`
      }

      html += `<div style="position:absolute; top:${headerHeight}px; left:0; right:0; bottom:${footerHeight}px; overflow:hidden;">`
      for (const child of effectiveChildren) {
        html += renderNode(child, layoutParent, modelMap, componentMap)
      }
      html += `</div>`
    } else {
      for (const child of effectiveChildren) {
        html += renderNode(child, layoutParent, modelMap, componentMap)
      }
    }
  }

  if (isDialog) {
    html += `</div>`
    const buttons = dialogButtons(node.properties.standardButtons)
    if (buttons.length > 0) {
      html += `<div class="qml-dialog-footer">${buttons.map(button =>
        `<button type="button" class="qml-dialog-button${button.primary ? ' is-primary' : ''}" data-qml-dialog-action="${button.action}" data-qml-dialog-id="${escapeAttr(node.id || '')}">${escapeHTML(button.label)}</button>`
      ).join('')}</div>`
    }
  }

  html += `</${tag}>`
  return html
}

/**
 * Render a complete QML document to an HTML string.
 * Renders all root nodes using the same layout path.
 */
export function renderQMLToHTML(nodes: QMLNode[], isLight: boolean = true): string {
  if (nodes.length === 0) {
    return emptyPreview(isLight)
  }

  const bgColor = isLight ? '#ffffff' : '#1e1e1e'
  const textColor = isLight ? '#000000' : '#cccccc'

  let bodyStyles: StyleMap = {
    'margin': '0',
    'overflow': 'hidden',
    'width': '100%',
    'height': '100%',
    'background': bgColor,
    'color': textColor,
    'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'direction': 'ltr',
  }

  let rootHTML = ''
  let windowTitle = 'QML Preview'
  const rootNode = nodes[0]
  const { roots: previewRoots, surfaces: previewSurfaces } = splitPreviewSurfaces(nodes)
  const stageStyles: StyleMap = {
    'position': 'relative',
    'display': 'inline-block',
    'vertical-align': 'top',
    'margin': '0',
    'top': '0',
    'left': '0',
  }

  if (rootNode) {
    const rootWidth = toRootCssSize(rootNode.properties?.width)
    const rootHeight = toRootCssSize(rootNode.properties?.height)
    if (rootWidth) stageStyles['width'] = rootWidth
    if (rootHeight) stageStyles['height'] = rootHeight
  }
  const rootHasExplicitWidth = !!stageStyles['width']
  const rootHasExplicitHeight = !!stageStyles['height']

  const modelMap = collectListModels(nodes)
  const componentMap = collectComponents(nodes)

  for (const node of previewRoots) {
    if (node.type === 'Window' || node.type === 'ApplicationWindow') {
      windowTitle = node.properties.title || 'QML Preview'
    }
    rootHTML += renderNode(node, undefined, modelMap, componentMap)
  }

  const hasPreviewTabs = previewSurfaces.length > 0
  const rootTabLabel = rootNode?.type || 'Root'
  const tabButtons = hasPreviewTabs
    ? `<div class="qml-preview-tabs" role="tablist">` +
      `<button class="qml-preview-tab is-active" type="button" role="tab" aria-selected="true" data-preview-tab="root">${escapeHTML(rootTabLabel)}</button>` +
      previewSurfaces.map(surface => `<button class="qml-preview-tab" type="button" role="tab" aria-selected="false" data-preview-tab="${escapeAttr(surface.key)}">${escapeHTML(surface.label)}</button>`).join('') +
      `</div>`
    : ''
  const rootPanel = `<div class="qml-preview-panel is-active" data-preview-panel="root"><div class="qml-preview-root"><div class="qml-preview-stage" style="${stylesToString(stageStyles)}">${rootHTML}</div></div></div>`
  const surfacePanels = previewSurfaces.map(surface =>
    `<div class="qml-preview-panel qml-preview-component-panel qml-preview-${surface.node.type.toLowerCase()}-panel" data-preview-panel="${escapeAttr(surface.key)}"><div class="qml-preview-root"><div class="qml-preview-component">${renderNode(surface.node, undefined, modelMap, componentMap)}</div></div></div>`
  ).join('')
  const previewHTML = `<div class="qml-preview-shell${hasPreviewTabs ? ' has-tabs' : ''}">${tabButtons}<div class="qml-preview-panels">${rootPanel}${surfacePanels}</div></div>`

  const bodyStyleStr = stylesToString(bodyStyles)
  const stageStyleStr = stylesToString(stageStyles)
  const escapedTitle = escapeHTML(windowTitle)
  const astPayload = JSON.stringify(nodes).replace(/</g, '\\u003c')

  return String.raw`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapedTitle}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; overflow:hidden; }
  body { ${bodyStyleStr} }
  .qml-preview-root {
    width: 100%;
    height: 100%;
    overflow: auto;
    position: relative;
    direction: ltr;
    scrollbar-width: auto;
  }
  .qml-preview-root::-webkit-scrollbar:vertical {
    width: 0;
  }
  .qml-preview-root::-webkit-scrollbar:horizontal {
    height: 10px;
  }
  .qml-preview-shell { width:100%; height:100%; display:flex; flex-direction:column; overflow:hidden; }
  .qml-preview-tabs {
    flex:0 0 auto; display:flex; min-height:34px; overflow-x:auto; overflow-y:hidden;
    border-bottom:1px solid var(--qml-control-border); background:var(--qml-menubar-bg);
  }
  .qml-preview-tab {
    flex:0 0 auto; min-width:88px; height:34px; padding:0 14px; border:0;
    border-right:1px solid var(--qml-control-border); border-bottom:2px solid transparent;
    color:var(--qml-muted-text); background:transparent; font:inherit; cursor:pointer;
  }
  .qml-preview-tab:hover { background:var(--qml-combo-dd-hover-bg); color:var(--qml-control-text); }
  .qml-preview-tab.is-active { color:var(--qml-tab-active-text); border-bottom-color:var(--qml-accent); background:var(--qml-tab-active-bg); font-weight:600; }
  .qml-preview-panels { position:relative; flex:1 1 auto; min-height:0; overflow:hidden; }
  .qml-preview-panel { display:none; position:absolute; inset:0; }
  .qml-preview-panel.is-active { display:block; }
  .qml-preview-component-panel .qml-preview-root { display:flex; align-items:center; justify-content:center; padding:24px; }
  .qml-preview-dialog-panel .qml-preview-root, .qml-preview-popup-panel .qml-preview-root { align-items:flex-start; justify-content:flex-start; }
  .qml-preview-component { position:relative; max-width:100%; max-height:100%; }
  .qml-preview-component > .qml-dialog { display:flex !important; flex-direction:column; margin:0 !important; }
  .qml-preview-component > .qml-popup { display:block !important; margin:0 !important; }
  .qml-dialog-titlebar {
    flex:0 0 auto; min-height:44px; display:flex; align-items:center; padding:0 18px;
    border-bottom:1px solid var(--qml-control-border); background:var(--qml-menubar-bg);
  }
  .qml-dialog-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:15px; font-weight:600; }
  .qml-dialog-content { position:relative; flex:1 1 auto; min-height:72px; padding:20px; overflow:auto; }
  .qml-dialog-footer {
    flex:0 0 auto; min-height:56px; display:flex; align-items:center; justify-content:flex-end;
    gap:8px; padding:10px 14px; border-top:1px solid var(--qml-control-border); background:var(--qml-menubar-bg);
  }
  .qml-dialog-button {
    min-width:76px; height:32px; padding:0 16px; border:1px solid var(--qml-control-border);
    border-radius:4px; color:var(--qml-control-text); background:var(--qml-btn-bg); font:inherit; cursor:pointer;
  }
  .qml-dialog-button:hover { background:var(--qml-btn-hover-bg); }
  .qml-dialog-button.is-primary { color:#fff; border-color:var(--qml-accent); background:var(--qml-accent); }
  .qml-dialog-button:focus-visible { outline:2px solid var(--qml-accent); outline-offset:2px; }
  .qml-preview-stage {
    position: relative;
  }
  :root {
    --qml-control-bg: ${isLight ? '#ffffff' : '#2d2d2d'};
    --qml-control-text: ${isLight ? '#333333' : '#cccccc'};
    --qml-muted-text: ${isLight ? '#999999' : '#888888'};
    --qml-control-border: ${isLight ? '#cccccc' : '#555555'};
    --qml-btn-bg: ${isLight ? '#e0e0e0' : '#3a3a3a'};
    --qml-btn-hover-bg: ${isLight ? '#d0d0d0' : '#4a4a4a'};
    --qml-accent: ${isLight ? '#0078d4' : '#4da6ff'};
    --qml-tab-active-bg: ${isLight ? '#e5f1fb' : '#173a52'};
    --qml-tab-active-text: ${isLight ? '#005a9e' : '#9bd2ff'};
    --qml-progress-bg: ${isLight ? '#e0e0e0' : '#3a3a3a'};
    --qml-slider-track: ${isLight ? '#dddddd' : '#444444'};
    --qml-switch-off: ${isLight ? '#cccccc' : '#555555'};
    --qml-combo-dd-bg: ${isLight ? '#ffffff' : '#2d2d2d'};
    --qml-combo-dd-border: ${isLight ? '#cccccc' : '#555555'};
    --qml-combo-dd-shadow: ${isLight ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.5)'};
    --qml-combo-dd-hover-bg: ${isLight ? '#f0f0f0' : '#3a3a3a'};
    --qml-combo-dd-sel-bg: ${isLight ? '#e8e8e8' : '#3a3a3a'};
    --qml-menubar-bg: ${isLight ? '#f0f0f0' : '#252525'};
    --qml-table-header-bg: ${isLight ? '#e8eaed' : '#343434'};
    --qml-table-header-hover: ${isLight ? '#dce2e8' : '#414141'};
    --qml-table-header-active: ${isLight ? '#d2dbe4' : '#484848'};
    --qml-table-header-border: ${isLight ? '#aeb4ba' : '#686868'};
    --qml-text-color: ${isLight ? '#000000' : '#cccccc'};
    --qml-list-border: ${isLight ? '#e0e0e0' : '#444'};
    --qml-item-border: ${isLight ? '#f0f0f0' : '#333'};
    --qml-spinner-border: ${isLight ? '#e0e0e0' : '#444'};
    --qml-dialog-bg: ${isLight ? 'white' : '#2d2d2d'};
    --qml-dialog-shadow: ${isLight ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.5)'};
    --qml-window-bg: ${isLight ? '#ffffff' : '#252525'};
    --qml-window-border: ${isLight ? '#8a8a8a' : '#666666'};
    --qml-window-shadow: ${isLight ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.45)'};
    --qml-menubar-border: ${isLight ? '#ddd' : '#444'};
  }
  .qml-node { position:relative; }
  .qml-swipeview > .qml-node, .qml-stackview > .qml-node {
    position: absolute !important;
    inset: 0;
    width: 100% !important;
    height: 100% !important;
  }
  @keyframes qml-spin { to { transform: rotate(360deg); } }
  [data-qml-type="button"]:hover { background:var(--qml-btn-hover-bg) !important; }
  [data-qml-type="roundbutton"]:hover { background:var(--qml-btn-hover-bg) !important; }
  [data-qml-type="toolbutton"]:hover { background:var(--qml-combo-dd-hover-bg) !important; }
  [data-qml-type="menu"]:hover { background:var(--qml-combo-dd-hover-bg) !important; }
  [data-qml-type="tabbutton"]:hover { background:var(--qml-combo-dd-hover-bg); }
  .qml-table-header:hover { background:var(--qml-table-header-hover) !important; }
  .qml-table-header:focus-visible { outline:2px solid var(--qml-accent); outline-offset:-2px; z-index:3; }
  .qml-table-header[data-qml-sorted="true"] { background:var(--qml-table-header-active) !important; }
  .qml-table-resizer:hover { background:var(--qml-accent); }
  .qml-cb-marker,.qml-radio-marker { display:inline-flex;flex:0 0 16px;width:16px;height:16px;box-sizing:border-box;border:1px solid var(--qml-control-border);background:var(--qml-control-bg);align-items:center;justify-content:center; }
  .qml-cb-marker { border-radius:3px; }
  [data-qml-type="checkbox"][data-qml-checked="true"] .qml-cb-marker { border-color:var(--qml-accent);background:var(--qml-accent); }
  [data-qml-type="checkbox"][data-qml-checked="true"] .qml-cb-marker::after { content:"";width:7px;height:4px;border-left:2px solid white;border-bottom:2px solid white;transform:translateY(-1px) rotate(-45deg); }
  .qml-radio-marker { border-radius:50%; }
  [data-qml-type="radio"][data-qml-checked="true"] .qml-radio-marker { border-color:var(--qml-accent); }
  [data-qml-type="radio"][data-qml-checked="true"] .qml-radio-marker::after { content:"";width:8px;height:8px;border-radius:50%;background:var(--qml-accent); }
  [data-qml-type="checkbox"]:hover .qml-cb-marker,[data-qml-type="radio"]:hover .qml-radio-marker { border-color:var(--qml-accent); }
</style>
</head>
<body>
${previewHTML}
<script>
try {
(function(){
var QML_AST=${astPayload};
var previewRoot=document.querySelector('[data-preview-panel="root"] .qml-preview-root');
var stageEl=document.querySelector('[data-preview-panel="root"] .qml-preview-stage');
if(previewRoot){
  previewRoot.scrollLeft=0;
  previewRoot.scrollTop=0;
  requestAnimationFrame(function(){
    previewRoot.scrollLeft=0;
    previewRoot.scrollTop=0;
  });
}
if(stageEl){
  var rootNodeEl=stageEl.querySelector(':scope > .qml-node')||stageEl.firstElementChild;
  if(rootNodeEl){
    var hasRootWidth=${rootHasExplicitWidth ? 'true' : 'false'};
    var hasRootHeight=${rootHasExplicitHeight ? 'true' : 'false'};
    if(!hasRootWidth){
      var naturalWidth=Math.max(rootNodeEl.scrollWidth||0, rootNodeEl.offsetWidth||0);
      if(naturalWidth>0){stageEl.style.width=naturalWidth+'px';}
    }
    if(!hasRootHeight){
      var naturalHeight=Math.max(rootNodeEl.scrollHeight||0, rootNodeEl.offsetHeight||0);
      if(naturalHeight>0){stageEl.style.height=naturalHeight+'px';}
    }
  }
}
var S={};
var Runtime={ids:{},methods:{},connections:[],stateDefs:{},bindings:[],modelDefs:{},modelViews:{},domTextBindings:[],animations:[],booting:true,applying:false};
var Qt={
  AlignLeft:1,AlignRight:2,AlignHCenter:4,AlignTop:8,AlignBottom:16,AlignVCenter:32,AlignCenter:36,
  Checked:true,Unchecked:false,
}

document.addEventListener('click',function(event){
  var button=event.target.closest('[data-qml-dialog-action]');
  if(!button)return;
  var dialogId=button.getAttribute('data-qml-dialog-id')||'';
  var action=button.getAttribute('data-qml-dialog-action')||'reject';
  var dialog=dialogId?Runtime.ids[dialogId]:null;
  if(dialog&&typeof dialog[action]==='function')dialog[action]();
  else activatePreviewTab('root');
});

function activatePreviewTab(key){
  var selected=String(key||'root');
  var panel=document.querySelector('[data-preview-panel="'+selected+'"]');
  if(!panel)selected='root';
  document.querySelectorAll('.qml-preview-tab').forEach(function(tab){
    var active=tab.getAttribute('data-preview-tab')===selected;
    tab.classList.toggle('is-active',active);
    tab.setAttribute('aria-selected',String(active));
  });
  document.querySelectorAll('.qml-preview-panel').forEach(function(item){
    item.classList.toggle('is-active',item.getAttribute('data-preview-panel')===selected);
  });
}

document.querySelectorAll('.qml-preview-tab').forEach(function(tab){
  tab.addEventListener('click',function(){activatePreviewTab(tab.getAttribute('data-preview-tab')||'root');});
});

function normalizeHandlerCode(code){
  if(!code)return '';
  var c=String(code).trim();
  if(c[0]==='{'&&c[c.length-1]==='}'){
    c=c.slice(1,-1);
  }
  return c;
}

function coerceLiteral(value){
  if(typeof value!=='string')return value;
  var v=value.trim();
  if(v==='true')return true;
  if(v==='false')return false;
  if(/^[0-9]+(\.[0-9]+)?$/.test(v) || /^[+-][0-9]+(\.[0-9]+)?$/.test(v))return parseFloat(v);
  if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))){
    return v.slice(1,-1);
  }
  return value;
}

function extractBlocks(source, keyword){
  var out=[];
  var i=0;
  while(i<source.length){
    var at=source.indexOf(keyword, i);
    if(at<0)break;
    var open=source.indexOf('{', at+keyword.length);
    if(open<0)break;
    var depth=1;
    var cur=open+1;
    while(cur<source.length&&depth>0){
      var ch=source[cur];
      if(ch==='{')depth++;
      else if(ch==='}')depth--;
      cur++;
    }
    if(depth===0){
      out.push(source.slice(open+1,cur-1));
      i=cur;
    }else{
      break;
    }
  }
  return out;
}

function escHtml(value){
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function isExpressionLike(expr){
  if(!expr)return false;
  var v=String(expr).trim();
  if(!v)return false;
  if(v==='true'||v==='false')return false;
  if(/^[0-9]+(\.[0-9]+)?$/.test(v) || /^[+-][0-9]+(\.[0-9]+)?$/.test(v))return false;
  if(/^#?[a-zA-Z][a-zA-Z0-9_.]*$/.test(v))return true;
  var ops='+-*/%()?:=!<>|&';
  for(var i=0;i<v.length;i++){
    if(ops.indexOf(v.charAt(i))>=0)return true;
  }
  return v.indexOf('.')>=0;
}

function evalExpr(expr, extraScope){
  var source=String(expr||'').trim();
  if(!source)return undefined;
  var scope=Object.assign({Math:Math,Qt:Qt,S:S},Runtime.methods,Runtime.ids,extraScope||{});
  try{
    return Function('scope','with(scope){ return ('+source+'); }')(scope);
  }catch(_e){
    return source;
  }
}

function execCode(code, extraScope){
  var source=normalizeHandlerCode(code);
  if(!source)return;
  var scope=Object.assign({Math:Math,Qt:Qt,S:S},Runtime.methods,Runtime.ids,extraScope||{});
  try{
    return Function('scope','with(scope){ '+source+' }')(scope);
  }catch(_e){
    return;
  }
}

function setDomProp(id, prop, value){
  var el=document.getElementById(id);
  if(!el)return;
  switch(prop){
    case 'text':{
      var textNode=el.querySelector('.qml-cb-text');
      if(textNode){textNode.textContent=String(value);}else{el.textContent=String(value);}
      break;
    }
    case 'checked':{
      var on=!!value;
      if(el.getAttribute('data-qml-type')==='checkbox'){
        el.setAttribute('data-qml-checked',String(on));
      }else if(el.getAttribute('data-qml-type')==='switch'){
        el.setAttribute('data-qml-checked',String(on));
        var track=el.firstElementChild;
        if(track){
          track.style.background=on?'var(--qml-switch-on,#4cd964)':'var(--qml-switch-off)';
          var thumb=track.firstElementChild;
          if(thumb){thumb.style.right=on?'2px':'auto';thumb.style.left=on?'auto':'2px';}
        }
      }
      break;
    }
    case 'value':{
      if(el.getAttribute('data-qml-type')==='slider'){
        var from=parseFloat(el.getAttribute('data-qml-from')||'0');
        var to=parseFloat(el.getAttribute('data-qml-to')||'100');
        var n=parseFloat(String(value));
        if(!isNaN(n)&&to!==from){
          var pct=Math.max(0,Math.min(100,((n-from)/(to-from))*100));
          el.setAttribute('data-qml-value',String(n));
          var fill=el.querySelector('.qml-slider-fill');
          var thumb=el.querySelector('.qml-slider-thumb');
          if(fill){fill.style.width=pct+'%';}
          if(thumb){thumb.style.left='calc('+pct+'% - 7px)';}
        }
      }
      break;
    }
    case 'currentIndex':{
      var idx=parseInt(String(value),10);
      if(isNaN(idx))idx=0;
      el.setAttribute('data-qml-currentindex',String(idx));
      if(el.classList.contains('qml-tabbar')){
        var kids=Array.prototype.filter.call(el.children,function(c){return c.getAttribute&&c.getAttribute('data-qml-type')==='tabbutton';});
        kids.forEach(function(c,i){
          c.style.borderBottom=i===idx?'2px solid var(--qml-accent)':'2px solid transparent';
          c.style.color=i===idx?'var(--qml-text-color)':'var(--qml-muted-text)';
        });
        var stack=el.nextElementSibling;
        while(stack&&!stack.classList.contains('qml-stacklayout')){stack=stack.nextElementSibling;}
        if(stack){
          var panels=Array.prototype.filter.call(stack.children,function(c){return c.classList.contains('qml-node');});
          panels.forEach(function(p,i){p.style.display=i===idx?'':'none';});
        }
      }
      if(el.classList.contains('qml-stacklayout')){
        var panels=Array.prototype.filter.call(el.children,function(c){return c.classList.contains('qml-node');});
        panels.forEach(function(p,i){p.style.display=i===idx?'':'none';});
      }
      if(el.classList.contains('qml-swipeview')||el.classList.contains('qml-stackview')){
        var pages=Array.prototype.filter.call(el.children,function(c){return c.classList.contains('qml-node');});
        pages.forEach(function(p,i){p.style.display=i===idx?'':'none';});
      }
      break;
    }
    case 'x': {
      var xv=parseFloat(String(value));
      if(!isNaN(xv)){
        if(el.getAttribute('data-qml-flow-pos')==='true')el.style.marginLeft=xv+'px';
        else el.style.left=xv+'px';
      }
      break;
    }
    case 'y': {
      var yv=parseFloat(String(value));
      if(!isNaN(yv)){
        if(el.getAttribute('data-qml-flow-pos')==='true')el.style.marginTop=yv+'px';
        else el.style.top=yv+'px';
      }
      break;
    }
    case 'width': { var wv=parseFloat(String(value)); if(!isNaN(wv))el.style.width=wv+'px'; break; }
    case 'height': { var hv=parseFloat(String(value)); if(!isNaN(hv))el.style.height=hv+'px'; break; }
    case 'color': el.style.background=String(value); break;
    case 'visible': el.style.display=value===false||value==='false'?'none':''; break;
    case 'opacity': el.style.opacity=String(value); break;
    case 'url': if(el.getAttribute('data-qml-type')==='webengineview')el.setAttribute('src',String(value||'about:blank')); break;
    case 'active':
      if(el.getAttribute('data-qml-loader')==='true'){
        var on=!(value===false||value==='false'||value===0||value==='0');
        var tpl=el.getAttribute('data-qml-loader-template')||'';
        if(on){
          if(!el.innerHTML&&tpl){el.innerHTML=tpl;}
          el.style.display='';
        }else{
          el.setAttribute('data-qml-loader-template', tpl||el.innerHTML||'');
          el.innerHTML='';
          el.style.display='none';
        }
      }
      break;
    case 'state': applyState(id, String(value)); break;
  }
}

function parseStates(statesRaw){
  if(!statesRaw)return [];
  var states=[];
  var stateBodies=extractBlocks(String(statesRaw),'State');
  stateBodies.forEach(function(body){
    var nm=(body.match(/name\s*:\s*["']([^"']+)["']/)||body.match(/name\s*:\s*([^\n;\r]+)/));
    var stateName=nm?String(nm[1]).trim():'';
    var whenMatch=(body.match(/when\s*:\s*([^\n;\r]+)/)||[])[1];
    var changes=[];
    var pcs=extractBlocks(body,'PropertyChanges');
    pcs.forEach(function(pc){
      var tm=pc.match(/target\s*:\s*([A-Za-z_]\w*)/);
      if(!tm)return;
      var target=tm[1];
      var props={};
      var lineRe=/([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*:\s*([^\n;\r]+)/g;
      var lm;
      while((lm=lineRe.exec(pc))){
        if(lm[1]==='target')continue;
        props[lm[1]]=String(lm[2]).trim();
      }
      changes.push({target:target,props:props});
    });
    states.push({name:stateName,when:whenMatch?String(whenMatch).trim():'',changes:changes});
  });
  return states;
}

function parseTransition(transRaw){
  if(!transRaw)return null;
  var raw=String(transRaw);
  var animBlocks=[];
  ['NumberAnimation','ColorAnimation','PropertyAnimation'].forEach(function(kind){
    animBlocks=animBlocks.concat(extractBlocks(raw,kind));
  });

  var parseAnim=function(body){
    var d=(body.match(/duration\s*:\s*(\d+)/)||[])[1];
    var p=(body.match(/properties\s*:\s*["']([^"']+)["']/)||body.match(/property\s*:\s*["']([^"']+)["']/)||[])[1];
    var easing=(body.match(/easing\.type\s*:\s*Easing\.([A-Za-z]+)/)||[])[1]||'InOutQuad';
    return {
      duration:d?parseInt(d,10):200,
      properties:p?String(p).split(',').map(function(x){return x.trim();}).filter(Boolean):['all'],
      easing:easing,
    };
  };

  var totalDuration=0;
  var mergedProps=[];
  if(raw.indexOf('SequentialAnimation')>=0){
    animBlocks.forEach(function(b){
      var a=parseAnim(b);
      totalDuration+=a.duration;
      mergedProps=mergedProps.concat(a.properties);
    });
  }else{
    var maxDuration=0;
    animBlocks.forEach(function(b){
      var a=parseAnim(b);
      if(a.duration>maxDuration)maxDuration=a.duration;
      mergedProps=mergedProps.concat(a.properties);
    });
    totalDuration=maxDuration||200;
  }

  if(animBlocks.length===0){
    var d0=(raw.match(/duration\s*:\s*(\d+)/)||[])[1];
    var p0=(raw.match(/properties\s*:\s*["']([^"']+)["']/)||raw.match(/property\s*:\s*["']([^"']+)["']/)||[])[1];
    return {
      duration:d0?parseInt(d0,10):200,
      properties:p0?String(p0).split(',').map(function(x){return x.trim();}).filter(Boolean):['all'],
      easing:(raw.match(/easing\.type\s*:\s*Easing\.([A-Za-z]+)/)||[])[1]||'InOutQuad',
    };
  }

  var uniqProps=Array.from(new Set(mergedProps.filter(Boolean)));
  var easingMatch=(raw.match(/easing\.type\s*:\s*Easing\.([A-Za-z]+)/)||[])[1]||'InOutQuad';
  return {duration:totalDuration||200,properties:uniqProps.length?uniqProps:['all'],easing:easingMatch};
}

function cssEasing(name){var map={Linear:'linear',InQuad:'ease-in',OutQuad:'ease-out',InOutQuad:'ease-in-out',InCubic:'cubic-bezier(.55,.055,.675,.19)',OutCubic:'cubic-bezier(.215,.61,.355,1)',InOutCubic:'cubic-bezier(.645,.045,.355,1)'};return map[name]||'ease-in-out';}

function stopStandaloneAnimation(animation){
  (animation.timers||[]).forEach(function(timer){clearTimeout(timer);});animation.timers=[];
  var element=document.getElementById(animation.target);if(element)element.style.transition='none';
  animation.active=false;
  if(animation.id&&Runtime.ids[animation.id])Runtime.ids[animation.id].running=false;
}

function startStandaloneAnimation(animation){
  if(!animation.target||!animation.property)return;
  stopStandaloneAnimation(animation);
  var target=Runtime.ids[animation.target];var element=document.getElementById(animation.target);if(!target||!element)return;
  animation.active=true;if(animation.id&&Runtime.ids[animation.id])Runtime.ids[animation.id].running=true;
  var runCycle=function(){
    element.style.transition='none';
    if(animation.from!==undefined)target[animation.property]=coerceLiteral(animation.from);
    void element.offsetWidth;
    requestAnimationFrame(function(){
      if(!animation.active)return;
      element.style.transition='all '+animation.duration+'ms '+cssEasing(animation.easing);
      target[animation.property]=coerceLiteral(animation.to);
    });
  };
  runCycle();
  if(animation.loops<0){
    var repeat=function(){if(!animation.active)return;runCycle();animation.timers.push(setTimeout(repeat,Math.max(16,animation.duration)));};
    animation.timers.push(setTimeout(repeat,Math.max(16,animation.duration)));
  }else{
    for(var loop=1;loop<animation.loops;loop++)animation.timers.push(setTimeout(runCycle,animation.duration*loop));
    animation.timers.push(setTimeout(function(){animation.active=false;if(animation.id&&Runtime.ids[animation.id])Runtime.ids[animation.id].running=false;},animation.duration*Math.max(1,animation.loops)));
  }
}

function applyState(ownerId, stateName){
  var def=Runtime.stateDefs[ownerId];
  if(!def)return;
  var st=def.states.find(function(s){return s.name===stateName;});
  if(!st)return;
  st.changes.forEach(function(change){
    var targetObj=Runtime.ids[change.target];
    if(!targetObj)return;
    var targetEl=document.getElementById(change.target);
    if(targetEl&&def.transition){
      var tProps='all';
      if(def.transition.properties[0]!=='all'){
        var mapped=def.transition.properties.map(function(p){
          var prop=String(p||'').trim();
          if(prop==='x')return targetEl.getAttribute('data-qml-flow-pos')==='true'?'margin-left':'left';
          if(prop==='y')return targetEl.getAttribute('data-qml-flow-pos')==='true'?'margin-top':'top';
          if(prop==='color')return 'background';
          return prop;
        }).filter(Boolean);
        tProps=Array.from(new Set(mapped)).join(',')||'all';
      }
      targetEl.style.transition=tProps+' '+def.transition.duration+'ms '+cssEasing(def.transition.easing);
    }
    Object.keys(change.props).forEach(function(prop){
      var v=evalExpr(change.props[prop], Runtime.ids[change.target]);
      targetObj[prop]=v;
    });
  });
}

function emitSignal(sourceId, signalName, payload){
  Runtime.connections.forEach(function(c){
    if(c.target!==sourceId)return;
    if(c.signal!==signalName)return;
    execCode(c.code, Object.assign({event:payload||null}, Runtime.ids[sourceId]||{}));
  });
  if(!Runtime.booting && !Runtime.applying){
    applyBindings();
  }
}

function applyBindings(){
  if(Runtime.booting || Runtime.applying)return;
  Runtime.applying=true;
  Runtime.bindings.forEach(function(b){
    var obj=Runtime.ids[b.id];
    if(!obj)return;
    var val=evalExpr(b.expr, obj);
    if(val!==undefined){
      obj[b.prop]=val;
    }
  });
  (Runtime.domTextBindings||[]).forEach(function(item){
    if(!item||!item.el||!item.expr)return;
    var value=evalExpr(item.expr);
    if(value===undefined)return;
    var textNode=item.el.querySelector('.qml-cb-text');
    if(textNode){textNode.textContent=String(value);}else{item.el.textContent=String(value);}
  });
  applyWhenStates();
  Runtime.applying=false;
}

function applyWhenStates(){
  Object.keys(Runtime.stateDefs).forEach(function(ownerId){
    var def=Runtime.stateDefs[ownerId];
    if(!def||!def.states)return;
    var chosen='';
    for(var i=0;i<def.states.length;i++){
      var st=def.states[i];
      if(!st.when)continue;
      var ok=!!evalExpr(st.when, Runtime.ids[ownerId]||{});
      if(ok){chosen=st.name;break;}
    }
    if(chosen){
      applyState(ownerId, chosen);
      var owner=Runtime.ids[ownerId];
      if(owner){ owner.state = chosen; }
    }
  });
}

function evalRowExpr(expr,row,index){
  if(!expr)return '';
  var source=String(expr).trim();
  try{
    return Function('scope','with(scope){ return ('+source+'); }')(
      Object.assign({index:index,modelData:row&&row.modelData},row||{})
    );
  }catch(_e){
    return source.replace(/\$\{index\}/g,String(index));
  }
}

function refreshModelViews(modelId){
  var rows=Runtime.modelDefs[modelId]||[];
  var views=document.querySelectorAll('[data-qml-model-ref="'+modelId+'"]');
  views.forEach(function(view){
    var tpl=view.getAttribute('data-qml-delegate-text')||'';
    var itemType=(view.getAttribute('data-qml-delegate-item')||'ItemDelegate').toLowerCase();
    var currentIdx=parseInt(view.getAttribute('data-qml-currentindex')||'-1',10);
    if(!tpl)return;
    var html='';
    rows.forEach(function(row,idx){
      var text=evalRowExpr(tpl,row,idx);
      if(itemType==='itemdelegate'){
        var selected=idx===currentIdx;
        html+='<div class="qml-node qml-itemdelegate" data-qml-type="itemdelegate" data-qml-index="'+idx+'" style="padding:8px 12px;border-bottom:1px solid var(--qml-item-border);font-size:13px;cursor:pointer;'+(selected?'background:var(--qml-combo-dd-sel-bg);font-weight:600;':'')+'">'+escHtml(String(text))+'</div>';
      }else{
        html+='<div class="qml-node" style="padding:4px 8px;">'+escHtml(String(text))+'</div>';
      }
    });
    view.innerHTML=html;
  });
  refreshStructuredViews(modelId);
}

function parseJsonAttr(el,name,fallback){
  try{return JSON.parse(el.getAttribute(name)||'');}catch(_e){return fallback;}
}

function refreshTableView(view,rows){
  var columns=parseJsonAttr(view,'data-qml-columns',[]);
  var headers=parseJsonAttr(view,'data-qml-headers',columns);
  var widths=parseJsonAttr(view,'data-qml-columnwidths',[]);
  if(!columns.length&&rows.length)columns=Object.keys(rows[0]).filter(function(k){return k!=='modelData';});
  if(!headers.length)headers=columns;
  var gridColumns=columns.map(function(_column,index){
    var width=parseFloat(widths[index]);
    return !isNaN(width)&&width>0?Math.max(48,width)+'px':'minmax(90px,1fr)';
  }).join(' ');
  var resizable=view.getAttribute('data-qml-resizablecolumns')==='true';
  var sortColumn=parseInt(view.getAttribute('data-qml-sort-column')||'-1',10);
  var sortDirection=view.getAttribute('data-qml-sort')||'';
  var selected=(view.getAttribute('data-qml-selected')||'').split(',').filter(Boolean).map(Number);
  var virtual=rows.length>200;
  var start=virtual?Math.max(0,Math.min(rows.length-1,parseInt(view.getAttribute('data-qml-window-start')||'0',10)||0)):0;
  var visibleRows=virtual?rows.slice(start,start+120):rows;
  var html='<div class="qml-table-grid" role="grid" style="display:grid;grid-template-columns:'+gridColumns+';min-width:100%;width:max-content;border-top:1px solid var(--qml-control-border);border-left:1px solid var(--qml-control-border)">';
  headers.forEach(function(header,index){
    var sorted=index===sortColumn;
    var sortIndicator=sorted?'<span class="qml-table-sort" aria-hidden="true" style="margin-left:auto;padding-left:8px;font-size:10px">'+(sortDirection==='desc'?'▼':'▲')+'</span>':'';
    html+='<button type="button" class="qml-table-header" data-qml-column="'+index+'" data-qml-sorted="'+String(sorted)+'" aria-sort="'+(sorted?(sortDirection==='desc'?'descending':'ascending'):'none')+'" style="position:sticky;top:0;display:flex;align-items:center;min-height:30px;padding:6px 9px;text-align:left;font:inherit;font-weight:600;color:var(--qml-control-text);background:var(--qml-table-header-bg);border:0;border-right:1px solid var(--qml-table-header-border);border-bottom:2px solid var(--qml-table-header-border);box-shadow:inset 0 1px 0 rgba(255,255,255,.35);cursor:pointer;z-index:1"><span>'+escHtml(String(header))+'</span>'+sortIndicator+(resizable?'<span class="qml-table-resizer" aria-hidden="true" style="position:absolute;top:0;right:-4px;width:8px;height:100%;cursor:col-resize;z-index:2"></span>':'')+'</button>';
  });
  if(virtual&&start>0)html+='<div aria-hidden="true" style="grid-column:1/-1;height:'+(start*30)+'px"></div>';
  visibleRows.forEach(function(row,visibleIndex){
    var rowIndex=start+visibleIndex;
    columns.forEach(function(role,columnIndex){
      var active=selected.indexOf(rowIndex)>=0;
      html+='<div role="gridcell" tabindex="0" class="qml-table-cell" data-qml-row="'+rowIndex+'" data-qml-column="'+columnIndex+'" data-qml-role="'+escHtml(String(role))+'" style="padding:6px 8px;border-right:1px solid var(--qml-control-border);border-bottom:1px solid var(--qml-control-border);background:'+(active?'var(--qml-combo-dd-sel-bg)':'transparent')+';cursor:default">'+escHtml(String(row[role]===undefined?'':row[role]))+'</div>';
    });
  });
  if(virtual&&start+visibleRows.length<rows.length)html+='<div aria-hidden="true" style="grid-column:1/-1;height:'+((rows.length-start-visibleRows.length)*30)+'px"></div>';
  view.innerHTML=html+'</div>';
}

function refreshTreeView(view,rows){
  var idRole=view.getAttribute('data-qml-idrole')||'nodeId';
  var parentRole=view.getAttribute('data-qml-parentrole')||'parentId';
  var textRole=view.getAttribute('data-qml-textrole')||'text';
  var flattened=[];
  var flatten=function(items,parent){
    (items||[]).forEach(function(item,index){
      var row=Object.assign({},item);
      var id=String(row[idRole]===undefined?(parent?parent+'-'+index:String(index)):row[idRole]);
      row[idRole]=id;
      row[parentRole]=parent;
      flattened.push(row);
      if(Array.isArray(item.children))flatten(item.children,id);
    });
  };
  if(rows.some(function(row){return Array.isArray(row&&row.children);})){
    flatten(rows,'');
    rows=flattened;
  }
  var expanded=new Set((view.getAttribute('data-qml-expanded-ids')||'').split(',').filter(Boolean));
  if(!view.hasAttribute('data-qml-tree-ready')&&view.getAttribute('data-qml-expanded')==='true'){
    rows.forEach(function(row){expanded.add(String(row[idRole]));});
    view.setAttribute('data-qml-tree-ready','true');
    view.setAttribute('data-qml-expanded-ids',Array.from(expanded).join(','));
  }
  var selected=(view.getAttribute('data-qml-selected')||'').split(',').filter(Boolean);
  var byParent={};
  rows.forEach(function(row,index){
    var parent=String(row[parentRole]===undefined?'':row[parentRole]);
    (byParent[parent]||(byParent[parent]=[])).push({row:row,index:index});
  });
  var renderBranch=function(parent,depth){
    return (byParent[parent]||[]).map(function(item){
      var id=String(item.row[idRole]===undefined?item.index:item.row[idRole]);
      var children=byParent[id]||[];
      var open=expanded.has(id);
      var active=selected.indexOf(id)>=0;
      var line='<div role="treeitem" tabindex="0" class="qml-tree-row" data-qml-nodeid="'+escHtml(id)+'" data-qml-index="'+item.index+'" aria-expanded="'+(children.length?String(open):'false')+'" style="padding:5px 8px 5px '+(8+depth*18)+'px;background:'+(active?'var(--qml-combo-dd-sel-bg)':'transparent')+';cursor:default;white-space:nowrap"><span class="qml-tree-toggle" style="display:inline-block;width:16px;cursor:'+(children.length?'pointer':'default')+'">'+(children.length?(open?'▾':'▸'):'')+'</span>'+escHtml(String(item.row[textRole]===undefined?id:item.row[textRole]))+'</div>';
      if(children.length&&open)line+=renderBranch(id,depth+1);
      return line;
    }).join('');
  };
  view.innerHTML='<div role="tree">'+renderBranch('',0)+'</div>';
}

function refreshStructuredViews(modelId){
  var rows=Runtime.modelDefs[modelId]||[];
  document.querySelectorAll('.qml-tableview[data-qml-model-ref="'+modelId+'"],.qml-treeview[data-qml-model-ref="'+modelId+'"]').forEach(function(view){
    if(view.classList.contains('qml-tableview'))refreshTableView(view,rows);
    else refreshTreeView(view,rows);
  });
}

function rowsForStructuredView(view){
  var modelRef=view.getAttribute('data-qml-model-ref')||'';
  if(Runtime.modelDefs[modelRef])return Runtime.modelDefs[modelRef];
  try{
    var direct=JSON.parse(modelRef);
    return Array.isArray(direct)?direct:[];
  }catch(_e){return [];}
}

function registerModelApi(modelId, rows, proxy){
  Runtime.modelDefs[modelId]=rows;
  proxy.count=rows.length;
  proxy.get=function(index){return rows[index]||null;};
  proxy.append=function(obj){
    rows.push(Object.assign({},obj||{}));
    proxy.count=rows.length;
    refreshModelViews(modelId);
  };
  proxy.remove=function(index,count){
    var n=(count===undefined)?1:Math.max(1,parseInt(String(count),10)||1);
    rows.splice(Math.max(0,parseInt(String(index),10)||0),n);
    proxy.count=rows.length;
    refreshModelViews(modelId);
  };
  proxy.setProperty=function(index,name,value){
    var i=Math.max(0,parseInt(String(index),10)||0);
    if(!rows[i])rows[i]={};
    rows[i][name]=value;
    refreshModelViews(modelId);
  };
  proxy.set=function(index,obj){
    var i=Math.max(0,parseInt(String(index),10)||0);
    if(i<rows.length)rows[i]=Object.assign({},obj||{});
    refreshModelViews(modelId);
  };
  proxy.clear=function(){
    rows.length=0;
    proxy.count=0;
    refreshModelViews(modelId);
  };
}

function stackViewNavigate(id,index,direction){
  var stack=document.getElementById(id);if(!stack)return -1;
  var pages=Array.prototype.filter.call(stack.children,function(child){return child.classList.contains('qml-node');});
  if(!pages.length)return -1;
  index=Math.max(0,Math.min(pages.length-1,index));
  var previous=parseInt(stack.getAttribute('data-qml-currentindex')||'0',10);if(isNaN(previous))previous=0;
  pages.forEach(function(page,pageIndex){
    if(pageIndex===index){page.style.display='';if(page.animate)page.animate([{transform:'translateX('+(direction<0?'-18px':'18px')+')',opacity:.25},{transform:'translateX(0)',opacity:1}],{duration:180,easing:'ease-out'});}
    else{page.style.display='none';}
  });
  stack.setAttribute('data-qml-currentindex',String(index));
  return index;
}

function registerNode(node){
  if(!node||typeof node!=='object')return;

  if(node.id){
    var store={};
    var proxy=new Proxy(store,{set:function(target,key,val){
      if(Object.is(target[key], val)){
        return true;
      }
      target[key]=val;
      if(!Runtime.booting){
        setDomProp(node.id,String(key),val);
        emitSignal(node.id, String(key).toLowerCase()+'changed', val);
      }
      return true;
    },get:function(target,key){return target[key];}});
    Runtime.ids[node.id]=proxy;

    if(node.type==='ListModel'){
      var rows=[];
      (node.children||[]).forEach(function(ch){
        if(ch.type!=='ListElement')return;
        var row={};
        Object.keys(ch.properties||{}).forEach(function(k){ row[k]=coerceLiteral(ch.properties[k]); });
        if(row.modelData===undefined){row.modelData=row.text!==undefined?row.text:'';}
        rows.push(row);
      });
      registerModelApi(node.id, rows, proxy);
    }

    Object.keys(node.properties||{}).forEach(function(k){
      proxy[k]=coerceLiteral(node.properties[k]);
      if(k!=='id'&&isExpressionLike(node.properties[k])){
        Runtime.bindings.push({id:node.id,prop:k,expr:node.properties[k]});
      }
    });
    if(node.type==='Dialog'||node.type==='Popup'){
      var previewKey=node.id||'';
      proxy.open=function(){proxy.visible=true;proxy.opened=true;activatePreviewTab(previewKey);emitSignal(node.id,'opened',null);};
      proxy.close=function(){proxy.visible=false;proxy.opened=false;activatePreviewTab('root');emitSignal(node.id,'closed',null);};
      proxy.accept=function(){proxy.close();emitSignal(node.id,'accepted',null);};
      proxy.reject=function(){proxy.close();emitSignal(node.id,'rejected',null);};
    }
    if(node.type==='StackView'){
      proxy.depth=Math.max(1,node.children.length);
      proxy.currentIndex=parseInt(node.properties.currentIndex||'0',10)||0;
      proxy.push=function(item){
        var stack=document.getElementById(node.id);var pages=stack?Array.prototype.filter.call(stack.children,function(child){return child.classList.contains('qml-node');}):[];
        var next=typeof item==='number'?item:pages.findIndex(function(page){return page.id===item||page.id===(item&&item.id);});
        if(next<0)next=Math.min(pages.length-1,(proxy.currentIndex||0)+1);
        next=stackViewNavigate(node.id,next,1);if(next>=0){proxy.currentIndex=next;proxy.depth=Math.max(proxy.depth,next+1);proxy.currentItem=pages[next]||null;}return proxy.currentItem;
      };
      proxy.pop=function(){var next=stackViewNavigate(node.id,Math.max(0,(proxy.currentIndex||0)-1),-1);if(next>=0){proxy.currentIndex=next;proxy.depth=Math.max(1,proxy.depth-1);}return proxy.currentItem;};
      proxy.replace=function(item){var previousDepth=proxy.depth;var result=proxy.push(item);proxy.depth=previousDepth;return result;};
      proxy.clear=function(){var stack=document.getElementById(node.id);if(stack)Array.prototype.forEach.call(stack.children,function(page){page.style.display='none';});proxy.depth=0;proxy.currentIndex=-1;proxy.currentItem=null;};
    }
    if(node.type==='TableView'||node.type==='TreeView'){
      proxy.selectedIndexes=[];
      proxy.clearSelection=function(){var view=document.getElementById(node.id);if(!view)return;view.setAttribute('data-qml-selected','');proxy.selectedIndexes=[];var rows=rowsForStructuredView(view);if(node.type==='TableView')refreshTableView(view,rows);else refreshTreeView(view,rows);};
      proxy.isSelected=function(index){return proxy.selectedIndexes.indexOf(index)>=0;};
      proxy.select=function(index,mode){
        var view=document.getElementById(node.id);if(!view)return;
        var value=String(index);var selected=(view.getAttribute('data-qml-selected')||'').split(',').filter(Boolean);
        if(mode==='Toggle')selected=selected.indexOf(value)>=0?selected.filter(function(item){return item!==value;}):selected.concat(value);
        else if(mode==='Add')selected=selected.indexOf(value)>=0?selected:selected.concat(value);
        else selected=[value];
        view.setAttribute('data-qml-selected',selected.join(','));proxy.selectedIndexes=selected.map(function(item){var number=Number(item);return isNaN(number)?item:number;});
        var rows=rowsForStructuredView(view);if(node.type==='TableView')refreshTableView(view,rows);else refreshTreeView(view,rows);
      };
    }
    if(node.type==='WebEngineView'){
      proxy.reload=function(){var frame=document.getElementById(node.id);if(frame)frame.setAttribute('src',frame.getAttribute('src')||'about:blank');};
      proxy.stop=function(){var frame=document.getElementById(node.id);try{frame&&frame.contentWindow&&frame.contentWindow.stop();}catch(_e){}};
      proxy.goBack=function(){var frame=document.getElementById(node.id);try{frame&&frame.contentWindow&&frame.contentWindow.history.back();}catch(_e){}};
      proxy.goForward=function(){var frame=document.getElementById(node.id);try{frame&&frame.contentWindow&&frame.contentWindow.history.forward();}catch(_e){}};
    }
    if(node.properties&&node.properties.states){
      Runtime.stateDefs[node.id]={
        states:parseStates(node.properties.states),
        transition:parseTransition(node.properties.transitions||''),
      };
    }
  }

  if(node.methods){
    Object.keys(node.methods).forEach(function(name){
      var fnSource=node.methods[name];
      Runtime.methods[name]=function(){
        var args=Array.prototype.slice.call(arguments);
        var self=(node.id&&Runtime.ids[node.id])?Runtime.ids[node.id]:S;
        var scope=Object.assign({Math:Math,Qt:Qt,S:S},Runtime.methods,Runtime.ids,{__args:args,__self:self});
        try{
          return Function('scope','source','with(scope){ return (eval("("+source+")")).apply(__self,__args); }')(scope,fnSource);
        }catch(_e){
          return;
        }
      };
    });
  }

  if(node.type==='Connections'){
    var target=((node.properties&&node.properties.target)||'').trim();
    if(target){
      Object.keys(node.properties||{}).forEach(function(k){
        if(!/^on[A-Z]/.test(k))return;
        var signal=k.slice(2).toLowerCase();
        Runtime.connections.push({target:target,signal:signal,code:node.properties[k]});
      });
      if(node.methods){
        Object.keys(node.methods).forEach(function(mn){
          if(!/^on[A-Z]/.test(mn))return;
          var signal=mn.slice(2).toLowerCase();
          var src=node.methods[mn];
          var body=src.replace(/^function\s+[A-Za-z_]\w*\s*\([^)]*\)\s*\{([\s\S]*)\}$/,'$1');
          Runtime.connections.push({target:target,signal:signal,code:body});
        });
      }
    }
  }

  if(['NumberAnimation','ColorAnimation','PropertyAnimation'].indexOf(node.type)>=0&&node.properties){
    var animation={id:node.id||'',target:(node.properties.target||'').trim(),property:(node.properties.property||node.properties.properties||'').replace(/["']/g,'').trim(),from:node.properties.from,to:node.properties.to,duration:parseInt(node.properties.duration||'250',10)||250,easing:(node.properties['easing.type']||'Easing.InOutQuad').replace('Easing.',''),loops:node.properties.loops==='Animation.Infinite'?-1:(parseInt(node.properties.loops||'1',10)||1),running:node.properties.running!=='false',active:false,timers:[]};
    Runtime.animations.push(animation);
    if(node.id&&Runtime.ids[node.id]){
      Runtime.ids[node.id].start=function(){startStandaloneAnimation(animation);};
      Runtime.ids[node.id].restart=function(){startStandaloneAnimation(animation);};
      Runtime.ids[node.id].stop=function(){stopStandaloneAnimation(animation);};
    }
  }

  (node.children||[]).forEach(registerNode);
  if(node.blockProperties){
    Object.keys(node.blockProperties).forEach(function(k){registerNode(node.blockProperties[k]);});
  }
}

function runElementHandler(t, signalName, eventObj){
  if(!t)return;
  var key='data-qml-on'+signalName;
  var code=t.getAttribute(key);
  if(code){
    execCode(code, Object.assign({event:eventObj||null}, Runtime.ids[t.id]||{}));
  }
  if(t.id){
    emitSignal(t.id, signalName, eventObj||null);
  }else{
    applyBindings();
  }
}

function updateRangeSlider(t,clientX,preferred){
  var rect=t.getBoundingClientRect();
  var from=parseFloat(t.getAttribute('data-qml-from')||'0');
  var to=parseFloat(t.getAttribute('data-qml-to')||'100');
  var first=parseFloat(t.getAttribute('data-qml-first')||String(from));
  var second=parseFloat(t.getAttribute('data-qml-second')||String(to));
  var pct=Math.max(0,Math.min(1,(clientX-rect.left)/Math.max(1,rect.width)));
  var value=from+(to-from)*pct;
  var which=preferred||((Math.abs(value-first)<=Math.abs(value-second))?'first':'second');
  if(which==='first')first=Math.min(value,second);else second=Math.max(value,first);
  var p1=((first-from)/(to-from||1))*100;
  var p2=((second-from)/(to-from||1))*100;
  t.setAttribute('data-qml-first',String(first));
  t.setAttribute('data-qml-second',String(second));
  var fill=t.querySelector('.qml-range-fill');
  var firstEl=t.querySelector('.qml-range-first');
  var secondEl=t.querySelector('.qml-range-second');
  if(fill){fill.style.left=p1+'%';fill.style.width=(p2-p1)+'%';}
  if(firstEl)firstEl.style.left='calc('+p1+'% - 6px)';
  if(secondEl)secondEl.style.left='calc('+p2+'% - 6px)';
  if(t.id&&Runtime.ids[t.id]){Runtime.ids[t.id].firstValue=first;Runtime.ids[t.id].secondValue=second;}
  runElementHandler(t,'moved',null);
  return which;
}

function updateDial(t,clientX,clientY){
  var rect=t.getBoundingClientRect();
  var angle=Math.atan2(clientY-(rect.top+rect.height/2),clientX-(rect.left+rect.width/2))*180/Math.PI+90;
  if(angle>180)angle-=360;
  angle=Math.max(-135,Math.min(135,angle));
  var from=parseFloat(t.getAttribute('data-qml-from')||'0');
  var to=parseFloat(t.getAttribute('data-qml-to')||'100');
  var value=from+(to-from)*((angle+135)/270);
  t.setAttribute('data-qml-value',String(value));
  var needle=t.querySelector('.qml-dial-needle');
  if(needle)needle.style.transform='rotate('+angle+'deg)';
  if(t.id&&Runtime.ids[t.id])Runtime.ids[t.id].value=value;
  runElementHandler(t,'moved',null);
}

function stepTumbler(t,delta,eventObj){
  var items=[];
  try{items=JSON.parse(t.getAttribute('data-qml-model')||'[]');}catch(_e){items=[];}
  if(!items.length)return;
  var idx=parseInt(t.getAttribute('data-qml-currentindex')||'0',10);
  idx=(idx+delta+items.length)%items.length;
  t.setAttribute('data-qml-currentindex',String(idx));
  var value=t.querySelector('.qml-tumbler-value');
  if(value)value.textContent=String(items[idx]);
  if(t.id&&Runtime.ids[t.id])Runtime.ids[t.id].currentIndex=idx;
  runElementHandler(t,'currentindexchanged',eventObj||null);
}

function renderCalendar(calendar,monthDelta){
  var selectedRaw=calendar.getAttribute('data-qml-selecteddate')||'';
  var monthRaw=calendar.getAttribute('data-qml-displayedmonth')||selectedRaw;
  var base=monthRaw?new Date(monthRaw):new Date();
  if(isNaN(base.getTime()))base=new Date();
  base=new Date(base.getFullYear(),base.getMonth()+(monthDelta||0),1);
  var year=base.getFullYear(),month=base.getMonth();
  var pad=function(n){return String(n).padStart(2,'0');};
  calendar.setAttribute('data-qml-displayedmonth',year+'-'+pad(month+1)+'-01');
  var locale=calendar.getAttribute('data-qml-locale')||undefined;
  var title=new Intl.DateTimeFormat(locale,{year:'numeric',month:'long'}).format(base);
  var html='<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><button type="button" class="qml-calendar-prev" aria-label="Previous month">‹</button><strong>'+escHtml(title)+'</strong><button type="button" class="qml-calendar-next" aria-label="Next month">›</button></div>';
  var monday=new Date(2024,0,1);
  for(var w=0;w<7;w++){var wd=new Date(monday);wd.setDate(monday.getDate()+w);html+='<span style="font-weight:600;text-align:center">'+escHtml(new Intl.DateTimeFormat(locale,{weekday:'short'}).format(wd))+'</span>';}
  var offset=(base.getDay()+6)%7;
  var days=new Date(year,month+1,0).getDate();
  for(var empty=0;empty<offset;empty++)html+='<span></span>';
  var today=new Date();
  for(var day=1;day<=days;day++){
    var iso=year+'-'+pad(month+1)+'-'+pad(day);
    var selected=selectedRaw.slice(0,10)===iso;
    var isToday=today.getFullYear()===year&&today.getMonth()===month&&today.getDate()===day;
    html+='<button type="button" class="qml-calendar-day" data-qml-date="'+iso+'" style="border:'+(isToday?'1px solid var(--qml-accent)':'1px solid transparent')+';background:'+(selected?'var(--qml-accent)':'transparent')+';color:'+(selected?'white':'inherit')+';font-weight:'+(selected?'600':'400')+';padding:3px 0;cursor:pointer;border-radius:3px">'+day+'</button>';
  }
  calendar.innerHTML=html;
}

document.querySelectorAll('[data-qml-type="calendar"]').forEach(function(calendar){renderCalendar(calendar,0);});

function layoutPathView(view){
  var points=parseJsonAttr(view,'data-qml-pathpoints',[]);if(points.length<2)return;
  var items=Array.prototype.filter.call(view.children,function(child){return child.classList.contains('qml-node');});
  items.forEach(function(item,index){
    var pointIndex=items.length<=1?0:Math.round(index*(points.length-1)/(items.length-1));var point=points[pointIndex]||[0,0];
    item.style.position='absolute';item.style.left=point[0]+'px';item.style.top=point[1]+'px';item.style.transform='translate(-50%,-50%)';item.style.transition='transform 180ms ease,opacity 180ms ease';
    item.setAttribute('data-qml-path-index',String(index));
  });
}
document.querySelectorAll('[data-qml-type="pathview"]').forEach(layoutPathView);

function scrollHostFor(bar){return bar.parentElement;}
function syncAttachedScrollBar(bar){
  if(bar.getAttribute('data-qml-attached')!=='true')return;
  var host=scrollHostFor(bar);if(!host)return;
  var horizontal=bar.getAttribute('data-qml-orientation')==='Qt.Horizontal';
  var viewport=horizontal?host.clientWidth:host.clientHeight;
  var extent=horizontal?host.scrollWidth:host.scrollHeight;
  var offset=horizontal?host.scrollLeft:host.scrollTop;
  var size=extent>0?Math.max(.05,Math.min(1,viewport/extent)):1;
  var position=extent>viewport?offset/extent:0;
  var thumb=bar.firstElementChild;if(!thumb)return;
  if(horizontal){thumb.style.left=(position*100)+'%';thumb.style.width=(size*100)+'%';}
  else{thumb.style.top=(position*100)+'%';thumb.style.height=(size*100)+'%';}
  bar.style.opacity=extent>viewport?'1':'.25';
}
document.querySelectorAll('[data-qml-type="scrollbar"][data-qml-attached="true"]').forEach(function(bar){
  var host=scrollHostFor(bar);if(!host)return;
  host.addEventListener('scroll',function(){syncAttachedScrollBar(bar);},{passive:true});
  syncAttachedScrollBar(bar);
});

var activeDrag=null;
document.addEventListener('pointerdown',function(e){
  var pathView=e.target.closest('[data-qml-type="pathview"]');
  if(pathView){activeDrag={type:'pathview',el:pathView,startX:e.clientX,startIndex:parseInt(pathView.getAttribute('data-qml-currentindex')||'0',10)||0};return;}
  var scrollBar=e.target.closest('[data-qml-type="scrollbar"]');
  if(scrollBar&&scrollBar.getAttribute('data-qml-attached')==='true'){
    var host=scrollHostFor(scrollBar);var horizontal=scrollBar.getAttribute('data-qml-orientation')==='Qt.Horizontal';
    if(host){activeDrag={type:'scrollbar',el:scrollBar,host:host,horizontal:horizontal,start:horizontal?e.clientX:e.clientY,startScroll:horizontal?host.scrollLeft:host.scrollTop};e.preventDefault();}
    return;
  }
  var resizer=e.target.closest('.qml-table-resizer');
  if(resizer){
    var table=resizer.closest('.qml-tableview');
    var header=resizer.closest('.qml-table-header');
    var widths=parseJsonAttr(table,'data-qml-columnwidths',[]);
    var headers=Array.prototype.slice.call(table.querySelectorAll('.qml-table-header'));
    while(widths.length<headers.length)widths.push(headers[widths.length].getBoundingClientRect().width);
    activeDrag={type:'table-column',el:table,column:parseInt(header.getAttribute('data-qml-column')||'0',10),startX:e.clientX,startWidth:header.getBoundingClientRect().width,widths:widths};
    e.preventDefault();e.stopPropagation();
    return;
  }
  var range=e.target.closest('[data-qml-type="rangeslider"]');
  if(range){
    var preferred=e.target.closest('.qml-range-first')?'first':e.target.closest('.qml-range-second')?'second':null;
    activeDrag={type:'range',el:range,which:updateRangeSlider(range,e.clientX,preferred)};
    e.preventDefault();
    return;
  }
  var dial=e.target.closest('[data-qml-type="dial"]');
  if(dial){activeDrag={type:'dial',el:dial};updateDial(dial,e.clientX,e.clientY);e.preventDefault();}
});
document.addEventListener('pointermove',function(e){
  if(!activeDrag)return;
  if(activeDrag.type==='table-column'){
    activeDrag.widths[activeDrag.column]=Math.max(48,activeDrag.startWidth+e.clientX-activeDrag.startX);
    activeDrag.el.setAttribute('data-qml-columnwidths',JSON.stringify(activeDrag.widths));
    var grid=activeDrag.el.querySelector('.qml-table-grid');
    if(grid)grid.style.gridTemplateColumns=activeDrag.widths.map(function(width){return Math.max(48,width)+'px';}).join(' ');
    return;
  }
  if(activeDrag.type==='range')updateRangeSlider(activeDrag.el,e.clientX,activeDrag.which);
  if(activeDrag.type==='dial')updateDial(activeDrag.el,e.clientX,e.clientY);
  if(activeDrag.type==='scrollbar'){
    var coordinate=activeDrag.horizontal?e.clientX:e.clientY;
    var track=activeDrag.horizontal?activeDrag.el.clientWidth:activeDrag.el.clientHeight;
    var viewport=activeDrag.horizontal?activeDrag.host.clientWidth:activeDrag.host.clientHeight;
    var extent=activeDrag.horizontal?activeDrag.host.scrollWidth:activeDrag.host.scrollHeight;
    var next=activeDrag.startScroll+(coordinate-activeDrag.start)*Math.max(1,extent/Math.max(1,track));
    if(activeDrag.horizontal)activeDrag.host.scrollLeft=next;else activeDrag.host.scrollTop=next;
  }
});
document.addEventListener('pointerup',function(e){
  if(activeDrag&&activeDrag.type==='pathview'){
    var items=Array.prototype.filter.call(activeDrag.el.children,function(child){return child.classList.contains('qml-node');});
    var delta=e.clientX-activeDrag.startX;var next=Math.max(0,Math.min(items.length-1,activeDrag.startIndex+(Math.abs(delta)>24?(delta<0?1:-1):0)));
    activeDrag.el.setAttribute('data-qml-currentindex',String(next));if(activeDrag.el.id&&Runtime.ids[activeDrag.el.id])Runtime.ids[activeDrag.el.id].currentIndex=next;
    items.forEach(function(item,index){item.style.opacity=index===next?'1':'.65';item.style.transform='translate(-50%,-50%) scale('+(index===next?'1.08':'1')+')';});
  }
  activeDrag=null;
});
document.addEventListener('wheel',function(e){
  var tumbler=e.target.closest('[data-qml-type="tumbler"]');
  if(!tumbler)return;
  e.preventDefault();
  stepTumbler(tumbler,e.deltaY>0?1:-1,e);
},{passive:false});

(QML_AST||[]).forEach(registerNode);
Runtime.booting=false;
document.querySelectorAll('[data-qml-type="webengineview"]').forEach(function(frame){frame.addEventListener('load',function(event){runElementHandler(frame,'loadingchanged',event);});});
Runtime.animations.forEach(function(animation){
  if(animation.running)startStandaloneAnimation(animation);
});
Object.keys(Runtime.modelDefs).forEach(function(mid){refreshModelViews(mid);});
Runtime.domTextBindings=Array.prototype.map.call(document.querySelectorAll('[data-qml-bind-text]'),function(el){
  return {el:el,expr:el.getAttribute('data-qml-bind-text')||''};
});
document.querySelectorAll('[data-qml-loader="true"]').forEach(function(el){
  if(!el.getAttribute('data-qml-loader-template')){
    el.setAttribute('data-qml-loader-template', el.innerHTML || '');
  }
});
applyBindings();
document.querySelectorAll('[data-qml-oncompleted]').forEach(function(element){
  var code=element.getAttribute('data-qml-oncompleted')||'';
  execCode(code, element.id&&Runtime.ids[element.id]?Runtime.ids[element.id]:{});
});
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-qml-type]');
  if(!t)return;
  var type=t.getAttribute('data-qml-type');
  switch(type){
    case'button':
    case'roundbutton':{
      t.style.transform='scale(0.93)';
      setTimeout(function(){t.style.transform='';},100);
      runElementHandler(t,'clicked',e);
      break;
    }
    case'toolbutton':{
      t.style.background='var(--qml-btn-hover-bg)';
      setTimeout(function(){t.style.background='';},150);
      runElementHandler(t,'clicked',e);
      break;
    }
    case'checkbox':{
      var checked=t.getAttribute('data-qml-checked')!=='true';
      t.setAttribute('data-qml-checked',String(checked));
      if(t.id&&Runtime.ids[t.id])Runtime.ids[t.id].checked=checked;
      runElementHandler(t,'clicked',e);
      break;
    }
    case'radio':{
      var grp=t.getAttribute('data-qml-group')||'default';
      document.querySelectorAll('[data-qml-type="radio"][data-qml-group="'+grp+'"]').forEach(function(r){
        r.setAttribute('data-qml-checked','false');
        if(r.id&&Runtime.ids[r.id])Runtime.ids[r.id].checked=false;
      });
      t.setAttribute('data-qml-checked','true');
      if(t.id&&Runtime.ids[t.id])Runtime.ids[t.id].checked=true;
      runElementHandler(t,'clicked',e);
      break;
    }
    case'switch':{
      var on=t.getAttribute('data-qml-checked')!=='true';
      t.setAttribute('data-qml-checked',String(on));
      var track=t.firstElementChild;
      if(track){
        track.style.background=on?'var(--qml-switch-on,#4cd964)':'var(--qml-switch-off)';
        var thumb=track.firstElementChild;
        if(thumb){thumb.style.right=on?'2px':'auto';thumb.style.left=on?'auto':'2px';}
      }
      if(t.id&&Runtime.ids[t.id])Runtime.ids[t.id].checked=on;
      runElementHandler(t,'clicked',e);
      break;
    }
    case'slider':{
      var rect=t.getBoundingClientRect();
      var x=e.clientX-rect.left;
      var pct=Math.max(0,Math.min(100,(x/rect.width)*100));
      var from=parseFloat(t.getAttribute('data-qml-from')||'0');
      var to=parseFloat(t.getAttribute('data-qml-to')||'100');
      t.setAttribute('data-qml-value',String(Math.round(from+(to-from)*(pct/100))));
      var fill=t.querySelector('.qml-slider-fill');
      var thumb=t.querySelector('.qml-slider-thumb');
      if(fill){fill.style.width=pct+'%';}
      if(thumb){thumb.style.left='calc('+pct+'% - 7px)';}
      if(t.id&&Runtime.ids[t.id])Runtime.ids[t.id].value=parseFloat(t.getAttribute('data-qml-value')||'0');
      runElementHandler(t,'moved',e);
      break;
    }
    case'itemdelegate':{
      var view=t.closest('.qml-listview');
      if(view){
        var selIdx=parseInt(t.getAttribute('data-qml-index')||'-1',10);
        if(!isNaN(selIdx)&&selIdx>=0){
          view.setAttribute('data-qml-currentindex',String(selIdx));
          Array.prototype.forEach.call(view.querySelectorAll('.qml-itemdelegate'),function(item){
            var selected=item===t;
            item.style.background=selected?'var(--qml-combo-dd-sel-bg)':'';
            item.style.fontWeight=selected?'600':'';
          });
          var modelRef=view.getAttribute('data-qml-model-ref')||'';
          if(modelRef)refreshModelViews(modelRef);
          if(view.id&&Runtime.ids[view.id])Runtime.ids[view.id].currentIndex=selIdx;
          runElementHandler(view,'activated',e);
        }
      }
      break;
    }
    case'tumbler':{
      if(e.target.closest('.qml-tumbler-up'))stepTumbler(t,-1,e);
      else if(e.target.closest('.qml-tumbler-down'))stepTumbler(t,1,e);
      break;
    }
    case'calendar':{
      if(e.target.closest('.qml-calendar-prev')){renderCalendar(t,-1);return;}
      if(e.target.closest('.qml-calendar-next')){renderCalendar(t,1);return;}
      var day=e.target.closest('.qml-calendar-day');
      if(!day)return;
      var selected=day.getAttribute('data-qml-date')||'';
      t.setAttribute('data-qml-selecteddate',selected);
      renderCalendar(t,0);
      if(t.id&&Runtime.ids[t.id])Runtime.ids[t.id].selectedDate=selected;
      runElementHandler(t,'clicked',e);
      break;
    }
    case'tableview':{
      var cell=e.target.closest('.qml-table-cell');
      var header=e.target.closest('.qml-table-header');
      var tableModel=t.getAttribute('data-qml-model-ref')||'';
      if(e.target.closest('.qml-table-resizer')){
        break;
      }else if(header&&tableModel){
        var columns=parseJsonAttr(t,'data-qml-columns',[]);
        var columnIndex=parseInt(header.getAttribute('data-qml-column')||'0',10);
        var role=columns[columnIndex];
        var rows=Runtime.modelDefs[tableModel]||[];
        var previousColumn=parseInt(t.getAttribute('data-qml-sort-column')||'-1',10);
        var direction=previousColumn===columnIndex&&t.getAttribute('data-qml-sort')==='asc'?'desc':'asc';
        rows.sort(function(a,b){return String(a[role]||'').localeCompare(String(b[role]||''))*(direction==='asc'?1:-1);});
        t.setAttribute('data-qml-sort-column',String(columnIndex));
        t.setAttribute('data-qml-sort',direction);
        refreshTableView(t,rows);
      }else if(cell){
        var rowIndex=parseInt(cell.getAttribute('data-qml-row')||'-1',10);
        var selected=(t.getAttribute('data-qml-selected')||'').split(',').filter(Boolean).map(Number);
        if((t.getAttribute('data-qml-selectionmode')||'').endsWith('ExtendedSelection')&&(e.ctrlKey||e.metaKey)){
          selected=selected.indexOf(rowIndex)>=0?selected.filter(function(v){return v!==rowIndex;}):selected.concat(rowIndex);
        }else selected=[rowIndex];
        t.setAttribute('data-qml-selected',selected.join(','));
        t.setAttribute('data-qml-currentindex',String(rowIndex));
        if(t.id&&Runtime.ids[t.id]){Runtime.ids[t.id].currentIndex=rowIndex;Runtime.ids[t.id].selectedIndexes=selected.slice();}
        t.querySelectorAll('.qml-table-cell').forEach(function(tableCell){
          var selectedRow=parseInt(tableCell.getAttribute('data-qml-row')||'-1',10);
          tableCell.style.background=selected.indexOf(selectedRow)>=0?'var(--qml-combo-dd-sel-bg)':'transparent';
        });
        runElementHandler(t,'activated',e);
      }
      break;
    }
    case'treeview':{
      var row=e.target.closest('.qml-tree-row');
      if(!row)return;
      var nodeId=row.getAttribute('data-qml-nodeid')||'';
      var toggle=e.target.closest('.qml-tree-toggle');
      if(toggle&&toggle.textContent){
        var expanded=new Set((t.getAttribute('data-qml-expanded-ids')||'').split(',').filter(Boolean));
        if(expanded.has(nodeId))expanded.delete(nodeId);else expanded.add(nodeId);
        t.setAttribute('data-qml-expanded-ids',Array.from(expanded).join(','));
      }else{
        var selected=(t.getAttribute('data-qml-selected')||'').split(',').filter(Boolean);
        if((t.getAttribute('data-qml-selectionmode')||'').endsWith('ExtendedSelection')&&(e.ctrlKey||e.metaKey)){
          selected=selected.indexOf(nodeId)>=0?selected.filter(function(v){return v!==nodeId;}):selected.concat(nodeId);
        }else selected=[nodeId];
        t.setAttribute('data-qml-selected',selected.join(','));
        var treeIndex=parseInt(row.getAttribute('data-qml-index')||'-1',10);
        t.setAttribute('data-qml-currentindex',String(treeIndex));
        if(t.id&&Runtime.ids[t.id]){Runtime.ids[t.id].currentIndex=treeIndex;Runtime.ids[t.id].selectedIndexes=selected.slice();}
        runElementHandler(t,'activated',e);
      }
      refreshTreeView(t,Runtime.modelDefs[t.getAttribute('data-qml-model-ref')||'']||[]);
      break;
    }
    case'tabbutton':{
      var tb=t.parentElement;
      var kids=Array.prototype.filter.call(tb.children,function(c){return c.getAttribute('data-qml-type')==='tabbutton';});
      var idx=kids.indexOf(t);
      if(idx<0)return;
      kids.forEach(function(c,i){
        c.style.borderBottom=i===idx?'2px solid var(--qml-accent)':'2px solid transparent';
        c.style.color=i===idx?'var(--qml-text-color)':'var(--qml-muted-text)';
      });
      var stack=tb.nextElementSibling;
      while(stack&&!stack.classList.contains('qml-stacklayout')){stack=stack.nextElementSibling;}
      if(stack){
        var panels=Array.prototype.filter.call(stack.children,function(c){return c.classList.contains('qml-node');});
        panels.forEach(function(p,i){p.style.display=i===idx?'':'none';});
        if(stack.id&&Runtime.ids[stack.id])Runtime.ids[stack.id].currentIndex=idx;
      }
      if(tb&&tb.id&&Runtime.ids[tb.id])Runtime.ids[tb.id].currentIndex=idx;
      runElementHandler(t,'clicked',e);
      break;
    }
    case'combobox':{
      // Close any existing combobox dropdowns first
      document.querySelectorAll('.qml-combo-dd').forEach(function(d){d.remove();});
      var raw=t.getAttribute('data-qml-model')||'[]';
      var items;
      try{items=JSON.parse(raw);}catch(e){items=[];}
      if(!items.length)return;
      var textRole=t.getAttribute('data-qml-textrole')||'text';
      var currentIdx=parseInt(t.getAttribute('data-qml-currentindex')||'-1',10);
      var comboInput=t.querySelector('.qml-combo-input');
      var filterText=comboInput?comboInput.value.toLowerCase():'';
      var rect=t.getBoundingClientRect();
      var box=document.createElement('div');
      box.className='qml-combo-dd';
      box.style.cssText='position:fixed;top:'+(rect.bottom+2)+'px;left:'+rect.left+'px;width:'+rect.width+'px;background:var(--qml-combo-dd-bg);border:1px solid var(--qml-combo-dd-border);border-radius:4px;z-index:10000;box-shadow:0 4px 12px var(--qml-combo-dd-shadow);';
      items.forEach(function(item,i){
        var opt=document.createElement('div');
        var itemText=item&&typeof item==='object'?(item[textRole]===undefined?'':item[textRole]):item;
        if(filterText&&String(itemText).toLowerCase().indexOf(filterText)<0)return;
        opt.textContent=String(itemText);
        opt.style.cssText='padding:6px 10px;cursor:pointer;font-size:13px;color:var(--qml-control-text);'+(i===currentIdx?'background:var(--qml-combo-dd-sel-bg);font-weight:600;':'');
        opt.onmouseover=function(){opt.style.background='var(--qml-combo-dd-hover-bg)';};
        opt.onmouseout=function(){opt.style.background=i===currentIdx?'var(--qml-combo-dd-sel-bg)':'';};
        opt.onclick=function(e){
          e.stopPropagation();
          t.setAttribute('data-qml-currentindex',String(i));
          var lbl=t.querySelector('span:first-child');
          var input=t.querySelector('.qml-combo-input');
          if(input){input.value=String(itemText);}
          if(lbl){
            lbl.textContent=String(itemText);
            lbl.style.color='var(--qml-control-text)';
          }
          if(t.id&&Runtime.ids[t.id])Runtime.ids[t.id].currentIndex=i;
          if(t.id&&Runtime.ids[t.id])Runtime.ids[t.id].editText=String(itemText);
          runElementHandler(t,'activated',e);
          box.remove();
        };
        box.appendChild(opt);
      });
      document.body.appendChild(box);
      // Auto-close on outside click
      var closer=function(e){
        if(!box.contains(e.target)){
          box.remove();
          document.removeEventListener('click',closer,true);
        }
      };
      setTimeout(function(){document.addEventListener('click',closer,true);},0);
      break;
    }
    case'spinbox':{
      var value=parseFloat(t.getAttribute('data-qml-value')||'0');
      var from=parseFloat(t.getAttribute('data-qml-from')||'0');
      var to=parseFloat(t.getAttribute('data-qml-to')||'99');
      var step=parseFloat(t.getAttribute('data-qml-step')||'1');
      if(isNaN(step)||step<=0)step=1;
      var isInc=!!e.target.closest('.qml-spinbox-inc');
      var isDec=!!e.target.closest('.qml-spinbox-dec');
      if(isInc||isDec){
        value=value+(isInc?step:-step);
        value=Math.max(from,Math.min(to,value));
        t.setAttribute('data-qml-value',String(value));
        var v=t.querySelector('.qml-spinbox-value');
        if(v){v.textContent=String(value);} 
        if(t.id&&Runtime.ids[t.id])Runtime.ids[t.id].value=value;
        runElementHandler(t,'valuechanged',e);
      }
      runElementHandler(t,'clicked',e);
      break;
    }
    case'delaybutton':{
      var d=parseInt(t.getAttribute('data-qml-delay')||'800',10);
      if(isNaN(d)||d<0)d=800;
      var fill=t.querySelector('.qml-delay-fill');
      if(fill){
        fill.style.transition='none';
        fill.style.width='0%';
        requestAnimationFrame(function(){
          fill.style.transition='width '+d+'ms linear';
          fill.style.width='100%';
        });
      }
      setTimeout(function(){runElementHandler(t,'triggered',e);},d);
      break;
    }
    case'menu':{
      document.querySelectorAll('.qml-menu-dd-global').forEach(function(d){d.remove();});
      var rect=t.getBoundingClientRect();
      var dd=document.createElement('div');
      dd.className='qml-menu-dd-global';
      dd.style.cssText='position:fixed;top:'+(rect.bottom+2)+'px;left:'+rect.left+'px;background:var(--qml-combo-dd-bg);border:1px solid var(--qml-combo-dd-border);border-radius:4px;box-shadow:0 4px 12px var(--qml-combo-dd-shadow);z-index:12000;min-width:140px;padding:2px 0;';
      Array.prototype.forEach.call(t.children,function(c){
        if(!c.classList)return;
        if(c.classList.contains('qml-menuitem')||c.classList.contains('qml-menuseparator')){
          var clone=c.cloneNode(true);
          clone.style.display='block';
          dd.appendChild(clone);
        }
      });
      if(dd.children.length>0){
        document.body.appendChild(dd);
      }
      runElementHandler(t,'clicked',e);
      break;
    }
    case'menuitem':{
      runElementHandler(t,'triggered',e);
      document.querySelectorAll('.qml-menu-dd-global').forEach(function(d){d.remove();});
      break;
    }
  }
});
document.addEventListener('input',function(e){
  var input=e.target.closest('.qml-combo-input');
  if(!input)return;
  var combo=input.closest('[data-qml-type="combobox"]');
  if(combo&&combo.id&&Runtime.ids[combo.id])Runtime.ids[combo.id].editText=input.value;
});
// close dropdowns on outside click
document.addEventListener('click',function(e){
  if(!e.target.closest('[data-qml-type="combobox"]')){
    document.querySelectorAll('.qml-combo-dd').forEach(function(d){d.remove();});
  }
  if(!e.target.closest('[data-qml-type="menu"]')){
    if(!e.target.closest('.qml-menu-dd-global')){
      document.querySelectorAll('.qml-menu-dd-global').forEach(function(d){d.remove();});
    }
  }
});
document.addEventListener('dblclick',function(e){
  var cell=e.target.closest('.qml-tableview[data-qml-editable="true"] .qml-table-cell');
  if(!cell)return;
  var view=cell.closest('.qml-tableview');
  var modelId=view.getAttribute('data-qml-model-ref')||'';
  var rowIndex=parseInt(cell.getAttribute('data-qml-row')||'-1',10);
  var role=cell.getAttribute('data-qml-role')||'';
  cell.contentEditable='true';cell.focus();
  var commit=function(){
    cell.contentEditable='false';
    var rows=Runtime.modelDefs[modelId]||[];
    if(rows[rowIndex])rows[rowIndex][role]=cell.textContent||'';
    refreshTableView(view,rows);
  };
  cell.addEventListener('blur',commit,{once:true});
  cell.addEventListener('keydown',function(event){if(event.key==='Enter'){event.preventDefault();cell.blur();}},{once:true});
});
document.addEventListener('keydown',function(e){
  var comboInput=e.target.closest('.qml-combo-input');
  if(comboInput&&e.key==='Enter'){
    var combo=comboInput.closest('[data-qml-type="combobox"]');
    if(!combo)return;
    var raw=combo.getAttribute('data-qml-model')||'[]';
    var items=[];try{items=JSON.parse(raw);}catch(_e){}
    var role=combo.getAttribute('data-qml-textrole')||'text';
    var found=items.findIndex(function(item){var text=item&&typeof item==='object'?item[role]:item;return String(text).toLowerCase()===comboInput.value.toLowerCase();});
    if(found>=0){combo.setAttribute('data-qml-currentindex',String(found));if(combo.id&&Runtime.ids[combo.id])Runtime.ids[combo.id].currentIndex=found;runElementHandler(combo,'activated',e);}
    if(combo.id&&Runtime.ids[combo.id])Runtime.ids[combo.id].editText=comboInput.value;
    runElementHandler(combo,'accepted',e);e.preventDefault();return;
  }
  var list=e.target.closest('.qml-listview');
  if(list&&(e.key==='ArrowDown'||e.key==='ArrowUp')){
    var items=Array.prototype.slice.call(list.querySelectorAll('.qml-itemdelegate'));
    var current=parseInt(list.getAttribute('data-qml-currentindex')||'-1',10);
    var next=Math.max(0,Math.min(items.length-1,current+(e.key==='ArrowDown'?1:-1)));
    if(items[next]){items[next].click();items[next].focus();e.preventDefault();}
    return;
  }
  var table=e.target.closest('.qml-tableview');
  if(table&&e.target.closest('.qml-table-cell')&&['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].indexOf(e.key)>=0){
    var cell=e.target.closest('.qml-table-cell');
    var row=parseInt(cell.getAttribute('data-qml-row')||'0',10);
    var column=parseInt(cell.getAttribute('data-qml-column')||'0',10);
    var columns=parseJsonAttr(table,'data-qml-columns',[]).length||1;
    if(e.key==='ArrowDown')row++;if(e.key==='ArrowUp')row--;
    if(e.key==='ArrowRight')column++;if(e.key==='ArrowLeft')column--;
    row=Math.max(0,row);column=Math.max(0,Math.min(columns-1,column));
    var target=table.querySelector('.qml-table-cell[data-qml-row="'+row+'"][data-qml-column="'+column+'"]');
    if(target){target.click();target.focus();e.preventDefault();}
    return;
  }
  var tree=e.target.closest('.qml-treeview');
  if(tree&&e.target.closest('.qml-tree-row')){
    var rows=Array.prototype.slice.call(tree.querySelectorAll('.qml-tree-row'));
    var active=e.target.closest('.qml-tree-row');
    var index=rows.indexOf(active);
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      var target=rows[Math.max(0,Math.min(rows.length-1,index+(e.key==='ArrowDown'?1:-1)))];
      if(target){target.click();target.focus();e.preventDefault();}
    }else if(e.key==='ArrowLeft'&&active.getAttribute('aria-expanded')==='true'){
      active.querySelector('.qml-tree-toggle').click();e.preventDefault();
    }else if(e.key==='ArrowRight'&&active.getAttribute('aria-expanded')==='false'&&active.querySelector('.qml-tree-toggle').textContent){
      active.querySelector('.qml-tree-toggle').click();e.preventDefault();
    }
  }
});
// init: highlight first tab, show only first stack panel
(function init(){
  document.querySelectorAll('.qml-tabbar').forEach(function(tb){
    var idx=parseInt(tb.getAttribute('data-qml-currentindex')||'0',10);
    if(isNaN(idx)||idx<0)idx=0;
    var kids=Array.prototype.filter.call(tb.children,function(c){return c.getAttribute&&c.getAttribute('data-qml-type')==='tabbutton';});
    kids.forEach(function(t,i){
      t.style.borderBottom=i===idx?'2px solid var(--qml-accent)':'2px solid transparent';
      t.style.color=i===idx?'var(--qml-text-color)':'var(--qml-muted-text)';
    });

    var stack=tb.nextElementSibling;
    while(stack&&!stack.classList.contains('qml-stacklayout')){stack=stack.nextElementSibling;}
    if(stack){
      var stackIdxAttr=parseInt(stack.getAttribute('data-qml-currentindex')||String(idx),10);
      var stackIdx=isNaN(stackIdxAttr)?idx:stackIdxAttr;
      var panels=Array.prototype.filter.call(stack.children,function(c){return c.classList.contains('qml-node');});
      panels.forEach(function(p,i){p.style.display=i===stackIdx?'':'none';});
    }
  });

  document.querySelectorAll('.qml-stacklayout').forEach(function(s){
    if(s.previousElementSibling&&s.previousElementSibling.classList.contains('qml-tabbar'))return;
    var idx=parseInt(s.getAttribute('data-qml-currentindex')||'0',10);
    if(isNaN(idx)||idx<0)idx=0;
    var panels=Array.prototype.filter.call(s.children,function(c){return c.classList.contains('qml-node');});
    panels.forEach(function(p,i){p.style.display=i===idx?'':'none';});
  });

  document.querySelectorAll('.qml-swipeview, .qml-stackview').forEach(function(s){
    var idx=parseInt(s.getAttribute('data-qml-currentindex')||'0',10);
    if(isNaN(idx)||idx<0)idx=0;
    var panels=Array.prototype.filter.call(s.children,function(c){return c.classList.contains('qml-node');});
    panels.forEach(function(p,i){p.style.display=i===idx?'':'none';});
  });

  document.querySelectorAll('.qml-tableview,.qml-treeview').forEach(function(view){
    var rows=rowsForStructuredView(view);
    if(view.classList.contains('qml-tableview'))refreshTableView(view,rows);
    else refreshTreeView(view,rows);
  });

  document.querySelectorAll('.qml-tableview').forEach(function(view){
    var rows=rowsForStructuredView(view);if(rows.length<=200)return;
    view.addEventListener('scroll',function(){
      var next=Math.max(0,Math.floor(view.scrollTop/30)-20);
      var current=parseInt(view.getAttribute('data-qml-window-start')||'0',10)||0;
      if(Math.abs(next-current)<20)return;
      view.setAttribute('data-qml-window-start',String(next));refreshTableView(view,rows);
    },{passive:true});
  });

  document.querySelectorAll('.qml-listview').forEach(function(view){
    var idx=parseInt(view.getAttribute('data-qml-currentindex')||'-1',10);
    view.querySelectorAll('.qml-itemdelegate').forEach(function(item){
      var selected=parseInt(item.getAttribute('data-qml-index')||'-1',10)===idx;
      item.style.background=selected?'var(--qml-combo-dd-sel-bg)':'';
      item.style.fontWeight=selected?'600':'';
    });
  });

  Object.keys(Runtime.stateDefs).forEach(function(ownerId){
    var owner=Runtime.ids[ownerId];
    if(!owner)return;
    var stateName=owner.state;
    if(stateName){applyState(ownerId,String(stateName));}
  });
})();
})();
}catch(e){document.body.innerHTML='<div style="color:red;padding:20px;font-family:monospace">Preview error: '+e.message+'</div>';}
</script>
</body>
</html>`
}

/**
 * Generate empty preview state
 */
export function emptyPreview(isLight: boolean = true): string {
  const bgColor = isLight ? '#f5f5f5' : '#1e1e1e'
  const textColor = isLight ? '#888' : '#666'
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Empty Preview</title>
<style>
  body { margin:0; display:flex; align-items:center; justify-content:center; 
         height:100vh; font-family:sans-serif; color:${textColor}; background:${bgColor}; }
</style>
</head>
<body></body>
</html>`
}

/**
 * Parse and render QML source to HTML in one call
 */
export function parseAndRender(qmlSource: string, isLight: boolean = true): string {
  const nodes = parseQML(qmlSource)
  if (nodes.length === 0) return emptyPreview(isLight)
  return renderQMLToHTML(nodes, isLight)
}
