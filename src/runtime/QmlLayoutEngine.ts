import { QmlObject } from './QmlObject'

const layoutTypes = new Set(['RowLayout', 'ColumnLayout', 'GridLayout'])

function bounded(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function childSize(child: QmlObject, axis: 'Width' | 'Height'): number {
  const preferred = Number(child.getProperty(`Layout.preferred${axis}`)) ||
    Number(child.getProperty(`implicit${axis}`)) ||
    Number(child.getProperty(axis.toLowerCase())) || 0
  const minimum = Number(child.getProperty(`Layout.minimum${axis}`)) || 0
  const maximum = Number(child.getProperty(`Layout.maximum${axis}`)) || Number.MAX_SAFE_INTEGER
  return bounded(preferred, minimum, maximum)
}

const alignmentFlags = {
  AlignLeft: 1,
  AlignRight: 2,
  AlignHCenter: 4,
  AlignTop: 8,
  AlignBottom: 16,
  AlignVCenter: 32,
}

function hasAlignment(value: unknown, name: keyof typeof alignmentFlags): boolean {
  return typeof value === 'number'
    ? (value & alignmentFlags[name]) !== 0
    : String(value).includes(name)
}

function alignedOffset(space: number, size: number, alignment: unknown, axis: 'horizontal' | 'vertical'): number {
  if (axis === 'horizontal') {
    if (hasAlignment(alignment, 'AlignRight')) return space - size
    if (hasAlignment(alignment, 'AlignHCenter')) return (space - size) / 2
  } else {
    if (hasAlignment(alignment, 'AlignBottom')) return space - size
    if (hasAlignment(alignment, 'AlignVCenter')) return (space - size) / 2
  }
  return 0
}

export class QmlLayoutEngine {
  private readonly unsubscribe: Array<() => void> = []
  private childUnsubscribe: Array<() => void> = []
  private updating = false

  constructor(private readonly layout: QmlObject) {
    if (!layoutTypes.has(layout.typeName)) throw new Error('QmlLayoutEngine requires a QML Layout object')
    for (const name of layout.getPropertyNames()) {
      this.unsubscribe.push(layout.onPropertyChanged(name, () => this.relayout()))
    }
    this.unsubscribe.push(layout.connectSignal('childrenChanged', () => this.bindChildren()))
    this.bindChildren()
  }

  dispose(): void {
    this.unsubscribe.forEach(unsubscribe => unsubscribe())
    this.childUnsubscribe.forEach(unsubscribe => unsubscribe())
  }

  relayout(): void {
    if (this.updating) return
    this.updating = true
    try {
      if (this.layout.typeName === 'GridLayout') this.layoutGrid()
      else this.layoutLinear(this.layout.typeName === 'RowLayout')
    } finally {
      this.updating = false
    }
  }

  private bindChildren(): void {
    this.childUnsubscribe.forEach(unsubscribe => unsubscribe())
    this.childUnsubscribe = this.layout.children.flatMap(child => (
      child.getPropertyNames()
        .filter(name => name.startsWith('Layout.') || name === 'visible' || name.startsWith('implicit'))
        .map(name => child.onPropertyChanged(name, () => this.relayout()))
    ))
    this.relayout()
  }

  private layoutLinear(horizontal: boolean): void {
    const children = this.layout.children.filter(child => child.hasProperty('visible') && child.getProperty('visible'))
    if (children.length === 0) return
    const primarySize = Number(this.layout.getProperty(horizontal ? 'width' : 'height')) || 0
    const crossSize = Number(this.layout.getProperty(horizontal ? 'height' : 'width')) || 0
    const spacing = Number(this.layout.getProperty('spacing')) || 0
    const fixed = children.reduce((total, child) => (
      total + (child.getProperty(horizontal ? 'Layout.fillWidth' : 'Layout.fillHeight') ? 0 : childSize(child, horizontal ? 'Width' : 'Height'))
    ), 0)
    const fillChildren = children.filter(child => child.getProperty(horizontal ? 'Layout.fillWidth' : 'Layout.fillHeight'))
    const available = Math.max(0, primarySize - fixed - spacing * Math.max(0, children.length - 1))
    const fillSize = fillChildren.length > 0 ? available / fillChildren.length : 0
    let cursor = 0

    for (const child of children) {
      const primary = child.getProperty(horizontal ? 'Layout.fillWidth' : 'Layout.fillHeight')
        ? bounded(
          fillSize,
          Number(child.getProperty(horizontal ? 'Layout.minimumWidth' : 'Layout.minimumHeight')) || 0,
          Number(child.getProperty(horizontal ? 'Layout.maximumWidth' : 'Layout.maximumHeight')) || Number.MAX_SAFE_INTEGER,
        )
        : childSize(child, horizontal ? 'Width' : 'Height')
      const cross = child.getProperty(horizontal ? 'Layout.fillHeight' : 'Layout.fillWidth')
        ? crossSize
        : childSize(child, horizontal ? 'Height' : 'Width')
      const crossOffset = alignedOffset(
        crossSize,
        cross,
        child.getProperty('Layout.alignment'),
        horizontal ? 'vertical' : 'horizontal',
      )
      child.setInternalProperty(horizontal ? 'x' : 'y', cursor)
      child.setInternalProperty(horizontal ? 'y' : 'x', crossOffset)
      child.setInternalProperty(horizontal ? 'width' : 'height', primary)
      child.setInternalProperty(horizontal ? 'height' : 'width', cross)
      cursor += primary + spacing
    }
  }

  private layoutGrid(): void {
    const children = this.layout.children.filter(child => child.hasProperty('visible') && child.getProperty('visible'))
    const columns = Math.max(1, Number(this.layout.getProperty('columns')) || 1)
    const columnSpacing = Number(this.layout.getProperty('columnSpacing')) || 0
    const rowSpacing = Number(this.layout.getProperty('rowSpacing')) || 0
    const rows = Math.max(1, ...children.map((child, index) => {
      const explicitRow = Number(child.getProperty('Layout.row'))
      const row = explicitRow >= 0 ? explicitRow : Math.floor(index / columns)
      return row + Math.max(1, Number(child.getProperty('Layout.rowSpan')) || 1)
    }))
    const cellWidth = Math.max(0, (Number(this.layout.getProperty('width')) - columnSpacing * (columns - 1)) / columns)
    const cellHeight = Math.max(0, (Number(this.layout.getProperty('height')) - rowSpacing * (rows - 1)) / rows)

    children.forEach((child, index) => {
      const explicitRow = Number(child.getProperty('Layout.row'))
      const explicitColumn = Number(child.getProperty('Layout.column'))
      const row = explicitRow >= 0 ? explicitRow : Math.floor(index / columns)
      const column = explicitColumn >= 0 ? explicitColumn : index % columns
      const rowSpan = Math.max(1, Number(child.getProperty('Layout.rowSpan')) || 1)
      const columnSpan = Math.max(1, Number(child.getProperty('Layout.columnSpan')) || 1)
      const availableWidth = cellWidth * columnSpan + columnSpacing * (columnSpan - 1)
      const availableHeight = cellHeight * rowSpan + rowSpacing * (rowSpan - 1)
      const alignment = child.getProperty('Layout.alignment')
      const hasExplicitAlignment = Boolean(alignment)
      const width = child.getProperty('Layout.fillWidth') || !hasExplicitAlignment
        ? availableWidth
        : Math.min(availableWidth, childSize(child, 'Width'))
      const height = child.getProperty('Layout.fillHeight') || !hasExplicitAlignment
        ? availableHeight
        : Math.min(availableHeight, childSize(child, 'Height'))
      child.setInternalProperty(
        'x',
        column * (cellWidth + columnSpacing) + alignedOffset(availableWidth, width, alignment, 'horizontal'),
      )
      child.setInternalProperty(
        'y',
        row * (cellHeight + rowSpacing) + alignedOffset(availableHeight, height, alignment, 'vertical'),
      )
      child.setInternalProperty('width', width)
      child.setInternalProperty('height', height)
    })
  }
}
