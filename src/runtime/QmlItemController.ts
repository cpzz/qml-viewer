import { QmlObject } from './QmlObject'

const geometryProperties = ['x', 'y', 'width', 'height', 'visible'] as const
const paletteBaseNames = [
  'accent', 'alternateBase', 'base', 'brightText', 'button', 'buttonText', 'dark',
  'highlight', 'highlightedText', 'light', 'link', 'linkVisited', 'mid', 'midlight',
  'placeholderText', 'shadow', 'text', 'toolTipBase', 'toolTipText', 'window', 'windowText',
]
const paletteRoles = [
  ...paletteBaseNames,
  ...['active', 'inactive', 'disabled'].flatMap(g => paletteBaseNames.map(r => `${g}.${r}`)),
].map(role => `palette.${role}`)

const fontRoles = ['family', 'pixelSize', 'pointSize', 'bold', 'italic'].map(r => `font.${r}`)

function rootOf(item: QmlObject): QmlObject {
  let root = item
  while (root.parent) root = root.parent
  return root
}

function itemTree(root: QmlObject): QmlObject[] {
  return [root, ...root.children.flatMap(itemTree)]
}

function focusPolicyAllowsTab(item: QmlObject): boolean {
  const policy = item.getProperty('focusPolicy')
  return typeof policy === 'number'
    ? (policy & 1) !== 0
    : String(policy).includes('TabFocus') || String(policy).includes('StrongFocus')
}

function isEffectivelyAvailable(item: QmlObject): boolean {
  for (let current: QmlObject | null = item; current; current = current.parent) {
    if (current.hasProperty('visible') && !current.getProperty('visible')) return false
    if (current.hasProperty('enabled') && !current.getProperty('enabled')) return false
  }
  return true
}

export function forceActiveFocus(item: QmlObject): void {
  if (!isEffectivelyAvailable(item)) return
  for (const object of itemTree(rootOf(item))) {
    if (object.hasProperty('activeFocus')) object.setInternalProperty('activeFocus', false)
  }
  item.setProperty('focus', true)
  item.setInternalProperty('activeFocus', true)
  for (let parent = item.parent; parent; parent = parent.parent) {
    if (parent.typeName === 'FocusScope') parent.setInternalProperty('activeFocus', true)
  }
}

export function nextItemInFocusChain(item: QmlObject, forward = true): QmlObject {
  const candidates = itemTree(rootOf(item)).filter(candidate => (
    candidate.hasProperty('activeFocusOnTab') &&
    (Boolean(candidate.getProperty('activeFocusOnTab')) || focusPolicyAllowsTab(candidate)) &&
    isEffectivelyAvailable(candidate)
  ))
  if (candidates.length === 0) return item
  const index = candidates.indexOf(item)
  const offset = forward ? 1 : -1
  return candidates[(index + offset + candidates.length) % candidates.length]
}

export function stackItem(item: QmlObject, sibling: QmlObject, after: boolean): void {
  const parent = item.parent
  if (!parent || sibling === item || sibling.parent !== parent) return
  const children = parent.children
  children.splice(children.indexOf(item), 1)
  const siblingIndex = children.indexOf(sibling)
  children.splice(siblingIndex + (after ? 1 : 0), 0, item)
  parent.emitSignal('childrenChanged')
}

export class QmlItemController {
  private readonly unsubscribe: Array<() => void> = []
  private childUnsubscribe: Array<() => void> = []
  private parentUnsubscribe: Array<() => void> = []
  private requestedVisible: boolean
  private requestedEnabled: boolean
  private readonly paletteDefaults = new Map<string, unknown>()
  private readonly paletteOverrides = new Set<string>()
  private readonly fontDefaults = new Map<string, unknown>()
  private readonly fontOverrides = new Set<string>()
  private applyingAvailability = false
  private applyingPalette = false
  private applyingFont = false

  constructor(private readonly item: QmlObject) {
    if (!item.hasProperty('children')) throw new Error('QmlItemController requires an Item object')
    this.requestedVisible = Boolean(item.getProperty('visible'))
    this.requestedEnabled = Boolean(item.getProperty('enabled'))
    paletteRoles.forEach(name => {
      this.paletteDefaults.set(name, item.getProperty(name))
      if (item.isPropertyAssigned(name)) this.paletteOverrides.add(name)
      this.unsubscribe.push(item.onPropertyChanged(name, () => {
        if (!this.applyingPalette) this.paletteOverrides.add(name)
      }))
    })
    fontRoles.forEach(name => {
      if (!item.hasProperty(name)) return
      this.fontDefaults.set(name, item.getProperty(name))
      if (item.isPropertyAssigned(name)) this.fontOverrides.add(name)
      this.unsubscribe.push(item.onPropertyChanged(name, () => {
        if (!this.applyingFont) this.fontOverrides.add(name)
      }))
    })
    this.unsubscribe.push(item.connectSignal('childrenChanged', () => this.bindChildren()))
    if (item.hasSignal('parentChanged')) {
      this.unsubscribe.push(item.connectSignal('parentChanged', () => {
        this.bindParent()
        this.refresh()
      }))
    }
    this.unsubscribe.push(item.onPropertyChanged('focus', change => {
      if (change.value) forceActiveFocus(item)
      else if (item.getProperty('activeFocus')) item.setInternalProperty('activeFocus', false)
    }))
    this.unsubscribe.push(item.onPropertyChanged('parent', change => {
      if (change.value === item.parent) return
      if (change.value !== null && !(change.value instanceof QmlObject)) {
        item.setInternalProperty('parent', item.parent)
        return
      }
      item.reparentTo(change.value as QmlObject | null)
    }))
    this.unsubscribe.push(item.onPropertyChanged('visible', change => {
      if (!this.applyingAvailability) this.requestedVisible = Boolean(change.value)
      this.applyAvailability()
    }))
    this.unsubscribe.push(item.onPropertyChanged('enabled', change => {
      if (!this.applyingAvailability) this.requestedEnabled = Boolean(change.value)
      this.applyAvailability()
    }))
    this.bindParent()
    this.bindChildren()
    if (item.getProperty('focus')) forceActiveFocus(item)
  }

