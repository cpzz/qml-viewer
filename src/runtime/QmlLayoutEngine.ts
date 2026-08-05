import { QmlObject } from './QmlObject'

const layoutTypes = new Set(['RowLayout', 'ColumnLayout', 'GridLayout'])

function layoutChildren(layout: QmlObject): QmlObject[] {
  return layout.children.filter(child => child.typeName !== 'Repeater' && child.hasProperty('visible') && child.getProperty('visible'))
}

function bounded(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function childSize(child: QmlObject, axis: 'Width' | 'Height'): number {
  const preferredSize = Number(child.getProperty(`Layout.preferred${axis}`))
  const axisLower = axis.toLowerCase()
  // QML 优先级：Layout.preferredWidth > 显式 width > implicitWidth
  const preferred = preferredSize >= 0
    ? preferredSize
    : child.isExplicitlySet(axisLower)
      ? Number(child.getProperty(axisLower)) || 0
      : Number(child.getProperty(`implicit${axis}`)) || 0
  const minimumValue = Number(child.getProperty(`Layout.minimum${axis}`))
  const maximumValue = Number(child.getProperty(`Layout.maximum${axis}`))
  const minimum = minimumValue >= 0 ? minimumValue : 0
  const maximum = maximumValue >= 0 ? maximumValue : Number.MAX_SAFE_INTEGER
  return bounded(preferred, minimum, maximum)
}

type LayoutSide = 'left' | 'right' | 'top' | 'bottom'

function childMargin(child: QmlObject, side: LayoutSide): number {
  const name = `Layout.${side}Margin`
  const individual = Number(child.getProperty(name))
  return individual >= 0 ? individual : Math.max(0, Number(child.getProperty('Layout.margins')) || 0)
}

const alignmentFlags = {
  AlignLeft: 1,
  AlignRight: 2,
  AlignHCenter: 4,
  AlignTop: 32,
  AlignBottom: 128,
  AlignVCenter: 64,
}

function hasAlignment(value: unknown, name: keyof typeof alignmentFlags): boolean {
  return typeof value === 'number'
    ? (value & alignmentFlags[name]) !== 0
    : String(value).includes(name)
}

function alignedOffset(
  space: number,
  size: number,
  alignment: unknown,
  axis: 'horizontal' | 'vertical',
  rightToLeft = false,
): number {
  if (axis === 'horizontal') {
    if (hasAlignment(alignment, 'AlignHCenter')) return (space - size) / 2
    if (rightToLeft) return hasAlignment(alignment, 'AlignRight') ? 0 : space - size
    if (hasAlignment(alignment, 'AlignRight')) return space - size
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
  private pending = false

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
    if (this.updating) {
      this.pending = true
      return
    }
    this.updating = true
    try {
      do {
        this.pending = false
        if (this.layout.typeName === 'GridLayout') this.layoutGrid()
        else this.layoutLinear(this.layout.typeName === 'RowLayout')
      } while (this.pending)
    } finally {
      this.updating = false
    }
  }

  private bindChildren(): void {
    this.childUnsubscribe.forEach(unsubscribe => unsubscribe())
    this.childUnsubscribe = layoutChildren(this.layout).flatMap(child => (
      child.getPropertyNames()
        .filter(name => name.startsWith('Layout.') || name === 'visible' || name.startsWith('implicit'))
        .map(name => child.onPropertyChanged(name, () => this.relayout()))
    ))
    this.relayout()
  }

  private layoutLinear(horizontal: boolean): void {
    const children = layoutChildren(this.layout)
    if (children.length === 0) return
    const spacing = Number(this.layout.getProperty('spacing')) || 0
    const primaryStart: LayoutSide = horizontal ? 'left' : 'top'
    const primaryEnd: LayoutSide = horizontal ? 'right' : 'bottom'
    const crossStart: LayoutSide = horizontal ? 'top' : 'left'
    const crossEnd: LayoutSide = horizontal ? 'bottom' : 'right'
    const primaryMargins = (child: QmlObject) => childMargin(child, primaryStart) + childMargin(child, primaryEnd)
    const crossMargins = (child: QmlObject) => childMargin(child, crossStart) + childMargin(child, crossEnd)
    const uniformCellSizes = this.layout.hasProperty('uniformCellSizes') && Boolean(this.layout.getProperty('uniformCellSizes'))
    const uniformPrimarySize = uniformCellSizes
      ? Math.max(0, ...children.map(child => childSize(child, horizontal ? 'Width' : 'Height')))
      : 0
    const preferredPrimarySize = (child: QmlObject) => uniformCellSizes
      ? uniformPrimarySize
      : childSize(child, horizontal ? 'Width' : 'Height')
    const implicitPrimarySize = children.reduce((total, child) => (
      total + preferredPrimarySize(child) + primaryMargins(child)
    ), 0) + spacing * Math.max(0, children.length - 1)
    const implicitCrossSize = Math.max(0, ...children.map(child => (
      childSize(child, horizontal ? 'Height' : 'Width') + crossMargins(child)
    )))
    this.layout.setInternalProperty(horizontal ? 'implicitWidth' : 'implicitHeight', implicitPrimarySize)
    this.layout.setInternalProperty(horizontal ? 'implicitHeight' : 'implicitWidth', implicitCrossSize)
    const primarySize = Number(this.layout.getProperty(horizontal ? 'width' : 'height')) || implicitPrimarySize
    const crossSize = Number(this.layout.getProperty(horizontal ? 'height' : 'width')) || implicitCrossSize
    const fixed = children.reduce((total, child) => (
      total + primaryMargins(child) + (child.getProperty(horizontal ? 'Layout.fillWidth' : 'Layout.fillHeight')
        ? 0
        : preferredPrimarySize(child))
    ), 0)
    const fillChildren = children.filter(child => child.getProperty(horizontal ? 'Layout.fillWidth' : 'Layout.fillHeight'))
    const available = Math.max(0, primarySize - fixed - spacing * Math.max(0, children.length - 1))
    const stretchProperty = horizontal ? 'Layout.horizontalStretchFactor' : 'Layout.verticalStretchFactor'
    const hasStretchFactors = fillChildren.some(child => Number(child.getProperty(stretchProperty)) > 0)
    const fillWeight = (child: QmlObject) => {
      const stretch = Number(child.getProperty(stretchProperty))
      if (hasStretchFactors) return stretch > 0 ? stretch : 1
      return Math.max(1, childSize(child, horizontal ? 'Width' : 'Height'))
    }
    const totalFillWeight = fillChildren.reduce((total, child) => total + fillWeight(child), 0)
    let cursor = 0

    for (const child of children) {
      const minimum = Number(child.getProperty(horizontal ? 'Layout.minimumWidth' : 'Layout.minimumHeight'))
      const maximum = Number(child.getProperty(horizontal ? 'Layout.maximumWidth' : 'Layout.maximumHeight'))
      const primary = child.getProperty(horizontal ? 'Layout.fillWidth' : 'Layout.fillHeight')
        ? bounded(
          totalFillWeight > 0 ? available * fillWeight(child) / totalFillWeight : 0,
          minimum >= 0 ? minimum : 0,
          maximum >= 0 ? maximum : Number.MAX_SAFE_INTEGER,
        )
        : preferredPrimarySize(child)
      const availableCross = Math.max(0, crossSize - crossMargins(child))
      const cross = child.getProperty(horizontal ? 'Layout.fillHeight' : 'Layout.fillWidth')
        ? bounded(
          availableCross,
          Math.max(0, Number(child.getProperty(horizontal ? 'Layout.minimumHeight' : 'Layout.minimumWidth'))),
          Number(child.getProperty(horizontal ? 'Layout.maximumHeight' : 'Layout.maximumWidth')) >= 0
            ? Number(child.getProperty(horizontal ? 'Layout.maximumHeight' : 'Layout.maximumWidth'))
            : Number.MAX_SAFE_INTEGER,
        )
        : childSize(child, horizontal ? 'Height' : 'Width')
      const crossOffset = childMargin(child, crossStart) + alignedOffset(
        availableCross,
        cross,
        child.getProperty('Layout.alignment'),
        horizontal ? 'vertical' : 'horizontal',
        !horizontal && (Number(this.layout.getProperty('layoutDirection')) === 1 || String(this.layout.getProperty('layoutDirection')).includes('RightToLeft')),
      )
      child.setInternalProperty(horizontal ? 'x' : 'y', cursor + childMargin(child, primaryStart))
      child.setInternalProperty(horizontal ? 'y' : 'x', crossOffset)
      child.setInternalProperty(horizontal ? 'width' : 'height', primary)
      child.setInternalProperty(horizontal ? 'height' : 'width', cross)
      cursor += primary + primaryMargins(child) + spacing
    }
  }

  private layoutGrid(): void {
    const children = layoutChildren(this.layout)
    const columns = Math.max(1, Number(this.layout.getProperty('columns')) || 1)
    const columnSpacing = Number(this.layout.getProperty('columnSpacing')) || 0
    const rowSpacing = Number(this.layout.getProperty('rowSpacing')) || 0
    const occupied = new Set<string>()
    const placements = children.map(child => {
      const explicitRow = Number(child.getProperty('Layout.row'))
      const explicitColumn = Number(child.getProperty('Layout.column'))
      const rowSpan = Math.max(1, Number(child.getProperty('Layout.rowSpan')) || 1)
      const columnSpan = Math.min(columns, Math.max(1, Number(child.getProperty('Layout.columnSpan')) || 1))
      const fits = (row: number, column: number) => (
        column + columnSpan <= columns &&
        Array.from({ length: rowSpan }, (_, rowOffset) => row + rowOffset).every(candidateRow => (
          Array.from({ length: columnSpan }, (_, columnOffset) => column + columnOffset)
            .every(candidateColumn => !occupied.has(`${candidateRow}:${candidateColumn}`))
        ))
      )
      let row = explicitRow >= 0 ? explicitRow : 0
      let column = explicitColumn >= 0 ? explicitColumn : 0
      while (!fits(row, column)) {
        if (explicitRow >= 0 && explicitColumn < 0) column++
        else if (explicitColumn >= 0 && explicitRow < 0) row++
        else {
          column++
          if (column >= columns) {
            column = 0
            row++
          }
        }
      }
      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset++) {
        for (let columnOffset = 0; columnOffset < columnSpan; columnOffset++) {
          occupied.add(`${row + rowOffset}:${column + columnOffset}`)
        }
      }
      return { child, row, column, rowSpan, columnSpan }
    })
    const rows = Math.max(1, ...placements.map(({ row, rowSpan }) => row + rowSpan))
    const columnWidths = Array.from({ length: columns }, () => 0)
    const rowHeights = Array.from({ length: rows }, () => 0)
    const applyTrackMinimum = (tracks: number[], start: number, span: number, required: number, spacing: number) => {
      const current = tracks.slice(start, start + span).reduce((total, size) => total + size, 0) + spacing * (span - 1)
      const addition = Math.max(0, required - current) / span
      for (let offset = 0; offset < span; offset++) tracks[start + offset] += addition
    }
    placements
      .sort((left, right) => left.columnSpan + left.rowSpan - right.columnSpan - right.rowSpan)
      .forEach(({ child, row, column, rowSpan, columnSpan }) => {
        applyTrackMinimum(columnWidths, column, columnSpan, childSize(child, 'Width'), columnSpacing)
        applyTrackMinimum(rowHeights, row, rowSpan, childSize(child, 'Height'), rowSpacing)
      })
    const implicitWidth = columnWidths.reduce((total, size) => total + size, 0) + columnSpacing * (columns - 1)
    const implicitHeight = rowHeights.reduce((total, size) => total + size, 0) + rowSpacing * (rows - 1)
    this.layout.setInternalProperty('implicitWidth', implicitWidth)
    this.layout.setInternalProperty('implicitHeight', implicitHeight)
    const fitTracks = (tracks: number[], total: number, spacing: number) => {
      const available = Math.max(0, total - spacing * (tracks.length - 1))
      const current = tracks.reduce((sum, size) => sum + size, 0)
      const adjustment = (available - current) / tracks.length
      return tracks.map(size => Math.max(0, size + adjustment))
    }
    const useLayoutWidth = this.layout.isPropertyAssigned('width') || Boolean(this.layout.getProperty('Layout.fillWidth'))
    const useLayoutHeight = this.layout.isPropertyAssigned('height') || Boolean(this.layout.getProperty('Layout.fillHeight'))
    const fittedColumns = fitTracks(columnWidths, useLayoutWidth ? Number(this.layout.getProperty('width')) : implicitWidth, columnSpacing)
    const fittedRows = fitTracks(rowHeights, useLayoutHeight ? Number(this.layout.getProperty('height')) : implicitHeight, rowSpacing)
    const trackOffset = (tracks: number[], index: number, spacing: number) => (
      tracks.slice(0, index).reduce((total, size) => total + size, 0) + spacing * index
    )

    placements.forEach(({ child, row, column, rowSpan, columnSpan }) => {
      const availableWidth = fittedColumns.slice(column, column + columnSpan).reduce((total, size) => total + size, 0) + columnSpacing * (columnSpan - 1)
      const availableHeight = fittedRows.slice(row, row + rowSpan).reduce((total, size) => total + size, 0) + rowSpacing * (rowSpan - 1)
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
        trackOffset(fittedColumns, column, columnSpacing) + alignedOffset(availableWidth, width, alignment, 'horizontal'),
      )
      child.setInternalProperty(
        'y',
        trackOffset(fittedRows, row, rowSpacing) + alignedOffset(availableHeight, height, alignment, 'vertical'),
      )
      child.setInternalProperty('width', width)
      child.setInternalProperty('height', height)
    })
  }
}
