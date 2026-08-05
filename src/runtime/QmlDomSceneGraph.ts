import { parseQmlColor, toCssColor } from './QmlColor'
import type { QmlDocumentInstance } from './QmlDocument'
import { QmlCanvasContext } from './QmlCanvasContext'
import { QmlEasing, resolveQmlEasing } from './QmlAnimation'
import { bridgeObjectById, QmlObject } from './QmlObject'
import { cssItemTransform, cssTransformOrigin } from './QmlItemGeometry'
import { createDomGrabProvider, registerItemGrabProvider } from './QmlItemGrab'

interface MountedNode {
  element: HTMLElement
  parent: QmlObject | null
  unsubscribe: Array<() => void>
  removeEvents: Array<() => void>
  anchorUnsubscribe: Array<() => void>
}

/** 所有会触发几何重算的 anchors 锚定属性 */
const anchorTargetProperties = [
  'anchors.fill',
  'anchors.centerIn',
  'anchors.left',
  'anchors.right',
  'anchors.top',
  'anchors.bottom',
  'anchors.horizontalCenter',
  'anchors.verticalCenter',
  'anchors.baseline',
] as const

/**
 * 解析锚定目标：属性值可能是
 * - QmlObject（直接引用，如测试里的 setInternalProperty）
 * - 'parent' / 'parent.left' 字符串（锚线引用，激活路径保留的原始值）
 * - 'someId.right' 字符串（锚定文档中其他对象的锚线）
 * - { __qmlObjectId } 标记（绑定求值后经 QuickJS 边界序列化的结果）
 */
function resolveAnchorTarget(value: unknown, parent: QmlObject | null, ids: ReadonlyMap<string, QmlObject> | null): QmlObject | null {
  if (value instanceof QmlObject) return value
  if (typeof value === 'string') {
    // 'parent' / 'parent.left' → 父对象
    if (value.startsWith('parent')) return parent
    // 'someId.left' → 文档中 id 指向的对象（去掉锚线后缀）
    const dotIndex = value.indexOf('.')
    if (dotIndex > 0) {
      return ids?.get(value.slice(0, dotIndex)) ?? null
    }
    return null
  }
  if (typeof value === 'object' && value !== null && typeof (value as { __qmlObjectId?: unknown }).__qmlObjectId === 'string') {
    return bridgeObjectById((value as { __qmlObjectId: string }).__qmlObjectId) ?? null
  }
  return null
}

function cssLength(value: unknown): string {
  if (typeof value === 'number') return `${value}px`
  return value == null ? '' : String(value)
}

function cssValue(value: unknown): string {
  return value == null ? '' : String(value)
}

/** 将 Qt QML 颜色值转成浏览器可识别的 CSS 颜色（解析失败返回空串） */
function cssColor(value: unknown): string {
  const color = parseQmlColor(value)
  return color ? toCssColor(color) : ''
}

/**
 * 解析继承属性（font.* 是 QML 继承属性）：从自身向上找第一个显式设置了
 * 该子属性的对象；若都没有显式设置，返回自身（或最近祖先）的当前值。
 */
function resolveInheritedFontProperty(
  object: QmlObject,
  name: string,
): unknown {
  let current: QmlObject | null = object
  let fallback: unknown
  while (current) {
    if (current.hasProperty(name)) {
      if (current.isExplicitlySet(name)) return current.getProperty(name)
      if (fallback === undefined) fallback = current.getProperty(name)
    }
    current = current.parent
  }
  return fallback
}

function modelRows(model: unknown): unknown[] {
  if (Array.isArray(model)) return [...model]
  if (model instanceof QmlObject && model.typeName === 'ListModel') {
    return model.children
      .filter(child => child.typeName === 'ListElement')
      .map(child => Object.fromEntries(child.getPropertyNames().map(name => [name, child.getProperty(name)])))
  }
  return []
}

function isVisualObject(object: QmlObject): boolean {
  return object.typeName !== 'Repeater' && object.hasProperty('x') && object.hasProperty('width') && object.hasProperty('visible')
}

function tagNameFor(object: QmlObject): keyof HTMLElementTagNameMap {
  if (['Canvas', 'ShaderEffect', 'ParticleSystem', 'ChartView'].includes(object.typeName)) return 'canvas'
  if (object.typeName === 'Image') return 'img'
  if (object.typeName === 'WebEngineView') return 'iframe'
  if (object.typeName === 'VideoOutput') return 'video'
  if (['Button', 'RoundButton', 'ToolButton', 'DelayButton', 'ItemDelegate', 'MenuItem', 'TabButton'].includes(object.typeName)) return 'button'
  if (object.typeName === 'ComboBox') return 'select'
  if (object.typeName === 'ProgressBar') return 'progress'
  if (['DatePicker', 'TimePicker'].includes(object.typeName)) return 'input'
  if (['TextArea', 'TextEdit'].includes(object.typeName)) return 'textarea'
  if (object.typeName === 'GroupBox') return 'fieldset'
  if (['CheckBox', 'RadioButton', 'Switch'].includes(object.typeName)) return 'div'
  if (['TextField', 'TextInput', 'SpinBox'].includes(object.typeName)) return 'input'
  if (['Slider', 'Dial'].includes(object.typeName)) return 'div'
  return 'div'
}

/**
 * 用浏览器 canvas 实测文本宽度（与渲染使用同一字体的真实度量，含可变宽度字符）。
 * jsdom / 无 canvas 环境下返回 null，由调用方回退到近似估算。
 */
let textMeasureCanvas: HTMLCanvasElement | null = null
function measureTextWidth(text: string, fontSize: number, fontFamily: string | undefined): number | null {
  if (typeof document === 'undefined') return null
  try {
    textMeasureCanvas ??= document.createElement('canvas')
    const ctx = textMeasureCanvas.getContext('2d')
    if (!ctx || typeof ctx.measureText !== 'function') return null
    ctx.font = `${fontSize}px ${fontFamily || 'sans-serif'}`
    const width = ctx.measureText(text).width
    return Number.isFinite(width) && width > 0 ? width : null
  } catch {
    return null
  }
}

function contentImplicitSize(object: QmlObject): { width: number; height: number } | null {
  const text = object.hasProperty('text') ? cssValue(object.getProperty('text')) : ''
  if (object.typeName === 'Text' || object.typeName === 'Label') {
    const pixelSize = Number(resolveInheritedFontProperty(object, 'font.pixelSize')) || 0
    const pointSize = Number(resolveInheritedFontProperty(object, 'font.pointSize')) || 0
    const fontSize = pixelSize > 0 ? pixelSize : pointSize > 0 ? pointSize * 4 / 3 : 16
    const fontFamily = cssValue(resolveInheritedFontProperty(object, 'font.family'))
    const lines = text.split('\n')
    const measuredWidths = lines.map(line => measureTextWidth(line, fontSize, fontFamily))
    const hasMeasured = measuredWidths.some(width => width !== null)
    return {
      // 优先用真实度量（可变字体下 0.6×charCount 会高估宽度 → 右侧留白）；不可用时回退估算
      width: Math.max(20, hasMeasured
        ? Math.ceil(Math.max(0, ...measuredWidths.map(width => width ?? 0)))
        : Math.ceil(Math.max(0, ...lines.map(line => line.length)) * fontSize * 0.6)),
      height: Math.ceil(Math.max(1, lines.length) * fontSize * 1.2),
    }
  }
  if (buttonTypes.has(object.typeName)) {
    const height = object.typeName === 'ItemDelegate'
      ? Number(object.getProperty('implicitHeight')) || 30
      : 30
    return { width: Math.max(64, text.length * 8 + 24), height }
  }
  if (checkTypes.has(object.typeName)) return { width: Math.max(24, text.length * 8 + 24), height: 20 }
  if (textInputTypes.has(object.typeName)) {
    const placeholder = cssValue(object.getProperty('placeholderText'))
    return { width: Math.max(120, Math.max(text.length, placeholder.length) * 8 + 24), height: 28 }
  }
  if (['Slider', 'RangeSlider'].includes(object.typeName)) return { width: 120, height: 24 }
  if (object.typeName === 'SpinBox') return { width: 96, height: 30 }
  if (object.typeName === 'ComboBox') return { width: 140, height: 30 }
  if (['DatePicker', 'TimePicker'].includes(object.typeName)) return { width: 140, height: 30 }
  if (object.typeName === 'ProgressBar') return { width: 120, height: 8 }
  if (object.typeName === 'Dial') return { width: 64, height: 64 }
  if (object.typeName === 'Tumbler') return { width: 80, height: 72 }
  if (object.typeName === 'BusyIndicator') return { width: 24, height: 24 }
  if (object.typeName === 'StackLayout') return { width: 120, height: 24 }
  if (object.typeName === 'HorizontalHeaderView') return { width: 120, height: 30 }
  return null
}

// Qt 标准：Item.baselineOffset = 基线在局部坐标中的 y 偏移（默认 0，即基线在顶部）。
// 文本控件（Text/Label）的 baselineOffset 为只读，≈ 字体 ascent（约 0.8 × fontSize）。
// 用户显式设置的 baselineOffset 优先（Item 上可写）。
function baselineOffsetFor(object: QmlObject): number {
  if (object.isExplicitlySet('baselineOffset')) {
    return Number(object.getProperty('baselineOffset')) || 0
  }
  if (object.typeName === 'Text' || object.typeName === 'Label') {
    const pixelSize = Number(resolveInheritedFontProperty(object, 'font.pixelSize')) || 0
    const pointSize = Number(resolveInheritedFontProperty(object, 'font.pointSize')) || 0
    const fontSize = pixelSize > 0 ? pixelSize : pointSize > 0 ? pointSize * 4 / 3 : 16
    return Math.round(fontSize * 0.8)
  }
  return 0
}

function focusPolicyAllows(policy: unknown, kind: 'tab' | 'click'): boolean {
  if (typeof policy === 'number') return (policy & (kind === 'tab' ? 1 : 2)) !== 0
  const value = String(policy)
  return value.includes('StrongFocus') || value.includes(kind === 'tab' ? 'TabFocus' : 'ClickFocus')
}

function isPropertyAssignedInHierarchy(object: QmlObject, name: string): boolean {
  for (let current: QmlObject | null = object; current; current = current.parent) {
    if (current.hasProperty(name) && current.isPropertyAssigned(name)) return true
  }
  return false
}

/** Resolves a palette role, preferring the disabled group when enabled=false. Returns null if not explicitly set anywhere. */
function resolveGroupedPaletteColor(object: QmlObject, role: string): string | null {
  const isDisabled = object.hasProperty('enabled') && !object.getProperty('enabled')
  if (isDisabled && isPropertyAssignedInHierarchy(object, `palette.disabled.${role}`)) {
    return cssValue(object.getProperty(`palette.disabled.${role}`))
  }
  if (isPropertyAssignedInHierarchy(object, `palette.${role}`)) {
    return cssValue(object.getProperty(`palette.${role}`))
  }
  return null
}

function orderedVisualChildren(object: QmlObject): QmlObject[] {
  const background = object.hasProperty('background') ? object.getProperty('background') : null
  const contentItem = object.hasProperty('contentItem') ? object.getProperty('contentItem') : null
  const loaderItem = object.typeName === 'Loader' ? object.getProperty('item') : null
  const highlightItem = object.hasProperty('highlightItem') ? object.getProperty('highlightItem') : null
  return [
    ...(background instanceof QmlObject ? [background] : []),
    ...(highlightItem instanceof QmlObject ? [highlightItem] : []),
    ...object.children.filter(child => child !== background && child !== contentItem && child !== loaderItem && child !== highlightItem),
    ...(contentItem instanceof QmlObject ? [contentItem] : []),
    ...(loaderItem instanceof QmlObject ? [loaderItem] : []),
  ]
}

function isPopup(object: QmlObject): boolean {
  return ['Popup', 'Dialog', 'Menu', 'Drawer', 'ToolTip'].includes(object.typeName)
}

const buttonTypes = new Set(['Button', 'RoundButton', 'ToolButton', 'DelayButton', 'ItemDelegate', 'MenuItem', 'TabButton'])
const checkTypes = new Set(['CheckBox', 'RadioButton', 'Switch'])
const textInputTypes = new Set(['TextField', 'TextInput', 'TextArea', 'TextEdit'])
const layoutTypes = new Set(['RowLayout', 'ColumnLayout', 'GridLayout', 'Flow'])
const contentContainerTypes = new Set(['Page', 'Pane', 'Frame', 'GroupBox'])
const viewportContainerTypes = new Set(['Flickable', 'SwipeView', 'StackView'])

function layoutMarginValue(object: QmlObject, side: 'left' | 'right' | 'top' | 'bottom'): number {
  const individual = Number(object.getProperty(`Layout.${side}Margin`))
  return individual >= 0 ? individual : Math.max(0, Number(object.getProperty('Layout.margins')) || 0)
}

function popupPolicyAllows(policy: unknown, kind: 'outside' | 'escape'): boolean {
  if (typeof policy === 'number') return (policy & (kind === 'outside' ? 1 : 2)) !== 0
  return String(policy).includes(kind === 'outside' ? 'CloseOnPressOutside' : 'CloseOnEscape')
}

function effectiveItemHeight(object: QmlObject, depth = 0): number {
  if (depth > 6) return 0
  const explicitHeight = Number(object.getProperty('height')) || 0
  if (explicitHeight > 0) return explicitHeight

  const implicitHeight = Number(object.getProperty('implicitHeight')) || 0
  if (implicitHeight > 0) return implicitHeight

  const contentHeight = contentImplicitSize(object)?.height ?? 0
  let childrenHeight = 0
  for (const child of orderedVisualChildren(object)) {
    if (!child.getProperty('visible')) continue
    const childY = Number(child.getProperty('y')) || 0
    childrenHeight = Math.max(childrenHeight, childY + effectiveItemHeight(child, depth + 1))
  }
  return Math.max(contentHeight, childrenHeight)
}

function applicationWindowChromeHeights(window: QmlObject): {
  menuBar: number
  header: number
  footer: number
} {
  const strip = (key: 'menuBar' | 'header' | 'footer') => {
    const item = window.getProperty(key)
    if (!(item instanceof QmlObject)) return 0
    if (!item.getProperty('visible')) return 0
    return effectiveItemHeight(item)
  }
  return {
    menuBar: strip('menuBar'),
    header: strip('header'),
    footer: strip('footer'),
  }
}

function isApplicationWindowChromeChild(object: QmlObject): boolean {
  const parent = object.parent
  if (!parent || parent.typeName !== 'ApplicationWindow') return false
  return object === parent.getProperty('menuBar')
    || object === parent.getProperty('header')
    || object === parent.getProperty('footer')
}

