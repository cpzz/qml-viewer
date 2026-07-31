import type { QMLNode } from '../renderer/parser'
import { BindingEngine } from './BindingEngine'
import type { QmlAnimationScheduler } from './QmlAnimation'
import { isDeclarativeAnimation, QmlAnimationController } from './QmlAnimationController'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'
import { QmlExecutionEnvironment } from './QmlExecutionEnvironment'
import type { QmlJsEngine } from './QmlJsEngine'
import { QmlItemViewController } from './QmlItemViewController'
import { QmlLoaderController, type QmlLoaderSourceResolver } from './QmlLoaderController'
import { QmlObject } from './QmlObject'
import { QmlRepeaterController } from './QmlRepeaterController'
import { QmlShortcutController } from './QmlShortcutController'
import { QmlScope } from './QmlScope'
import { QmlStackViewController } from './QmlStackViewController'
import { QmlStateMachine } from './QmlStateMachine'
import { QmlTimerController } from './QmlTimerController'
import type { QmlTypeRegistry } from './QmlTypeRegistry'

export interface QmlDocumentInstance {
  nodes: readonly QMLNode[]
  roots: QmlObject[]
  ids: ReadonlyMap<string, QmlObject>
  scope: QmlScope
  nodeObjects: ReadonlyMap<QMLNode, QmlObject>
  nestedDocuments: readonly QmlDocumentInstance[]
}

export interface ActiveQmlDocument extends QmlDocumentInstance {
  bindings: BindingEngine
  execution: QmlExecutionEnvironment
    stateMachines: readonly QmlStateMachine[]
  dispose(): void
}

export interface QmlDocumentActivationOptions {
  resolveLoaderSource?: QmlLoaderSourceResolver
  shortcutEventTarget?: EventTarget
  animationScheduler?: QmlAnimationScheduler
}

interface PendingAlias {
  object: QmlObject
  name: string
  expression?: string
}

interface InlineDelegateFactory {
  create(parent?: QmlObject | null, context?: Record<string, unknown>): QmlDocumentInstance
  activate?: (instance: QmlDocumentInstance) => void
}

function coerceLiteral(value: string): unknown {
  const trimmed = value.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return Number(trimmed)
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed
    }
  }
  return trimmed
}

