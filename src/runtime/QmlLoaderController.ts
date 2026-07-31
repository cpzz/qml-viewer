import { QmlComponent } from './QmlComponent'
import type { QmlDocumentInstance } from './QmlDocument'
import { QmlObject } from './QmlObject'

export const QmlLoaderStatus = {
  Null: 0,
  Ready: 1,
  Loading: 2,
  Error: 3,
} as const

export type QmlLoaderSourceResolver = (
  source: string,
) => QmlComponent | Promise<QmlComponent>

export class QmlLoaderController {
  private generation = 0
  private loadedDocument: QmlDocumentInstance | null = null
  private declarativeItem: QmlObject | null = null
  private readonly unsubscribe: Array<() => void>
  private lastError: Error | null = null

  constructor(
    private readonly loader: QmlObject,
    private readonly resolveSource?: QmlLoaderSourceResolver,
  ) {
    if (loader.typeName !== 'Loader') throw new Error('QmlLoaderController requires a Loader object')
    this.unsubscribe = ['active', 'source', 'sourceComponent'].map(name => (
      loader.onPropertyChanged(name, () => { void this.reload() })
    ))
  }

  get error(): Error | null {
    return this.lastError
  }

  async reload(): Promise<void> {
    const generation = ++this.generation
    this.clearLoadedItem()
    this.lastError = null
    this.loader.setInternalProperty('progress', 0)

    if (!this.loader.getProperty('active')) {
      this.loader.setInternalProperty('status', QmlLoaderStatus.Null)
      return
    }

    try {
      let component = this.loader.getProperty('sourceComponent')
      const source = String(this.loader.getProperty('source') ?? '')
      if (component instanceof QmlObject && component.typeName === 'Component') {
        const item = component.children[0] ?? null
        if (!item) throw new Error('Loader sourceComponent has no root object')
        this.declarativeItem = item
        if (item.hasProperty('visible')) item.setInternalProperty('visible', true)
        this.loader.setInternalProperty('item', item)
        this.loader.setInternalProperty('progress', 1)
        this.loader.setInternalProperty('status', QmlLoaderStatus.Ready)
        this.loader.emitSignal('loaded')
        return
      }
      if (!(component instanceof QmlComponent)) {
        if (!source) {
          this.loader.setInternalProperty('status', QmlLoaderStatus.Null)
          return
        }
        if (!this.resolveSource) throw new Error(`No resolver available for Loader source ${source}`)
        this.loader.setInternalProperty('status', QmlLoaderStatus.Loading)
        component = await this.resolveSource(source)
      }
      if (generation !== this.generation) return
  if (!(component instanceof QmlComponent)) throw new Error('Loader sourceComponent is not a QmlComponent')
      if (component.status !== 'Ready') throw component.errors[0]

      const document = component.create(this.loader)
      if (generation !== this.generation) {
        document.roots.forEach(root => root.destroy())
        return
      }
      this.loadedDocument = document
      this.loader.setInternalProperty('item', document.roots[0] ?? null)
      this.loader.setInternalProperty('progress', 1)
      this.loader.setInternalProperty('status', QmlLoaderStatus.Ready)
      this.loader.emitSignal('loaded')
    } catch (error) {
      if (generation !== this.generation) return
      this.lastError = error instanceof Error ? error : new Error(String(error))
      this.loader.setInternalProperty('status', QmlLoaderStatus.Error)
    }
  }

  dispose(): void {
    this.generation++
    this.unsubscribe.forEach(unsubscribe => unsubscribe())
    this.clearLoadedItem()
  }

  private clearLoadedItem(): void {
    this.loadedDocument?.roots.forEach(root => root.destroy())
    this.loadedDocument = null
    if (this.declarativeItem?.hasProperty('visible')) {
      this.declarativeItem.setInternalProperty('visible', false)
    }
    this.declarativeItem = null
    this.loader.setInternalProperty('item', null)
  }
}
