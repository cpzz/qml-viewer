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

/** Auto-incrementing ID for interactive element identification */
let _nextId = 1
function uid(): string { return `iq-${_nextId++}` }

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
        'align-items': 'center',
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

  ScrollBar: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'none',
    }),
  },

  GroupBox: {
    tag: 'fieldset',
    computeStyles: (props) => {
      const styles: StyleMap = {
        'border': '1px solid var(--qml-control-border)',
        'border-radius': '6px',
        'padding': '12px',
      }
      if (props.title) {
        styles['border-top'] = 'none'
      }
      return styles
    },
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
    getAttributes: () => ({ 'data-qml-type': 'button' }),
  },

  RoundButton: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
      'width': '32px',
      'height': '32px',
      'background': 'var(--qml-btn-bg)',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '50%',
      'font-size': '13px',
      'font-weight': 'bold',
      'cursor': 'pointer',
      'user-select': 'none',
      'transition': 'transform 0.1s',
    }),
    getAttributes: () => ({ 'data-qml-type': 'roundbutton' }),
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
    getAttributes: () => ({ 'data-qml-type': 'toolbutton' }),
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
      const checked = props.checked === 'true'
      return `<span class="qml-cb-marker" style="font-size:16px;line-height:1">${checked ? '✓' : '☐'}</span><span class="qml-cb-text">${escapeHTML(props.text || '')}</span>`
    },
    getAttributes: (props) => ({
      'data-qml-type': 'checkbox',
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
      const checked = props.checked === 'true' ? '◉' : '○'
      return `<span style="font-size:16px;line-height:1">${checked}</span> ${escapeHTML(props.text || '')}`
    },
    getAttributes: (props) => ({
      'data-qml-type': 'radio',
      'data-qml-group': props.Group || props.group || 'default',
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
      return `<span style="display:inline-block;width:36px;height:18px;background:${on ? 'var(--qml-switch-on,#4cd964)' : 'var(--qml-switch-off)'};border-radius:9px;position:relative;transition:0.2s"><span style="display:block;width:14px;height:14px;background:var(--qml-control-bg);border-radius:50%;position:absolute;top:2px;${on ? 'right:2px' : 'left:2px'};transition:0.2s"></span></span>`
    },
    getAttributes: (props) => ({
      'data-qml-type': 'switch',
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
      const pct = Math.min(100, Math.max(0, ((val - from) / (to - from)) * 100))
      return {
        'position': 'relative',
        'height': '20px',
        'background': 'var(--qml-slider-track)',
        'border-radius': '4px',
        'cursor': 'pointer',
        ...(isNaN(pct) ? {} : {
          'background': `linear-gradient(to right, var(--qml-accent) ${pct}%, var(--qml-slider-track) ${pct}%)`,
        }),
      }
    },
    getAttributes: (props) => ({
      'data-qml-type': 'slider',
      'data-qml-value': props.value || '0',
      'data-qml-from': props.from || '0',
      'data-qml-to': props.to || '100',
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
    computeStyles: () => ({
      'display': 'block',
      'width': '100%',
      'padding': '6px 10px',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '4px',
      'font-size': '13px',
      'background': 'var(--qml-control-bg)',
      'color': 'var(--qml-control-text)',
      'box-sizing': 'border-box',
    }),
    getAttributes: (props) => ({
      'placeholder': props.placeholderText || '',
      'value': props.text || '',
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
    }),
    getAttributes: (props) => ({
      'placeholder': props.placeholderText || '',
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
      // Show placeholder text initially; currentIndex defaults to -1
      const placeholder = props.placeholderText || 'Select...'
      const hasItems = props.model && props.model !== '[]'
      const dropdown = hasItems
        ? `<span style="display:inline-flex;flex-direction:column;gap:2px;font-size:11px;color:var(--qml-muted-text)">▾</span>`
        : ''
      return `<span style="flex:1;color:var(--qml-muted-text)">${escapeHTML(placeholder)}</span> ${dropdown}`
    },
    getAttributes: (props) => ({
      'data-qml-type': 'combobox',
      'data-qml-model': props.model || '[]',
      'data-qml-currentindex': '-1',
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
    getAttributes: () => ({ 'data-qml-type': 'tabbutton' }),
  },

  StackLayout: {
    tag: 'div',
    computeStyles: () => ({
      'position': 'relative',
      'min-height': '40px',
    }),
  },

  ListView: {
    tag: 'div',
    computeStyles: () => ({
      'overflow': 'auto',
      'border': '1px solid var(--qml-list-border)',
      'border-radius': '4px',
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

  ApplicationWindow: {
    tag: 'div',
    computeStyles: (props) => ({
      'position': 'relative',
      'overflow': 'hidden',
    }),
  },

  Dialog: {
    tag: 'div',
    computeStyles: () => ({
      'display': 'none',
      'position': 'relative',
      'margin': '16px',
      'border': '1px solid var(--qml-control-border)',
      'border-radius': '8px',
      'background': 'var(--qml-dialog-bg)',
      'box-shadow': '0 4px 12px var(--qml-dialog-shadow)',
      'padding': '20px',
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
