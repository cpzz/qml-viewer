export type QmlPrimitiveType =
  | 'bool'
  | 'color'
  | 'date'
  | 'double'
  | 'int'
  | 'real'
  | 'string'
  | 'url'
  | 'var'

export interface QmlRuntimePropertyDefinition {
  name: string
  type: QmlPrimitiveType | string
  initialValue?: unknown
  default?: boolean
  readonly?: boolean
  required?: boolean
}

export interface QmlPropertyChange {
  name: string
  previousValue: unknown
  value: unknown
}

export type QmlPropertyListener = (change: QmlPropertyChange) => void
export type QmlSignalListener = (...args: unknown[]) => void
export type QmlMethod = (...args: unknown[]) => unknown

export interface QmlPropertyReference {
  object: QmlObject
  name: string
}

interface QmlAliasTarget {
  object: QmlObject
  propertyName: string | null
}

let propertyReadCollector: ((reference: QmlPropertyReference) => void) | null = null

export function collectQmlPropertyReads<T>(evaluate: () => T): {
  value: T
  dependencies: QmlPropertyReference[]
} {
  const previousCollector = propertyReadCollector
  const dependencies = new Map<string, QmlPropertyReference>()
  const objectIds = new WeakMap<QmlObject, number>()
  let nextObjectId = 1

  propertyReadCollector = (reference) => {
    let objectId = objectIds.get(reference.object)
    if (!objectId) {
      objectId = nextObjectId++
      objectIds.set(reference.object, objectId)
    }
    dependencies.set(`${objectId}:${reference.name}`, reference)
    previousCollector?.(reference)
  }

  try {
    return { value: evaluate(), dependencies: [...dependencies.values()] }
  } finally {
    propertyReadCollector = previousCollector
  }
}

function defaultValueForType(type: string): unknown {
  switch (type) {
    case 'bool': return false
    case 'double':
    case 'int':
    case 'real': return 0
    case 'string':
    case 'url': return ''
    case 'date': return new Date(Number.NaN)
    default: return undefined
  }
}

export class QmlObject {
  readonly typeName: string
  readonly children: QmlObject[] = []

  private parentObject: QmlObject | null

  private readonly definitions = new Map<string, QmlRuntimePropertyDefinition>()
  private readonly aliases = new Map<string, QmlAliasTarget>()
  private readonly values = new Map<string, unknown>()
  private readonly initializedProperties = new Set<string>()
  private readonly listeners = new Map<string, Set<QmlPropertyListener>>()
  private readonly signals = new Map<string, Set<QmlSignalListener>>()
  private readonly methods = new Map<string, QmlMethod>()
  private defaultPropertyName: string | null = null
  private completed = false

  constructor(typeName: string, parent: QmlObject | null = null) {
    this.typeName = typeName
    this.parentObject = null
    if (parent) this.attachTo(parent)
  }

  get parent(): QmlObject | null {
    return this.parentObject
  }

  attachTo(parent: QmlObject): void {
    if (this.parentObject) throw new Error(`${this.typeName} already has a parent`)
    if (parent === this || this.children.includes(parent)) {
      throw new Error(`Cannot create circular ownership for ${this.typeName}`)
    }
    this.parentObject = parent
    parent.children.push(this)
    if (parent.hasSignal('childrenChanged')) parent.emitSignal('childrenChanged')
  }

  defineProperty(definition: QmlRuntimePropertyDefinition, replaceDefault = false): void {
    if (this.hasProperty(definition.name)) {
      throw new Error(`Property ${definition.name} is already defined on ${this.typeName}`)
    }

    if (definition.default) {
      if (this.defaultPropertyName && !replaceDefault) {
        throw new Error(`Multiple default properties on ${this.typeName}`)
      }
      this.defaultPropertyName = definition.name
    }
    this.definitions.set(definition.name, { ...definition })
    this.defineSignal(`${definition.name}Changed`)
    this.values.set(
      definition.name,
      definition.initialValue !== undefined
        ? definition.initialValue
        : defaultValueForType(definition.type),
    )
    if ('initialValue' in definition) this.initializedProperties.add(definition.name)
  }

  defineAlias(name: string, target: QmlObject, propertyName: string | null = null): void {
    if (this.hasProperty(name)) {
      throw new Error(`Property ${name} is already defined on ${this.typeName}`)
    }
    if (propertyName && !target.hasProperty(propertyName)) {
      throw new Error(`Unknown alias target ${propertyName} on ${target.typeName}`)
    }
    this.aliases.set(name, { object: target, propertyName })
    this.defineSignal(`${name}Changed`)
    if (propertyName) {
      target.connectSignal(`${propertyName}Changed`, value => {
        this.emitSignal(`${name}Changed`, value)
      })
    }
  }

  defineSignal(name: string): void {
    if (this.signals.has(name)) throw new Error(`Signal ${name} is already defined on ${this.typeName}`)
    this.signals.set(name, new Set())
  }

