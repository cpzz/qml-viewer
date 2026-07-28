/**
 * QML Element Mappings - Phase 1
 * Defines how each QML element type maps to HTML/CSS
 */

export type StyleMap = Record<string, string>

export interface ElementMapping {
  /** HTML tag name */
  tag: string
  /** Generate CSS styles from QML properties */
  computeStyles: (props: Record<string, string>) => StyleMap
  /** Generate inner HTML content (for elements like Text) */
  renderContent?: (props: Record<string, string>) => string
  /** Generate interactive data attributes for JS event binding */
  getAttributes?: (props: Record<string, string>) => Record<string, string>
}

const DEFAULT_LAYOUT_SPACING = '5px'

/** Auto-incrementing ID for interactive element identification */
let _nextId = 1
function uid(): string { return `iq-${_nextId++}` }

function withSignalAttrs(
  props: Record<string, string>,
  type: string,
  base: Record<string, string> = {},
): Record<string, string> {
  const attrs: Record<string, string> = {
    ...base,
    'data-qml-type': type,
  }
  if (props.onClicked) attrs['data-qml-onclicked'] = props.onClicked
  if (props.onTriggered) attrs['data-qml-ontriggered'] = props.onTriggered
  return attrs
}

/**
 * Parse a QML numeric value, handling units.
 * Returns the numeric value or null if not a number.
 */
function parseNumeric(value: string): number | null {
  const clean = value.replace(/px|pt|dp/gi, '').trim()
  const n = parseFloat(clean)
  return isNaN(n) ? null : n
}

/**
 * Convert a pixel value string to CSS. Adds 'px' suffix if bare number.
 */
function toCSSPx(value: string): string {
  const n = parseNumeric(value)
  if (n === null) return value
  return `${n}px`
}

/**
 * Map QML color values to CSS color values.
 * Handles named colors, hex, and special values.
 */
function toCSSColor(value: string): string {
  // Already a valid CSS color
  if (['transparent', 'yellow', 'blue', 'red', 'green', 'white', 'black',
      'gray', 'grey', 'lightgray', 'darkgray', 'orange', 'purple', 'pink',
      'brown', 'cyan', 'magenta', 'steelblue', 'darkblue', 'navy',
      'lightblue', 'lightgreen', 'darkgreen', 'gold', 'silver',
      'turquoise', 'violet', 'indigo', 'coral', 'salmon', 'teal',
      'aqua', 'lime', 'maroon', 'olive', 'navy', 'aliceblue',
  ].includes(value.toLowerCase())) {
    return value
  }
  // Hex color (#xxx or #xxxxxx)
  if (value.startsWith('#') && (value.length === 4 || value.length === 7)) {
    return value
  }
  // Fallback
  return value
}

/**
 * Convert border.width + border.color to CSS border shorthand.
 */
function toCSSBorder(props: Record<string, string>): string {
  const bw = props['border.width']
  const bc = props['border.color']
  if (!bw && !bc) return ''
  const width = bw ? toCSSPx(bw) : '1px'
  const color = bc ? toCSSColor(bc) : '#000'
  return `${width} solid ${color}`
}

/**
 * Element type definitions and their CSS mappings.
 */
