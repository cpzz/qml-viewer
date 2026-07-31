import { QmlComponent } from './QmlComponent'
import type { QmlDocumentInstance } from './QmlDocument'
import { QmlListModel, type QmlListModelRow } from './QmlListModel'
import { QmlObject } from './QmlObject'

interface QmlDelegateFactory {
  create(parent?: QmlObject | null, context?: Record<string, unknown>): QmlDocumentInstance
}

function isDelegateFactory(value: unknown): value is QmlDelegateFactory {
  return Boolean(value && typeof (value as QmlDelegateFactory).create === 'function')
}

interface ItemViewEntry {
  index: number
  item: QmlObject
}

interface ListMetric {
  start: number
  primary: number
  width: number
  height: number
}

function modelRows(model: unknown): unknown[] {
  if (model instanceof QmlListModel) return model.toArray()
  if (Array.isArray(model)) return [...model]
  if (typeof model === 'number' && Number.isFinite(model)) {
    return Array.from({ length: Math.max(0, Math.floor(model)) }, (_, index) => index)
  }
  return []
}

function clampIndex(index: number, count: number): number {
  if (count === 0) return -1
  return Math.max(0, Math.min(count - 1, Math.trunc(index)))
}

export class QmlItemViewController {
  private entries: ItemViewEntry[] = []
  private highlightItem: QmlObject | null = null
  private modelUnsubscribe: (() => void) | null = null
  private readonly unsubscribe: Array<() => void>
  private rebuilding = false

  constructor(private readonly view: QmlObject) {
    if (!['ListView', 'GridView', 'PathView'].includes(view.typeName)) {
      throw new Error('QmlItemViewController requires a ListView, GridView, or PathView object')
    }
    this.unsubscribe = [
      view.onPropertyChanged('model', () => this.bindModel()),
      view.onPropertyChanged('delegate', () => this.rebuild()),
      view.onPropertyChanged('currentIndex', () => this.updateCurrent()),
      view.onPropertyChanged('contentX', () => this.rebuild()),
      view.onPropertyChanged('contentY', () => this.rebuild()),
      view.onPropertyChanged('width', () => this.rebuild()),
      view.onPropertyChanged('height', () => this.rebuild()),
    ]
    for (const name of ['spacing', 'orientation', 'cellWidth', 'cellHeight', 'cacheBuffer', 'pathItemCount', 'offset', 'path', 'section.property', 'highlight', 'snapMode']) {
      if (view.hasProperty(name)) this.unsubscribe.push(view.onPropertyChanged(name, () => this.rebuild()))
    }
    this.bindModel()
  }

  itemAt(index: number): QmlObject | null {
    return this.entries.find(entry => entry.index === index)?.item ?? null
  }

  positionViewAtIndex(index: number): void {
    const count = Number(this.view.getProperty('count'))
    const target = clampIndex(index, count)
    if (target < 0) return
    if (this.view.typeName === 'GridView') {
      const columns = Math.max(1, Math.floor(Number(this.view.getProperty('width')) / Number(this.view.getProperty('cellWidth'))))
      this.view.setProperty('contentY', Math.floor(target / columns) * Number(this.view.getProperty('cellHeight')))
    } else if (this.view.typeName === 'ListView') {
      const rows = modelRows(this.view.getProperty('model'))
      const metrics = this.listMetrics(rows)
      const horizontal = this.view.getProperty('orientation') === 'ListView.Horizontal'
      this.view.setProperty(horizontal ? 'contentX' : 'contentY', metrics[target]?.start ?? 0)
    }
    this.view.setProperty('currentIndex', target)
  }

  incrementCurrentIndex(): void {
    this.view.setProperty('currentIndex', clampIndex(Number(this.view.getProperty('currentIndex')) + 1, Number(this.view.getProperty('count'))))
  }

  decrementCurrentIndex(): void {
    this.view.setProperty('currentIndex', clampIndex(Number(this.view.getProperty('currentIndex')) - 1, Number(this.view.getProperty('count'))))
  }

