import type { QmlDocumentInstance } from './QmlDocument'
import { QmlListModel, type QmlListModelRow } from './QmlListModel'
import { QmlObject } from './QmlObject'

interface QmlDelegateFactory {
  create(parent?: QmlObject | null, context?: Record<string, unknown>): QmlDocumentInstance
}

function isDelegateFactory(value: unknown): value is QmlDelegateFactory {
  return Boolean(value && typeof (value as QmlDelegateFactory).create === 'function')
}

function modelRows(model: unknown): unknown[] {
  if (model instanceof QmlListModel) return model.toArray()
  if (model instanceof QmlObject && model.typeName === 'ListModel') {
    return model.children
        .filter(child => child.typeName === 'ListElement')
      .map(child => Object.fromEntries(child.getPropertyNames().map(name => [name, child.getProperty(name)])))
  }
  if (Array.isArray(model)) return [...model]
  if (typeof model === 'number' && Number.isFinite(model)) {
    return Array.from({ length: Math.max(0, Math.floor(model)) }, (_, index) => index)
  }
  return []
}

export class QmlRepeaterController {
  private items: QmlObject[] = []
  private modelUnsubscribe: (() => void) | null = null
  private readonly unsubscribe: Array<() => void>

  constructor(private readonly repeater: QmlObject) {
    if (repeater.typeName !== 'Repeater') throw new Error('QmlRepeaterController requires a Repeater object')
    this.unsubscribe = [
      repeater.onPropertyChanged('model', () => this.bindModel()),
      repeater.onPropertyChanged('delegate', () => this.rebuild()),
    ]
    this.bindModel()
  }

  itemAt(index: number): QmlObject | null {
    return this.items[index] ?? null
  }

  dispose(): void {
    this.unsubscribe.forEach(unsubscribe => unsubscribe())
    this.modelUnsubscribe?.()
    this.clearItems()
  }

  private bindModel(): void {
    this.modelUnsubscribe?.()
    const model = this.repeater.getProperty('model')
    this.modelUnsubscribe = model instanceof QmlListModel
      ? model.subscribe(() => this.rebuild())
      : null
    this.rebuild()
  }

  private rebuild(): void {
    this.clearItems()
    const delegate = this.repeater.getProperty('delegate')
    if (!isDelegateFactory(delegate)) {
      this.repeater.setInternalProperty('count', 0)
      return
    }

    const rows = modelRows(this.repeater.getProperty('model'))
    this.items = rows.map((modelData, index) => {
      const context = modelData && typeof modelData === 'object' && !Array.isArray(modelData)
        ? { index, modelData, ...modelData as QmlListModelRow }
        : { index, modelData }
      const document = delegate.create(this.repeater.parent, context)
      const item = document.roots[0]
      this.applyContext(item, index, modelData)
      this.repeater.emitSignal('itemAdded', index, item)
      return item
    })
    this.repeater.setInternalProperty('count', this.items.length)
  }

  private clearItems(): void {
    this.items.forEach((item, index) => {
      this.repeater.emitSignal('itemRemoved', index, item)
      item.destroy()
    })
    this.items = []
    this.repeater.setInternalProperty('count', 0)
  }

  private applyContext(item: QmlObject, index: number, modelData: unknown): void {
    if (item.hasProperty('index')) item.setProperty('index', index)
    if (item.hasProperty('modelData')) item.setProperty('modelData', modelData)
    if (modelData && typeof modelData === 'object' && !Array.isArray(modelData)) {
      for (const [name, value] of Object.entries(modelData as QmlListModelRow)) {
        if (item.hasProperty(name)) item.setProperty(name, value)
      }
    }
  }
}