export const ELEMENT_MAP: Record<string, ElementMapping> = {
  Rectangle: {
    tag: 'div',
    computeStyles: (props) => {
      const styles: StyleMap = {}

      if (props.color && props.color !== 'transparent') {
        styles['background'] = toCSSColor(props.color)
      }

      const border = toCSSBorder(props)
      if (border) {
        styles['border'] = border
      }

      if (props.radius) {
        styles['border-radius'] = toCSSPx(props.radius)
      }

      return styles
    },
  },

  Text: {
    tag: 'div',
    computeStyles: (props) => {
      const styles: StyleMap = {
        'white-space': 'pre-wrap',
        'overflow': 'hidden',
      }

      if (props.color) {
        styles['color'] = toCSSColor(props.color)
      }

      if (props['font.pixelSize']) {
        styles['font-size'] = toCSSPx(props['font.pixelSize'])
      }

      if (props['font.bold'] === 'true') {
        styles['font-weight'] = 'bold'
      }

      if (props['font.family']) {
        styles['font-family'] = props['font.family']
      }

      if (props['font.italic'] === 'true') {
        styles['font-style'] = 'italic'
      }

      if (props['font.pointSize']) {
        styles['font-size'] = toCSSPx(props['font.pointSize'])
      }

      // Alignment
      const halign = props['horizontalAlignment']
      if (halign) {
        const alignMap: Record<string, string> = {
          'Text.AlignLeft': 'left',
          'Text.AlignRight': 'right',
          'Text.AlignHCenter': 'center',
          'AlignLeft': 'left',
          'AlignRight': 'right',
          'AlignHCenter': 'center',
        }
        styles['text-align'] = alignMap[halign] || halign
      }

      const valign = props['verticalAlignment']
      if (valign) {
        const alignMap: Record<string, string> = {
          'Text.AlignTop': 'flex-start',
          'Text.AlignBottom': 'flex-end',
          'Text.AlignVCenter': 'center',
          'AlignTop': 'flex-start',
          'AlignBottom': 'flex-end',
          'AlignVCenter': 'center',
        }
        styles['display'] = 'flex'
        styles['align-items'] = alignMap[valign] || valign
      }

      return styles
    },
    renderContent: (props) => {
      return escapeHTML(props.text || '')
    },
  },

  Image: {
    tag: 'div',
    computeStyles: (props) => {
      const styles: StyleMap = {
        'overflow': 'hidden',
      }

      if (props.source) {
        styles['background-size'] = mapFillMode(props.fillMode)
        styles['background-position'] = 'center'
        styles['background-repeat'] = 'no-repeat'
        styles['background-image'] = `url("${escapeAttr(props.source)}")`
      }

      return styles
    },
  },

  Item: {
    tag: 'div',
    computeStyles: () => ({}),
  },

  Row: {
    tag: 'div',
    computeStyles: (props) => {
      const styles: StyleMap = {
        'display': 'flex',
        'flex-direction': 'row',
        'justify-content': 'flex-start',
        'align-items': 'flex-start',
        'gap': DEFAULT_LAYOUT_SPACING,
      }
      if (props.spacing) {
        styles['gap'] = toCSSPx(props.spacing)
      }
      if (props.padding || props.topPadding || props.leftPadding) {
        styles['padding'] = toCSSPx(props.padding || '0')
      }
      return styles
    },
  },

  Column: {
    tag: 'div',
    computeStyles: (props) => {
      const styles: StyleMap = {
        'display': 'flex',
        'flex-direction': 'column',
        'justify-content': 'flex-start',
        'align-items': 'flex-start',
        'gap': DEFAULT_LAYOUT_SPACING,
      }
      if (props.spacing) {
        styles['gap'] = toCSSPx(props.spacing)
      }
      if (props.padding) {
        styles['padding'] = toCSSPx(props.padding)
      }
      return styles
    },
  },

  // QML Quick Controls element mappings

  // RowLayout and ColumnLayout are equivalent to Row / Column
  RowLayout: {
    tag: 'div',
    computeStyles: (props) => {
      const styles: StyleMap = {
        'display': 'flex',
        'flex-direction': 'row',
        'justify-content': 'flex-start',
        'align-items': 'flex-start',
        'gap': DEFAULT_LAYOUT_SPACING,
      }
      if (props.spacing) styles['gap'] = toCSSPx(props.spacing)
      return styles
    },
  },

  ColumnLayout: {
    tag: 'div',
    computeStyles: (props) => {
      const styles: StyleMap = {
        'display': 'flex',
        'flex-direction': 'column',
        'justify-content': 'flex-start',
        'align-items': 'flex-start',
        'gap': DEFAULT_LAYOUT_SPACING,
      }
      if (props.spacing) styles['gap'] = toCSSPx(props.spacing)
      return styles
    },
  },

  Flickable: {
    tag: 'div',
    computeStyles: () => ({
      'overflow': 'auto',
    }),
  },

  ScrollView: {
    tag: 'div',
    computeStyles: () => ({
      'overflow': 'auto',
    }),
  },

  GridLayout: {
    tag: 'div',
    computeStyles: (props) => {
      const styles: StyleMap = {
        'display': 'grid',
        'gap': DEFAULT_LAYOUT_SPACING,
        'justify-items': 'start',
        'align-items': 'start',
      }
      if (props.spacing) styles['gap'] = toCSSPx(props.spacing)
      const cols = parseNumeric(props.columns || '')
      if (cols && cols > 0) {
        styles['grid-template-columns'] = `repeat(${Math.floor(cols)}, minmax(0, auto))`
      }
      return styles
    },
  },

  Flow: {
    tag: 'div',
    computeStyles: (props) => {
      const styles: StyleMap = {
        'display': 'flex',
        'flex-wrap': 'wrap',
        'gap': DEFAULT_LAYOUT_SPACING,
        'justify-content': 'flex-start',
        'align-items': 'flex-start',
        'align-content': 'flex-start',
      }
      if (props.spacing) styles['gap'] = toCSSPx(props.spacing)
      return styles
    },
  },

  Repeater: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'contents',
    }),
  },

  ListModel: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'none',
    }),
  },

  ListElement: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'none',
    }),
  },

  Connections: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'none',
    }),
  },

  Component: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'contents',
    }),
  },

  Loader: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'block',
      'position': 'relative',
      'min-height': '1px',
    }),
    getAttributes: (props) => ({
      'data-qml-loader': 'true',
      'data-qml-active': props.active || 'true',
    }),
  },

  ScrollBar: {
    tag: 'div',
    computeStyles: (props) => {
      const horizontal = props.orientation === 'Qt.Horizontal'
      const attached = props.__attached === 'true'
      return {
        'display': 'block',
        'position': attached ? 'absolute' : 'relative',
        'right': attached && !horizontal ? '2px' : 'auto',
        'bottom': attached ? '2px' : 'auto',
        'width': horizontal ? (attached ? 'calc(100% - 4px)' : '120px') : '8px',
        'height': horizontal ? '8px' : (attached ? 'calc(100% - 4px)' : '120px'),
        'border-radius': '4px',
        'background': 'rgba(127,127,127,.18)',
        'opacity': props.active === 'false' ? '.45' : '1',
        'overflow': 'hidden',
      }
    },
    renderContent: (props) => {
      const horizontal = props.orientation === 'Qt.Horizontal'
      const size = Math.max(0.05, Math.min(1, parseFloat(props.size || '.3') || .3))
      const position = Math.max(0, Math.min(1 - size, parseFloat(props.position || '0') || 0))
      const style = horizontal
        ? `left:${position * 100}%;top:0;width:${size * 100}%;height:100%`
        : `left:0;top:${position * 100}%;width:100%;height:${size * 100}%`
      return `<span style="position:absolute;${style};border-radius:4px;background:rgba(127,127,127,.72)"></span>`
    },
    getAttributes: (props) => ({
      'data-qml-type': 'scrollbar',
      'data-qml-orientation': props.orientation || 'Qt.Vertical',
      'data-qml-attached': props.__attached || 'false',
    }),
  },

  GroupBox: {
    tag: 'fieldset',
    computeStyles: () => {
      return {
        'border': '1px solid var(--qml-control-border)',
        'border-radius': '6px',
        'padding': '12px',
      }
    },
    renderContent: (props) => props.title
      ? `<legend style="padding:0 6px;font-size:13px;font-weight:600;color:var(--qml-control-text)">${escapeHTML(props.title)}</legend>`
      : '',
  },

  Button: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
      'padding': '6px 16px',
      'background': 'var(--qml-btn-bg)',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '4px',
      'font-size': '13px',
      'cursor': 'pointer',
      'user-select': 'none',
      'transition': 'transform 0.1s, background 0.2s',
    }),
    getAttributes: (props) => withSignalAttrs(props, 'button'),
  },

  RoundButton: {
    tag: 'div',
    computeStyles: (props) => ({
      'display': 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
      'width': '32px',
      'height': '32px',
      'background': 'var(--qml-btn-bg)',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': props.radius ? toCSSPx(props.radius) : '9999px',
      'font-size': '13px',
      'font-weight': 'bold',
      'cursor': 'pointer',
      'user-select': 'none',
      'transition': 'transform 0.1s',
    }),
    getAttributes: (props) => withSignalAttrs(props, 'roundbutton'),
  },

  ToolButton: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
      'padding': '4px 8px',
      'background': 'transparent',
      'border': '1px solid transparent',
      'border-radius': '4px',
      'font-size': '13px',
      'cursor': 'pointer',
      'transition': 'background 0.2s',
    }),
    getAttributes: (props) => withSignalAttrs(props, 'toolbutton'),
  },

  CheckBox: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'flex',
      'align-items': 'center',
      'gap': '6px',
      'cursor': 'pointer',
      'font-size': '13px',
      'user-select': 'none',
    }),
    renderContent: (props) => {
      return `<span class="qml-cb-marker"></span><span class="qml-cb-text">${escapeHTML(props.text || '')}</span>`
    },
    getAttributes: (props) => withSignalAttrs(props, 'checkbox', {
      'data-qml-checked': props.checked === 'true' ? 'true' : 'false',
      'data-qml-text': props.text || '',
      'data-qml-id': uid(),
    }),
  },

  RadioButton: {
    tag: 'label',
    computeStyles: () => ({
      'display': 'flex',
      'align-items': 'center',
      'gap': '6px',
      'cursor': 'pointer',
      'font-size': '13px',
      'user-select': 'none',
    }),
    renderContent: (props) => {
      return `<span class="qml-radio-marker"></span><span class="qml-cb-text">${escapeHTML(props.text || '')}</span>`
    },
    getAttributes: (props) => withSignalAttrs(props, 'radio', {
      'data-qml-checked': props.checked === 'true' ? 'true' : 'false',
      'data-qml-group': props['ButtonGroup.group'] || props.Group || props.group || 'default',
      'data-qml-text': props.text || '',
      'data-qml-id': uid(),
    }),
  },

  Switch: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'inline-flex',
      'align-items': 'center',
      'gap': '6px',
      'font-size': '13px',
      'cursor': 'pointer',
      'user-select': 'none',
    }),
    renderContent: (props) => {
      const on = props.checked === 'true'
      return `<span style="display:inline-block;width:36px;height:18px;background:${on ? 'var(--qml-switch-on,#4cd964)' : 'var(--qml-switch-off)'};border-radius:9px;position:relative;transition:0.2s"><span style="display:block;width:14px;height:14px;background:var(--qml-control-bg);border-radius:50%;position:absolute;top:2px;${on ? 'right:2px' : 'left:2px'};transition:0.2s"></span></span><span class="qml-cb-text">${escapeHTML(props.text || '')}</span>`
    },
    getAttributes: (props) => withSignalAttrs(props, 'switch', {
      'data-qml-checked': props.checked === 'true' ? 'true' : 'false',
      'data-qml-id': uid(),
    }),
  },

  Slider: {
    tag: 'div',
    computeStyles: (props) => {
      const val = parseFloat(props.value || '0')
      const from = parseFloat(props.from || '0')
      const to = parseFloat(props.to || '100')
      const range = to - from
      const pct = range === 0 ? 0 : Math.min(100, Math.max(0, ((val - from) / range) * 100))
      return {
        'position': 'relative',
        'height': '20px',
        'min-width': '140px',
        'padding': '8px 0',
        'cursor': 'pointer',
      }
    },
    renderContent: (props) => {
      const val = parseFloat(props.value || '0')
      const from = parseFloat(props.from || '0')
      const to = parseFloat(props.to || '100')
      const range = to - from
      const pct = range === 0 ? 0 : Math.min(100, Math.max(0, ((val - from) / range) * 100))
      return `<span class="qml-slider-track" style="display:block;position:relative;height:4px;border-radius:2px;background:var(--qml-slider-track);overflow:visible;"><span class="qml-slider-fill" style="display:block;position:absolute;left:0;top:0;height:100%;width:${pct}%;background:var(--qml-accent);"></span><span class="qml-slider-thumb" style="display:block;position:absolute;top:50%;left:calc(${pct}% - 7px);width:14px;height:14px;border-radius:50%;background:var(--qml-control-bg);border:2px solid var(--qml-accent);transform:translateY(-50%);"></span></span>`
    },
    getAttributes: (props) => withSignalAttrs(props, 'slider', {
      'data-qml-value': props.value || '0',
      'data-qml-from': props.from || '0',
      'data-qml-to': props.to || '100',
      'data-qml-id': uid(),
    }),
  },

  RangeSlider: {
    tag: 'div',
    computeStyles: () => ({
      'position': 'relative',
      'height': '20px',
      'min-width': '180px',
      'padding': '8px 0',
      'cursor': 'pointer',
    }),
    renderContent: (props) => {
      const from = parseFloat(props.from || '0')
      const to = parseFloat(props.to || '100')
      const first = parseFloat(props['first.value'] || props.value || props.from || '0')
      const second = parseFloat(props['second.value'] || props.to || '100')
      const range = to - from || 1
      const p1 = Math.min(100, Math.max(0, ((first - from) / range) * 100))
      const p2 = Math.min(100, Math.max(0, ((second - from) / range) * 100))
      const left = Math.min(p1, p2)
      const right = Math.max(p1, p2)
      return `<span class="qml-range-track" style="display:block;position:relative;height:4px;border-radius:2px;background:var(--qml-slider-track)"><span class="qml-range-fill" style="display:block;position:absolute;left:${left}%;width:${Math.max(0, right - left)}%;height:100%;background:var(--qml-accent)"></span><span class="qml-range-first" style="position:absolute;left:calc(${left}% - 6px);top:50%;width:12px;height:12px;border-radius:50%;transform:translateY(-50%);background:var(--qml-control-bg);border:2px solid var(--qml-accent)"></span><span class="qml-range-second" style="position:absolute;left:calc(${right}% - 6px);top:50%;width:12px;height:12px;border-radius:50%;transform:translateY(-50%);background:var(--qml-control-bg);border:2px solid var(--qml-accent)"></span></span>`
    },
    getAttributes: (props) => withSignalAttrs(props, 'rangeslider', {
      'data-qml-first': props['first.value'] || props.from || '0',
      'data-qml-second': props['second.value'] || props.to || '100',
      'data-qml-from': props.from || '0',
      'data-qml-to': props.to || '100',
      'data-qml-id': uid(),
    }),
  },

  Dial: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
      'width': '44px',
      'height': '44px',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '50%',
      'background': 'var(--qml-control-bg)',
      'position': 'relative',
    }),
    renderContent: (props) => {
      const from = parseFloat(props.from || '0')
      const to = parseFloat(props.to || '100')
      const value = parseFloat(props.value || '0')
      const range = to - from || 1
      const p = Math.min(1, Math.max(0, (value - from) / range))
      const angle = -135 + p * 270
      return `<span class="qml-dial-needle" style="position:absolute;left:50%;top:calc(50% - 13px);display:block;width:2px;height:14px;background:var(--qml-accent);transform:rotate(${angle}deg);transform-origin:center bottom;"></span>`
    },
    getAttributes: (props) => withSignalAttrs(props, 'dial', {
      'data-qml-value': props.value || '0',
      'data-qml-from': props.from || '0',
      'data-qml-to': props.to || '100',
      'data-qml-id': uid(),
    }),
  },

  SpinBox: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'inline-flex',
      'align-items': 'stretch',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '4px',
      'overflow': 'hidden',
      'background': 'var(--qml-control-bg)',
      'color': 'var(--qml-control-text)',
      'min-width': '90px',
      'font-size': '13px',
      'user-select': 'none',
    }),
    renderContent: (props) => {
      const value = props.value || '0'
      return `<span class="qml-spinbox-dec" style="padding:6px 8px;cursor:pointer;border-right:1px solid var(--qml-control-border)">-</span><span class="qml-spinbox-value" style="padding:6px 10px;min-width:36px;text-align:center">${escapeHTML(value)}</span><span class="qml-spinbox-inc" style="padding:6px 8px;cursor:pointer;border-left:1px solid var(--qml-control-border)">+</span>`
    },
    getAttributes: (props) => withSignalAttrs(props, 'spinbox', {
      'data-qml-value': props.value || '0',
      'data-qml-from': props.from || '0',
      'data-qml-to': props.to || '99',
      'data-qml-step': props.stepSize || '1',
      'data-qml-id': uid(),
    }),
  },

  Tumbler: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'inline-flex',
      'flex-direction': 'column',
      'justify-content': 'center',
      'align-items': 'center',
      'min-width': '80px',
      'height': '80px',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '4px',
      'background': 'var(--qml-control-bg)',
      'color': 'var(--qml-control-text)',
      'font-size': '12px',
      'overflow': 'hidden',
    }),
    renderContent: (props) => {
      const idx = parseInt(props.currentIndex || '0', 10)
      const model = props.model || '[]'
      let items: string[] = []
      try { items = JSON.parse(model) } catch { items = [] }
      const current = items[idx] ?? `${idx}`
      return `<span class="qml-tumbler-up" style="opacity:.45;cursor:pointer">▲</span><span class="qml-tumbler-value" style="font-weight:600;padding:4px 0">${escapeHTML(String(current))}</span><span class="qml-tumbler-down" style="opacity:.45;cursor:pointer">▼</span>`
    },
    getAttributes: (props) => withSignalAttrs(props, 'tumbler', {
      'data-qml-model': props.model || '[]',
      'data-qml-currentindex': props.currentIndex || '0',
      'data-qml-id': uid(),
    }),
  },

  DelayButton: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
      'position': 'relative',
      'overflow': 'hidden',
      'padding': '6px 16px',
      'background': 'var(--qml-btn-bg)',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '4px',
      'font-size': '13px',
      'cursor': 'pointer',
      'user-select': 'none',
    }),
    renderContent: (props) => {
      const text = escapeHTML(props.text || 'Delay')
      return `<span class="qml-delay-fill" style="position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(0,120,212,.22)"></span><span style="position:relative">${text}</span>`
    },
    getAttributes: (props) => withSignalAttrs(props, 'delaybutton', {
      'data-qml-delay': props.delay || '800',
      'data-qml-id': uid(),
    }),
  },

  ProgressBar: {
    tag: 'div',
    computeStyles: (props) => {
      const pct = Math.min(100, Math.max(0, parseFloat(props.value || '0') * 100))
      return {
        'position': 'relative',
        'height': '8px',
        'background': 'var(--qml-progress-bg)',
        'border-radius': '4px',
        'overflow': 'hidden',
        ...(isNaN(pct) ? {} : {
          'background': `linear-gradient(to right, var(--qml-accent) ${pct}%, var(--qml-progress-bg) ${pct}%)`,
        }),
      }
    },
  },

  TextField: {
    tag: 'input',
    computeStyles: (props) => ({
      'display': 'block',
      'width': '100%',
      'padding': '6px 10px',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '4px',
      'font-size': '13px',
      'background': 'var(--qml-control-bg)',
      'color': 'var(--qml-control-text)',
      'box-sizing': 'border-box',
      ...(props.echoMode === 'TextInput.NoEcho' ? { 'color': 'transparent', 'caret-color': 'var(--qml-control-text)' } : {}),
    }),
    getAttributes: (props) => ({
      'type': props.echoMode && props.echoMode !== 'TextInput.Normal' ? 'password' : 'text',
      'placeholder': props.placeholderText || '',
      'value': props.text || '',
      ...(props.readOnly === 'true' ? { readonly: 'readonly' } : {}),
    }),
  },

  TextInput: {
    tag: 'input',
    computeStyles: (props) => ({
      'display': 'block',
      'width': '100%',
      'padding': '0',
      'border': 'none',
      'outline': 'none',
      'font': 'inherit',
      'background': 'transparent',
      'color': props.echoMode === 'TextInput.NoEcho' ? 'transparent' : 'var(--qml-control-text)',
      'caret-color': 'var(--qml-control-text)',
      'box-sizing': 'border-box',
    }),
    getAttributes: (props) => ({
      'type': props.echoMode && props.echoMode !== 'TextInput.Normal' ? 'password' : 'text',
      'value': props.text || '',
      ...(props.readOnly === 'true' ? { readonly: 'readonly' } : {}),
    }),
  },

  TextArea: {
    tag: 'textarea',
    computeStyles: (props) => ({
      'display': 'block',
      'width': '100%',
      'min-height': props.implicitHeight ? toCSSPx(props.implicitHeight) : '60px',
      'padding': '6px 10px',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '4px',
      'font-size': '13px',
      'font-family': 'inherit',
      'background': 'var(--qml-control-bg)',
      'color': 'var(--qml-control-text)',
      'box-sizing': 'border-box',
      'resize': 'vertical',
      'white-space': props.wrapMode === 'TextEdit.NoWrap' ? 'pre' : 'pre-wrap',
      'overflow-wrap': props.wrapMode === 'TextEdit.WrapAnywhere' ? 'anywhere' : 'normal',
    }),
    getAttributes: (props) => ({
      'placeholder': props.placeholderText || '',
      ...(props.readOnly === 'true' ? { readonly: 'readonly' } : {}),
      ...(props.wrapMode === 'TextEdit.NoWrap' ? { wrap: 'off' } : {}),
    }),
  },

  TextEdit: {
    tag: 'textarea',
    computeStyles: (props) => ({
      'display': 'block',
      'width': '100%',
      'min-height': props.implicitHeight ? toCSSPx(props.implicitHeight) : '40px',
      'padding': '0',
      'border': 'none',
      'outline': 'none',
      'font': 'inherit',
      'background': 'transparent',
      'color': 'var(--qml-control-text)',
      'resize': 'none',
      'white-space': props.wrapMode === 'TextEdit.NoWrap' ? 'pre' : 'pre-wrap',
      'overflow-wrap': props.wrapMode === 'TextEdit.WrapAnywhere' ? 'anywhere' : 'normal',
    }),
    getAttributes: (props) => ({
      ...(props.readOnly === 'true' ? { readonly: 'readonly' } : {}),
      ...(props.wrapMode === 'TextEdit.NoWrap' ? { wrap: 'off' } : {}),
    }),
  },

  ComboBox: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'flex',
      'align-items': 'center',
      'justify-content': 'space-between',
      'padding': '6px 10px',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '4px',
      'font-size': '13px',
      'background': 'var(--qml-control-bg)',
      'color': 'var(--qml-control-text)',
      'cursor': 'pointer',
      'user-select': 'none',
    }),
    renderContent: (props) => {
      const placeholder = props.placeholderText || 'Select...'
      let items: unknown[] = []
      try {
        const parsed = JSON.parse(props.model || '[]')
        if (Array.isArray(parsed)) items = parsed
      } catch {
        items = []
      }
      const currentIndex = parseInt(props.currentIndex ?? (items.length ? '0' : '-1'), 10)
      const currentItem = items[currentIndex]
      const textRole = props.textRole || 'text'
      const currentText = currentItem && typeof currentItem === 'object'
        ? String((currentItem as Record<string, unknown>)[textRole] ?? '')
        : currentItem === undefined ? '' : String(currentItem)
      const label = props.editable === 'true'
        ? `<input class="qml-combo-input" type="text" value="${escapeAttr(props.editText || currentText)}" placeholder="${escapeAttr(placeholder)}" style="flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--qml-control-text);font:inherit" />`
        : `<span style="flex:1;color:${currentText ? 'var(--qml-control-text)' : 'var(--qml-muted-text)'}">${escapeHTML(currentText || placeholder)}</span>`
      const dropdown = items.length
        ? `<span style="display:inline-flex;flex-direction:column;gap:2px;font-size:11px;color:var(--qml-muted-text)">▾</span>`
        : ''
      return `${label} ${dropdown}`
    },
    getAttributes: (props) => withSignalAttrs(props, 'combobox', {
      'data-qml-model': props.model || '[]',
      'data-qml-currentindex': props.currentIndex ?? '0',
      'data-qml-textrole': props.textRole || 'text',
      'data-qml-editable': props.editable || 'false',
      'data-qml-placeholdertext': props.placeholderText || 'Select...',
      'data-qml-id': uid(),
    }),
  },

  TabBar: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'flex',
      'gap': '2px',
      'border-bottom': '2px solid var(--qml-accent)',
    }),
    getAttributes: (props) => ({
      'data-qml-currentindex': props.currentIndex || '0',
    }),
  },

  TabButton: {
    tag: 'div',
    computeStyles: () => ({
      'padding': '8px 16px',
      'font-size': '13px',
      'cursor': 'pointer',
      'border-bottom': '2px solid transparent',
      'color': 'var(--qml-muted-text)',
      'user-select': 'none',
      'transition': 'border-color 0.2s, color 0.2s',
    }),
    getAttributes: (props) => withSignalAttrs(props, 'tabbutton'),
  },

  StackLayout: {
    tag: 'div',
    computeStyles: () => ({
      'position': 'relative',
      'min-height': '40px',
    }),
    getAttributes: (props) => ({
      'data-qml-currentindex': props.currentIndex || '0',
    }),
  },

  SwipeView: {
    tag: 'div',
    computeStyles: () => ({
      'position': 'relative',
      'overflow': 'hidden',
      'min-height': '40px',
      'border': '1px solid var(--qml-list-border)',
      'border-radius': '4px',
    }),
    getAttributes: (props) => ({
      'data-qml-type': 'swipeview',
      'data-qml-currentindex': props.currentIndex || '0',
    }),
  },

  StackView: {
    tag: 'div',
    computeStyles: () => ({
      'position': 'relative',
      'overflow': 'hidden',
      'min-height': '40px',
      'border': '1px solid var(--qml-list-border)',
      'border-radius': '4px',
    }),
    getAttributes: (props) => ({
      'data-qml-type': 'stackview',
      'data-qml-currentindex': props.currentIndex || '0',
    }),
  },

  SplitView: {
    tag: 'div',
    computeStyles: (props) => ({
      'display': 'flex',
      'flex-direction': props.orientation === 'Qt.Vertical' ? 'column' : 'row',
      'gap': DEFAULT_LAYOUT_SPACING,
      'align-items': 'stretch',
      'justify-content': 'stretch',
    }),
  },

  Page: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'block',
      'border': '1px solid var(--qml-list-border)',
      'border-radius': '6px',
      'padding': '10px',
      'background': 'var(--qml-control-bg)',
    }),
  },

  Pane: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'block',
      'border': '1px solid var(--qml-list-border)',
      'border-radius': '6px',
      'padding': '10px',
      'background': 'var(--qml-control-bg)',
    }),
  },

  Frame: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'block',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '4px',
      'padding': '8px',
      'background': 'var(--qml-control-bg)',
    }),
  },

  Drawer: {
    tag: 'div',
    computeStyles: (props) => ({
      'display': 'block',
      'position': 'relative',
      'width': props.width ? toCSSPx(props.width) : '240px',
      'min-height': props.height ? toCSSPx(props.height) : '48px',
      'background': 'var(--qml-control-bg)',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '6px',
      'padding': '10px',
    }),
  },

  Popup: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'block',
      'position': 'relative',
      'min-width': '120px',
      'min-height': '40px',
      'padding': '10px',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '6px',
      'background': 'var(--qml-dialog-bg)',
      'box-shadow': '0 4px 12px var(--qml-dialog-shadow)',
    }),
  },

  ToolTip: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'inline-block',
      'padding': '4px 8px',
      'font-size': '12px',
      'color': 'var(--qml-control-bg)',
      'background': 'var(--qml-control-text)',
      'border-radius': '4px',
    }),
  },

  ListView: {
    tag: 'div',
    computeStyles: () => ({
      'overflow': 'auto',
      'border': '1px solid var(--qml-list-border)',
      'border-radius': '4px',
    }),
    getAttributes: (props) => withSignalAttrs(props, 'listview', {
      'data-qml-currentindex': props.currentIndex || '-1',
    }),
  },

  GridView: {
    tag: 'div',
    computeStyles: (props) => ({
      'display': 'grid',
      'grid-template-columns': `repeat(auto-fill, minmax(${toCSSPx(props.cellWidth || '96')}, 1fr))`,
      'grid-auto-rows': toCSSPx(props.cellHeight || '48'),
      'gap': DEFAULT_LAYOUT_SPACING,
      'overflow': 'auto',
      'border': '1px solid var(--qml-list-border)',
      'border-radius': '4px',
    }),
    getAttributes: (props) => withSignalAttrs(props, 'gridview', {
      'data-qml-currentindex': props.currentIndex || '-1',
    }),
  },

  PathView: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'block',
      'position': 'relative',
      'overflow': 'hidden',
      'border': '1px solid var(--qml-list-border)',
      'border-radius': '4px',
      'padding': '6px',
    }),
    getAttributes: (props) => withSignalAttrs(props, 'pathview', {
      'data-qml-currentindex': props.currentIndex || '-1',
    }),
  },

  TableView: {
    tag: 'div',
    computeStyles: () => ({
      'overflow': 'auto',
      'border': '1px solid var(--qml-list-border)',
      'border-radius': '4px',
      'padding': '4px',
      'font-size': '12px',
    }),
    getAttributes: (props) => withSignalAttrs(props, 'tableview', {
      'data-qml-currentindex': props.currentIndex || '-1',
      'data-qml-model-ref': props.model || '',
      'data-qml-columns': props.columns || '[]',
      'data-qml-headers': props.headers || props.columns || '[]',
      'data-qml-editable': props.editable || 'false',
      'data-qml-selectionmode': props.selectionMode || 'SingleSelection',
      'data-qml-resizablecolumns': props.resizableColumns || 'false',
      'data-qml-columnwidths': props.columnWidths || '[]',
    }),
  },

  TreeView: {
    tag: 'div',
    computeStyles: () => ({
      'overflow': 'auto',
      'border': '1px solid var(--qml-list-border)',
      'border-radius': '4px',
      'padding': '6px',
      'font-size': '12px',
    }),
    getAttributes: (props) => withSignalAttrs(props, 'treeview', {
      'data-qml-currentindex': props.currentIndex || '-1',
      'data-qml-model-ref': props.model || '',
      'data-qml-idrole': props.idRole || 'nodeId',
      'data-qml-parentrole': props.parentRole || 'parentId',
      'data-qml-textrole': props.textRole || 'text',
      'data-qml-expanded': props.expanded || 'true',
      'data-qml-selectionmode': props.selectionMode || 'SingleSelection',
    }),
  },

  HorizontalHeaderView: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'flex',
      'gap': '1px',
      'padding': '2px',
      'background': 'var(--qml-menubar-bg)',
      'border': '1px solid var(--qml-list-border)',
      'font-size': '12px',
    }),
  },

  VerticalHeaderView: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'flex',
      'flex-direction': 'column',
      'gap': '1px',
      'padding': '2px',
      'background': 'var(--qml-menubar-bg)',
      'border': '1px solid var(--qml-list-border)',
      'font-size': '12px',
    }),
  },

  ItemDelegate: {
    tag: 'div',
    computeStyles: () => ({
      'padding': '8px 12px',
      'border-bottom': '1px solid var(--qml-item-border)',
      'font-size': '13px',
      'cursor': 'pointer',
    }),
    getAttributes: (props) => withSignalAttrs(props, 'itemdelegate', {
      'data-qml-index': props.__index || '-1',
      'tabindex': '0',
    }),
  },

  BusyIndicator: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
      'width': '24px',
      'height': '24px',
      'border': '3px solid var(--qml-spinner-border)',
      'border-top': '3px solid var(--qml-accent)',
      'border-radius': '50%',
      'animation': 'qml-spin 0.8s linear infinite',
    }),
    renderContent: () => '',
  },

  ScrollIndicator: {
    tag: 'div',
    computeStyles: () => ({
      'position': 'absolute',
      'right': '2px',
      'top': '2px',
      'bottom': '2px',
      'width': '4px',
      'border-radius': '2px',
      'background': 'rgba(127,127,127,.35)',
      'pointer-events': 'none',
    }),
  },

  ApplicationWindow: {
    tag: 'div',
    computeStyles: (_props) => ({
      'position': 'relative',
      'overflow': 'hidden',
      'border': '1px solid var(--qml-window-border)',
      'background': 'var(--qml-window-bg)',
      'box-shadow': '0 2px 8px var(--qml-window-shadow)',
    }),
  },

  Window: {
    tag: 'div',
    computeStyles: () => ({
      'position': 'relative',
      'overflow': 'hidden',
      'border': '1px solid var(--qml-window-border)',
      'background': 'var(--qml-window-bg)',
      'box-shadow': '0 2px 8px var(--qml-window-shadow)',
    }),
  },

  Dialog: {
    tag: 'div',
    computeStyles: (props) => ({
      'display': 'none',
      'position': 'relative',
      'margin': '16px',
      'min-width': props.width ? '0' : '320px',
      'min-height': props.height ? '0' : '160px',
      'max-width': 'min(640px, calc(100vw - 64px))',
      'max-height': 'calc(100vh - 96px)',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '8px',
      'background': 'var(--qml-dialog-bg)',
      'box-shadow': '0 4px 12px var(--qml-dialog-shadow)',
      'padding': '0',
      'overflow': 'hidden',
    }),
  },

  MenuBar: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'flex',
      'gap': '2px',
      'padding': '4px 8px',
      'background': 'var(--qml-menubar-bg)',
      'border-bottom': '1px solid var(--qml-menubar-border)',
      'min-height': '30px',
    }),
  },

  Menu: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'inline-block',
      'position': 'relative',
      'padding': '4px 12px',
      'font-size': '13px',
      'cursor': 'pointer',
      'user-select': 'none',
      'border-radius': '4px',
    }),
    renderContent: (props) => escapeHTML(props.title || ''),
    getAttributes: () => ({ 'data-qml-type': 'menu' }),
  },

  MenuItem: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'none',
      'padding': '4px 16px',
      'font-size': '13px',
      'cursor': 'pointer',
      'white-space': 'nowrap',
    }),
    getAttributes: (props) => withSignalAttrs(props, 'menuitem'),
  },

  MenuSeparator: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'block',
      'height': '1px',
      'margin': '4px 8px',
      'background': 'var(--qml-control-border)',
    }),
  },

  Action: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'none',
    }),
  },

  ActionGroup: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'none',
    }),
  },

  Shortcut: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'none',
    }),
  },

  Calendar: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'grid',
      'grid-template-columns': 'repeat(7, 1fr)',
      'gap': '2px',
      'padding': '8px',
      'border': '1px solid var(--qml-list-border)',
      'border-radius': '6px',
      'font-size': '12px',
      'background': 'var(--qml-control-bg)',
    }),
    renderContent: () => '',
    getAttributes: (props) => withSignalAttrs(props, 'calendar', {
      'data-qml-selecteddate': props.selectedDate || '',
      'data-qml-displayedmonth': props.displayedMonth || props.selectedDate || '',
      'data-qml-locale': props.locale || '',
    }),
  },

  DatePicker: {
    tag: 'input',
    computeStyles: () => ({
      'display': 'block',
      'padding': '6px 10px',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '4px',
      'font-size': '13px',
      'background': 'var(--qml-control-bg)',
      'color': 'var(--qml-control-text)',
    }),
    getAttributes: (props) => ({
      'type': 'date',
      'value': props.date || props.value || '',
    }),
  },

  TimePicker: {
    tag: 'input',
    computeStyles: () => ({
      'display': 'block',
      'padding': '6px 10px',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '4px',
      'font-size': '13px',
      'background': 'var(--qml-control-bg)',
      'color': 'var(--qml-control-text)',
    }),
    getAttributes: (props) => ({
      'type': 'time',
      'value': props.time || props.value || '',
    }),
  },

  ShaderEffect: {
    tag: 'div',
    computeStyles: (props) => ({
      'display': 'block',
      'position': 'relative',
      'filter': props.opacity ? `opacity(${props.opacity})` : 'saturate(1.05)',
      'overflow': 'hidden',
    }),
  },

  DropShadow: {
    tag: 'div',
    computeStyles: (props) => ({
      'display': 'block',
      'position': 'relative',
      'filter': `drop-shadow(${toCSSPx(props.horizontalOffset || '0')} ${toCSSPx(props.verticalOffset || '6')} ${toCSSPx(props.radius || '14')} ${toCSSColor(props.color || 'rgba(0,0,0,.25)')})`,
    }),
  },

  OpacityMask: {
    tag: 'div',
    computeStyles: (props) => ({
      'display': 'block',
      'position': 'relative',
      'opacity': props.opacity || '1',
      ...(props.maskSource && /^(https?:|data:|\/)/.test(props.maskSource) ? {
        'mask-image': `url("${escapeAttr(props.maskSource)}")`,
        'mask-size': '100% 100%',
      } : {}),
    }),
  },

  ChartView: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      'min-height': '120px',
      'border': '1px solid var(--qml-list-border)',
      'border-radius': '6px',
      'background': 'linear-gradient(180deg, rgba(77,166,255,.12), rgba(77,166,255,.02))',
      'font-size': '12px',
      'color': 'var(--qml-muted-text)',
    }),
    renderContent: () => 'ChartView',
  },

  WebEngineView: {
    tag: 'iframe',
    computeStyles: () => ({
      'display': 'block',
      'width': '100%',
      'height': '100%',
      'border': '1px solid var(--qml-list-border)',
      'border-radius': '4px',
      'background': 'var(--qml-control-bg)',
    }),
    getAttributes: (props) => withSignalAttrs(props, 'webengineview', {
      'src': props.url || 'about:blank',
      'loading': 'lazy',
      'referrerpolicy': 'no-referrer-when-downgrade',
    }),
  },

  VideoOutput: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      'min-height': '120px',
      'background': '#111',
      'color': '#ddd',
      'border-radius': '6px',
      'border': '1px solid #333',
      'font-size': '12px',
    }),
    renderContent: (props) => {
      const source = props.source || ''
      if (!/^(https?:|blob:|data:|file:|\/|\.\/|\.\.\/)/.test(source)) return 'VideoOutput'
      const fit = props.fillMode === 'VideoOutput.Stretch' ? 'fill' : props.fillMode === 'VideoOutput.PreserveAspectCrop' ? 'cover' : 'contain'
      return `<video src="${escapeAttr(source)}" style="width:100%;height:100%;object-fit:${fit}" ${props.autoPlay === 'false' ? '' : 'autoplay'} ${props.muted === 'false' ? '' : 'muted'} ${props.controls === 'true' ? 'controls' : ''}></video>`
    },
  },

  Label: {
    tag: 'div',
    computeStyles: (props) => {
      const styles: StyleMap = {
        'white-space': 'pre-wrap',
        'overflow': 'hidden',
      }
      if (props.color) styles['color'] = toCSSColor(props.color)
      if (props['font.pixelSize']) styles['font-size'] = toCSSPx(props['font.pixelSize'])
      if (props['font.bold'] === 'true') styles['font-weight'] = 'bold'
      if (props['font.family']) styles['font-family'] = props['font.family']
      if (props['font.italic'] === 'true') styles['font-style'] = 'italic'
      return styles
    },
  },
}

export function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function escapeAttr(s: string): string {
  // Escape & first, then " — otherwise &quot; gets double-encoded to &amp;quot;
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function mapFillMode(fillMode: string | undefined): string {
  if (!fillMode) return 'contain'
  const map: Record<string, string> = {
    'Image.Stretch': '100% 100%',
    'Image.PreserveAspectFit': 'contain',
    'Image.PreserveAspectCrop': 'cover',
    'Image.Tile': 'auto',
  }
  return map[fillMode] || 'contain'
}