  activate(index: number): void {
    const target = clampIndex(index, Number(this.view.getProperty('count')))
    if (target < 0) return
    this.view.setProperty('currentIndex', target)
    this.view.emitSignal('activated', target)
  }

  snapToNearest(): void {
    if (this.view.typeName !== 'ListView' || this.view.getProperty('snapMode') === 'ListView.NoSnap') return
    const rows = modelRows(this.view.getProperty('model'))
    const metrics = this.listMetrics(rows)
    if (!metrics.length) return
    const horizontal = this.view.getProperty('orientation') === 'ListView.Horizontal'
    const property = horizontal ? 'contentX' : 'contentY'
    const offset = Number(this.view.getProperty(property)) || 0
    const nearest = metrics.reduce((best, metric) => (
      Math.abs(metric.start - offset) < Math.abs(best.start - offset) ? metric : best
    ))
    this.view.setProperty(property, nearest.start)
  }

  dispose(): void {
    this.unsubscribe.forEach(unsubscribe => unsubscribe())
    this.modelUnsubscribe?.()
    this.clearEntries()
  }

  private bindModel(): void {
    this.modelUnsubscribe?.()
    const model = this.view.getProperty('model')
    this.modelUnsubscribe = model instanceof QmlListModel
      ? model.subscribe(() => this.rebuild())
      : null
    this.rebuild()
  }

  private rebuild(): void {
    if (this.rebuilding) return
    this.rebuilding = true
    try {
      this.clearEntries()
      const rows = modelRows(this.view.getProperty('model'))
      this.view.setInternalProperty('count', rows.length)
      const normalizedCurrent = clampIndex(Number(this.view.getProperty('currentIndex')), rows.length)
      if (normalizedCurrent !== this.view.getProperty('currentIndex')) {
        this.view.setProperty('currentIndex', normalizedCurrent)
      }
      const delegate = this.view.getProperty('delegate')
      if (!isDelegateFactory(delegate) || rows.length === 0) {
        this.view.setInternalProperty('currentItem', null)
        return
      }

      const listMetrics = this.view.typeName === 'ListView' ? this.listMetrics(rows) : []
      const indices = this.visibleIndices(rows.length, listMetrics)
      this.entries = indices.map(index => {
        const row = rows[index]
        const context = row && typeof row === 'object' && !Array.isArray(row)
          ? { index, modelData: row, ...row as QmlListModelRow }
          : { index, modelData: row }
        const item = delegate.create(this.view, context).roots[0]
        this.applyContext(item, index, rows[index])
        this.positionItem(item, index, rows.length, listMetrics)
        return { index, item }
      })
      this.view.setInternalProperty('currentItem', this.itemAt(normalizedCurrent))
      this.updateHighlight()
    } finally {
      this.rebuilding = false
    }
  }

  private visibleIndices(count: number, listMetrics: ListMetric[] = []): number[] {
    if (this.view.typeName === 'PathView') {
      const requested = Number(this.view.getProperty('pathItemCount')) || count
      const visibleCount = Math.min(count, Math.max(1, Math.floor(requested)))
      const start = clampIndex(Number(this.view.getProperty('currentIndex')), count)
      return Array.from({ length: visibleCount }, (_, offset) => (Math.max(0, start) + offset) % count)
    }

    const cache = Number(this.view.getProperty('cacheBuffer')) || 0
    if (this.view.typeName === 'GridView') {
      const cellWidth = Math.max(1, Number(this.view.getProperty('cellWidth')) || 100)
      const cellHeight = Math.max(1, Number(this.view.getProperty('cellHeight')) || 100)
      const columns = Math.max(1, Math.floor(Number(this.view.getProperty('width')) / cellWidth))
      const firstRow = Math.max(0, Math.floor((Number(this.view.getProperty('contentY')) - cache) / cellHeight))
      const lastRow = Math.ceil((Number(this.view.getProperty('contentY')) + Number(this.view.getProperty('height')) + cache) / cellHeight)
      const first = Math.min(count, firstRow * columns)
      const last = Math.min(count, lastRow * columns)
      return Array.from({ length: Math.max(0, last - first) }, (_, offset) => first + offset)
    }

    const horizontal = this.view.getProperty('orientation') === 'ListView.Horizontal'
    const contentOffset = Number(this.view.getProperty(horizontal ? 'contentX' : 'contentY')) || 0
    const viewportSize = Number(this.view.getProperty(horizontal ? 'width' : 'height')) || 0
    const start = contentOffset - cache
    const end = contentOffset + viewportSize + cache
    return listMetrics
      .map((metric, index) => ({ metric, index }))
      .filter(({ metric }) => metric.start < end && metric.start + metric.primary > start)
      .map(({ index }) => index)
  }