function instantiateNode(
  node: QMLNode,
  parent: QmlObject | null,
  ids: Map<string, QmlObject>,
  scope: QmlScope,
  pendingAliases: PendingAlias[],
  nodeObjects: Map<QMLNode, QmlObject>,
  registry: QmlTypeRegistry,
  routeToDefaultProperty = false,
  completeObject = true,
  nestedDocuments: QmlDocumentInstance[],
): QmlObject {
  const object = registry.create(node.type, parent)
  const factoryDocument = registry.getFactoryDocument(object)
  if (factoryDocument) nestedDocuments.push(factoryDocument)
  nodeObjects.set(node, object)
  const declarations = node.propertyDeclarations ?? {}

  if (node.type === 'ListElement') {
    for (const name of Object.keys(node.properties)) {
      if (name !== 'id' && !object.hasProperty(name)) object.defineProperty({ name, type: 'var' })
    }
  }

  for (const declaration of Object.values(declarations)) {
    if (declaration.type === 'alias') {
      pendingAliases.push({
        object,
        name: declaration.name,
        expression: declaration.value,
      })
      continue
    }
    object.defineProperty({
      name: declaration.name,
      type: declaration.type,
      default: declaration.isDefault,
      readonly: declaration.isReadonly,
      required: declaration.isRequired,
    }, declaration.isDefault)
    if (declaration.value !== undefined) {
      object.initializeProperty(declaration.name, coerceLiteral(declaration.value))
    }
  }

  for (const [name, rawValue] of Object.entries(node.properties)) {
    if (name === 'id' || declarations[name] || /^on[A-Z]/.test(name) || name === 'Component.onCompleted') continue
    if (!object.hasProperty(name) && node.type === 'PropertyChanges') {
      object.defineProperty({ name, type: 'var' })
    }
    if (!object.hasProperty(name)) throw new Error(`Unknown property ${name} on ${node.type}`)
    object.initializeProperty(name, coerceLiteral(rawValue))
  }

  for (const signal of Object.values(node.signals ?? {})) {
    object.defineSignal(signal.name)
  }

  if (node.id) {
    if (ids.has(node.id)) throw new Error(`Duplicate id ${node.id}`)
    ids.set(node.id, object)
    scope.defineId(node.id, object)
  }

  node.children.forEach(child => (
    instantiateNode(child, object, ids, scope, pendingAliases, nodeObjects, registry, true, true, nestedDocuments)
  ))
  Object.entries(node.blockProperties ?? {}).forEach(([name, child]) => {
    if (name === 'delegate' && object.hasProperty(name)) {
      const factory: InlineDelegateFactory = {
        create: (delegateParent: QmlObject | null = null, context = {}) => {
          const instance = instantiateQmlDocument([child], registry, delegateParent)
          const root = instance.roots[0]
          for (const [contextName, value] of Object.entries(context)) {
            if (!root.hasProperty(contextName)) root.defineProperty({ name: contextName, type: 'var' })
            root.setProperty(contextName, value)
          }
          factory.activate?.(instance)
          return instance
        },
      }
      object.initializeProperty(name, factory)
      return
    }
    const childObject = instantiateNode(
      child,
      object,
      ids,
      scope,
      pendingAliases,
      nodeObjects,
      registry,
      false,
      true,
      nestedDocuments,
    )
    if (object.hasProperty(name)) object.initializeProperty(name, childObject)
  })
  Object.entries(node.objectListProperties ?? {}).forEach(([name, children]) => {
    const childObjects = children.map(child => instantiateNode(
      child,
      object,
      ids,
      scope,
      pendingAliases,
      nodeObjects,
      registry,
      false,
      true,
      nestedDocuments,
    ))
    if (object.hasProperty(name)) object.initializeProperty(name, childObjects)
  })
  if (node.type === 'ListModel' && object.hasProperty('count')) {
    object.setInternalProperty('count', object.children.filter(child => child.typeName === 'ListElement').length)
  }
  if (node.type === 'Component') {
    object.children.forEach(child => {
      if (child.hasProperty('visible')) child.setInternalProperty('visible', false)
    })
  }
  if (routeToDefaultProperty) parent?.appendDefaultChild(object)
  if (completeObject) object.complete()
  return object
}

function resolveAliases(aliases: PendingAlias[], scope: QmlScope): void {
  for (const alias of aliases) {
    const expression = alias.expression?.trim()
    if (!expression) throw new Error(`Alias ${alias.name} requires a target`)

    const separator = expression.lastIndexOf('.')
    const ownerName = separator >= 0 ? expression.slice(0, separator) : expression
    const propertyName = separator >= 0 ? expression.slice(separator + 1) : null
    const target = ownerName === 'parent'
      ? alias.object.parent
      : ownerName === 'this'
        ? alias.object
        : scope.resolveId(ownerName)

    if (!target) throw new Error(`Unknown alias target ${ownerName}`)
    alias.object.defineAlias(alias.name, target, propertyName)
  }
}

export function instantiateQmlDocument(
  nodes: QMLNode[],
  registry: QmlTypeRegistry = createBuiltinQmlTypeRegistry(),
  parent: QmlObject | null = null,
  completeRoots = true,
): QmlDocumentInstance {
  const ids = new Map<string, QmlObject>()
  const scope = new QmlScope()
  const pendingAliases: PendingAlias[] = []
  const nodeObjects = new Map<QMLNode, QmlObject>()
  const nestedDocuments: QmlDocumentInstance[] = []
  const roots = nodes.map(node => (
    instantiateNode(
      node,
      parent,
      ids,
      scope,
      pendingAliases,
      nodeObjects,
      registry,
      parent !== null,
      completeRoots,
      nestedDocuments,
    )
  ))
  resolveAliases(pendingAliases, scope)
  return { nodes, roots, ids, scope, nodeObjects, nestedDocuments }
}