function applicationWindowGridRows(window: QmlObject): {
  menuBarRow: number
  headerRow: number
  contentRow: number
  footerRow: number
  template: string
} {
  const hasMenuBar = window.getProperty('menuBar') instanceof QmlObject
    && window.getProperty('menuBar')?.getProperty('visible') !== false
  const hasHeader = window.getProperty('header') instanceof QmlObject
    && window.getProperty('header')?.getProperty('visible') !== false
  const hasFooter = window.getProperty('footer') instanceof QmlObject
    && window.getProperty('footer')?.getProperty('visible') !== false

  let row = 1
  const menuBarRow = hasMenuBar ? row++ : -1
  const headerRow = hasHeader ? row++ : -1
  const contentRow = row++
  const footerRow = hasFooter ? row++ : -1

  const rows: string[] = []
  if (hasMenuBar) rows.push('auto')
  if (hasHeader) rows.push('auto')
  rows.push('minmax(0, 1fr)')
  if (hasFooter) rows.push('auto')

  return { menuBarRow, headerRow, contentRow, footerRow, template: rows.join(' ') }
}

export class QmlDomSceneGraph {
  private readonly mounted = new Map<QmlObject, MountedNode>()
  private container: HTMLElement | null = null
  private overlay: HTMLElement | null = null
  private overlayRemoveEvents: Array<() => void> = []
  private readonly tooltipElements = new Map<QmlObject, HTMLElement>()
  private readonly tooltipTimers = new Map<QmlObject, ReturnType<typeof setTimeout>>()
  /** 当前文档的 id → 对象映射，用于解析锚线引用（someId.left） */
  private ids: ReadonlyMap<string, QmlObject> | null = null

  constructor(private readonly domDocument: Document) {}

  mount(document: QmlDocumentInstance, container: HTMLElement): void {
    this.dispose()
    this.ids = document.ids
    this.container = container
    container.replaceChildren()
    container.classList.add('qml-runtime-root')
    const containerPosition = this.domDocument.defaultView?.getComputedStyle(container).position
    if (!containerPosition || containerPosition === 'static') {
      container.style.position = 'relative'
    }
    this.overlay = this.domDocument.createElement('div')
    this.overlay.className = 'qml-runtime-overlay'
    Object.assign(this.overlay.style, {
      position: 'absolute',
      inset: '0px',
      zIndex: '2147483647',
      pointerEvents: 'none',
    })
    container.append(this.overlay)
    const closeTopPopup = (kind: 'outside' | 'escape') => {
      const popup = [...this.mounted.keys()].reverse().find(object => (
        isPopup(object) && object.getProperty('visible')
      ))
      if (!popup || !popupPolicyAllows(popup.getProperty('closePolicy'), kind)) return
      popup.callMethod('close')
    }
    // overlay 是 pointer-events: none 的透明层，点击事件会穿透到下层元素，
    // 无法靠 overlay 自身接收事件。改为监听 container 的 pointerdown：
    // 如果点击目标不在任何可见的弹出层内，则视为“点击外部”，关闭顶层弹窗。
    const onContainerPointer = (event: Event) => {
      const target = event.target as Node
      const overlay = this.overlay
      if (!overlay || !overlay.contains(target)) {
        closeTopPopup('outside')
      }
    }
    const onKeyDown = (event: Event) => {
      const keyboard = event as KeyboardEvent
      if (keyboard.key === 'Escape') closeTopPopup('escape')
      const navigationProperty = ({
        ArrowLeft: 'KeyNavigation.left', ArrowRight: 'KeyNavigation.right',
        ArrowUp: 'KeyNavigation.up', ArrowDown: 'KeyNavigation.down',
      } as Record<string, string>)[keyboard.key]
      if (navigationProperty) {
        const current = [...this.mounted.entries()].find(([, node]) => node.element === this.domDocument.activeElement)?.[0]
        const target = current?.getProperty(navigationProperty)
        if (target instanceof QmlObject) {
          this.mounted.get(target)?.element.focus()
          keyboard.preventDefault()
          return
        }
      }
      if (keyboard.key !== 'Tab') return
      const popup = [...this.mounted.keys()].reverse().find(object => (
        isPopup(object) && object.getProperty('visible') && object.getProperty('focusTrap')
      ))
      const popupElement = popup ? this.mounted.get(popup)?.element : undefined
      if (!popupElement) return
      const focusable = [...popupElement.querySelectorAll<HTMLElement>('button,input,select,[tabindex="0"]')]
        .filter(element => element.tabIndex >= 0)
      if (!focusable.length) return
      const current = focusable.indexOf(this.domDocument.activeElement as HTMLElement)
      const next = keyboard.shiftKey
        ? (current <= 0 ? focusable.length - 1 : current - 1)
        : (current + 1) % focusable.length
      focusable[next].focus()
      keyboard.preventDefault()
    }
    this.container.addEventListener('pointerdown', onContainerPointer)
    this.domDocument.addEventListener('keydown', onKeyDown)
    this.overlayRemoveEvents = [
      () => this.container?.removeEventListener('pointerdown', onContainerPointer),
      () => this.domDocument.removeEventListener('keydown', onKeyDown),
    ]

    for (const root of document.roots) this.mountObject(root, container)
  }

  getElement(object: QmlObject): HTMLElement | undefined {
    return this.mounted.get(object)?.element
  }

  dispose(): void {
    for (const node of this.mounted.values()) {
      node.unsubscribe.forEach(unsubscribe => unsubscribe())
      node.removeEvents.forEach(removeEvent => removeEvent())
      node.anchorUnsubscribe.forEach(unsubscribe => unsubscribe())
    }
    this.mounted.clear()
    this.tooltipElements.forEach(el => el.remove())
    this.tooltipElements.clear()
    this.tooltipTimers.forEach(id => clearTimeout(id))
    this.tooltipTimers.clear()
    this.overlayRemoveEvents.forEach(removeEvent => removeEvent())
    this.overlayRemoveEvents = []
    this.overlay = null
    this.container?.replaceChildren()
    this.container = null
    this.ids = null
  }

  private mountObject(object: QmlObject, parentElement: HTMLElement, renderParent: QmlObject | null = object.parent): void {
    if (!isVisualObject(object)) {
      if (object.typeName === 'Component') return
      object.children.forEach(child => this.mountObject(child, parentElement))
      return
    }

    const element = this.domDocument.createElement(tagNameFor(object))
    element.className = 'qml-runtime-node'
    element.dataset.qmlType = object.typeName
    const mountParent = isPopup(object) && this.overlay ? this.overlay : parentElement
    mountParent.append(element)

    const unsubscribe = object.getPropertyNames().map(name => object.onPropertyChanged(name, () => {
      if (name === 'activeFocus') return
      if (name === 'focus') {
        this.syncFocusState(object, element)
        return
      }
      this.updateBranch(object)
      if (name === 'item' || name === 'background' || name === 'contentItem' || name === 'highlightItem') {
        this.syncChildren(object, element)
      }
    }))
    unsubscribe.push(registerItemGrabProvider(object, createDomGrabProvider(element)))
    if (object.hasSignal('childrenChanged')) {
      unsubscribe.push(object.connectSignal('childrenChanged', () => this.syncChildren(object, element)))
    }
    // Qt 语义：直接赋值 checked 时同步 checkState（DOM 点击以外的路径，如 QML handler 赋值）
    if (object.typeName === 'CheckBox' && object.hasProperty('checkState')) {
      unsubscribe.push(object.onPropertyChanged('checked', ({ value }) => {
        const expected = Boolean(value) ? 2 : 0
        if (Number(object.getProperty('checkState')) !== expected) {
          object.setInternalProperty('checkState', expected)
        }
      }))
    }
    // 差异3修复：订阅兄弟锚定目标（anchors.left/centerIn 等指向的兄弟对象）的
    // 几何变化，兄弟尺寸/位置变了 → 重算本对象的位置尺寸。
    const anchorUnsubscribe = this.subscribeAnchorTargets(object, element)
    const removeEvents = this.installEvents(object, element)
    this.mounted.set(object, { element, parent: renderParent, unsubscribe, removeEvents, anchorUnsubscribe })
    this.initializeCanvas(object, element)
    this.updateElement(object, element)
    orderedVisualChildren(object).forEach(child => this.mountObject(child, element, object))
    this.updateElement(object, element)
  }

