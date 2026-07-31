import { QmlObject } from './QmlObject'

export type QmlResolvedValue = QmlObject | unknown

export class QmlScope {
  readonly parent: QmlScope | null
  private readonly ids = new Map<string, QmlObject>()

  constructor(parent: QmlScope | null = null) {
    this.parent = parent
  }

  defineId(name: string, object: QmlObject): void {
    if (this.ids.has(name)) throw new Error(`Duplicate id ${name}`)
    this.ids.set(name, object)
  }

  resolveId(name: string): QmlObject | undefined {
    return this.ids.get(name) ?? this.parent?.resolveId(name)
  }

  getVisibleIds(): ReadonlyMap<string, QmlObject> {
    return new Map([
      ...(this.parent?.getVisibleIds() ?? []),
      ...this.ids,
    ])
  }

  resolve(name: string, context: QmlObject | null = null): QmlResolvedValue {
    let current = context
    while (current) {
      if (current.hasProperty(name)) return current.getProperty(name)
      current = current.parent
    }

    const object = this.resolveId(name)
    if (object) return object
    return undefined
  }
}
