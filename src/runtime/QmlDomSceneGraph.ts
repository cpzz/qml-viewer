import type { QmlDocumentInstance } from './QmlDocument'
import { QmlCanvasContext } from './QmlCanvasContext'
import { QmlObject } from './QmlObject'

interface MountedNode {
  element: HTMLElement
  parent: QmlObject | null
  unsubscribe: Array<() => void>
  removeEvents: Array<() => void>
}

function cssLength(value: unknown): string {
  if (typeof value === 'number') return `${value}px`
  return value == null ? '' : String(value)
}

function cssValue(value: unknown): string {
  return value == null ? '' : String(value)
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
  return object.hasProperty('x') && object.hasProperty('width') && object.hasProperty('visible')
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
  if (['CheckBox', 'RadioButton', 'Switch'].includes(object.typeName)) return 'label'
  if (['TextField', 'TextInput', 'SpinBox'].includes(object.typeName)) return 'input'
  if (['Slider', 'Dial'].includes(object.typeName)) return 'div'
  return 'div'
}

function contentImplicitSize(object: QmlObject): { width: number; height: number } | null {
  const text = object.hasProperty('text') ? cssValue(object.getProperty('text')) : ''
  if (object.typeName === 'Text' || object.typeName === 'Label') {
    const fontSize = Number(object.getProperty('font.pixelSize')) || 16
    const lines = text.split('\n')
    return {
      width: Math.ceil(Math.max(0, ...lines.map(line => line.length)) * fontSize * 0.6),
      height: Math.ceil(Math.max(1, lines.length) * fontSize * 1.2),
    }
  }
  if (buttonTypes.has(object.typeName)) {
    return { width: Math.max(64, text.length * 8 + 24), height: 30 }
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
  if (object.typeName === 'TabBar') return { width: 120, height: 34 }
  if (object.typeName === 'StackLayout') return { width: 120, height: 24 }
  if (object.typeName === 'HorizontalHeaderView') return { width: 120, height: 30 }
  return null
}

function focusPolicyAllows(policy: unknown, kind: 'tab' | 'click'): boolean {
  if (typeof policy === 'number') return (policy & (kind === 'tab' ? 1 : 2)) !== 0
  const value = String(policy)
  return value.includes('StrongFocus') || value.includes(kind === 'tab' ? 'TabFocus' : 'ClickFocus')
}

function orderedVisualChildren(object: QmlObject): QmlObject[] {
  const background = object.hasProperty('background') ? object.getProperty('background') : null
  const contentItem = object.hasProperty('contentItem') ? object.getProperty('contentItem') : null
  const loaderItem = object.typeName === 'Loader' ? object.getProperty('item') : null
  return [
    ...(background instanceof QmlObject ? [background] : []),
    ...object.children.filter(child => child !== background && child !== contentItem && child !== loaderItem),
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

function popupPolicyAllows(policy: unknown, kind: 'outside' | 'escape'): boolean {
  if (typeof policy === 'number') return (policy & (kind === 'outside' ? 1 : 2)) !== 0
  return String(policy).includes(kind === 'outside' ? 'CloseOnPressOutside' : 'CloseOnEscape')
}

export class QmlDomSceneGraph {
  private readonly mounted = new Map<QmlObject, MountedNode>()
  private container: HTMLElement | null = null
  private overlay: HTMLElement | null = null
  private overlayRemoveEvents: Array<() => void> = []

  constructor(private readonly domDocument: Document) {}

  mount(document: QmlDocumentInstance, container: HTMLElement): void {
    this.dispose()
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
    const onOverlayPointer = (event: Event) => {
      if (event.target !== this.overlay) return
      closeTopPopup('outside')
      event.stopPropagation()
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
    this.overlay.addEventListener('pointerdown', onOverlayPointer)
    this.domDocument.addEventListener('keydown', onKeyDown)
    this.overlayRemoveEvents = [
      () => this.overlay?.removeEventListener('pointerdown', onOverlayPointer),
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
    }
    this.mounted.clear()
    this.overlayRemoveEvents.forEach(removeEvent => removeEvent())
    this.overlayRemoveEvents = []
    this.overlay = null
    this.container?.replaceChildren()
    this.container = null
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
      this.updateBranch(object)
      if (name === 'item' || name === 'background' || name === 'contentItem') this.syncChildren(object, element)
    }))
    if (object.hasSignal('childrenChanged')) {
      unsubscribe.push(object.connectSignal('childrenChanged', () => this.syncChildren(object, element)))
    }
    const removeEvents = this.installEvents(object, element)
    this.mounted.set(object, { element, parent: renderParent, unsubscribe, removeEvents })
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
    if (object.hasProperty('background') && object.hasProperty('contentItem')) {
      const padding = Number(object.getProperty('padding')) || 0
      const background = object.getProperty('background')
      const contentItem = object.getProperty('contentItem')
      if (background instanceof QmlObject) {
        background.setInternalProperty('x', 0)
        background.setInternalProperty('y', 0)
        background.setInternalProperty('width', geometry.width)
        background.setInternalProperty('height', geometry.height)
      }
      if (contentItem instanceof QmlObject) {
        contentItem.setInternalProperty('x', padding)
        contentItem.setInternalProperty('y', padding)
        contentItem.setInternalProperty('width', Math.max(0, geometry.width - padding * 2))
        contentItem.setInternalProperty('height', Math.max(0, geometry.height - padding * 2))
      }
    }
    const positionedByParent = ['Row', 'Column', 'RowLayout', 'ColumnLayout', 'GridLayout', 'Flow', 'SplitView', 'TabBar']
      .includes(object.parent?.typeName ?? '') ||
      (object.parent?.typeName === 'ScrollView' && layoutTypes.has(object.typeName)) ||
      contentContainerTypes.has(object.parent?.typeName ?? '')
    style.position = positionedByParent ? 'relative' : 'absolute'
    style.left = positionedByParent ? '' : cssLength(geometry.x)
    style.top = positionedByParent ? '' : cssLength(geometry.y)
    style.width = cssLength(geometry.width)
    style.height = cssLength(geometry.height)
    style.zIndex = cssValue(object.getProperty('z'))
    style.opacity = cssValue(object.getProperty('opacity'))
    style.display = object.getProperty('visible') ? '' : 'none'
    if (object.parent && ['StackLayout', 'SwipeView', 'StackView'].includes(object.parent.typeName)) {
      const siblings = orderedVisualChildren(object.parent)
      const currentIndex = Number(object.parent.getProperty('currentIndex')) || 0
      if (siblings.indexOf(object) !== currentIndex) style.display = 'none'
    }
    style.pointerEvents = object.getProperty('enabled') ? '' : 'none'
    if (positionedByParent || contentContainerTypes.has(object.parent?.typeName ?? '')) {
      style.maxWidth = '100%'
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
    if (object.getProperty('anchors.fill') && geometry.height <= 0) style.height = '100%'
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
    style.transform = `rotate(${cssValue(object.getProperty('rotation'))}deg) scale(${cssValue(object.getProperty('scale'))})`
    style.transformOrigin = 'center'
    if (layoutTypes.has(object.typeName)) {
      const margin = Math.max(0, Number(object.getProperty('anchors.margins')) || 0)
      style.boxSizing = 'border-box'
      style.maxWidth = '100%'
      if (object.parent?.typeName === 'ScrollView') {
        style.width = 'auto'
        style.margin = `${margin}px`
      } else if (geometry.width <= 0) {
        style.width = 'auto'
      }
      if (Number(object.getProperty('height')) <= 0) {
        style.height = 'auto'
        style.minHeight = 'max-content'
      }
    }
    if (contentContainerTypes.has(object.typeName) && Number(object.getProperty('height')) <= 0) {
      style.height = 'auto'
      style.minHeight = 'max-content'
      if (layoutTypes.has(object.parent?.typeName ?? '')) style.alignSelf = 'stretch'
    }
    if (object.hasProperty('Layout.fillWidth') && object.getProperty('Layout.fillWidth')) {
      style.flexGrow = '1'
      if (object.parent?.typeName === 'ColumnLayout') style.width = '100%'
    }
    if (object.hasProperty('Layout.fillHeight') && object.getProperty('Layout.fillHeight')) style.alignSelf = 'stretch'
    const alignment = object.getProperty('Layout.alignment')
    const aligned = (name: string, flag: number) => typeof alignment === 'number'
      ? (alignment & flag) !== 0
      : String(alignment).includes(name)
    if (object.parent?.typeName === 'RowLayout') {
      if (aligned('AlignTop', 8)) style.alignSelf = 'flex-start'
      else if (aligned('AlignBottom', 16)) style.alignSelf = 'flex-end'
      else if (aligned('AlignVCenter', 32)) style.alignSelf = 'center'
    } else if (object.parent?.typeName === 'ColumnLayout') {
      if (aligned('AlignLeft', 1)) style.alignSelf = 'flex-start'
      else if (aligned('AlignRight', 2)) style.alignSelf = 'flex-end'
      else if (aligned('AlignHCenter', 4)) style.alignSelf = 'center'
    }
    const tabFocus = object.hasProperty('focusPolicy') && focusPolicyAllows(object.getProperty('focusPolicy'), 'tab')
    element.tabIndex = object.getProperty('focus') || tabFocus ? 0 : -1
    if (object.getProperty('focus') && this.domDocument.activeElement !== element) element.focus()

    const objectName = cssValue(object.getProperty('objectName'))
    if (objectName) element.dataset.qmlObjectName = objectName
    else delete element.dataset.qmlObjectName

    if (object.typeName === 'ItemDelegate' && object.hasProperty('index') && ['ListView', 'GridView', 'PathView'].includes(object.parent?.typeName ?? '')) {
      element.setAttribute('aria-selected', String(Number(object.getProperty('index')) === Number(object.parent!.getProperty('currentIndex'))))
    }
    if (['ListView', 'GridView', 'PathView'].includes(object.typeName)) element.tabIndex = 0

    if (object.typeName === 'Rectangle') {
      style.backgroundColor = cssValue(object.getProperty('color'))
      style.borderRadius = cssLength(object.getProperty('radius'))
      style.borderStyle = 'solid'
      style.borderWidth = cssLength(object.getProperty('border.width'))
      style.borderColor = cssValue(object.getProperty('border.color'))
    }

    if (object.typeName === 'ApplicationWindow') {
      style.display = object.getProperty('visible') ? 'grid' : 'none'
      style.gridTemplateRows = '36px minmax(0, 1fr) 32px'
      style.maxWidth = '100%'
      style.boxSizing = 'border-box'
      style.overflow = 'hidden'
      const windowColor = cssValue(object.getProperty('color'))
      style.backgroundColor = !windowColor || windowColor === 'transparent' ? 'var(--qml-panel-bg)' : windowColor
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
      const header = object.parent.getProperty('header')
      const footer = object.parent.getProperty('footer')
      style.position = 'relative'
      style.inset = 'auto'
      style.width = '100%'
      style.minWidth = '0'
      style.boxSizing = 'border-box'
      if (object === header) {
        style.gridRow = '1'
        style.height = '36px'
      } else if (object === footer) {
        style.gridRow = '3'
        style.height = '32px'
      } else {
        style.gridRow = '2'
        style.height = '100%'
        style.minHeight = '0'
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
      const textColor = cssValue(object.getProperty('color'))
      const hasCustomRectangleBackground = object.parent?.typeName === 'Rectangle' &&
        !['', 'transparent'].includes(cssValue(object.parent.getProperty('color')))
      style.color = (!textColor || textColor === 'black') && !hasCustomRectangleBackground
        ? 'var(--qml-control-text)'
        : textColor
      style.fontSize = cssLength(Number(object.getProperty('font.pixelSize')) || 16)
      style.fontFamily = cssValue(object.getProperty('font.family'))
      style.fontWeight = object.getProperty('font.bold') ? 'bold' : 'normal'
      style.fontStyle = object.getProperty('font.italic') ? 'italic' : 'normal'
      style.whiteSpace = object.getProperty('wrapMode') === 'Text.NoWrap' ? 'nowrap' : 'pre-wrap'
      if (object.hasProperty('padding')) style.padding = cssLength(object.getProperty('padding'))
    }

    if (checkTypes.has(object.typeName)) {
      let input = element.querySelector<HTMLInputElement>(':scope > input')
      let marker = element.querySelector<HTMLSpanElement>(':scope > .qml-check-marker')
      let caption = element.querySelector<HTMLSpanElement>(':scope > .qml-check-caption')
      if (!input || !marker || !caption) {
        input = this.domDocument.createElement('input')
        marker = this.domDocument.createElement('span')
        caption = this.domDocument.createElement('span')
        element.replaceChildren(input, marker, caption)
      }
      input.className = 'qml-check-input'
      marker.className = 'qml-check-marker'
      caption.className = 'qml-check-caption'
      element.classList.toggle('qml-switch-control', object.typeName === 'Switch')
      input.type = object.typeName === 'RadioButton' ? 'radio' : 'checkbox'
      input.checked = Boolean(object.getProperty('checked'))
      input.disabled = !object.getProperty('enabled')
      input.tabIndex = element.tabIndex
      if (object.typeName === 'RadioButton') {
        const group = object.getProperty('ButtonGroup.group')
        input.name = group instanceof QmlObject ? cssValue(group.getProperty('objectName')) || 'qml-radio-group' : cssValue(group)
      }
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

    if (object.typeName === 'MenuBar') {
      style.display = object.getProperty('visible') ? 'flex' : 'none'
      style.alignItems = 'center'
      style.gap = '2px'
      style.padding = '0 8px'
      style.backgroundColor = 'var(--qml-panel-muted-bg)'
      style.borderBottom = object.parent?.getProperty('header') === object ? '1px solid var(--qml-control-border)' : ''
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
          button.addEventListener('click', () => menu.callMethod('open'))
          element.append(button)
        })
      }
    }

    if (object.typeName === 'RowLayout' || object.typeName === 'ColumnLayout') {
      style.display = object.getProperty('visible') ? 'flex' : 'none'
      style.flexDirection = object.typeName === 'RowLayout' ? 'row' : 'column'
      style.gap = cssLength(object.getProperty('spacing'))
      style.alignItems = object.typeName === 'RowLayout' ? 'center' : 'stretch'
    }
    if (object.typeName === 'GridLayout') {
      style.display = object.getProperty('visible') ? 'grid' : 'none'
      style.gridTemplateColumns = `repeat(${Math.max(1, Number(object.getProperty('columns')) || 1)}, max-content)`
      style.gap = cssLength(object.getProperty('spacing'))
      style.alignItems = 'start'
    }
    if (object.typeName === 'Flow') {
      style.display = object.getProperty('visible') ? 'flex' : 'none'
      style.flexWrap = 'wrap'
      style.gap = cssLength(object.getProperty('spacing'))
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

    if (object.hasProperty('palette.button')) {
      const buttonColor = cssValue(object.getProperty('palette.button'))
      const buttonTextColor = cssValue(object.getProperty('palette.buttonText'))
      style.backgroundColor = buttonColor === '#f3f3f3' ? '' : buttonColor
      style.color = buttonTextColor === '#202020' ? '' : buttonTextColor
      style.fontFamily = cssValue(object.getProperty('font.family'))
      style.fontSize = cssLength(object.getProperty('font.pixelSize'))
    }

    if (buttonTypes.has(object.typeName)) {
      if (!(object.getProperty('contentItem') instanceof QmlObject)) {
        element.textContent = cssValue(object.getProperty('text'))
      }
      element.setAttribute('aria-pressed', cssValue(object.getProperty('checked')))
      ;(element as HTMLButtonElement).disabled = !object.getProperty('enabled')
      if (object.typeName === 'RoundButton') style.borderRadius = '50%'
      element.classList.toggle('qml-tool-button', object.typeName === 'ToolButton')
    }

    if (element instanceof this.domDocument.defaultView!.HTMLInputElement) {
      if (object.typeName === 'TextField' || object.typeName === 'TextInput') {
        element.type = object.getProperty('echoMode') === 'TextInput.Normal' ? 'text' : 'password'
        element.value = cssValue(object.getProperty('text'))
        element.placeholder = cssValue(object.getProperty('placeholderText'))
        element.readOnly = Boolean(object.getProperty('readOnly'))
        element.disabled = !object.getProperty('enabled')
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
      if (object.getProperty('checked')) {
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
      style.display = object.getProperty('visible') ? 'flex' : 'none'
      style.alignItems = 'stretch'
      style.gap = '2px'
      orderedVisualChildren(object).forEach((child, index) => {
        const childElement = this.mounted.get(child)?.element
        if (childElement) childElement.setAttribute('aria-selected', String(index === Number(object.getProperty('currentIndex'))))
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
    if (node) this.updateElement(object, node.element)
    object.children.forEach(child => this.updateBranch(child))
  }

  private syncChildren(object: QmlObject, element: HTMLElement): void {
    for (const [mountedObject, node] of [...this.mounted]) {
      if (node.parent === object && !object.children.includes(mountedObject)) {
        this.unmountObject(mountedObject)
      }
    }
    for (const child of orderedVisualChildren(object)) {
      if (!this.mounted.has(child)) this.mountObject(child, element, object)
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
    node.element.remove()
    this.mounted.delete(object)
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

    const targetFor = (value: unknown): QmlObject | null => {
      if (value instanceof QmlObject) return value
      if (typeof value === 'string' && value.startsWith('parent')) return parent
      return null
    }
    const targetSize = (target: QmlObject) => ({
      width: Number(target.getProperty('width')) || 0,
      height: Number(target.getProperty('height')) || 0,
    })
    const margin = Number(object.getProperty('anchors.margins')) || 0
    const leftMargin = Number(object.getProperty('anchors.leftMargin')) || margin
    const rightMargin = Number(object.getProperty('anchors.rightMargin')) || margin
    const topMargin = Number(object.getProperty('anchors.topMargin')) || margin
    const bottomMargin = Number(object.getProperty('anchors.bottomMargin')) || margin
    const fillTarget = targetFor(object.getProperty('anchors.fill'))
    if (fillTarget) {
      const target = targetSize(fillTarget)
      return {
        x: leftMargin,
        y: topMargin,
        width: Math.max(0, target.width - leftMargin - rightMargin),
        height: Math.max(0, target.height - topMargin - bottomMargin),
      }
    }

    const centerTarget = targetFor(object.getProperty('anchors.centerIn'))
    if (centerTarget) {
      const target = targetSize(centerTarget)
      x = (target.width - width) / 2
      y = (target.height - height) / 2
    }
    const horizontalTarget = targetFor(object.getProperty('anchors.horizontalCenter'))
    if (horizontalTarget) x = (targetSize(horizontalTarget).width - width) / 2
    const verticalTarget = targetFor(object.getProperty('anchors.verticalCenter'))
    if (verticalTarget) y = (targetSize(verticalTarget).height - height) / 2

    const leftTarget = targetFor(object.getProperty('anchors.left'))
    const rightTarget = targetFor(object.getProperty('anchors.right'))
    if (leftTarget) x = leftMargin
    if (rightTarget) {
      const targetWidth = targetSize(rightTarget).width
      if (leftTarget) width = Math.max(0, targetWidth - leftMargin - rightMargin)
      else x = targetWidth - width - rightMargin
    }
    const topTarget = targetFor(object.getProperty('anchors.top'))
    const bottomTarget = targetFor(object.getProperty('anchors.bottom'))
    if (topTarget) y = topMargin
    if (bottomTarget) {
      const targetHeight = targetSize(bottomTarget).height
      if (topTarget) height = Math.max(0, targetHeight - topMargin - bottomMargin)
      else y = targetHeight - height - bottomMargin
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

    listen('focus', () => object.setInternalProperty('activeFocus', true))
    listen('blur', () => object.setInternalProperty('activeFocus', false))
    listen('keydown', event => object.emitSignal('keyPressed', event))
    listen('keyup', event => object.emitSignal('keyReleased', event))

    if (object.hasProperty('hovered')) {
      listen('mouseenter', () => object.setInternalProperty('hovered', true))
      listen('mouseleave', () => object.setInternalProperty('hovered', false))
    }

    if (object.hasProperty('focusPolicy')) {
      listen('mousedown', () => {
        if (focusPolicyAllows(object.getProperty('focusPolicy'), 'click')) element.focus()
      })
    }

    if (buttonTypes.has(object.typeName)) {
      const activate = () => {
        if (!object.getProperty('enabled') || object.typeName === 'DelayButton') return
        if (object.getProperty('checkable')) {
          object.callMethod('toggle')
          object.emitSignal('toggled')
        }
        object.emitSignal('clicked')
        if (object.typeName === 'TabButton' && object.parent?.typeName === 'TabBar') {
          object.parent.setProperty('currentIndex', orderedVisualChildren(object.parent).indexOf(object))
        }
        if (object.typeName === 'ItemDelegate' && object.hasProperty('index') && ['ListView', 'GridView', 'PathView'].includes(object.parent?.typeName ?? '')) {
          const index = Number(object.getProperty('index'))
          object.parent!.setProperty('currentIndex', index)
          object.parent!.emitSignal('activated', index)
        }
        if (object.typeName === 'MenuItem' && object.parent?.typeName === 'Menu') object.parent.callMethod('close')
      }
      const cancelDelay = () => {
        if (delayTimer !== null) this.domDocument.defaultView?.clearInterval(delayTimer)
        delayTimer = null
        if (object.typeName === 'DelayButton' && Number(object.getProperty('progress')) < 1) {
          object.setInternalProperty('progress', 0)
          element.style.removeProperty('background-image')
        }
      }
      const startDelay = () => {
        if (object.typeName !== 'DelayButton') return
        cancelDelay()
        const delay = Math.max(0, Number(object.getProperty('delay')) || 0)
        const tickInterval = 16
        const step = delay === 0 ? 1 : tickInterval / delay
        const material = !!element.closest('[data-qml-style="material"]')
        const fillColor = material ? 'color-mix(in srgb, var(--qml-on-accent) 50%, transparent)' : 'var(--qml-accent)'
        let progress = 0
        const tick = () => {
          progress = Math.min(1, progress + step)
          object.setInternalProperty('progress', progress)
          element.style.backgroundImage = `linear-gradient(90deg, ${fillColor} ${progress * 100}%, transparent ${progress * 100}%)`
          if (progress < 1) return
          cancelDelay()
          if (!object.getProperty('checked')) {
            object.setProperty('checked', true)
            object.emitSignal('toggled')
          }
          object.emitSignal('activated')
        }
        tick()
        if (progress < 1) {
          delayTimer = this.domDocument.defaultView?.setInterval(tick, tickInterval) ?? null
        }
      }
      listen('mousedown', event => {
        object.setInternalProperty('pressed', true)
        object.setInternalProperty('down', true)
        object.setInternalProperty('pressX', (event as MouseEvent).offsetX)
        object.setInternalProperty('pressY', (event as MouseEvent).offsetY)
        object.emitSignal('pressed')
        startDelay()
      })
      listen('mouseup', () => {
        object.setInternalProperty('pressed', false)
        object.setInternalProperty('down', false)
        object.emitSignal('released')
        cancelDelay()
      })
      listen('mouseleave', () => {
        if (!object.getProperty('pressed')) return
        object.setInternalProperty('pressed', false)
        object.setInternalProperty('down', false)
        object.emitSignal('canceled')
        cancelDelay()
      })
      listen('click', activate)
      listen('dblclick', () => object.emitSignal('doubleClicked'))
      listen('keydown', event => {
        if ((event as KeyboardEvent).key !== ' ' || (event as KeyboardEvent).repeat) return
        event.preventDefault()
        object.setInternalProperty('pressed', true)
        object.setInternalProperty('down', true)
        object.emitSignal('pressed')
      })
      listen('keyup', event => {
        if ((event as KeyboardEvent).key !== ' ') return
        event.preventDefault()
        object.setInternalProperty('pressed', false)
        object.setInternalProperty('down', false)
        object.emitSignal('released')
        activate()
      })
      removers.push(cancelDelay)
    }

    if (checkTypes.has(object.typeName)) {
      const updateChecked = (event: Event) => {
        const input = event.target as HTMLInputElement
        if (!(input instanceof this.domDocument.defaultView!.HTMLInputElement)) return
        if (object.getProperty('checked') === input.checked) return
        if (object.typeName === 'RadioButton' && input.checked) {
          ;[...this.mounted.keys()]
            .filter(sibling => sibling !== object && sibling.parent === object.parent &&
              sibling.typeName === 'RadioButton' && sibling.getProperty('checked'))
            .forEach(sibling => {
              sibling.setProperty('checked', false)
              sibling.emitSignal('toggled')
            })
        }
        object.setProperty('checked', input.checked)
        object.emitSignal('toggled')
        object.emitSignal('clicked')
      }
      listen('click', updateChecked)
      listen('change', updateChecked)
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
      listen('input', event => {
        object.setProperty('value', Number((event.currentTarget as HTMLInputElement).value))
        object.emitSignal('valueModified')
      })
      listen('keydown', event => {
        const key = (event as KeyboardEvent).key
        if (key !== 'ArrowUp' && key !== 'ArrowDown') return
        const step = Number(object.getProperty('stepSize')) || 1
        const value = Number(object.getProperty('value')) + (key === 'ArrowUp' ? step : -step)
        object.setProperty('value', Math.max(Number(object.getProperty('from')), Math.min(Number(object.getProperty('to')), value)))
        object.emitSignal('valueModified')
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