  private listMetrics(rows: unknown[]): ListMetric[] {
    const delegate = this.view.getProperty('delegate')
    if (!isDelegateFactory(delegate)) return []
    const horizontal = this.view.getProperty('orientation') === 'ListView.Horizontal'
    const spacing = Number(this.view.getProperty('spacing')) || 0
    let cursor = 0
    return rows.map((row, index) => {
      const probe = delegate.create().roots[0]
      this.applyContext(probe, index, row)
      const width = Math.max(1, Number(probe.getProperty('width')) || Number(probe.getProperty('implicitWidth')) || 1)
      const height = Math.max(1, Number(probe.getProperty('height')) || Number(probe.getProperty('implicitHeight')) || 1)
      probe.destroy()
      const metric = { start: cursor, primary: horizontal ? width : height, width, height }
      cursor += metric.primary + spacing
      return metric
    })
  }

  private positionItem(item: QmlObject, index: number, count: number, listMetrics: ListMetric[]): void {
    if (this.view.typeName === 'ListView') {
      const horizontal = this.view.getProperty('orientation') === 'ListView.Horizontal'
      const metric = listMetrics[index]
      const total = listMetrics.length
        ? listMetrics.at(-1)!.start + listMetrics.at(-1)!.primary
        : 0
      item.setProperty('x', horizontal ? metric.start : 0)
      item.setProperty('y', horizontal ? 0 : metric.start)
      this.view.setInternalProperty('contentWidth', horizontal ? total : Math.max(Number(this.view.getProperty('width')), ...listMetrics.map(value => value.width)))
      this.view.setInternalProperty('contentHeight', horizontal ? Math.max(Number(this.view.getProperty('height')), ...listMetrics.map(value => value.height)) : total)
      return
    }
    if (this.view.typeName === 'GridView') {
      const cellWidth = Number(this.view.getProperty('cellWidth')) || 100
      const cellHeight = Number(this.view.getProperty('cellHeight')) || 100
      const columns = Math.max(1, Math.floor(Number(this.view.getProperty('width')) / cellWidth))
      item.setProperty('x', (index % columns) * cellWidth)
      item.setProperty('y', Math.floor(index / columns) * cellHeight)
      this.view.setInternalProperty('contentWidth', columns * cellWidth)
      this.view.setInternalProperty('contentHeight', Math.ceil(count / columns) * cellHeight)
      return
    }

    const width = Number(this.view.getProperty('width')) || 0
    const height = Number(this.view.getProperty('height')) || 0
    const offset = Number(this.view.getProperty('offset')) || 0
    const progress = ((index + offset) % Math.max(1, count)) / Math.max(1, count - 1)
    const itemWidth = Number(item.getProperty('width')) || 0
    const itemHeight = Number(item.getProperty('height')) || 0
    const path = this.view.getProperty('path')
    if (path instanceof QmlObject && path.typeName === 'Path') {
      const point = this.samplePath(path, Math.max(0, Math.min(1, progress)))
      item.setProperty('x', point.x - itemWidth / 2)
      item.setProperty('y', point.y - itemHeight / 2)
      for (const [name, value] of Object.entries(point.attributes)) {
        if (!item.hasProperty(name)) item.defineProperty({ name, type: 'real', initialValue: value })
        else item.setProperty(name, value)
      }
      return
    }
    const angle = ((index + offset) / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2
    item.setProperty('x', width / 2 + Math.cos(angle) * width * 0.4 - itemWidth / 2)
    item.setProperty('y', height / 2 + Math.sin(angle) * height * 0.4 - itemHeight / 2)
  }

  private updateCurrent(): void {
    if (this.rebuilding) return
    const current = this.itemAt(Number(this.view.getProperty('currentIndex')))
    this.view.setInternalProperty('currentItem', current)
    this.updateHighlight()
    if (!current && Number(this.view.getProperty('currentIndex')) >= 0) this.rebuild()
  }

  private samplePath(path: QmlObject, progress: number): { x: number; y: number; attributes: Record<string, number> } {
    const drawable = path.children.filter(child => child.typeName === 'PathLine' || child.typeName === 'PathQuad')
    const attributes = Object.fromEntries(path.children
      .filter(child => child.typeName === 'PathAttribute')
      .map(child => [String(child.getProperty('name')), Number(child.getProperty('value')) || 0]))
    if (!drawable.length) {
      return { x: Number(path.getProperty('startX')), y: Number(path.getProperty('startY')), attributes }
    }
    const scaled = progress * drawable.length
    const segmentIndex = Math.min(drawable.length - 1, Math.floor(scaled))
    const local = Math.min(1, scaled - segmentIndex)
    const segment = drawable[segmentIndex]
    const previous = segmentIndex === 0 ? path : drawable[segmentIndex - 1]
    const startX = Number(previous.getProperty(segmentIndex === 0 ? 'startX' : 'x')) || 0
    const startY = Number(previous.getProperty(segmentIndex === 0 ? 'startY' : 'y')) || 0
    const endX = Number(segment.getProperty('x')) || 0
    const endY = Number(segment.getProperty('y')) || 0
    if (segment.typeName === 'PathQuad') {
      const controlX = Number(segment.getProperty('controlX')) || 0
      const controlY = Number(segment.getProperty('controlY')) || 0
      const inverse = 1 - local
      return {
        x: inverse * inverse * startX + 2 * inverse * local * controlX + local * local * endX,
        y: inverse * inverse * startY + 2 * inverse * local * controlY + local * local * endY,
        attributes,
      }
    }
    return {
      x: startX + (endX - startX) * local,
      y: startY + (endY - startY) * local,
      attributes,
    }
  }

  private clearEntries(): void {
    this.highlightItem?.destroy()
    this.highlightItem = null
    if (this.view.hasProperty('highlightItem')) this.view.setInternalProperty('highlightItem', null)
    this.entries.forEach(entry => entry.item.destroy())
    this.entries = []
    this.view.setInternalProperty('currentItem', null)
  }

  private applyContext(item: QmlObject, index: number, modelData: unknown): void {
    if (item.hasProperty('index')) item.setProperty('index', index)
    if (item.hasProperty('modelData')) item.setProperty('modelData', modelData)
    if (modelData && typeof modelData === 'object' && !Array.isArray(modelData)) {
      for (const [name, value] of Object.entries(modelData as QmlListModelRow)) {
        if (item.hasProperty(name)) item.setProperty(name, value)
      }
    }
    if (this.view.typeName === 'ListView') {
      const sectionProperty = String(this.view.getProperty('section.property') ?? '')
      if (sectionProperty) {
        if (!item.hasProperty('ListView.section')) {
          item.defineProperty({ name: 'ListView.section', type: 'string', initialValue: '' })
        }
        const section = modelData && typeof modelData === 'object'
          ? (modelData as QmlListModelRow)[sectionProperty]
          : undefined
        item.setProperty('ListView.section', section == null ? '' : String(section))
      }
    }
  }

  private updateHighlight(): void {
    this.highlightItem?.destroy()
    this.highlightItem = null
    if (!this.view.hasProperty('highlight')) return
    const component = this.view.getProperty('highlight')
    const current = this.itemAt(Number(this.view.getProperty('currentIndex')))
    if (!(component instanceof QmlComponent) || !current) {
      this.view.setInternalProperty('highlightItem', null)
      return
    }
    const highlight = component.create(this.view).roots[0]
    for (const name of ['x', 'y', 'width', 'height']) {
      highlight.setProperty(name, current.getProperty(name))
    }
    this.highlightItem = highlight
    this.view.setInternalProperty('highlightItem', highlight)
  }
}