  connectSignal(name: string, listener: QmlSignalListener): () => void {
    const listeners = this.signals.get(name)
    if (!listeners) throw new Error(`Unknown signal ${name} on ${this.typeName}`)
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  emitSignal(name: string, ...args: unknown[]): void {
    const listeners = this.signals.get(name)
    if (!listeners) throw new Error(`Unknown signal ${name} on ${this.typeName}`)
    ;[...listeners].forEach(listener => listener(...args))
  }

  hasSignal(name: string): boolean {
    return this.signals.has(name)
  }

  getPropertyType(name: string): string | undefined {
    const alias = this.aliases.get(name)
    return alias?.propertyName
      ? alias.object.getPropertyType(alias.propertyName)
      : this.definitions.get(name)?.type
  }

  defineMethod(name: string, method: QmlMethod): void {
    if (this.methods.has(name)) throw new Error(`Method ${name} is already defined on ${this.typeName}`)
    this.methods.set(name, method)
  }

  callMethod(name: string, ...args: unknown[]): unknown {
    const method = this.methods.get(name)
    if (!method) throw new Error(`Unknown method ${name} on ${this.typeName}`)
    return method(...args)
  }

  hasMethod(name: string): boolean {
    return this.methods.has(name)
  }

  hasProperty(name: string): boolean {
    return this.definitions.has(name) || this.aliases.has(name)
  }

  getPropertyNames(): string[] {
    return [...new Set([...this.definitions.keys(), ...this.aliases.keys()])]
  }

  getProperty(name: string): unknown {
    const alias = this.aliases.get(name)
    if (alias) {
      return alias.propertyName
        ? alias.object.getProperty(alias.propertyName)
        : alias.object
    }
    if (!this.definitions.has(name)) {
      throw new Error(`Unknown property ${name} on ${this.typeName}`)
    }
    propertyReadCollector?.({ object: this, name })
    return this.values.get(name)
  }

  setProperty(name: string, value: unknown): void {
    const alias = this.aliases.get(name)
    if (alias) {
      if (!alias.propertyName) throw new Error(`Cannot assign to object alias ${name}`)
      alias.object.setProperty(alias.propertyName, value)
      return
    }
    this.writeProperty(name, value, false)
  }

  initializeProperty(name: string, value: unknown): void {
    this.writeProperty(name, value, true)
  }

  setInternalProperty(name: string, value: unknown): void {
    this.writeProperty(name, value, true, true)
  }

  destroy(): void {
    ;[...this.children].forEach(child => child.destroy())
    const parent = this.parentObject
    if (parent) {
      const index = parent.children.indexOf(this)
      if (index >= 0) parent.children.splice(index, 1)
      const defaultProperty = parent.defaultPropertyName
      if (defaultProperty) {
        const value = parent.getProperty(defaultProperty)
        if (Array.isArray(value) && value.includes(this)) {
          parent.setInternalProperty(defaultProperty, value.filter(item => item !== this))
        } else if (value === this) {
          parent.setInternalProperty(defaultProperty, null)
        }
      }
      this.parentObject = null
      if (parent.hasSignal('childrenChanged')) parent.emitSignal('childrenChanged')
    }
    this.listeners.clear()
    this.signals.forEach(listeners => listeners.clear())
  }

  appendDefaultChild(child: QmlObject): void {
    if (!this.defaultPropertyName) return

    const currentValue = this.getProperty(this.defaultPropertyName)
    if (Array.isArray(currentValue)) {
      this.initializeProperty(this.defaultPropertyName, [...currentValue, child])
      return
    }
    if (currentValue === undefined || currentValue === null) {
      this.initializeProperty(this.defaultPropertyName, child)
      return
    }
    throw new Error(
      `Default property ${this.defaultPropertyName} on ${this.typeName} already has a value`,
    )
  }

  complete(): void {
    const missing = [...this.definitions.values()]
      .filter(definition => definition.required && !this.initializedProperties.has(definition.name))
      .map(definition => definition.name)

    if (missing.length > 0) {
      throw new Error(`Missing required properties on ${this.typeName}: ${missing.join(', ')}`)
    }
    this.completed = true
  }

  onPropertyChanged(name: string, listener: QmlPropertyListener): () => void {
    const alias = this.aliases.get(name)
    if (alias) {
      if (!alias.propertyName) throw new Error(`Object alias ${name} has no change signal`)
      return alias.object.onPropertyChanged(alias.propertyName, change => listener({
        ...change,
        name,
      }))
    }
    if (!this.definitions.has(name)) {
      throw new Error(`Unknown property ${name} on ${this.typeName}`)
    }
    const propertyListeners = this.listeners.get(name) ?? new Set<QmlPropertyListener>()
    propertyListeners.add(listener)
    this.listeners.set(name, propertyListeners)
    return () => propertyListeners.delete(listener)
  }

  private writeProperty(
    name: string,
    value: unknown,
    initializing: boolean,
    internal = false,
  ): void {
    const definition = this.definitions.get(name)
    if (!definition) {
      throw new Error(`Unknown property ${name} on ${this.typeName}`)
    }
    if (definition.readonly && !internal && (!initializing || this.completed)) {
      throw new Error(`Cannot assign to readonly property ${name} on ${this.typeName}`)
    }

    const previousValue = this.values.get(name)
    if (Object.is(previousValue, value)) return

    this.values.set(name, value)
    this.initializedProperties.add(name)
    const change = { name, previousValue, value }
    const listeners = this.listeners.get(name)
    if (listeners) [...listeners].forEach(listener => listener(change))
    this.emitSignal(`${name}Changed`, value)
  }
}