  dispose(): void {
    this.unsubscribe.forEach(unsubscribe => unsubscribe())
    this.childUnsubscribe.forEach(unsubscribe => unsubscribe())
    this.parentUnsubscribe.forEach(unsubscribe => unsubscribe())
  }

  refresh(): void {
    const children = this.item.children.filter(child => child.hasProperty('visible'))
    const resources = this.item.children.filter(child => !child.hasProperty('visible'))
    const visibleChildren = children.filter(child => Boolean(child.getProperty('visible')))
    this.item.setInternalProperty('parent', this.item.parent)
    this.setObjectList('children', children)
    this.setObjectList('resources', resources)
    this.setObjectList('visibleChildren', visibleChildren)

    if (children.length === 0) {
      this.setChildrenRect(0, 0, 0, 0)
      return
    }
    const left = Math.min(...children.map(child => Number(child.getProperty('x')) || 0))
    const top = Math.min(...children.map(child => Number(child.getProperty('y')) || 0))
    const right = Math.max(...children.map(child => (
      (Number(child.getProperty('x')) || 0) + (Number(child.getProperty('width')) || 0)
    )))
    const bottom = Math.max(...children.map(child => (
      (Number(child.getProperty('y')) || 0) + (Number(child.getProperty('height')) || 0)
    )))
    this.setChildrenRect(left, top, right - left, bottom - top)
  }

  private bindChildren(): void {
    this.childUnsubscribe.forEach(unsubscribe => unsubscribe())
    this.childUnsubscribe = this.item.children.flatMap(child => (
      child.hasProperty('visible')
        ? geometryProperties.map(name => child.onPropertyChanged(name, () => this.refresh()))
        : []
    ))
    this.refresh()
  }

  private setChildrenRect(x: number, y: number, width: number, height: number): void {
    this.item.setInternalProperty('childrenRect.x', x)
    this.item.setInternalProperty('childrenRect.y', y)
    this.item.setInternalProperty('childrenRect.width', width)
    this.item.setInternalProperty('childrenRect.height', height)
  }

  private setObjectList(name: string, objects: QmlObject[]): void {
    const current = this.item.getProperty(name)
    if (Array.isArray(current) && current.length === objects.length &&
      current.every((object, index) => object === objects[index])) return
    this.item.setInternalProperty(name, objects)
  }

  private clearUnavailableFocus(): void {
    if (this.item.getProperty('activeFocus') && !isEffectivelyAvailable(this.item)) {
      this.item.setInternalProperty('activeFocus', false)
    }
  }

  private bindParent(): void {
    this.parentUnsubscribe.forEach(unsubscribe => unsubscribe())
    this.parentUnsubscribe = []
    const parent = this.item.parent
    if (parent?.hasProperty('visible')) {
      this.parentUnsubscribe.push(parent.onPropertyChanged('visible', () => this.applyAvailability()))
      this.parentUnsubscribe.push(parent.onPropertyChanged('enabled', () => this.applyAvailability()))
      paletteRoles.forEach(name => {
        this.parentUnsubscribe.push(parent.onPropertyChanged(name, () => this.applyPalette()))
      })
      fontRoles.forEach(name => {
        if (parent.hasProperty(name)) {
          this.parentUnsubscribe.push(parent.onPropertyChanged(name, () => this.applyFont()))
        }
      })
    }
    this.applyAvailability()
    this.applyPalette()
    this.applyFont()
  }

  private applyAvailability(): void {
    if (this.applyingAvailability) return
    const parent = this.item.parent
    const parentVisible = !parent?.hasProperty('visible') || Boolean(parent.getProperty('visible'))
    const parentEnabled = !parent?.hasProperty('enabled') || Boolean(parent.getProperty('enabled'))
    this.applyingAvailability = true
    this.item.setInternalProperty('visible', this.requestedVisible && parentVisible)
    this.item.setInternalProperty('enabled', this.requestedEnabled && parentEnabled)
    this.applyingAvailability = false
    this.clearUnavailableFocus()
  }

  private applyPalette(): void {
    const parent = this.item.parent
    this.applyingPalette = true
    paletteRoles.forEach(name => {
      if (this.paletteOverrides.has(name)) return
      const value = parent?.hasProperty(name) ? parent.getProperty(name) : this.paletteDefaults.get(name)
      this.item.setInternalProperty(name, value)
    })
    this.applyingPalette = false
  }

  private applyFont(): void {
    const parent = this.item.parent
    this.applyingFont = true
    fontRoles.forEach(name => {
      if (this.fontOverrides.has(name)) return
      if (!this.item.hasProperty(name)) return
      const value = parent?.hasProperty(name) ? parent.getProperty(name) : this.fontDefaults.get(name)
      if (value !== undefined) this.item.setInternalProperty(name, value)
    })
    this.applyingFont = false
  }
}
