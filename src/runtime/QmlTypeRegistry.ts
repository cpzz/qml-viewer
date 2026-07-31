import {
  QmlObject,
  type QmlMethod,
  type QmlRuntimePropertyDefinition,
} from './QmlObject'
import type { QmlDocumentInstance } from './QmlDocument'

export interface QmlTypeDefinition {
  name: string
  baseType?: string
  properties?: QmlRuntimePropertyDefinition[]
  signals?: string[]
  methods?: Record<string, QmlMethod>
}

export type QmlTypeFactory = (parent: QmlObject | null) => QmlObject | QmlDocumentInstance

function cloneValue(value: unknown): unknown {
  if (value instanceof Date) return new Date(value.getTime())
  if (Array.isArray(value)) return value.map(cloneValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [name, cloneValue(item)]),
    )
  }
  return value
}

export class QmlTypeRegistry {
  private readonly definitions = new Map<string, QmlTypeDefinition>()
  private readonly factories = new Map<string, QmlTypeFactory>()
  private readonly factoryDocuments = new WeakMap<QmlObject, QmlDocumentInstance>()

  register(definition: QmlTypeDefinition): void {
    if (this.has(definition.name)) {
      throw new Error(`QML type ${definition.name} is already registered`)
    }
    this.definitions.set(definition.name, {
      ...definition,
      properties: definition.properties?.map(property => ({ ...property })),
      signals: [...(definition.signals ?? [])],
      methods: { ...(definition.methods ?? {}) },
    })
  }

  registerFactory(name: string, factory: QmlTypeFactory): void {
    if (this.has(name)) throw new Error(`QML type ${name} is already registered`)
    this.factories.set(name, factory)
  }

  has(name: string): boolean {
    return this.definitions.has(name) || this.factories.has(name)
  }

  create(name: string, parent: QmlObject | null = null): QmlObject {
    const factory = this.factories.get(name)
    if (factory) {
      const result = factory(parent)
      if (result instanceof QmlObject) return result
      const root = result.roots[0]
      this.factoryDocuments.set(root, result)
      return root
    }
    const hierarchy = this.resolveHierarchy(name)
    const properties = new Map<string, QmlRuntimePropertyDefinition>()
    const signals = new Set<string>()
    const methods = new Map<string, QmlMethod>()

    for (const definition of hierarchy) {
      for (const property of definition.properties ?? []) properties.set(property.name, property)
      for (const signal of definition.signals ?? []) signals.add(signal)
      for (const [methodName, method] of Object.entries(definition.methods ?? {})) {
        methods.set(methodName, method)
      }
    }

    const object = new QmlObject(name)
    for (const property of properties.values()) {
      object.defineProperty({
        ...property,
        initialValue: cloneValue(property.initialValue),
      })
    }
    for (const signal of signals) object.defineSignal(signal)
    for (const [methodName, method] of methods) {
      object.defineMethod(methodName, (...args) => method.apply(object, args))
    }
    if (parent) object.attachTo(parent)
    return object
  }

  getFactoryDocument(object: QmlObject): QmlDocumentInstance | undefined {
    return this.factoryDocuments.get(object)
  }

  private resolveHierarchy(name: string): QmlTypeDefinition[] {
    const hierarchy: QmlTypeDefinition[] = []
    const visited = new Set<string>()
    let currentName: string | undefined = name

    while (currentName) {
      if (visited.has(currentName)) throw new Error(`Circular QML type inheritance at ${currentName}`)
      visited.add(currentName)
      const definition = this.definitions.get(currentName)
      if (!definition) throw new Error(`Unknown QML type ${currentName}`)
      hierarchy.unshift(definition)
      currentName = definition.baseType
    }
    return hierarchy
  }
}
