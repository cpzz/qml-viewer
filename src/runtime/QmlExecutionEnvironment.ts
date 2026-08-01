import { QmlJsEngine, type QmlJsLiveBridge, type QmlJsScope } from './QmlJsEngine'
import { QmlObject } from './QmlObject'
import { QmlScope } from './QmlScope'

export type QmlHostFunctions = Record<string, (...args: unknown[]) => unknown>

function toScriptValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Date) return value.toISOString()
  if (value instanceof QmlObject) {
    if (seen.has(value)) return null
    seen.add(value)
    const result = Object.fromEntries(
      value.getPropertyNames().map(name => [name, toScriptValue(value.getProperty(name), seen)]),
    )
    seen.delete(value)
    return result
  }
  if (Array.isArray(value)) return value.map(item => toScriptValue(item, seen))
  if (value && typeof value === 'object') {
    if (seen.has(value)) return null
    seen.add(value)
    const result = Object.fromEntries(
      Object.entries(value).map(([name, item]) => [name, toScriptValue(item, seen)]),
    )
    seen.delete(value)
    return result
  }
  return value
}

export class QmlExecutionEnvironment {
  constructor(
    private readonly engine: QmlJsEngine,
    private readonly scope: QmlScope,
    private readonly hostFunctions: QmlHostFunctions = {},
  ) {}

  evaluate(expression: string, context: QmlObject): unknown {
    return this.engine.evaluateLive(expression, this.createBridge(context))
  }

  evaluateAsync(expression: string, context: QmlObject): Promise<unknown> {
    return this.engine.evaluateLiveAsync(expression, this.createBridge(context))
  }

  execute(body: string, context: QmlObject, locals: QmlJsScope = {}): void {
    this.engine.executeLive(body, this.createBridge(context, locals))
  }

  executeAsync(body: string, context: QmlObject, locals: QmlJsScope = {}): Promise<void> {
    return this.engine.executeLiveAsync(body, this.createBridge(context, locals))
  }

  call(functionSource: string, args: unknown[], context: QmlObject): unknown {
    return this.engine.callLive(functionSource, args, this.createBridge(context))
  }

  callAsync(functionSource: string, args: unknown[], context: QmlObject): Promise<unknown> {
    return this.engine.callLiveAsync(functionSource, args, this.createBridge(context))
  }

  private createBridge(context: QmlObject, locals: QmlJsScope = {}): QmlJsLiveBridge {
    const ids = this.scope.getVisibleIds()
    const objects = new Map(ids)
    const objectIds = new Map<QmlObject, string>([...ids].map(([id, object]) => [object, id]))
    let nextObjectId = 1
    const propertyOwners = new Map<string, QmlObject>()
    const hierarchy: QmlObject[] = []
    let current: QmlObject | null = context
    while (current) {
      hierarchy.unshift(current)
      current = current.parent
    }
    for (const object of hierarchy) {
      for (const name of object.getPropertyNames()) {
        propertyOwners.set(name, object)
      }
    }
    const getObject = (id: string) => {
      const object = objects.get(id)
      if (!object) throw new Error(`Unknown QML id ${id}`)
      return object
    }
    const toBridgeValue = (value: unknown): unknown => {
      if (!(value instanceof QmlObject)) return toScriptValue(value)
      let id = objectIds.get(value)
      if (!id) {
        id = `__object${nextObjectId++}`
        objectIds.set(value, id)
        objects.set(id, value)
      }
      return { __qmlObjectId: id }
    }

    const allHostFunctions = {
      ...this.hostFunctions,
      __qmlConsole: (method: string, args: unknown[]) => {
        if (typeof window !== 'undefined') {
          window.postMessage({ type: 'qml-preview-log', level: method, args, timestamp: Date.now() }, '*')
        }
        return null
      },
    }

    return {
      scope: Object.fromEntries(Object.entries(locals).map(([name, value]) => [name, toScriptValue(value)])),
      objectIds: [...ids.keys()],
      hostFunctions: Object.keys(allHostFunctions),
      contextProperties: [...propertyOwners.keys(), 'parent'],
      getContextProperty: name => toBridgeValue(
        name === 'parent' ? context.parent : propertyOwners.get(name)?.getProperty(name),
      ),
      setContextProperty: (name, value) => propertyOwners.get(name)?.setProperty(name, value),
      getObjectMemberKind: (id, name) => {
        const object = getObject(id)
        if (object.hasProperty(name)) return 'property'
        if (object.hasMethod(name)) return 'method'
        if (object.hasSignal(name)) return 'signal'
        return undefined
      },
      getObjectProperty: (id, name) => toBridgeValue(getObject(id).getProperty(name)),
      setObjectProperty: (id, name, value) => getObject(id).setProperty(name, value),
      callObjectMethod: (id, name, args) => toBridgeValue(getObject(id).callMethod(name, ...args)),
      emitObjectSignal: (id, name, args) => getObject(id).emitSignal(name, ...args),
      callHostFunction: (name, args) => {
        const hostFunction = allHostFunctions[name]
        if (!hostFunction) throw new Error(`Unknown QML host function ${name}`)
        return hostFunction(...args)
      },
    }
  }
}