function handlerSignalName(name: string): string | null {
  if (!/^on[A-Z]/.test(name)) return null
  return name[2].toLowerCase() + name.slice(3)
}

function handlerBody(source: string): string {
  const trimmed = source.trim()
  return trimmed.startsWith('{') && trimmed.endsWith('}')
    ? trimmed.slice(1, -1)
    : trimmed
}

function isStaticLiteral(source: string): boolean {
  const trimmed = source.trim()
  if (/^(?:true|false|null|undefined|[+-]?(?:\d+\.?\d*|\.\d+))$/.test(trimmed)) return true
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) return true
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return false
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

export function activateQmlDocument(
  nodes: QMLNode[],
  jsEngine: QmlJsEngine,
  registry: QmlTypeRegistry = createBuiltinQmlTypeRegistry(),
  options: QmlDocumentActivationOptions = {},
): ActiveQmlDocument {
  const document = instantiateQmlDocument(nodes, registry)
  const bindings = new BindingEngine()
  const execution = new QmlExecutionEnvironment(jsEngine, document.scope)
  const disconnectors: Array<() => void> = []
  const completedHandlers: Array<() => void> = []
  const stateMachines: QmlStateMachine[] = []
  const loaderControllers: QmlLoaderController[] = []
  const itemViewControllers: QmlItemViewController[] = []
  const repeaterControllers: QmlRepeaterController[] = []
  const timerControllers: QmlTimerController[] = []
  const shortcutControllers: QmlShortcutController[] = []
  const animationControllers: QmlAnimationController[] = []
  const stackViewControllers: QmlStackViewController[] = []

  const activateInstance = (instance: QmlDocumentInstance, instanceExecution: QmlExecutionEnvironment) => {
  const flattenedNodes = instance.nodes.flatMap(function flatten(current): QMLNode[] {
    return [
      current,
      ...current.children.flatMap(flatten),
      ...Object.entries(current.blockProperties ?? {})
        .filter(([name]) => name !== 'delegate')
        .flatMap(([, child]) => flatten(child)),
      ...Object.values(current.objectListProperties ?? {}).flatMap(list => list.flatMap(flatten)),
    ]
  })
  const methodSources = new Map<QmlObject, string[]>()
  const visibleMethodDeclarations = (context: QmlObject): string => {
    const hierarchy: QmlObject[] = []
    let current: QmlObject | null = context
    while (current) {
      hierarchy.unshift(current)
      current = current.parent
    }
    return hierarchy.flatMap(object => methodSources.get(object) ?? []).join('\n')
  }

  for (const node of flattenedNodes) {
    const object = instance.nodeObjects.get(node)!
    const delegate = object.hasProperty('delegate') ? object.getProperty('delegate') as InlineDelegateFactory | null : null
    if (delegate && typeof delegate.create === 'function') {
      delegate.activate = created => activateInstance(created, new QmlExecutionEnvironment(jsEngine, created.scope))
    }
    methodSources.set(object, Object.values(node.methods ?? {}))

    for (const [name, source] of Object.entries(node.methods ?? {})) {
      object.defineMethod(name, (...args) => instanceExecution.call(
        `function (...__qmlArgs) { ${visibleMethodDeclarations(object)}; return (${source})(...__qmlArgs); }`,
        args,
        object,
      ))
    }
  }

  for (const node of flattenedNodes) {
    const object = instance.nodeObjects.get(node)!
    const execute = (body: string, locals: Record<string, unknown> = {}) => {
      instanceExecution.execute(`${visibleMethodDeclarations(object)}\n${body}`, object, locals)
    }

    const expressions = new Map<string, string>()
    for (const declaration of Object.values(node.propertyDeclarations ?? {})) {
      if (declaration.type !== 'alias' && declaration.value !== undefined) {
        expressions.set(declaration.name, declaration.value)
      }
    }
    for (const [name, source] of Object.entries(node.properties)) {
      if (name !== 'id' && !/^on[A-Z]/.test(name) && name !== 'Component.onCompleted') {
        expressions.set(name, source)
      }
    }
    for (const [name, expression] of expressions) {
      if (node.type === 'PropertyChanges' && name === 'target') continue
      if (isStaticLiteral(expression) || node.literalProperties?.[name]) continue
      if (object.getPropertyType(name) === 'date' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(expression.trim())) continue
      const directObject = /^[A-Za-z_$][\w$]*$/.test(expression.trim())
        ? instance.scope.resolveId(expression.trim())
        : undefined
      if (directObject) {
        bindings.bind(object, name, () => directObject)
        continue
      }
      try {
        instanceExecution.evaluate(expression, object)
        bindings.bind(object, name, () => instanceExecution.evaluate(expression, object))
      } catch {
        bindings.unbind(object, name)
      }
    }

    for (const [name, source] of Object.entries(node.properties)) {
      if (name === 'Component.onCompleted') {
        completedHandlers.push(() => execute(handlerBody(source)))
        continue
      }
      const signalName = handlerSignalName(name)
      if (!signalName || !object.hasSignal(signalName)) continue
      const parameters = node.signals?.[signalName]?.parameters ?? []
      disconnectors.push(object.connectSignal(signalName, (...args) => {
        const locals = Object.fromEntries(parameters.map((parameter, index) => (
          [parameter.name, args[index]]
        )))
        execute(handlerBody(source), locals)
      }))
    }

    if (node.type === 'Connections' && object.getProperty('enabled')) {
      const targetValue = object.getProperty('target')
      const target = targetValue instanceof QmlObject
        ? targetValue
        : instance.scope.resolveId(node.properties.target?.trim() ?? String(targetValue))
      if (target instanceof QmlObject) {
        object.setInternalProperty('target', target)
        const handlerNames = new Set([
          ...Object.keys(node.methods ?? {}).filter(name => /^on[A-Z]/.test(name)),
          ...Object.keys(node.properties).filter(name => /^on[A-Z]/.test(name)),
        ])
        handlerNames.forEach(name => {
          const signalName = handlerSignalName(name)
          if (!signalName || !target.hasSignal(signalName)) return
          disconnectors.push(target.connectSignal(signalName, (...args) => {
            if (object.hasMethod(name)) object.callMethod(name, ...args)
            else execute(handlerBody(node.properties[name]))
          }))
        })
      }
    }
  }
  for (const nested of instance.nestedDocuments) {
    activateInstance(nested, new QmlExecutionEnvironment(jsEngine, nested.scope))
  }
  }

  activateInstance(document, execution)

  const installLoaders = (instance: QmlDocumentInstance) => {
    for (const object of instance.nodeObjects.values()) {
      if (object.typeName !== 'Loader') continue
      const controller = new QmlLoaderController(object, options.resolveLoaderSource)
      loaderControllers.push(controller)
      void controller.reload()
    }
    instance.nestedDocuments.forEach(installLoaders)
  }
  installLoaders(document)

  const installRuntimeControllers = (instance: QmlDocumentInstance) => {
    for (const object of instance.nodeObjects.values()) {
      if (['ListView', 'GridView', 'PathView'].includes(object.typeName)) {
        const controller = new QmlItemViewController(object)
        itemViewControllers.push(controller)
        object.defineMethod('itemAt', index => controller.itemAt(Number(index)))
        object.defineMethod('itemAtIndex', index => controller.itemAt(Number(index)))
        object.defineMethod('positionViewAtIndex', index => controller.positionViewAtIndex(Number(index)))
        object.defineMethod('incrementCurrentIndex', () => controller.incrementCurrentIndex())
        object.defineMethod('decrementCurrentIndex', () => controller.decrementCurrentIndex())
      } else if (object.typeName === 'Repeater') {
        const controller = new QmlRepeaterController(object)
        repeaterControllers.push(controller)
        object.defineMethod('itemAt', index => controller.itemAt(Number(index)))
      } else if (object.typeName === 'Timer') {
        timerControllers.push(new QmlTimerController(object))
      } else if (object.typeName === 'Shortcut' && options.shortcutEventTarget) {
        shortcutControllers.push(new QmlShortcutController(object, options.shortcutEventTarget))
      } else if (isDeclarativeAnimation(object)) {
        animationControllers.push(new QmlAnimationController(object, options.animationScheduler))
      } else if (object.typeName === 'StackView') {
        stackViewControllers.push(new QmlStackViewController(object))
      }
    }
    instance.nestedDocuments.forEach(installRuntimeControllers)
  }
  installRuntimeControllers(document)

  for (const owner of document.nodeObjects.values()) {
    if (!owner.hasProperty('states')) continue
    const stateObjects = owner.getProperty('states')
    if (!Array.isArray(stateObjects) || stateObjects.length === 0) continue
    const definitions = stateObjects
      .filter((state): state is QmlObject => state instanceof QmlObject && state.typeName === 'State')
      .map(state => ({
        name: String(state.getProperty('name')),
        when: () => Boolean(state.getProperty('when')),
        changes: state.children
          .filter(change => change.typeName === 'PropertyChanges')
          .map(change => {
            const targetValue = change.getProperty('target')
            const target = targetValue instanceof QmlObject
              ? targetValue
              : document.scope.resolveId(String(targetValue))
            if (!target) throw new Error(`Unknown PropertyChanges target ${String(targetValue)}`)
            return {
              target,
              values: Object.fromEntries(change.getPropertyNames()
                .filter(name => name !== 'target')
                .map(name => [name, change.getProperty(name)])),
            }
          }),
      }))
    const transitionObjects = owner.getProperty('transitions')
    const transitions = Array.isArray(transitionObjects)
      ? transitionObjects
        .filter((transition): transition is QmlObject => transition instanceof QmlObject && transition.typeName === 'Transition')
        .map(transition => {
          const animation = transition.children.find(child => (
            child.typeName === 'NumberAnimation' || child.typeName === 'PropertyAnimation' ||
            child.typeName === 'ColorAnimation' || child.typeName === 'Vector3dAnimation'
          ))
          const propertyName = animation
            ? String(animation.getProperty('properties') || animation.getProperty('property'))
            : ''
          return {
            from: String(transition.getProperty('from')),
            to: String(transition.getProperty('to')),
            properties: propertyName ? propertyName.split(',').map(name => name.trim()) : undefined,
            duration: animation ? Number(animation.getProperty('duration')) : undefined,
            valueType: animation?.typeName === 'ColorAnimation'
              ? 'color' as const
              : animation?.typeName === 'Vector3dAnimation' ? 'vector' as const : 'number' as const,
          }
        })
      : []
    const machine = new QmlStateMachine(definitions, transitions)
    stateMachines.push(machine)
    const refreshFromWhen = async () => {
      await machine.refresh()
      if (owner.getProperty('state') !== machine.state) owner.setProperty('state', machine.state)
    }
    disconnectors.push(owner.onPropertyChanged('state', change => {
      void machine.setState(String(change.value))
    }))
    for (const state of stateObjects.filter((value): value is QmlObject => value instanceof QmlObject)) {
      disconnectors.push(state.onPropertyChanged('when', () => { void refreshFromWhen() }))
    }
    const explicitState = String(owner.getProperty('state'))
    if (explicitState) void machine.setState(explicitState)
    else void refreshFromWhen()
  }

  completedHandlers.forEach(run => run())
  return {
    ...document,
    bindings,
    execution,
      stateMachines,
    dispose() {
      disconnectors.forEach(disconnect => disconnect())
      loaderControllers.forEach(controller => controller.dispose())
      itemViewControllers.forEach(controller => controller.dispose())
      repeaterControllers.forEach(controller => controller.dispose())
      timerControllers.forEach(controller => controller.dispose())
      shortcutControllers.forEach(controller => controller.dispose())
      animationControllers.forEach(controller => controller.dispose())
      stackViewControllers.forEach(controller => controller.dispose())
      bindings.dispose()
      stateMachines.forEach(machine => machine.stop())
    },
  }
}