  private updateElement(object: QmlObject, element: HTMLElement): void {
    const implicitSize = contentImplicitSize(object)
    if (implicitSize) {
      object.setInternalProperty('implicitWidth', implicitSize.width)
      object.setInternalProperty('implicitHeight', implicitSize.height)
    }
    const style = element.style
    const geometry = this.resolveGeometry(object)
    if (object.getProperty('anchors.fill') && Number(object.getProperty('width')) <= 0 && geometry.width > 0) {
      object.setInternalProperty('width', geometry.width)
    }
    if (object.getProperty('anchors.fill') && Number(object.getProperty('height')) <= 0 && geometry.height > 0) {
      object.setInternalProperty('height', geometry.height)
    }
    // StackLayout 子项由布局填满：把视觉尺寸写回属性，
    // 使子项内部的 anchors.centerIn/anchors.fill 引用到正确的布局尺寸。
    if (object.parent?.typeName === 'StackLayout' && geometry.width > 0 && geometry.height > 0) {
      object.setInternalProperty('width', geometry.width)
      object.setInternalProperty('height', geometry.height)
    }
    if (object.hasProperty('background') && object.hasProperty('contentItem')) {
      const p = Number(object.getProperty('padding')) || 0
      const left = object.isPropertyAssigned('leftPadding') ? Number(object.getProperty('leftPadding')) : p
      const right = object.isPropertyAssigned('rightPadding') ? Number(object.getProperty('rightPadding')) : p
      const top = object.isPropertyAssigned('topPadding') ? Number(object.getProperty('topPadding')) : p
      const bottom = object.isPropertyAssigned('bottomPadding') ? Number(object.getProperty('bottomPadding')) : p
      const background = object.getProperty('background')
      const contentItem = object.getProperty('contentItem')
      if (background instanceof QmlObject) {
        background.setInternalProperty('x', 0)
        background.setInternalProperty('y', 0)
        background.setInternalProperty('width', geometry.width)
        background.setInternalProperty('height', geometry.height)
      }
      if (contentItem instanceof QmlObject) {
        contentItem.setInternalProperty('x', left)
        contentItem.setInternalProperty('y', top)
        contentItem.setInternalProperty('width', Math.max(0, geometry.width - left - right))
        contentItem.setInternalProperty('height', Math.max(0, geometry.height - top - bottom))
      }
      if (object.hasProperty('availableWidth')) {
        object.setInternalProperty('availableWidth', Math.max(0, geometry.width - left - right))
        object.setInternalProperty('availableHeight', Math.max(0, geometry.height - top - bottom))
      }
    }
    const positionedByParent = ['Row', 'Column', 'RowLayout', 'ColumnLayout', 'Flow', 'SplitView', 'TabBar', 'ToolBar']
      .includes(object.parent?.typeName ?? '') ||
      (object.parent?.typeName === 'ScrollView' && layoutTypes.has(object.typeName)) ||
      contentContainerTypes.has(object.parent?.typeName ?? '')
    style.position = positionedByParent ? 'relative' : 'absolute'
    style.left = positionedByParent ? '' : cssLength(geometry.x)
    style.top = positionedByParent ? '' : cssLength(geometry.y)
    style.width = cssLength(geometry.width)
    style.height = cssLength(geometry.height)
    style.zIndex = cssValue(object.getProperty('z'))
    style.opacity = cssValue(Math.max(0, Math.min(1, Number(object.getProperty('opacity')))))
    style.display = object.getProperty('visible') ? '' : 'none'
    element.classList.toggle('qml-disabled', object.hasProperty('enabled') && !object.getProperty('enabled'))
    if (object.parent && ['StackLayout', 'SwipeView', 'StackView'].includes(object.parent.typeName)) {
      const siblings = orderedVisualChildren(object.parent)
      const currentIndex = Number(object.parent.getProperty('currentIndex')) || 0
      if (siblings.indexOf(object) !== currentIndex) style.display = 'none'
    }
    style.pointerEvents = object.getProperty('enabled') ? '' : 'none'
    const preservesExplicitWidth = object.isExplicitlySet('width') && geometry.width > 0
      && !object.getProperty('Layout.fillWidth')
    if (contentContainerTypes.has(object.parent?.typeName ?? '') ||
      (positionedByParent && !['GridLayout', 'Flow'].includes(object.typeName))) {
      style.maxWidth = preservesExplicitWidth ? '' : '100%'
    } else {
      style.maxWidth = ''
    }
    if (geometry.width <= 0 && ['Column', 'ColumnLayout'].includes(object.parent?.typeName ?? '')) {
      style.width = 'auto'
      style.alignSelf = 'stretch'
    }
    if (geometry.width <= 0 && contentContainerTypes.has(object.parent?.typeName ?? '')) {
      style.width = '100%'
    }
    if (geometry.width <= 0 && viewportContainerTypes.has(object.parent?.typeName ?? '')) {
      style.width = '100%'
    }
    if (geometry.height <= 0 && viewportContainerTypes.has(object.parent?.typeName ?? '')) {
      style.height = '100%'
    }
    if (geometry.height <= 0 && object.parent?.typeName === 'SplitView') {
      style.height = 'auto'
      style.alignSelf = 'stretch'
    }
    if (object.getProperty('anchors.fill') && geometry.width <= 0) style.width = '100%'
    // AppWindow-grid 子项已由专属块设置 height:100%；flex-column 子项中 height:100% 意为
    // 铺满容器整高而非剩余空间，两种情况均跳过，避免与 flex 布局产生冲突
    const parentIsFlexColumn = ['ColumnLayout', 'Column'].includes(object.parent?.typeName ?? '')
    if (object.getProperty('anchors.fill') && geometry.height <= 0
        && object.parent?.typeName !== 'ApplicationWindow'
        && !parentIsFlexColumn) {
      style.height = '100%'
    }
    if (isPopup(object)) {
      style.pointerEvents = object.getProperty('visible') ? 'auto' : 'none'
      style.boxSizing = 'border-box'
      style.transition = `opacity ${Number(object.getProperty('transitionDuration')) || 0}ms ease`
      if (object.getProperty('centerInOverlay') && this.container) {
        style.left = `${Math.max(0, (this.container.clientWidth - geometry.width) / 2)}px`
        style.top = `${Math.max(0, (this.container.clientHeight - geometry.height) / 2)}px`
      }
    }
    style.overflow = object.getProperty('clip') ? 'hidden' : 'visible'
    if (['Flickable', 'ListView', 'GridView', 'PathView', 'ScrollView'].includes(object.typeName)) {
      style.overflow = object.typeName === 'ScrollView' ? 'auto' : 'hidden'
    }
    style.transform = cssItemTransform(object)
    style.transformOrigin = cssTransformOrigin(object)
    style.isolation = object.getProperty('layer.enabled') ? 'isolate' : ''
    style.willChange = object.getProperty('layer.enabled') ? 'transform, opacity' : ''
    style.imageRendering = object.getProperty('layer.enabled') && !object.getProperty('layer.smooth') ? 'pixelated' : 'auto'
    if (layoutTypes.has(object.typeName)) {
      const margin = Math.max(0, Number(object.getProperty('anchors.margins')) || 0)
      style.boxSizing = 'border-box'
      if (!['GridLayout', 'Flow'].includes(object.typeName)) style.maxWidth = '100%'
      if (object.parent?.typeName === 'ScrollView') {
        style.width = 'auto'
        style.margin = `${margin}px`
      } else if (geometry.width <= 0 && !object.getProperty('anchors.fill')) {
        style.width = 'auto'
      }
      if (Number(object.getProperty('height')) <= 0 && !object.getProperty('anchors.fill')) {
        style.height = 'auto'
        style.minHeight = 'max-content'
      }
    }
    if (positionedByParent && ['Row', 'Column', 'RowLayout', 'ColumnLayout', 'Flow'].includes(object.parent?.typeName ?? '')) {
      const parentIsRow = object.parent?.typeName === 'RowLayout'
      const parentIsColumn = object.parent?.typeName === 'ColumnLayout'
      const primaryFill = Boolean(object.getProperty('anchors.fill')) ||
        (parentIsRow && Boolean(object.getProperty('Layout.fillWidth'))) ||
        (parentIsColumn && Boolean(object.getProperty('Layout.fillHeight')))
      if (primaryFill) {
        const factorName = parentIsRow ? 'Layout.horizontalStretchFactor' : 'Layout.verticalStretchFactor'
        const factor = parentIsRow || parentIsColumn ? Number(object.getProperty(factorName)) : -1
        style.flexGrow = String(factor > 0 ? factor : 1)
        style.flexShrink = '1'
      } else {
        style.flexShrink = '0'
        style.flexGrow = '0'
      }
      const crossFill = (parentIsRow && object.getProperty('Layout.fillHeight')) ||
        (parentIsColumn && object.getProperty('Layout.fillWidth'))
      if (crossFill) style.alignSelf = 'stretch'
    }
    if (contentContainerTypes.has(object.typeName) && Number(object.getProperty('height')) <= 0) {
      style.height = 'auto'
      style.minHeight = 'max-content'
      if (layoutTypes.has(object.parent?.typeName ?? '')) style.alignSelf = 'stretch'
    }
    if (layoutTypes.has(object.parent?.typeName ?? '')) {
      style.marginLeft = cssLength(layoutMarginValue(object, 'left'))
      style.marginRight = cssLength(layoutMarginValue(object, 'right'))
      style.marginTop = cssLength(layoutMarginValue(object, 'top'))
      style.marginBottom = cssLength(layoutMarginValue(object, 'bottom'))
    }
    const alignment = object.getProperty('Layout.alignment')
    const aligned = (name: string, flag: number) => typeof alignment === 'number'
      ? (alignment & flag) !== 0
      : String(alignment).includes(name)
    if (object.parent?.typeName === 'RowLayout') {
      if (aligned('AlignTop', 32)) style.alignSelf = 'flex-start'
      else if (aligned('AlignBottom', 128)) style.alignSelf = 'flex-end'
      else if (aligned('AlignVCenter', 64)) style.alignSelf = 'center'
    } else if (object.parent?.typeName === 'ColumnLayout') {
      const rightToLeft = Number(object.parent.getProperty('layoutDirection')) === 1 || String(object.parent.getProperty('layoutDirection')).includes('RightToLeft')
      if (aligned('AlignLeft', 1)) style.alignSelf = rightToLeft ? 'flex-end' : 'flex-start'
      else if (aligned('AlignRight', 2)) style.alignSelf = rightToLeft ? 'flex-start' : 'flex-end'
      else if (aligned('AlignHCenter', 4)) style.alignSelf = 'center'
    }
    this.syncFocusState(object, element)

    const objectName = cssValue(object.getProperty('objectName'))
    if (objectName) element.dataset.qmlObjectName = objectName
    else delete element.dataset.qmlObjectName

    if (object.typeName === 'ItemDelegate' && object.hasProperty('index') && ['ListView', 'GridView', 'PathView'].includes(object.parent?.typeName ?? '')) {
      element.setAttribute('aria-selected', String(Number(object.getProperty('index')) === Number(object.parent!.getProperty('currentIndex'))))
    }
    if (['ListView', 'GridView', 'PathView'].includes(object.typeName)) element.tabIndex = 0

    if (object.typeName === 'Rectangle') {
      style.backgroundColor = cssColor(object.getProperty('color'))
      style.borderRadius = cssLength(object.getProperty('radius'))
      style.borderStyle = 'solid'
      style.borderWidth = cssLength(object.getProperty('border.width'))
      style.borderColor = cssColor(object.getProperty('border.color'))
    }

    if (object.typeName === 'ApplicationWindow') {
      style.display = object.getProperty('visible') ? 'grid' : 'none'
      const rows = applicationWindowGridRows(object)
      style.gridTemplateRows = rows.template
      style.maxWidth = '100%'
      style.boxSizing = 'border-box'
      style.overflow = 'hidden'
      const windowColor = parseQmlColor(object.getProperty('color'))
      style.backgroundColor = !windowColor || windowColor[3] === 0
        ? (resolveGroupedPaletteColor(object, 'window') ?? 'var(--qml-panel-bg)')
        : toCssColor(windowColor)
    }

    if (object.typeName === 'Loader') {
      const item = object.getProperty('item')
      if (item instanceof QmlObject) {
        const itemGeometry = this.resolveGeometry(item)
        if (Number(object.getProperty('width')) <= 0) style.width = cssLength(itemGeometry.width)
        if (Number(object.getProperty('height')) <= 0) style.height = cssLength(itemGeometry.height)
      } else if (Number(object.getProperty('height')) <= 0) {
        style.height = '0px'
      }
    }

    if (object.parent?.typeName === 'ApplicationWindow') {
      const menuBar = object.parent.getProperty('menuBar')
      const header = object.parent.getProperty('header')
      const footer = object.parent.getProperty('footer')
      const rows = applicationWindowGridRows(object.parent)
      const chromeWidth = Number(object.parent.getProperty('width')) || 0
      const chromeHeight = effectiveItemHeight(object)
      if (object === menuBar) {
        if (chromeWidth > 0 && Number(object.getProperty('width')) !== chromeWidth) {
          object.setInternalProperty('width', chromeWidth)
        }
        if (chromeHeight > 0 && Number(object.getProperty('height')) <= 0) {
          object.setInternalProperty('height', chromeHeight)
        }
        style.position = 'relative'
        style.inset = 'auto'
        style.width = '100%'
        style.minWidth = '0'
        style.boxSizing = 'border-box'
        // grid-column:1 防止 CSS Grid 自动列放置把多个同 row 子项排到第二列
        style.gridColumn = '1'
        style.gridRow = rows.menuBarRow > 0 ? String(rows.menuBarRow) : ''
        style.height = 'auto'
      } else if (object === header) {
        if (chromeWidth > 0 && Number(object.getProperty('width')) !== chromeWidth) {
          object.setInternalProperty('width', chromeWidth)
        }
        if (chromeHeight > 0 && Number(object.getProperty('height')) <= 0) {
          object.setInternalProperty('height', chromeHeight)
        }
        style.position = 'relative'
        style.inset = 'auto'
        style.width = '100%'
        style.minWidth = '0'
        style.boxSizing = 'border-box'
        style.gridColumn = '1'
        style.gridRow = rows.headerRow > 0 ? String(rows.headerRow) : ''
        style.height = 'auto'
      } else if (object === footer) {
        if (chromeWidth > 0 && Number(object.getProperty('width')) !== chromeWidth) {
          object.setInternalProperty('width', chromeWidth)
        }
        if (chromeHeight > 0 && Number(object.getProperty('height')) <= 0) {
          object.setInternalProperty('height', chromeHeight)
        }
        style.position = 'relative'
        style.inset = 'auto'
        style.width = '100%'
        style.minWidth = '0'
        style.boxSizing = 'border-box'
        style.gridColumn = '1'
        style.gridRow = rows.footerRow > 0 ? String(rows.footerRow) : ''
        style.height = 'auto'
      } else {
        // 普通内容子项属于 ApplicationWindow 的 content 区。
        // 这里显式绑定到 content 行，同时保留绝对定位与锚点几何。
        style.gridRow = String(rows.contentRow)
        style.gridColumn = '1'
      }
    }

    if (element instanceof this.domDocument.defaultView!.HTMLCanvasElement) {
      element.width = Math.max(0, Math.round(geometry.width))
      element.height = Math.max(0, Math.round(geometry.height))
      if (object.typeName === 'ShaderEffect') {
        element.dataset.vertexShader = cssValue(object.getProperty('vertexShader'))
        element.dataset.fragmentShader = cssValue(object.getProperty('fragmentShader'))
        style.filter = object.getProperty('available') ? '' : cssValue(object.getProperty('fallbackFilter'))
      } else if (object.typeName === 'ChartView') {
        this.paintChart(object)
      } else if (object.typeName === 'ParticleSystem') {
        this.paintParticles(object)
      }
    }

    if (object.typeName === 'Text' || object.typeName === 'Label') {
      element.textContent = cssValue(object.getProperty('text'))
      const textColor = parseQmlColor(object.getProperty('color'))
      const hasCustomRectangleBackground = object.parent?.typeName === 'Rectangle' && (() => {
        const parentColor = parseQmlColor(object.parent.getProperty('color'))
        return parentColor !== null && parentColor[3] > 0
      })()
      const isDefaultBlack = textColor === null || (textColor[3] === 255 && textColor[0] === 0 && textColor[1] === 0 && textColor[2] === 0)
      const useDefaultColor = isDefaultBlack && !object.isExplicitlySet('color') && !hasCustomRectangleBackground
      style.color = useDefaultColor
        ? (resolveGroupedPaletteColor(object, 'windowText') ?? 'var(--qml-control-text)')
        : textColor ? toCssColor(textColor) : ''
      style.fontSize = (() => {
        const pixelSize = Number(resolveInheritedFontProperty(object, 'font.pixelSize')) || 0
        const pointSize = Number(resolveInheritedFontProperty(object, 'font.pointSize')) || 0
        return cssLength(pixelSize > 0 ? pixelSize : pointSize > 0 ? pointSize * 4 / 3 : 16)
      })()
      style.fontFamily = cssValue(resolveInheritedFontProperty(object, 'font.family'))
      style.fontWeight = resolveInheritedFontProperty(object, 'font.bold') ? 'bold' : 'normal'
      style.fontStyle = resolveInheritedFontProperty(object, 'font.italic') ? 'italic' : 'normal'
      const wrapMode = object.getProperty('wrapMode')
      const noWrap = Number(wrapMode) === 0 || String(wrapMode).includes('NoWrap')
      const wrapAnywhere = Number(wrapMode) === 2 || Number(wrapMode) === 3 || /WrapAnywhere|Text\.Wrap$/.test(String(wrapMode))
      style.whiteSpace = noWrap ? 'pre' : 'pre-wrap'
      style.overflowWrap = wrapAnywhere ? 'anywhere' : 'normal'
      style.wordBreak = Number(wrapMode) === 2 || String(wrapMode).includes('WrapAnywhere') ? 'break-all' : 'normal'
      const horizontalAlignment = object.getProperty('horizontalAlignment')
      style.textAlign = Number(horizontalAlignment) === 2 || String(horizontalAlignment).includes('AlignRight')
        ? 'right'
        : Number(horizontalAlignment) === 4 || String(horizontalAlignment).includes('AlignHCenter')
          ? 'center'
          : 'left'
      const verticalAlignment = object.getProperty('verticalAlignment')
      style.alignContent = Number(verticalAlignment) === 128 || String(verticalAlignment).includes('AlignBottom')
        ? 'end'
        : Number(verticalAlignment) === 64 || String(verticalAlignment).includes('AlignVCenter')
          ? 'center'
          : 'start'
      const lineHeight = Number(object.getProperty('lineHeight')) || 1
      const fixedLineHeight = Number(object.getProperty('lineHeightMode')) === 1 || String(object.getProperty('lineHeightMode')).includes('FixedHeight')
      style.lineHeight = fixedLineHeight ? cssLength(lineHeight) : String(lineHeight)
      const maximumLineCount = Number(object.getProperty('maximumLineCount'))
      const elide = object.getProperty('elide')
      const hasElide = Number(elide) !== 3 && !String(elide).includes('ElideNone')
      style.overflow = hasElide || maximumLineCount < 2147483647 ? 'hidden' : ''
      style.textOverflow = hasElide ? 'ellipsis' : ''
      if (hasElide && maximumLineCount >= 2147483647) style.whiteSpace = 'nowrap'
      if (maximumLineCount < 2147483647) {
        style.display = '-webkit-box'
        style.setProperty('-webkit-box-orient', 'vertical')
        style.setProperty('-webkit-line-clamp', String(Math.max(1, maximumLineCount)))
      } else {
        style.removeProperty('-webkit-box-orient')
        style.removeProperty('-webkit-line-clamp')
      }
      if (object.hasProperty('padding')) style.padding = cssLength(object.getProperty('padding'))
    }

    if (checkTypes.has(object.typeName)) {
      let indicator = element.querySelector<HTMLSpanElement>(':scope > .qml-check-indicator')
      let checkMark = indicator?.querySelector<HTMLSpanElement>(':scope > .qml-check-mark')
      let caption = element.querySelector<HTMLSpanElement>(':scope > .qml-check-caption')
      if (!indicator || !checkMark || !caption) {
        indicator = this.domDocument.createElement('span')
        checkMark = this.domDocument.createElement('span')
        caption = this.domDocument.createElement('span')
        indicator.append(checkMark)
        element.replaceChildren(indicator, caption)
      }
      indicator.className = 'qml-check-indicator'
      checkMark.className = 'qml-check-mark'
      caption.className = 'qml-check-caption'

      const checked = Boolean(object.getProperty('checked'))
      // checkState / tristate are CheckBox-specific; RadioButton and Switch only use checked
      const checkState = object.hasProperty('checkState') ? Number(object.getProperty('checkState')) : (checked ? 2 : 0)
      const isPartial = checkState === 1
      const isRadio = object.typeName === 'RadioButton'
      const isSwitch = object.typeName === 'Switch'

      element.classList.toggle('qml-switch-control', isSwitch)
      element.classList.toggle('qml-radio-control', isRadio)
      element.classList.toggle('qml-checked', checked)
      element.classList.toggle('qml-partial', isPartial)
      element.classList.toggle('qml-disabled', !object.getProperty('enabled'))
      element.setAttribute('role', isSwitch ? 'switch' : isRadio ? 'radio' : 'checkbox')
      element.setAttribute('aria-checked', isPartial ? 'mixed' : String(checked))
      element.setAttribute('aria-disabled', String(!object.getProperty('enabled')))

      caption.textContent = cssValue(object.getProperty('text'))
    }

    if (object.typeName === 'Image' && element instanceof this.domDocument.defaultView!.HTMLImageElement) {
      const source = cssValue(object.getProperty('source'))
      if (source) element.src = source
      else element.removeAttribute('src')
      element.style.objectFit = object.getProperty('fillMode') === 'Image.Stretch' ? 'fill' : 'contain'
    }

    if (object.typeName === 'WebEngineView' && element instanceof this.domDocument.defaultView!.HTMLIFrameElement) {
      const url = cssValue(object.getProperty('url')) || 'about:blank'
      if (element.src !== url) element.src = url
      element.referrerPolicy = 'no-referrer'
    }

    if (object.typeName === 'VideoOutput' && element instanceof this.domDocument.defaultView!.HTMLVideoElement) {
      const source = cssValue(object.getProperty('source'))
      if (element.getAttribute('src') !== source) element.setAttribute('src', source)
      element.autoplay = Boolean(object.getProperty('autoPlay'))
      element.muted = Boolean(object.getProperty('muted'))
      element.controls = Boolean(object.getProperty('controls'))
      element.style.objectFit = object.getProperty('fillMode') === 'VideoOutput.Stretch'
        ? 'fill'
        : object.getProperty('fillMode') === 'VideoOutput.PreserveAspectCrop' ? 'cover' : 'contain'
    }

    if (object.typeName === 'DropShadow') {
      const x = cssLength(object.getProperty('horizontalOffset'))
      const y = cssLength(object.getProperty('verticalOffset'))
      const radius = cssLength(object.getProperty('radius'))
      style.filter = `drop-shadow(${x} ${y} ${radius} ${cssValue(object.getProperty('color'))})`
    }
    if (object.typeName === 'OpacityMask') {
      const maskSource = cssValue(object.getProperty('maskSource'))
      style.maskImage = maskSource ? `url("${maskSource}")` : ''
      style.maskSize = '100% 100%'
    }

    if (object.typeName === 'Row' || object.typeName === 'Column') {
      style.display = object.getProperty('visible') ? 'flex' : 'none'
      style.flexDirection = object.typeName === 'Row' ? 'row' : 'column'
      style.gap = cssLength(object.getProperty('spacing'))
      style.padding = cssLength(object.getProperty('padding'))
    }

    if (object.typeName === 'ToolBar') {
      style.display = object.getProperty('visible') ? 'flex' : 'none'
      style.alignItems = 'center'
      style.backgroundColor = 'var(--qml-panel-muted-bg)'
      style.borderBottom = object.parent?.getProperty('header') === object ? '1px solid var(--qml-control-border)' : ''
      style.borderTop = object.parent?.getProperty('footer') === object ? '1px solid var(--qml-control-border)' : ''
      if (geometry.height <= 0) {
        style.height = 'auto'
        style.minHeight = 'max-content'
      }
    }

    if (object.typeName === 'MenuBar') {
      style.display = object.getProperty('visible') ? 'flex' : 'none'
      style.alignItems = 'center'
      style.gap = '2px'
      style.padding = '0 8px'
      style.backgroundColor = 'var(--qml-panel-muted-bg)'
      style.borderBottom = object.parent?.getProperty('menuBar') === object || object.parent?.getProperty('header') === object
        ? '1px solid var(--qml-control-border)'
        : ''
      style.borderTop = object.parent?.getProperty('footer') === object ? '1px solid var(--qml-control-border)' : ''
      const menus = object.children.filter(child => child.typeName === 'Menu')
      const existing = [...element.querySelectorAll<HTMLButtonElement>(':scope > .qml-menu-command')]
      if (existing.length !== menus.length) {
        existing.forEach(button => button.remove())
        menus.forEach(menu => {
          const button = this.domDocument.createElement('button')
          button.className = 'qml-menu-command'
          button.type = 'button'
          button.textContent = cssValue(menu.getProperty('title'))
          // container 的 pointerdown（点击外部关闭）会在 click 之前触发并关闭菜单，
          // 这里用 pointerdown 记录“点击前是否已打开”，供 click 做 toggle 判断。
          let wasOpenBeforeClick = false
          button.addEventListener('pointerdown', () => {
            wasOpenBeforeClick = Boolean(menu.getProperty('visible'))
          })
          button.addEventListener('click', () => {
            if (wasOpenBeforeClick) {
              // 点击已打开的菜单按钮 → 关闭（toggle）
              menu.callMethod('close')
              return
            }
            // 同一 MenuBar 下同时只显示一个菜单：先关闭其他已打开的兄弟菜单
            menus.forEach(sibling => {
              if (sibling !== menu && sibling.getProperty('visible')) sibling.callMethod('close')
            })
            const buttonRect = button.getBoundingClientRect()
            const containerRect = this.container?.getBoundingClientRect()
            if (containerRect) {
              menu.setInternalProperty('x', buttonRect.left - containerRect.left)
              menu.setInternalProperty('y', buttonRect.bottom - containerRect.top)
            }
            menu.callMethod('open')
          })
          element.append(button)
        })
      }
    }

    if (object.typeName === 'Menu') {
      style.display = object.getProperty('visible') ? 'flex' : 'none'
      style.flexDirection = 'column'
      style.alignItems = 'stretch'
      style.gap = '2px'
      style.padding = '4px'
      style.width = 'max-content'
      style.height = 'max-content'
      style.minWidth = '0'
      style.minHeight = '0'
      style.boxSizing = 'border-box'
    }

    if (object.typeName === 'MenuSeparator' && object.parent?.typeName === 'Menu') {
      // 分隔线：占满菜单宽度（几何计算出的 width 为 0，必须覆盖），
      // 内联只设尺寸，颜色/边距交给 CSS。
      style.position = 'relative'
      style.left = ''
      style.top = ''
      style.width = '100%'
      style.height = '1px'
      style.minWidth = '0'
      style.flexShrink = '0'
    }

    if (object.typeName === 'RowLayout' || object.typeName === 'ColumnLayout') {
      style.display = object.getProperty('visible') ? 'flex' : 'none'
      style.gap = cssLength(object.getProperty('spacing'))
      const rightToLeft = object.hasProperty('layoutDirection') && (
        Number(object.getProperty('layoutDirection')) === 1 || String(object.getProperty('layoutDirection')).includes('RightToLeft')
      )
      style.flexDirection = object.typeName === 'RowLayout'
        ? (rightToLeft ? 'row-reverse' : 'row')
        : 'column'
      style.alignItems = object.typeName === 'RowLayout' ? 'center' : rightToLeft ? 'flex-end' : 'flex-start'
    }
    if (object.typeName === 'GridLayout') {
      style.display = object.getProperty('visible') ? 'block' : 'none'
    }
    if (object.typeName === 'Flow') {
      style.display = object.getProperty('visible') ? 'flex' : 'none'
      style.flexWrap = 'wrap'
      style.gap = cssLength(object.getProperty('spacing'))
      const topToBottom = Number(object.getProperty('flow')) === 1 || String(object.getProperty('flow')).includes('TopToBottom')
      style.flexDirection = topToBottom ? 'column' : 'row'
      style.alignContent = 'flex-start'
    }

    if (['StackLayout', 'SwipeView', 'StackView'].includes(object.typeName)) {
      const currentIndex = Number(object.getProperty('currentIndex')) || 0
      const children = orderedVisualChildren(object)
      children.forEach((child, index) => {
        const childElement = this.mounted.get(child)?.element
        if (childElement) childElement.style.display = index === currentIndex ? '' : 'none'
      })
      style.overflow = 'hidden'
    }
    if (object.typeName === 'SplitView') {
      style.display = object.getProperty('visible') ? 'flex' : 'none'
      style.flexDirection = object.getProperty('orientation') === 'Qt.Vertical' ? 'column' : 'row'
    }

    if (object.hasProperty('padding') && !['Row', 'Column', 'MenuBar'].includes(object.typeName)) {
      const padding = Number(object.getProperty('padding')) || 0
      style.padding = padding > 0 ? cssLength(padding) : ''
    }

    if (buttonTypes.has(object.typeName) || checkTypes.has(object.typeName)) {
      const isHighlighted = object.hasProperty('highlighted') && Boolean(object.getProperty('highlighted'))
      const resolvedAccent = isHighlighted ? resolveGroupedPaletteColor(object, 'accent') : null
      style.backgroundColor = resolvedAccent ?? resolveGroupedPaletteColor(object, 'button') ?? ''
      style.color = resolveGroupedPaletteColor(object, 'buttonText') ?? ''
      style.fontFamily = cssValue(resolveInheritedFontProperty(object, 'font.family'))
      const pixelSize = Number(resolveInheritedFontProperty(object, 'font.pixelSize')) || 0
      const pointSize = Number(resolveInheritedFontProperty(object, 'font.pointSize')) || 0
      style.fontSize = pixelSize > 0
        ? cssLength(pixelSize)
        : pointSize > 0
          ? cssLength(pointSize * 4 / 3)
          : cssLength(14)
      style.fontWeight = resolveInheritedFontProperty(object, 'font.bold') ? 'bold' : 'normal'
      style.fontStyle = resolveInheritedFontProperty(object, 'font.italic') ? 'italic' : 'normal'
    }

    if (buttonTypes.has(object.typeName)) {
      if (!(object.getProperty('contentItem') instanceof QmlObject)) {
        // 用 .qml-button-content span 渲染文本（Qt contentItem 语义）。裸文本节点
        // 属于非定位内容，按 CSS 绘制顺序画在绝对定位的 background 之下，不透明
        // 背景（如 #333333）会完全盖住文本；span 带 z-index 保证文本在背景之上。
        const text = cssValue(object.getProperty('text'))
        let content = [...element.children].find(
          child => child.classList.contains('qml-button-content'),
        ) as HTMLSpanElement | undefined
        if (!content) {
          content = this.domDocument.createElement('span')
          content.className = 'qml-button-content'
          element.appendChild(content)
        }
        content.style.position = 'relative'
        content.style.zIndex = '1'
        content.textContent = text
      }
      element.setAttribute('aria-pressed', cssValue(object.getProperty('checked')))
      ;(element as HTMLButtonElement).disabled = !object.getProperty('enabled')
      if (object.typeName === 'RoundButton') {
        style.borderRadius = cssLength(object.getProperty('radius'))
      }
      element.classList.toggle('qml-tool-button', object.typeName === 'ToolButton')
      element.classList.toggle('qml-button-flat', Boolean(object.getProperty('flat')))
      element.classList.toggle('qml-button-highlighted', Boolean(object.getProperty('highlighted')))
      if (object.typeName === 'ItemDelegate') {
        style.textAlign = 'left'
        if (object.isPropertyAssigned('leftPadding')) style.paddingLeft = cssLength(object.getProperty('leftPadding'))
        if (object.isPropertyAssigned('rightPadding')) style.paddingRight = cssLength(object.getProperty('rightPadding'))
        const content = element.querySelector<HTMLElement>('.qml-button-content')
        if (content) {
          content.style.justifyContent = 'flex-start'
          content.style.width = '100%'
        }
      }
      if (object.getProperty('highlighted')) {
        style.color = resolveGroupedPaletteColor(object, 'highlightedText') ?? 'var(--qml-on-accent)'
      }
      if (object.parent?.typeName === 'Menu') {
        // 菜单项：在 Menu flex column 中垂直排列，撑满宽度、文字左对齐。
        // 文本 span 必须参与流内布局（position: relative），否则 Menu 的
        // max-content 宽度无法基于文本计算，菜单会塌缩成 0 宽。
        // 注意：background/border/box-shadow/color 全部交给 CSS 控制
        //（hover 高亮依赖选择器，不能被内联样式覆盖）。
        style.position = 'relative'
        style.left = ''
        style.top = ''
        style.width = '100%'
        style.minWidth = '0'
        style.justifyContent = 'flex-start'
        style.textAlign = 'left'
        style.padding = '4px 8px'
        style.minHeight = '26px'
        element.classList.add('qml-menu-item')
        const content = element.querySelector<HTMLElement>('.qml-button-content')
        if (content) {
          content.style.position = 'relative'
          content.style.inset = 'auto'
          content.style.justifyContent = 'flex-start'
          content.style.width = '100%'
        }
      }
    }

    if (element instanceof this.domDocument.defaultView!.HTMLInputElement) {
      if (object.typeName === 'TextField' || object.typeName === 'TextInput') {
        element.type = object.getProperty('echoMode') === 'TextInput.Normal' ? 'text' : 'password'
        element.value = cssValue(object.getProperty('text'))
        element.placeholder = cssValue(object.getProperty('placeholderText'))
        element.readOnly = Boolean(object.getProperty('readOnly'))
        element.disabled = !object.getProperty('enabled')
        if (object.isPropertyAssigned('color')) {
          const textColor = parseQmlColor(object.getProperty('color'))
          if (textColor) style.color = toCssColor(textColor)
        } else {
          const resolved = resolveGroupedPaletteColor(object, 'text')
          if (resolved !== null) style.color = resolved
        }
        const baseColor = resolveGroupedPaletteColor(object, 'base')
        if (baseColor !== null) style.backgroundColor = baseColor
        const placeholderColor = resolveGroupedPaletteColor(object, 'placeholderText')
        if (placeholderColor !== null) style.setProperty('--qml-placeholder-color', placeholderColor)
      } else if (object.typeName === 'SpinBox') {
        element.type = 'number'
        element.min = cssValue(object.getProperty('from'))
        element.max = cssValue(object.getProperty('to'))
        element.step = cssValue(object.getProperty('stepSize'))
        element.value = cssValue(object.getProperty('value'))
        element.readOnly = !object.getProperty('editable')
      }
    }
    if (object.typeName === 'Slider' || object.typeName === 'Dial') {
      element.classList.toggle('qml-slider-control', object.typeName === 'Slider')
      element.classList.toggle('qml-dial-control', object.typeName === 'Dial')
      const from = Number(object.getProperty('from')) || 0
      const to = Number(object.getProperty('to')) || 100
      const value = Number(object.getProperty('value')) || 0
      const position = Math.max(0, Math.min(1, (value - from) / (to - from || 1)))
      object.setInternalProperty('position', position)
      object.setInternalProperty('visualPosition', position)
      let input = element.querySelector<HTMLInputElement>(':scope > .qml-range-native')
      if (!input) {
        input = this.domDocument.createElement('input')
        input.type = 'range'
        input.className = 'qml-range-native'
        if (object.typeName === 'Slider') {
          const track = this.domDocument.createElement('span')
          track.className = 'qml-slider-track'
          const fill = this.domDocument.createElement('span')
          fill.className = 'qml-slider-fill'
          const handle = this.domDocument.createElement('span')
          handle.className = 'qml-slider-handle'
          track.append(fill, handle)
          element.replaceChildren(track, input)
        } else {
          const face = this.domDocument.createElement('span')
          face.className = 'qml-dial-face'
          const needle = this.domDocument.createElement('span')
          needle.className = 'qml-dial-needle'
          face.append(needle)
          element.replaceChildren(face, input)
        }
      }
      input.min = String(from)
      input.max = String(to)
      input.step = Number(object.getProperty('stepSize')) > 0 ? cssValue(object.getProperty('stepSize')) : 'any'
      input.value = String(value)
      input.disabled = !object.getProperty('enabled')
      element.style.setProperty('--qml-position', String(position))
      element.style.setProperty('--qml-position-percent', `${position * 100}%`)
      element.style.setProperty('--qml-dial-angle', `${-135 + position * 270}deg`)
    }
    if (element instanceof this.domDocument.defaultView!.HTMLTextAreaElement && ['TextArea', 'TextEdit'].includes(object.typeName)) {
      element.value = cssValue(object.getProperty('text'))
      element.placeholder = cssValue(object.getProperty('placeholderText'))
      element.readOnly = Boolean(object.getProperty('readOnly'))
      element.wrap = object.getProperty('wrapMode') === 'TextEdit.NoWrap' ? 'off' : 'soft'
      if (object.isPropertyAssigned('color')) {
        const textColor = parseQmlColor(object.getProperty('color'))
        if (textColor) style.color = toCssColor(textColor)
      } else {
        const resolved = resolveGroupedPaletteColor(object, 'text')
        if (resolved !== null) style.color = resolved
      }
      const baseColor = resolveGroupedPaletteColor(object, 'base')
      if (baseColor !== null) style.backgroundColor = baseColor
      const placeholderColor = resolveGroupedPaletteColor(object, 'placeholderText')
      if (placeholderColor !== null) style.setProperty('--qml-placeholder-color', placeholderColor)
    }
    if (object.typeName === 'RangeSlider') {
      const from = Number(object.getProperty('from')) || 0
      const to = Number(object.getProperty('to')) || 100
      const span = to - from || 1
      const first = Math.max(0, Math.min(1, (Number(object.getProperty('first.value')) - from) / span))
      const second = Math.max(0, Math.min(1, (Number(object.getProperty('second.value')) - from) / span))
      element.style.setProperty('--qml-range-first', `${Math.min(first, second) * 100}%`)
      element.style.setProperty('--qml-range-second', `${Math.max(first, second) * 100}%`)
      if (element.querySelectorAll(':scope > .qml-range-track').length === 0) {
        const track = this.domDocument.createElement('span')
        track.className = 'qml-range-track'
        const fill = this.domDocument.createElement('span')
        fill.className = 'qml-range-fill'
        const firstHandle = this.domDocument.createElement('span')
        firstHandle.className = 'qml-range-handle'
        firstHandle.dataset.rangeHandle = 'first'
        const secondHandle = this.domDocument.createElement('span')
        secondHandle.className = 'qml-range-handle'
        secondHandle.dataset.rangeHandle = 'second'
        track.append(fill, firstHandle, secondHandle)
        element.replaceChildren(track)
      }
    }
    if (object.typeName === 'GroupBox') {
      const title = cssValue(object.getProperty('title'))
      element.setAttribute('aria-label', title)
      let legend = element.querySelector<HTMLLegendElement>(':scope > legend')
      if (!legend) {
        legend = this.domDocument.createElement('legend')
        element.prepend(legend)
      }
      legend.textContent = title
    }
    if (object.typeName === 'BusyIndicator') {
      element.setAttribute('role', 'progressbar')
      element.setAttribute('aria-busy', cssValue(object.getProperty('running')))
    }
    if (object.typeName === 'DelayButton') {
      // 用户自定义了 background（background 内已用 control.progress 绘制进度条）
      // 时，不再叠加默认主题色渐变，遵循"指定用用户的、不指定用主题色"。
      const hasCustomBackground = object.getProperty('background') instanceof QmlObject
      if (object.getProperty('checked') || hasCustomBackground) {
        style.removeProperty('background-image')
      } else {
        const pct = `${Math.max(0, Math.min(1, Number(object.getProperty('progress')) || 0)) * 100}%`
        const fill = element.closest('[data-qml-style="material"]')
          ? 'color-mix(in srgb, var(--qml-on-accent) 50%, transparent)'
          : 'var(--qml-accent)'
        style.backgroundImage = `linear-gradient(90deg, ${fill} ${pct}, transparent ${pct})`
      }
    }
    if (object.typeName === 'ScrollIndicator') {
      const position = Math.max(0, Math.min(1, Number(object.getProperty('position')) || 0))
      const size = Math.max(0.05, Math.min(1, Number(object.getProperty('size')) || 0.2))
      style.left = 'auto'
      style.top = `${position * 100}%`
      style.right = '3px'
      style.width = '4px'
      style.height = `${size * 100}%`
      style.transform = 'none'
      element.setAttribute('aria-hidden', String(!object.getProperty('active')))
    }
    if (object.typeName === 'Calendar') this.projectCalendar(object, element)
    if (element instanceof this.domDocument.defaultView!.HTMLInputElement && object.typeName === 'DatePicker') {
      element.type = 'date'
      element.value = this.dateInputValue(object.getProperty('selectedDate'))
    }
    if (element instanceof this.domDocument.defaultView!.HTMLInputElement && object.typeName === 'TimePicker') {
      element.type = 'time'
      element.value = cssValue(object.getProperty('time'))
    }
    if (object.typeName === 'ToolTip') element.textContent = cssValue(object.getProperty('text'))
    if (object.typeName === 'TableView') this.projectTableView(object, element)
    if (object.typeName === 'TreeView') this.projectTreeView(object, element)
    if (object.typeName === 'HorizontalHeaderView' || object.typeName === 'VerticalHeaderView') {
      const syncView = object.getProperty('syncView')
      let headers: string[] = []
      if (syncView instanceof QmlObject) {
        const h = syncView.getProperty('headers')
        if (Array.isArray(h) && h.length) headers = h.map(cssValue)
      }
      if (!headers.length) {
        headers = orderedVisualChildren(object).filter(c => c.typeName === 'Label').map(c => cssValue(c.getProperty('text')))
      }
      if (headers.length) {
        const cells = headers.map((label, index) => {
          const cell = this.domDocument.createElement('div')
          cell.setAttribute('role', 'columnheader')
          cell.dataset.columnIndex = String(index)
          cell.textContent = label
          return cell
        })
        element.replaceChildren(...cells)
      }
      style.whiteSpace = 'pre'
    }
    if (element instanceof this.domDocument.defaultView!.HTMLSelectElement && object.typeName === 'ComboBox') {
      const model = object.getProperty('model')
      const values = Array.isArray(model) ? model : []
      element.replaceChildren(...values.map((value, index) => {
        const option = this.domDocument.createElement('option')
        option.value = String(index)
        option.textContent = typeof value === 'object' && value ? cssValue((value as Record<string, unknown>).text) : cssValue(value)
        return option
      }))
      element.selectedIndex = Number(object.getProperty('currentIndex'))
      object.setInternalProperty('currentText', element.selectedIndex >= 0 ? element.options[element.selectedIndex]?.text ?? '' : '')
    }
    if (object.typeName === 'Tumbler') {
      element.classList.add('qml-tumbler-control')
      const model = object.getProperty('model')
      const values = Array.isArray(model) ? model : Array.from({ length: Math.max(0, Number(model) || 0) }, (_, index) => index)
      const current = Number(object.getProperty('currentIndex'))
      element.replaceChildren(...[-1, 0, 1].map(offset => {
        const item = this.domDocument.createElement('button')
        const index = values.length ? (current + offset + values.length) % values.length : -1
        item.type = 'button'
        item.className = 'qml-tumbler-item'
        item.dataset.index = String(index)
        item.setAttribute('aria-selected', String(offset === 0))
        item.textContent = index >= 0 ? cssValue(values[index]) : ''
        return item
      }))
      object.setInternalProperty('currentItem', values[current] ?? null)
    }
    if (object.typeName === 'TabBar') {
      const parent = object.parent
      const parentFooter = parent?.hasProperty('footer') ? parent.getProperty('footer') : null
      const parentHeader = parent?.hasProperty('header') ? parent.getProperty('header') : null
      style.display = object.getProperty('visible') ? 'flex' : 'none'
      style.alignItems = 'stretch'
      style.gap = '2px'
      style.backgroundColor = 'var(--qml-panel-muted-bg)'
      style.borderTop = parentFooter === object ? '1px solid var(--qml-control-border)' : ''
      style.borderBottom = parentHeader === object ? '1px solid var(--qml-control-border)' : ''
      const tabs = orderedVisualChildren(object)
      let currentIndex = Number(object.getProperty('currentIndex'))
      if (tabs.length === 0) {
        if (currentIndex !== -1) object.setInternalProperty('currentIndex', -1)
        currentIndex = -1
      } else {
        const clamped = Math.max(0, Math.min(tabs.length - 1, Number.isFinite(currentIndex) ? currentIndex : 0))
        if (currentIndex !== clamped) object.setInternalProperty('currentIndex', clamped)
        currentIndex = clamped
      }
      tabs.forEach((child, index) => {
        const childElement = this.mounted.get(child)?.element
        const selected = index === currentIndex
        if (child.hasProperty('checked') && child.getProperty('checked') !== selected) {
          child.setInternalProperty('checked', selected)
        }
        if (childElement) childElement.setAttribute('aria-selected', String(selected))
      })
    }
    if (element instanceof this.domDocument.defaultView!.HTMLProgressElement && object.typeName === 'ProgressBar') {
      element.max = Number(object.getProperty('to')) - Number(object.getProperty('from'))
      if (object.getProperty('indeterminate')) element.removeAttribute('value')
      else element.value = Number(object.getProperty('value')) - Number(object.getProperty('from'))
    }
  }

  private dateInputValue(value: unknown): string {
    const date = value instanceof Date ? value : new Date(String(value))
    if (Number.isNaN(date.getTime())) return ''
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  private projectCalendar(object: QmlObject, element: HTMLElement): void {
    const displayed = new Date(String(object.getProperty('displayedMonth')))
    const month = Number.isNaN(displayed.getTime()) ? new Date() : displayed
    const year = month.getUTCFullYear()
    const monthIndex = month.getUTCMonth()
    const locale = cssValue(object.getProperty('locale')) || 'en-US'
    const selected = this.dateInputValue(object.getProperty('selectedDate'))
    const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay()
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
    const title = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(month)
    const weekdays = Array.from({ length: 7 }, (_, index) => (
      new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + index)))
    ))
    const previous = this.domDocument.createElement('button')
    previous.type = 'button'
    previous.className = 'qml-calendar-nav'
    previous.ariaLabel = 'Previous month'
    previous.textContent = '‹'
    previous.addEventListener('click', () => object.setProperty('displayedMonth', new Date(Date.UTC(year, monthIndex - 1, 1))))
    const heading = this.domDocument.createElement('strong')
    heading.className = 'qml-calendar-title'
    heading.textContent = title
    const next = this.domDocument.createElement('button')
    next.type = 'button'
    next.className = 'qml-calendar-nav'
    next.ariaLabel = 'Next month'
    next.textContent = '›'
    next.addEventListener('click', () => object.setProperty('displayedMonth', new Date(Date.UTC(year, monthIndex + 1, 1))))
    const header = this.domDocument.createElement('div')
    header.className = 'qml-calendar-header'
    header.append(previous, heading, next)
    const grid = this.domDocument.createElement('div')
    grid.className = 'qml-calendar-grid'
    weekdays.forEach(weekday => {
      const label = this.domDocument.createElement('span')
      label.className = 'qml-calendar-weekday'
      label.textContent = weekday
      grid.append(label)
    })
    for (let index = 0; index < firstWeekday; index += 1) {
      const spacer = this.domDocument.createElement('span')
      spacer.className = 'qml-calendar-spacer'
      grid.append(spacer)
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(Date.UTC(year, monthIndex, day))
      const button = this.domDocument.createElement('button')
      button.type = 'button'
      button.className = 'qml-calendar-day'
      button.textContent = String(day)
      button.setAttribute('aria-selected', String(this.dateInputValue(date) === selected))
      button.addEventListener('click', () => {
        grid.querySelectorAll('.qml-calendar-day').forEach(dayButton => dayButton.setAttribute('aria-selected', 'false'))
        button.setAttribute('aria-selected', 'true')
        object.setProperty('selectedDate', date)
      })
      grid.append(button)
    }
    element.replaceChildren(header, grid)
  }

  private initializeCanvas(object: QmlObject, element: HTMLElement): void {
    if (!(element instanceof this.domDocument.defaultView!.HTMLCanvasElement)) return
    const contextType = String(object.getProperty('contextType') || '2d')
    const nativeContext = element.getContext(contextType as '2d')
    const context = nativeContext ? new QmlCanvasContext(nativeContext, contextType) : null
    object.setInternalProperty('context', context)
    object.setInternalProperty('available', Boolean(context))
    if (context) object.emitSignal('paint', context)
  }

  private projectTableView(object: QmlObject, element: HTMLElement): void {
    const model = object.getProperty('model')
    const rows = modelRows(model)
    const configuredColumns = object.getProperty('columns')
    const columns = Array.isArray(configuredColumns) && configuredColumns.length
      ? configuredColumns.map(String)
      : Object.keys((rows[0] as Record<string, unknown> | undefined) ?? {})
    const headers = object.getProperty('headers')
    const labels = Array.isArray(headers) && headers.length ? headers : columns
    const selected = new Set(Array.isArray(object.getProperty('selectedIndexes')) ? object.getProperty('selectedIndexes') as number[] : [])
    const configuredWidths = object.getProperty('columnWidths')
    const widths = Array.isArray(configuredWidths) ? configuredWidths.map(Number) : []
    element.setAttribute('role', 'grid')
    element.style.display = 'grid'
    element.style.gridTemplateColumns = columns.map((_, index) => {
      if (widths[index] > 0) {
        return index === columns.length - 1 ? `minmax(${widths[index]}px, 1fr)` : `${widths[index]}px`
      }
      return 'minmax(0, 1fr)'
    }).join(' ')
    const cells: HTMLElement[] = []
    labels.forEach((label, index) => {
      const header = this.domDocument.createElement('div')
      header.setAttribute('role', 'columnheader')
      header.dataset.columnIndex = String(index)
      header.textContent = cssValue(label)
      cells.push(header)
    })
    rows.forEach((row, rowIndex) => columns.forEach(column => {
      const cell = this.domDocument.createElement('div')
      cell.setAttribute('role', 'gridcell')
      cell.dataset.rowIndex = String(rowIndex)
      cell.setAttribute('aria-selected', String(selected.has(rowIndex)))
      cell.textContent = cssValue(row && typeof row === 'object' ? (row as Record<string, unknown>)[column] : row)
      cells.push(cell)
    }))
    element.replaceChildren(...cells)
  }

  private projectTreeView(object: QmlObject, element: HTMLElement): void {
    const model = object.getProperty('model')
    const rows = modelRows(model)
    const idRole = cssValue(object.getProperty('idRole'))
    const parentRole = cssValue(object.getProperty('parentRole'))
    const textRole = cssValue(object.getProperty('textRole'))
    const expanded = new Set(Array.isArray(object.getProperty('expandedIds')) ? object.getProperty('expandedIds') as unknown[] : [])
    const selected = new Set(Array.isArray(object.getProperty('selectedIndexes')) ? object.getProperty('selectedIndexes') as unknown[] : [])
    const expandAll = Boolean(object.getProperty('expanded'))
    const byParent = new Map<unknown, Array<Record<string, unknown>>>()
    rows.forEach((row, index) => {
      const value = row && typeof row === 'object' ? row as Record<string, unknown> : { [idRole]: index, [textRole]: row }
      const parent = value[parentRole] ?? null
      byParent.set(parent, [...(byParent.get(parent) ?? []), value])
    })
    const nodes: HTMLElement[] = []
    const append = (parent: unknown, depth: number) => (byParent.get(parent) ?? []).forEach(row => {
      const id = row[idRole]
      const children = byParent.get(id) ?? []
      const node = this.domDocument.createElement('div')
      node.setAttribute('role', 'treeitem')
      node.dataset.nodeId = cssValue(id)
      node.dataset.rowIndex = String(rows.indexOf(row))
      node.setAttribute('aria-selected', String(selected.has(id) || selected.has(rows.indexOf(row))))
      node.style.paddingLeft = `${depth * 16}px`
      const isExpanded = expandAll || expanded.has(id)
      node.textContent = `${children.length ? (isExpanded ? '▾ ' : '▸ ') : ''}${cssValue(row[textRole])}`
      nodes.push(node)
      if (isExpanded) append(id, depth + 1)
    })
    append(byParent.has(null) ? null : '', 0)
    element.setAttribute('role', 'tree')
    element.replaceChildren(...nodes)
  }

  private paintChart(object: QmlObject): void {
    const context = object.getProperty('context')
    if (!(context instanceof QmlCanvasContext) || context.contextType !== '2d') return
    const native = context.nativeContext as CanvasRenderingContext2D
    const width = Number(object.getProperty('width')) || 0
    const height = Number(object.getProperty('height')) || 0
    const series = object.getProperty('series')
    native.clearRect(0, 0, width, height)
    if (!Array.isArray(series) || series.length === 0) return
    const raw = series[0] instanceof QmlObject
      ? series[0].getProperty(series[0].hasProperty('points') ? 'points' : 'values')
      : series
    const values = Array.isArray(raw)
      ? raw.map(value => value && typeof value === 'object' ? Number((value as Record<string, unknown>).y) : Number(value))
      : []
    if (values.length === 0) return
    const maximum = Math.max(1, ...values)
    const barWidth = width / values.length
    values.forEach((value, index) => native.fillRect(
      index * barWidth,
      height - height * value / maximum,
      Math.max(1, barWidth - 2),
      height * value / maximum,
    ))
  }

  private paintParticles(object: QmlObject): void {
    const context = object.getProperty('context')
    if (!(context instanceof QmlCanvasContext) || context.contextType !== '2d') return
    const native = context.nativeContext as CanvasRenderingContext2D
    const width = Number(object.getProperty('width')) || 0
    const height = Number(object.getProperty('height')) || 0
    native.clearRect(0, 0, width, height)
    const particles = object.getProperty('particles')
    if (!Array.isArray(particles)) return
    for (const particle of particles) {
      if (!particle || typeof particle !== 'object') continue
      const value = particle as Record<string, unknown>
      native.beginPath()
      native.arc(Number(value.x), Number(value.y), Number(value.size) || 2, 0, Math.PI * 2)
      native.fill()
    }
  }

  private updateBranch(object: QmlObject): void {
    const node = this.mounted.get(object)
    if (node) {
      this.updateElement(object, node.element)
      this.syncTooltip(object, node.element)
    }
    object.children.forEach(child => this.updateBranch(child))
  }

  private syncFocusState(object: QmlObject, element: HTMLElement): void {
    const tabFocus = object.hasProperty('focusPolicy') && focusPolicyAllows(object.getProperty('focusPolicy'), 'tab')
    const clickFocus = object.hasProperty('focusPolicy') && focusPolicyAllows(object.getProperty('focusPolicy'), 'click')
    const keyboardFocusable = Boolean(object.getProperty('focus')) || Boolean(object.getProperty('activeFocusOnTab')) || tabFocus
    if (keyboardFocusable) element.tabIndex = 0
    else if (clickFocus) element.tabIndex = -1
    else element.removeAttribute('tabindex')
    if (object.getProperty('focus') && this.domDocument.activeElement !== element) element.focus()
  }

  private syncTooltip(object: QmlObject, element: HTMLElement): void {
    if (!object.hasProperty('ToolTip.text')) return
    const text = String(object.getProperty('ToolTip.text') ?? '')
    const visible = Boolean(object.getProperty('ToolTip.visible'))
    const delay = Number(object.getProperty('ToolTip.delay')) || 0
    const timeout = Number(object.getProperty('ToolTip.timeout') ?? -1)

    const existingTimer = this.tooltipTimers.get(object)
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer)
      this.tooltipTimers.delete(object)
    }

    if (!visible || !text) {
      const el = this.tooltipElements.get(object)
      if (el) el.style.display = 'none'
      return
    }

    const show = () => {
      let el = this.tooltipElements.get(object)
      if (!el) {
        el = this.domDocument.createElement('div')
        el.className = 'qml-tooltip'
        ;(this.container ?? this.domDocument.body).append(el)
        this.tooltipElements.set(object, el)
      }
      el.textContent = text
      el.style.display = 'block'
      // position just below the element using its bounding rect relative to container
      const containerRect = this.container?.getBoundingClientRect() ?? { left: 0, top: 0 }
      const rect = element.getBoundingClientRect()
      el.style.left = `${rect.left - containerRect.left}px`
      el.style.top  = `${rect.bottom - containerRect.top + 4}px`
      if (timeout > 0) {
        this.tooltipTimers.set(object, setTimeout(() => {
          el!.style.display = 'none'
          this.tooltipTimers.delete(object)
        }, timeout))
      }
    }

    if (delay > 0) {
      this.tooltipTimers.set(object, setTimeout(show, delay))
    } else {
      show()
    }
  }

  private syncChildren(object: QmlObject, element: HTMLElement): void {
    const children = orderedVisualChildren(object)
    for (const [mountedObject, node] of [...this.mounted]) {
      if (node.parent === object && !children.includes(mountedObject)) {
        this.unmountObject(mountedObject)
      }
    }
    for (const child of children) {
      if (!this.mounted.has(child)) this.mountObject(child, element, object)
      else element.append(this.mounted.get(child)!.element)
    }
  }

  private unmountObject(object: QmlObject): void {
    for (const [child, node] of [...this.mounted]) {
      if (node.parent === object) this.unmountObject(child)
    }
    const node = this.mounted.get(object)
    if (!node) return
    node.unsubscribe.forEach(unsubscribe => unsubscribe())
    node.removeEvents.forEach(removeEvent => removeEvent())
    node.anchorUnsubscribe.forEach(unsubscribe => unsubscribe())
    node.element.remove()
    this.mounted.delete(object)
  }

  /**
   * 订阅本对象 anchors 锚定目标（兄弟或父）的几何变化。
   * QML 中 anchors 目标是声明式的：目标尺寸/位置变化时锚定项自动跟随。
   * 父项变化已由 updateBranch 递归覆盖，这里只需补兄弟目标。
   */
  private subscribeAnchorTargets(object: QmlObject, element: HTMLElement): Array<() => void> {
    const unsubscribers: Array<() => void> = []
    const seen = new Set<QmlObject>()
    const subscribe = (value: unknown) => {
      const target = resolveAnchorTarget(value, object.parent, this.ids)
      if (!target || target === object || seen.has(target)) return
      seen.add(target)
      const refresh = () => {
        const node = this.mounted.get(object)
        if (node) this.updateElement(object, node.element)
      }
      for (const prop of ['width', 'height', 'x', 'y'] as const) {
        if (target.hasProperty(prop)) unsubscribers.push(target.onPropertyChanged(prop, refresh))
      }
      // 目标显式设置了尺寸但当前未挂载（例如 anchor 目标晚于本对象挂载）时，
      // 目标挂载完成后的 updateElement 会重算本对象，无需额外处理。
      void element
    }
    for (const prop of anchorTargetProperties) {
      if (object.hasProperty(prop)) subscribe(object.getProperty(prop))
    }
    return unsubscribers
  }

  private resolveGeometry(object: QmlObject): {
    x: number
    y: number
    width: number
    height: number
  } {
    let x = Number(object.getProperty('x')) || 0
    let y = Number(object.getProperty('y')) || 0
    let width = Number(object.getProperty('width')) || Number(object.getProperty('implicitWidth')) || 0
    let height = Number(object.getProperty('height')) || Number(object.getProperty('implicitHeight')) || 0
    const parent = object.parent
    if (!parent || !isVisualObject(parent)) return { x, y, width, height }
    if (['Flickable', 'ListView', 'GridView', 'PathView'].includes(parent.typeName)) {
      x -= Number(parent.getProperty('contentX')) || 0
      y -= Number(parent.getProperty('contentY')) || 0
    }
    // QML 标准：StackLayout 会把每个子项 resize 填满整个布局区域。
    // （QtQuick.Layouts 的 QQuickStackLayout::updateLayout() 对每个子项设置
    //   layoutGeom = (0, 0, width, height)，覆盖子项自身的 width/height/anchors。）
    if (parent.typeName === 'StackLayout') {
      let layoutWidth = Number(parent.getProperty('width')) || 0
      let layoutHeight = Number(parent.getProperty('height')) || 0
      // StackLayout 常嵌在 ColumnLayout 等布局容器里，不一定是 ApplicationWindow
      // 的直接子项，因此沿容器链向上查找 ApplicationWindow。
      let window: QmlObject | null = null
      for (let p = parent.parent; p; p = p.parent) {
        if (p.typeName === 'ApplicationWindow') {
          window = p
          break
        }
      }
      if (window) {
        // ApplicationWindow 内容区是 CSS Grid 的 1fr 行：
        // 内容区宽 = 窗口宽，内容区高 = 窗口高 - menuBar - header - footer（显式高或隐式高）
        layoutWidth = Number(window.getProperty('width')) || layoutWidth
        const strips = applicationWindowChromeHeights(window)
        layoutHeight = Math.max(0, (Number(window.getProperty('height')) || layoutHeight)
          - strips.menuBar - strips.header - strips.footer)
        // StackLayout 是布局容器的子项时，与兄弟项共享容器空间（QML 布局行为）：
        // 沿主轴扣减兄弟尺寸——Column/ColumnLayout 扣高度，Row/RowLayout 扣宽度，
        // 使模型尺寸与 CSS flex 分配结果一致（用声明尺寸避免递归）。
        const layoutParent = parent.parent
        if (layoutParent && ['ColumnLayout', 'Column'].includes(layoutParent.typeName)) {
          const siblingHeight = orderedVisualChildren(layoutParent)
            .filter(child => child !== parent)
            .reduce((sum, sibling) => sum + (Number(sibling.getProperty('height')) || Number(sibling.getProperty('implicitHeight')) || 0), 0)
          layoutHeight = Math.max(0, layoutHeight - siblingHeight)
        } else if (layoutParent && ['RowLayout', 'Row'].includes(layoutParent.typeName)) {
          const siblingWidth = orderedVisualChildren(layoutParent)
            .filter(child => child !== parent)
            .reduce((sum, sibling) => sum + (Number(sibling.getProperty('width')) || Number(sibling.getProperty('implicitWidth')) || 0), 0)
          layoutWidth = Math.max(0, layoutWidth - siblingWidth)
        }
      }
      // QML 方式（QQuickStackLayout::implicitSize）：无显式尺寸时用隐式尺寸，
      // 即所有子项隐式尺寸的最大值（与 Qt 源码逐行一致）。
      if (layoutWidth <= 0 || layoutHeight <= 0) {
        let implicitWidth = 0
        let implicitHeight = 0
        for (const child of orderedVisualChildren(parent)) {
          const declaredWidth = Number(child.getProperty('implicitWidth')) || 0
          const declaredHeight = Number(child.getProperty('implicitHeight')) || 0
          const content = contentImplicitSize(child)
          implicitWidth = Math.max(implicitWidth, declaredWidth > 0 ? declaredWidth : content?.width ?? 0)
          implicitHeight = Math.max(implicitHeight, declaredHeight > 0 ? declaredHeight : content?.height ?? 0)
        }
        if (layoutWidth <= 0) layoutWidth = Number(parent.getProperty('implicitWidth')) || implicitWidth
        if (layoutHeight <= 0) layoutHeight = Number(parent.getProperty('implicitHeight')) || implicitHeight
      }
      if (layoutWidth > 0 && layoutHeight > 0) {
        return { x: 0, y: 0, width: layoutWidth, height: layoutHeight }
      }
    }

    const targetFor = (value: unknown): QmlObject | null => resolveAnchorTarget(value, parent, this.ids)
    // 锚定线的坐标在父坐标系中：锚定父项时其坐标为 (0,0)，
    // 锚定兄弟时使用兄弟对象在父坐标系中的属性几何。
    const targetOrigin = (target: QmlObject): { x: number; y: number } => (
      target === parent
        ? { x: 0, y: 0 }
        : { x: Number(target.getProperty('x')) || 0, y: Number(target.getProperty('y')) || 0 }
    )
    const targetSize = (target: QmlObject) => {
      if (target === parent && parent.typeName === 'ApplicationWindow') {
        // Qt 中 ApplicationWindow 的子项挂在 contentItem 上，
        // contentItem 的几何 = 窗口 − menuBar − header − footer。
        // 因此锚定 parent（ApplicationWindow）时，parent 的有效尺寸是内容区。
        const winWidth = Number(parent.getProperty('width')) || 0
        const winHeight = Number(parent.getProperty('height')) || 0
        const strips = applicationWindowChromeHeights(parent)
        return {
          width: winWidth,
          height: Math.max(0, winHeight - strips.menuBar - strips.header - strips.footer),
        }
      }
      return {
        width: Number(target.getProperty('width')) || Number(target.getProperty('implicitWidth')) || 0,
        height: Number(target.getProperty('height')) || Number(target.getProperty('implicitHeight')) || 0,
      }
    }
    const margin = Number(object.getProperty('anchors.margins')) || 0
    const leftMargin = Number(object.getProperty('anchors.leftMargin')) || margin
    const rightMargin = Number(object.getProperty('anchors.rightMargin')) || margin
    const topMargin = Number(object.getProperty('anchors.topMargin')) || margin
    const bottomMargin = Number(object.getProperty('anchors.bottomMargin')) || margin
    const horizontalCenterOffset = Number(object.getProperty('anchors.horizontalCenterOffset')) || 0
    const verticalCenterOffset = Number(object.getProperty('anchors.verticalCenterOffset')) || 0
    const baselineOffset = Number(object.getProperty('anchors.baselineOffset')) || 0
    // Qt: alignWhenCentered=true（默认）时 centered anchors 对齐到整像素；
    // false 时允许亚像素中心位置。
    const alignWhenCentered = object.getProperty('anchors.alignWhenCentered') !== false
    const fillTarget = targetFor(object.getProperty('anchors.fill'))
    if (fillTarget) {
      const target = targetSize(fillTarget)
      const origin = targetOrigin(fillTarget)
      return {
        x: origin.x + leftMargin,
        y: origin.y + topMargin,
        width: Math.max(0, target.width - leftMargin - rightMargin),
        height: Math.max(0, target.height - topMargin - bottomMargin),
      }
    }

    const centerTarget = targetFor(object.getProperty('anchors.centerIn'))
    if (centerTarget) {
      const target = targetSize(centerTarget)
      const origin = targetOrigin(centerTarget)
      const cx = origin.x + (target.width - width) / 2 + horizontalCenterOffset
      const cy = origin.y + (target.height - height) / 2 + verticalCenterOffset
      x = alignWhenCentered ? Math.round(cx) : cx
      y = alignWhenCentered ? Math.round(cy) : cy
    }
    const horizontalTarget = targetFor(object.getProperty('anchors.horizontalCenter'))
    if (horizontalTarget) {
      const hx = targetOrigin(horizontalTarget).x + (targetSize(horizontalTarget).width - width) / 2 + horizontalCenterOffset
      x = alignWhenCentered ? Math.round(hx) : hx
    }
    const verticalTarget = targetFor(object.getProperty('anchors.verticalCenter'))
    if (verticalTarget) {
      const vy = targetOrigin(verticalTarget).y + (targetSize(verticalTarget).height - height) / 2 + verticalCenterOffset
      y = alignWhenCentered ? Math.round(vy) : vy
    }

    const leftTarget = targetFor(object.getProperty('anchors.left'))
    const rightTarget = targetFor(object.getProperty('anchors.right'))
    if (leftTarget) x = targetOrigin(leftTarget).x + leftMargin
    if (rightTarget) {
      const target = targetSize(rightTarget)
      const rightOrigin = targetOrigin(rightTarget).x
      if (leftTarget) {
        // 差异2：显式设置了 width → width 优先，right 忽略（QML 定义）
        const explicitWidth = object.isExplicitlySet('width') && Number(object.getProperty('width')) > 0
        if (explicitWidth) {
          // 显式 width 时，left 生效，right 忽略
        } else {
          width = Math.max(0, rightOrigin + target.width - targetOrigin(leftTarget).x - leftMargin - rightMargin)
        }
      } else {
        x = rightOrigin + target.width - width - rightMargin
      }
    }
    const topTarget = targetFor(object.getProperty('anchors.top'))
    const bottomTarget = targetFor(object.getProperty('anchors.bottom'))
    if (topTarget) y = targetOrigin(topTarget).y + topMargin
    if (bottomTarget) {
      const target = targetSize(bottomTarget)
      const bottomOrigin = targetOrigin(bottomTarget).y
      if (topTarget) {
        const explicitHeight = object.isExplicitlySet('height') && Number(object.getProperty('height')) > 0
        if (explicitHeight) {
          // 显式 height 时，top 生效，bottom 忽略
        } else {
          height = Math.max(0, bottomOrigin + target.height - targetOrigin(topTarget).y - topMargin - bottomMargin)
        }
      } else {
        y = bottomOrigin + target.height - height - bottomMargin
      }
    }
    // baseline 对齐（Qt 标准）：self.baseline 对齐 target.baseline。
    // baseline 位置 = y + baselineOffset；文本控件 baselineOffset ≈ ascent，
    // 普通 Item 默认 0（基线在顶部）。anchors.baselineOffset 为额外偏移（正值向下）。
    const baselineTarget = targetFor(object.getProperty('anchors.baseline'))
    if (baselineTarget) {
      const targetBaseline = targetOrigin(baselineTarget).y + baselineOffsetFor(baselineTarget)
      y = targetBaseline - baselineOffsetFor(object) + baselineOffset
    }
    return { x, y, width, height }
  }

  private installEvents(object: QmlObject, element: HTMLElement): Array<() => void> {
    const removers: Array<() => void> = []
    let delayTimer: number | null = null
    const listen = (name: string, listener: EventListener) => {
      element.addEventListener(name, listener)
      removers.push(() => element.removeEventListener(name, listener))
    }
    const mousePayload = (event: MouseEvent) => ({
      x: event.offsetX,
      y: event.offsetY,
      button: event.button,
      buttons: event.buttons,
      alt: event.altKey,
      control: event.ctrlKey,
      shift: event.shiftKey,
      meta: event.metaKey,
    })
    const pointerPayload = (event: PointerEvent) => ({
      x: event.offsetX,
      y: event.offsetY,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      isPrimary: event.isPrimary,
      pressure: event.pressure,
      buttons: event.buttons,
    })

    listen('focus', () => object.callMethod('forceActiveFocus'))
    listen('blur', () => object.setInternalProperty('activeFocus', false))
    const emitKey = (name: 'pressed' | 'released', event: KeyboardEvent) => {
      const attachedSignal = `Keys.${name}`
      const itemSignal = name === 'pressed' ? 'keyPressed' : 'keyReleased'
      const emitAttached = () => {
        if (!object.getProperty('Keys.enabled')) return
        object.emitSignal(attachedSignal, event)
        const forwardTo = object.getProperty('Keys.forwardTo')
        if (Array.isArray(forwardTo)) {
          forwardTo.filter((target): target is QmlObject => target instanceof QmlObject)
            .forEach(target => target.emitSignal(attachedSignal, event))
        }
      }
      if (String(object.getProperty('Keys.priority')).includes('AfterItem')) {
        object.emitSignal(itemSignal, event)
        emitAttached()
      } else {
        emitAttached()
        object.emitSignal(itemSignal, event)
      }
    }
    listen('keydown', event => {
      const navigationProperty: Record<string, string> = {
        ArrowLeft: 'KeyNavigation.left', ArrowRight: 'KeyNavigation.right',
        ArrowUp: 'KeyNavigation.up', ArrowDown: 'KeyNavigation.down',
        Tab: event.shiftKey ? 'KeyNavigation.backtab' : 'KeyNavigation.tab',
      }
      const propertyName = navigationProperty[event.key]
      const target = propertyName ? object.getProperty(propertyName) : null
      if (target instanceof QmlObject && target.hasMethod('forceActiveFocus')) target.callMethod('forceActiveFocus')
      emitKey('pressed', event)
    })
    listen('keyup', event => emitKey('released', event))

    if (object.hasProperty('hovered')) {
      listen('mouseenter', () => object.setInternalProperty('hovered', true))
      listen('mouseleave', () => object.setInternalProperty('hovered', false))
    }

    if (object.hasProperty('focusPolicy')) {
      listen('mousedown', () => {
        if (focusPolicyAllows(object.getProperty('focusPolicy'), 'click')) element.focus()
      })
    }

    const isAbstractButton = buttonTypes.has(object.typeName) || checkTypes.has(object.typeName)
    if (isAbstractButton) {
      let pressAndHoldTimer: number | null = null
      let pressAndHoldTriggered = false

      const clearPressAndHold = () => {
        if (pressAndHoldTimer !== null) this.domDocument.defaultView?.clearTimeout(pressAndHoldTimer)
        pressAndHoldTimer = null
        pressAndHoldTriggered = false
      }
      const startPressAndHold = () => {
        clearPressAndHold()
        if (!object.hasSignal('pressAndHold')) return
        pressAndHoldTimer = this.domDocument.defaultView?.setTimeout(() => {
          pressAndHoldTriggered = true
          object.emitSignal('pressAndHold')
        }, 800) ?? null
      }

      // DelayButton 延迟动画（仅 DelayButton 使用）
      // Qt 语义：按下后 progress 0→1 由 transition 块里的 NumberAnimation 驱动
      // （duration 控制时长、easing.type 控制曲线）；未定义 transition 时退回
      // 线性步进，用 delay 作为总时长。
      const progressAnimationTypes = new Set([
        'NumberAnimation', 'PropertyAnimation', 'ColorAnimation', 'Vector3dAnimation',
      ])
      const delayProgressAnimation = () => {
        const transition = object.getProperty('transition')
        if (!(transition instanceof QmlObject) || transition.typeName !== 'Transition') return undefined
        return transition.children.find(child => (
          progressAnimationTypes.has(child.typeName) &&
          String(child.getProperty('property') || child.getProperty('properties'))
            .split(',')
            .map(name => name.trim())
            .includes('progress')
        ))
      }
      const cancelDelay = () => {
        if (delayTimer !== null) this.domDocument.defaultView?.clearInterval(delayTimer)
        delayTimer = null
        // 仅在尚未激活时重置进度（已激活的按钮保持 progress=1）
        if (object.typeName === 'DelayButton' && !object.getProperty('checked')) {
          object.setInternalProperty('progress', 0)
          element.style.removeProperty('background-image')
        }
      }
      const startDelay = () => {
        if (object.typeName !== 'DelayButton') return
        cancelDelay()
        const animation = delayProgressAnimation()
        const duration = animation
          ? Math.max(0, Number(animation.getProperty('duration')) || 0)
          : Math.max(0, Number(object.getProperty('delay')) || 0)
        const easing = animation
          ? resolveQmlEasing(animation.getProperty('easing.type'))
          : QmlEasing.Linear
        const tickInterval = 16
        // 用户自定义了 background 时进度条由 background 内的绑定（control.progress）
        // 呈现，不再画默认主题色渐变，遵循"指定用用户的、不指定用主题色"。
        const hasCustomBackground = object.getProperty('background') instanceof QmlObject
        const material = !!element.closest('[data-qml-style="material"]')
        const fillColor = material ? 'color-mix(in srgb, var(--qml-on-accent) 50%, transparent)' : 'var(--qml-accent)'
        const startedAt = Date.now()
        const tick = () => {
          const timeRatio = duration === 0 ? 1 : Math.min(1, (Date.now() - startedAt) / duration)
          // 缓动曲线可能过冲（Back/Elastic/Bounce），进度值保留原始值，填充条视觉上夹取到 0..1
          const progress = easing(timeRatio)
          object.setInternalProperty('progress', progress)
          if (!hasCustomBackground) {
            const clamped = Math.max(0, Math.min(1, progress))
            element.style.backgroundImage = `linear-gradient(90deg, ${fillColor} ${clamped * 100}%, transparent ${clamped * 100}%)`
          }
          if (timeRatio < 1) return
          if (!object.getProperty('checked')) {
            object.setProperty('checked', true)
            object.emitSignal('toggled')
          }
          cancelDelay()
          object.emitSignal('activated')
        }
        tick()
        if (Date.now() - startedAt < duration) {
          delayTimer = this.domDocument.defaultView?.setInterval(tick, tickInterval) ?? null
        }
      }

      // activate: 点击时的统一入口（AbstractButton.clicked 语义）
      // DelayButton 也走这里（Qt 语义：未取消的按下-释放即触发 clicked；
      // 延迟完成的 activated 由 startDelay 独立发出）
      const activate = () => {
        if (!object.getProperty('enabled')) return
        if (pressAndHoldTriggered) return

        // --- toggle 逻辑：按子类型分发 ---
        if (checkTypes.has(object.typeName)) {
          // CheckBox / RadioButton / Switch：始终 toggle
          try {
            if (object.typeName === 'CheckBox') {
              // Qt 语义（QQuickCheckBox::nextCheckState）：
              // 用户提供 nextCheckState 回调时无条件调用（与 tristate 无关）；
              // 无回调且 tristate 时三态循环 (checkState+1)%3；
              // 无回调时走默认 checked 翻转。
              const nextCheckState = object.getProperty('nextCheckState')
              if (typeof nextCheckState === 'function') {
                const nextState = nextCheckState()
                object.setProperty('checkState', nextState)
                object.setProperty('checked', nextState !== 0)
              } else if (object.getProperty('tristate')) {
                const currentState = Number(object.getProperty('checkState'))
                const nextState = (currentState + 1) % 3
                object.setProperty('checkState', nextState)
                object.setProperty('checked', nextState !== 0)
              } else {
                const next = !object.getProperty('checked')
                object.setProperty('checked', next)
                // 非 tristate 时 checked 与 checkState 保持同步
                object.setProperty('checkState', next ? 2 : 0)
              }
            } else if (object.typeName === 'RadioButton') {
              if (!object.getProperty('checked')) {
                ;[...this.mounted.keys()]
                  .filter(sibling => sibling !== object && sibling.parent === object.parent &&
                    sibling.typeName === 'RadioButton' && sibling.getProperty('checked'))
                  .forEach(sibling => {
                    sibling.setProperty('checked', false)
                    sibling.emitSignal('toggled')
                  })
                object.setProperty('checked', true)
              }
            } else {
              object.setProperty('checked', !object.getProperty('checked'))
            }
          } catch (error) {
            // 即使绑定引擎求值失败，也要继续发射信号
            console.error('CheckBox toggle error:', error)
          }
          object.emitSignal('toggled')
        } else if (object.getProperty('checkable')) {
          // Button (checkable=true) 的 toggle
          try {
            object.callMethod('toggle')
          } catch (error) {
            console.error('Button toggle error:', error)
          }
          object.emitSignal('toggled')
        }

        object.emitSignal('clicked')

        // --- 子类型特有后处理 ---
        if (object.typeName === 'TabButton' && object.parent?.typeName === 'TabBar') {
          const index = orderedVisualChildren(object.parent).indexOf(object)
          object.parent.setProperty('currentIndex', index)
          if (object.parent.hasSignal('activated')) {
            object.parent.emitSignal('activated', index)
          }
        }
        if (object.typeName === 'ItemDelegate' && object.hasProperty('index') && ['ListView', 'GridView', 'PathView'].includes(object.parent?.typeName ?? '')) {
          const index = Number(object.getProperty('index'))
          const itemView = object.parent!
          itemView.setProperty('currentIndex', index)
          itemView.emitSignal('activated', index)
        }
        if (object.typeName === 'MenuItem' && object.parent?.typeName === 'Menu') object.parent.callMethod('close')
      }

      // === 通用鼠标/键盘事件（AbstractButton 层） ===
      listen('mousedown', event => {
        object.setInternalProperty('pressed', true)
        object.setInternalProperty('down', true)
        object.setInternalProperty('pressX', (event as MouseEvent).offsetX)
        object.setInternalProperty('pressY', (event as MouseEvent).offsetY)
        object.emitSignal('pressed')
        startDelay()
        startPressAndHold()
      })
      listen('mouseup', () => {
        object.setInternalProperty('pressed', false)
        object.setInternalProperty('down', false)
        object.emitSignal('released')
        cancelDelay()
        clearPressAndHold()
      })
      listen('mouseleave', () => {
        if (!object.getProperty('pressed')) return
        object.setInternalProperty('pressed', false)
        object.setInternalProperty('down', false)
        object.emitSignal('canceled')
        cancelDelay()
        clearPressAndHold()
      })
      listen('click', activate)
      listen('dblclick', () => object.emitSignal('doubleClicked'))
      listen('keydown', event => {
        if ((event as KeyboardEvent).key !== ' ' || (event as KeyboardEvent).repeat) return
        event.preventDefault()
        object.setInternalProperty('pressed', true)
        object.setInternalProperty('down', true)
        object.emitSignal('pressed')
        startPressAndHold()
      })
      listen('keyup', event => {
        if ((event as KeyboardEvent).key !== ' ') return
        event.preventDefault()
        object.setInternalProperty('pressed', false)
        object.setInternalProperty('down', false)
        object.emitSignal('released')
        clearPressAndHold()
        activate()
      })
      removers.push(cancelDelay, clearPressAndHold)
    }

    if (textInputTypes.has(object.typeName)) {
      listen('input', event => {
        object.setProperty('text', (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value)
      })
      listen('change', () => object.emitSignal('editingFinished'))
      listen('keydown', event => {
        if ((event as KeyboardEvent).key === 'Enter') object.emitSignal('accepted')
      })
    }

    if (object.typeName === 'Slider') {
      listen('input', event => {
        const input = event.target as HTMLInputElement
        if (!input.classList.contains('qml-range-native')) return
        object.setProperty('value', Number(input.value))
        object.emitSignal('moved')
      })
      listen('keydown', event => {
        const key = (event as KeyboardEvent).key
        if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(key)) return
        if (key === 'ArrowLeft' || key === 'ArrowDown') object.callMethod('decrease')
        else object.callMethod('increase')
        object.emitSignal('moved')
      })
    }

    if (object.typeName === 'Dial') {
      listen('input', event => {
        const input = event.target as HTMLInputElement
        if (!input.classList.contains('qml-range-native')) return
        object.setProperty('value', Number(input.value))
        object.emitSignal('moved')
      })
    }

    if (object.typeName === 'RangeSlider') {
      let dragging: 'first' | 'second' | null = null

      const getPosition = (clientX: number) => {
        const rect = element.getBoundingClientRect()
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      }

      const snapValue = (value: number): number => {
        const from = Number(object.getProperty('from')) || 0
        const to = Number(object.getProperty('to')) || 100
        const stepSize = Number(object.getProperty('stepSize')) || 0
        if (stepSize <= 0) return value
        return Math.round((value - from) / stepSize) * stepSize + from
      }

      const setValue = (handle: 'first' | 'second', clientX: number) => {
        const pos = getPosition(clientX)
        const from = Number(object.getProperty('from')) || 0
        const to = Number(object.getProperty('to')) || 100
        const value = snapValue(from + pos * (to - from))
        const first = Number(object.getProperty('first.value'))
        const second = Number(object.getProperty('second.value'))
        if (handle === 'first') {
          object.setProperty('first.value', Math.min(value, second))
        } else {
          object.setProperty('second.value', Math.max(value, first))
        }
        object.emitSignal('moved')
      }

      listen('mousedown', event => {
        const e = event as MouseEvent
        const handle = (e.target as HTMLElement).closest('.qml-range-handle') as HTMLElement | null
        if (handle) {
          dragging = handle.dataset.rangeHandle as 'first' | 'second'
          e.preventDefault()
          return
        }
        // Click on track — move nearest handle
        const pos = getPosition(e.clientX)
        const from = Number(object.getProperty('from')) || 0
        const to = Number(object.getProperty('to')) || 100
        const value = from + pos * (to - from)
        const first = Number(object.getProperty('first.value'))
        const second = Number(object.getProperty('second.value'))
        const distFirst = Math.abs(value - first)
        const distSecond = Math.abs(value - second)
        setValue(distFirst <= distSecond ? 'first' : 'second', e.clientX)
      })

      const doc = this.domDocument.defaultView?.document
      if (doc) {
        const moveHandler = (e: globalThis.MouseEvent) => {
          if (!dragging) return
          setValue(dragging, e.clientX)
        }
        const upHandler = () => { dragging = null }
        doc.addEventListener('mousemove', moveHandler)
        doc.addEventListener('mouseup', upHandler)
        removers.push(() => doc.removeEventListener('mousemove', moveHandler))
        removers.push(() => doc.removeEventListener('mouseup', upHandler))
      }
    }

    if (object.typeName === 'SpinBox') {
      const normalizeSpinBoxValue = (candidate: number): number => {
        const from = Number(object.getProperty('from'))
        const to = Number(object.getProperty('to'))
        const lower = Math.min(from, to)
        const upper = Math.max(from, to)
        const wrap = Boolean(object.getProperty('wrap'))
        if (!Number.isFinite(candidate)) return Number(object.getProperty('value')) || 0
        if (wrap && upper > lower) {
          if (candidate > upper) return lower
          if (candidate < lower) return upper
        }
        return Math.max(lower, Math.min(upper, candidate))
      }

      const commitSpinBoxValue = (candidate: number) => {
        object.setProperty('value', normalizeSpinBoxValue(candidate))
        object.emitSignal('valueModified')
      }

      listen('input', event => {
        commitSpinBoxValue(Number((event.currentTarget as HTMLInputElement).value))
      })
      listen('keydown', event => {
        const key = (event as KeyboardEvent).key
        if (key !== 'ArrowUp' && key !== 'ArrowDown') return
        event.preventDefault()
        const step = Number(object.getProperty('stepSize')) || 1
        commitSpinBoxValue(Number(object.getProperty('value')) + (key === 'ArrowUp' ? step : -step))
      })
      listen('wheel', event => {
        event.preventDefault()
        const step = Number(object.getProperty('stepSize')) || 1
        const direction = (event as WheelEvent).deltaY >= 0 ? -1 : 1
        commitSpinBoxValue(Number(object.getProperty('value')) + direction * step)
      })
    }

    if (object.typeName === 'ComboBox') {
      listen('change', event => {
        const select = event.currentTarget as HTMLSelectElement
        object.setProperty('currentIndex', select.selectedIndex)
        object.setInternalProperty('currentText', select.selectedIndex >= 0 ? select.options[select.selectedIndex]?.text ?? '' : '')
        object.emitSignal('activated', select.selectedIndex)
      })
    }
    if (object.typeName === 'Tumbler') {
      const selectIndex = (index: number) => {
        const model = object.getProperty('model')
        const count = Array.isArray(model) ? model.length : Math.max(0, Number(model) || 0)
        if (!count) return
        const next = object.getProperty('wrap') ? (index + count) % count : Math.max(0, Math.min(count - 1, index))
        object.setProperty('currentIndex', next)
        object.setInternalProperty('currentItem', Array.isArray(model) ? model[next] : next)
        object.emitSignal('activated', next)
      }
      listen('click', event => {
        const item = (event.target as HTMLElement).closest<HTMLElement>('[data-index]')
        if (item) selectIndex(Number(item.dataset.index))
      })
      listen('wheel', event => {
        event.preventDefault()
        const model = object.getProperty('model')
        const count = Array.isArray(model) ? model.length : Math.max(0, Number(model) || 0)
        if (!count) return
        const direction = (event as WheelEvent).deltaY >= 0 ? 1 : -1
        selectIndex(Number(object.getProperty('currentIndex')) + direction)
      })
    }

    if (object.typeName === 'DatePicker' || object.typeName === 'TimePicker') {
      listen('change', event => {
        const input = event.currentTarget as HTMLInputElement
        object.setProperty(object.typeName === 'DatePicker' ? 'selectedDate' : 'time', input.value)
      })
    }

    if (object.typeName === 'TableView') {
      listen('click', event => {
        const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-row-index]')
        if (!cell) return
        const index = Number(cell.dataset.rowIndex)
        object.setProperty('currentIndex', index)
        const additive = (event as MouseEvent).ctrlKey || (event as MouseEvent).metaKey
        const selected = new Set(additive && Array.isArray(object.getProperty('selectedIndexes'))
          ? object.getProperty('selectedIndexes') as number[] : [])
        if (additive && selected.has(index)) selected.delete(index)
        else selected.add(index)
        object.setInternalProperty('selectedIndexes', [...selected])
        object.emitSignal('activated', index)
      })
      listen('mousedown', event => {
        if (!object.getProperty('resizableColumns')) return
        const header = (event.target as HTMLElement).closest<HTMLElement>('[data-column-index]')
        if (!header) return
        const rect = header.getBoundingClientRect()
        if (rect.right - (event as MouseEvent).clientX > 8) return
        const index = Number(header.dataset.columnIndex)
        const startX = (event as MouseEvent).clientX
        const widths = Array.isArray(object.getProperty('columnWidths')) ? [...object.getProperty('columnWidths') as number[]] : []
        const startWidth = widths[index] || rect.width || 80
        const move = (moveEvent: MouseEvent) => {
          widths[index] = Math.max(24, startWidth + moveEvent.clientX - startX)
          object.setProperty('columnWidths', [...widths])
        }
        const up = () => {
          this.domDocument.removeEventListener('mousemove', move)
          this.domDocument.removeEventListener('mouseup', up)
        }
        this.domDocument.addEventListener('mousemove', move)
        this.domDocument.addEventListener('mouseup', up)
        removers.push(up)
      })
    }

    if (['ListView', 'GridView', 'PathView'].includes(object.typeName)) {
      listen('keydown', event => {
        const key = (event as KeyboardEvent).key
        if (key !== 'ArrowDown' && key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowLeft') return
        event.preventDefault()
        object.callMethod(key === 'ArrowDown' || key === 'ArrowRight' ? 'incrementCurrentIndex' : 'decrementCurrentIndex')
      })
      if (object.typeName === 'ListView') listen('wheel', event => {
        event.preventDefault()
        const horizontal = object.getProperty('orientation') === 'ListView.Horizontal'
        const delta = horizontal ? (event as WheelEvent).deltaX || (event as WheelEvent).deltaY : (event as WheelEvent).deltaY
        const property = horizontal ? 'contentX' : 'contentY'
        const contentSize = Number(object.getProperty(horizontal ? 'contentWidth' : 'contentHeight')) || 0
        const viewportSize = Number(object.getProperty(horizontal ? 'width' : 'height')) || 0
        const next = Math.max(0, Math.min(Math.max(0, contentSize - viewportSize), Number(object.getProperty(property)) + delta))
        object.setProperty(property, next)
      })
    }

    if (object.typeName === 'TreeView') {
      listen('click', event => {
        const node = (event.target as HTMLElement).closest<HTMLElement>('[data-node-id]')
        if (!node) return
        const index = Number(node.dataset.rowIndex)
        const id = node.dataset.nodeId ?? ''
        const expanded = new Set(Array.isArray(object.getProperty('expandedIds')) ? object.getProperty('expandedIds') as unknown[] : [])
        if (object.getProperty('expanded')) {
          const rows = modelRows(object.getProperty('model'))
          const idRole = String(object.getProperty('idRole'))
          const parentRole = String(object.getProperty('parentRole'))
          const parentIds = new Set(rows.map(row => row && typeof row === 'object' ? (row as Record<string, unknown>)[parentRole] : null))
          rows.forEach(row => {
            if (row && typeof row === 'object') {
              const candidate = (row as Record<string, unknown>)[idRole]
              if (parentIds.has(candidate)) expanded.add(String(candidate))
            }
          })
          object.setProperty('expanded', false)
        }
        if (expanded.has(id)) {
          expanded.delete(id)
          object.emitSignal('collapsed', index)
        } else {
          expanded.add(id)
          object.emitSignal('expanded', index)
        }
        object.setProperty('expandedIds', [...expanded])
        object.setProperty('currentIndex', index)
        object.setInternalProperty('selectedIndexes', [index])
        object.emitSignal('activated', index)
      })
    }

    if (object.typeName === 'Image' && element instanceof this.domDocument.defaultView!.HTMLImageElement) {
      listen('load', () => {
        object.setInternalProperty('implicitWidth', element.naturalWidth)
        object.setInternalProperty('implicitHeight', element.naturalHeight)
        object.setInternalProperty('status', 1)
      })
      listen('error', () => object.setInternalProperty('status', 3))
    }

    if (object.typeName === 'WebEngineView' && element instanceof this.domDocument.defaultView!.HTMLIFrameElement) {
      listen('load', () => {
        object.setInternalProperty('loading', false)
        object.emitSignal('loadingChanged', false)
      })
      object.setInternalProperty('loading', true)
    }

    if (object.typeName === 'VideoOutput' && element instanceof this.domDocument.defaultView!.HTMLVideoElement) {
      listen('play', () => {
        object.setInternalProperty('playing', true)
        object.emitSignal('started')
      })
      listen('pause', () => {
        object.setInternalProperty('playing', false)
        object.emitSignal('stopped')
      })
      listen('error', () => object.emitSignal('errorOccurred', element.error?.message ?? 'Media error'))
    }

    if (object.typeName === 'MouseArea') {
      const finishPropagation = (event: Event) => {
        if (!object.getProperty('propagateComposedEvents')) event.stopPropagation()
      }
      listen('click', event => {
        object.emitSignal('clicked', mousePayload(event as MouseEvent))
        finishPropagation(event)
      })
      listen('dblclick', event => {
        object.emitSignal('doubleClicked', mousePayload(event as MouseEvent))
        finishPropagation(event)
      })
      listen('mousedown', event => {
        object.setInternalProperty('pressed', true)
        object.emitSignal('pressed', mousePayload(event as MouseEvent))
        finishPropagation(event)
      })
      listen('mouseup', event => {
        object.setInternalProperty('pressed', false)
        object.emitSignal('released', mousePayload(event as MouseEvent))
        finishPropagation(event)
      })
      listen('mouseenter', () => {
        object.setInternalProperty('containsMouse', true)
        object.emitSignal('entered')
      })
      listen('mouseleave', () => {
        object.setInternalProperty('containsMouse', false)
        object.setInternalProperty('pressed', false)
        object.emitSignal('exited')
      })
      listen('mousemove', event => {
        object.emitSignal('positionChanged', mousePayload(event as MouseEvent))
        finishPropagation(event)
      })
      listen('pointerdown', event => {
        const pointer = event as PointerEvent
        if (pointer.pointerType === 'mouse') return
        object.setInternalProperty('pressed', true)
        object.emitSignal('pressed', pointerPayload(pointer))
        if (object.getProperty('preventStealing')) element.setPointerCapture?.(pointer.pointerId)
        finishPropagation(event)
      })
      listen('pointermove', event => {
        const pointer = event as PointerEvent
        if (pointer.pointerType === 'mouse' || !object.getProperty('pressed')) return
        object.emitSignal('positionChanged', pointerPayload(pointer))
        finishPropagation(event)
      })
      listen('pointerup', event => {
        const pointer = event as PointerEvent
        if (pointer.pointerType === 'mouse' || !object.getProperty('pressed')) return
        object.setInternalProperty('pressed', false)
        object.emitSignal('released', pointerPayload(pointer))
        object.emitSignal('clicked', pointerPayload(pointer))
        if (element.hasPointerCapture?.(pointer.pointerId)) element.releasePointerCapture?.(pointer.pointerId)
        finishPropagation(event)
      })
      listen('pointercancel', event => {
        const pointer = event as PointerEvent
        if (pointer.pointerType === 'mouse') return
        object.setInternalProperty('pressed', false)
        object.emitSignal('canceled', pointerPayload(pointer))
        if (element.hasPointerCapture?.(pointer.pointerId)) element.releasePointerCapture?.(pointer.pointerId)
        finishPropagation(event)
      })
    }
    return removers
  }
}
