import { beforeAll, describe, expect, it, vi } from 'vitest'
import { parseQML } from '../renderer/parser'
import { activateQmlDocument, instantiateQmlDocument } from './QmlDocument'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'
import { QmlComponent } from './QmlComponent'
import { QmlJsEngine } from './QmlJsEngine'

describe('instantiateQmlDocument', () => {
  it('creates an owned object tree and id registry', () => {
    const document = instantiateQmlDocument(parseQML(`
      Item {
        id: root
        width: 320
        Rectangle {
          id: panel
          visible: true
        }
      }
    `))

    const root = document.ids.get('root')
    const panel = document.ids.get('panel')
    expect(document.roots).toEqual([root])
    expect(root?.children).toEqual([panel])
    expect(panel?.parent).toBe(root)
    expect(root?.getProperty('width')).toBe(320)
    expect(panel?.getProperty('visible')).toBe(true)
  })

  it('routes Connections function handlers to the target signal', async () => {
    const engine = await QmlJsEngine.create()
    const active = activateQmlDocument(parseQML(`
      Item {
        id: root
        property int counter: 0
        Button { id: addFive }
        Connections {
          target: addFive
          function onClicked() { root.counter = root.counter + 5 }
        }
      }
    `), engine)

    const connection = active.roots[0].children.find(child => child.typeName === 'Connections')!
    expect((connection.getProperty('target') as { typeName?: string }).typeName).toBe('Button')
    expect(connection.hasMethod('onClicked')).toBe(true)
    active.ids.get('addFive')!.emitSignal('clicked')

    expect(active.ids.get('root')!.getProperty('counter')).toBe(5)
    active.dispose()
  })

  it('instantiates declarative ListModel roles and resolves model ids', async () => {
    const engine = await QmlJsEngine.create()
    const active = activateQmlDocument(parseQML(`
      Item {
        ListModel { id: people; ListElement { name: "Alice"; age: 23 } }
        ListView { id: view; model: people }
      }
    `), engine)
    const model = active.ids.get('people')!

    expect(active.ids.get('view')!.getProperty('model')).toBe(model)
    expect(model.children[0].getProperty('name')).toBe('Alice')
    expect(model.children[0].getProperty('age')).toBe(23)
    active.dispose()
  })

  it('automatically activates asynchronous Loader sources', async () => {
    const registry = createBuiltinQmlTypeRegistry()
    const engine = await QmlJsEngine.create()
    const active = activateQmlDocument(parseQML(`
      Item { Loader { id: loader; source: "Panel.qml" } }
    `), engine, registry, {
      resolveLoaderSource: async source => new QmlComponent(
        source === 'Panel.qml' ? 'Rectangle { id: panel; color: "red" }' : 'Text { text: "Other" }',
        registry,
        source,
      ),
    })
    const loader = active.ids.get('loader')!
    await vi.waitFor(() => expect(loader.getProperty('status')).toBe(1))
    const firstItem = loader.getProperty('item') as { typeName: string; parent: unknown }

    expect(firstItem.typeName).toBe('Rectangle')
    loader.setProperty('source', 'Other.qml')
    await vi.waitFor(() => expect((loader.getProperty('item') as { typeName: string }).typeName).toBe('Text'))
    expect(firstItem.parent).toBeNull()

    active.dispose()
    expect(loader.getProperty('item')).toBeNull()
  })

  it('instantiates declared property types and literal values', () => {
    const document = instantiateQmlDocument(parseQML(`
      Item {
        id: root
        property color accent: "red"
        property bool active: false
        readonly property list<Item> entries: []
      }
    `))
    const root = document.ids.get('root')

    expect(root?.getProperty('accent')).toBe('red')
    expect(root?.getProperty('active')).toBe(false)
    expect(root?.getProperty('entries')).toEqual([])
    expect(() => root?.setProperty('entries', [])).toThrow(
      'Cannot assign to readonly property entries on Item',
    )
  })

  it('rejects missing required properties and duplicate ids', () => {
    expect(() => instantiateQmlDocument(parseQML(`
      Item { required property string title }
    `))).toThrow('Missing required properties on Item: title')

    expect(() => instantiateQmlDocument(parseQML(`
      Item {
        Rectangle { id: repeated }
        Rectangle { id: repeated }
      }
    `))).toThrow('Duplicate id repeated')
  })

  it('routes anonymous children to a declared list default property', () => {
    const document = instantiateQmlDocument(parseQML(`
      Item {
        id: root
        default property list<Item> content: []
        Rectangle { id: first }
        Text { id: second }
      }
    `))
    const root = document.ids.get('root')

    expect(root?.getProperty('content')).toEqual([
      document.ids.get('first'),
      document.ids.get('second'),
    ])
  })

  it('resolves object properties, ancestor properties, and ids in lexical scope', () => {
    const document = instantiateQmlDocument(parseQML(`
      Item {
        id: root
        property color accent: "red"
        Rectangle {
          id: panel
          property string title: "Panel"
        }
      }
    `))
    const root = document.ids.get('root')!
    const panel = document.ids.get('panel')!

    expect(document.scope.resolve('title', panel)).toBe('Panel')
    expect(document.scope.resolve('accent', panel)).toBe('red')
    expect(document.scope.resolve('root', panel)).toBe(root)
    expect(document.scope.resolve('missing', panel)).toBeUndefined()
  })

  it('resolves property and object aliases after all ids are registered', () => {
    const document = instantiateQmlDocument(parseQML(`
      Item {
        id: root
        property alias panelWidth: panel.width
        property alias panelRef: panel
        Rectangle {
          id: panel
          width: 120
        }
      }
    `))
    const root = document.ids.get('root')!
    const panel = document.ids.get('panel')!

    expect(root.getProperty('panelWidth')).toBe(120)
    expect(root.getProperty('panelRef')).toBe(panel)
    root.setProperty('panelWidth', 240)
    expect(panel.getProperty('width')).toBe(240)
  })

  it('registers custom signals from parsed declarations', () => {
    const document = instantiateQmlDocument(parseQML(`
      Item {
        id: root
        signal activated(int index)
      }
    `))
    const root = document.ids.get('root')!
    const values: unknown[] = []
    root.connectSignal('activated', index => values.push(index))

    root.emitSignal('activated', 3)

    expect(values).toEqual([3])
  })

  it('uses built-in type defaults and Item data child routing', () => {
    const document = instantiateQmlDocument(parseQML(`
      Item {
        id: root
        Rectangle { id: panel }
      }
    `))
    const root = document.ids.get('root')!
    const panel = document.ids.get('panel')!

    expect(panel.getProperty('color')).toBe('white')
    expect(panel.getProperty('visible')).toBe(true)
    expect(root.getProperty('data')).toEqual([panel])
  })

  it('rejects unknown QML types and properties', () => {
    expect(() => instantiateQmlDocument(parseQML('MissingType {}'))).toThrow(
      'Unknown QML type MissingType',
    )
    expect(() => instantiateQmlDocument(parseQML('Item { missing: 1 }'))).toThrow(
      'Unknown property missing on Item',
    )
  })
})

describe('activateQmlDocument', () => {
  let jsEngine: QmlJsEngine

  beforeAll(async () => {
    jsEngine = await QmlJsEngine.create()
  })

  it('updates a child binding when a custom parent property changes', () => {
    const document = activateQmlDocument(parseQML(`
      Item {
        id: root
        property color accent: "red"
        Text {
          id: label
          color: accent
        }
      }
    `), jsEngine)
    const root = document.ids.get('root')!
    const label = document.ids.get('label')!

    expect(label.getProperty('color')).toBe('red')
    root.setProperty('accent', 'blue')
    expect(label.getProperty('color')).toBe('blue')
  })

  it('installs methods and signal handlers with parameters', () => {
    const document = activateQmlDocument(parseQML(`
      Item {
        id: root
        property int count: 1
        signal advanced(int step)
        onAdvanced: { count += step }
        function increment(step) { count += step; return count }
      }
    `), jsEngine)
    const root = document.ids.get('root')!

    expect(root.callMethod('increment', 2)).toBe(3)
    root.emitSignal('advanced', 4)
    expect(root.getProperty('count')).toBe(7)
  })

  it('resolves unqualified QML method calls from child signal handlers', () => {
    const document = activateQmlDocument(parseQML(`
      Item {
        id: root
        property int count: 0
        function increment() { root.count = root.count + 1 }
        MouseArea { id: action; onClicked: increment() }
      }
    `), jsEngine)

    document.ids.get('action')!.emitSignal('clicked')

    expect(document.ids.get('root')!.getProperty('count')).toBe(1)
  })

  it('runs Component.onCompleted after activation', () => {
    const document = activateQmlDocument(parseQML(`
      Item {
        id: root
        property string status: "pending"
        Component.onCompleted: { status = "ready" }
      }
    `), jsEngine)

    expect(document.ids.get('root')?.getProperty('status')).toBe('ready')
  })

  it('connects handlers to built-in type signals', () => {
    const document = activateQmlDocument(parseQML(`
      Item {
        id: root
        property int clickCount: 0
        MouseArea {
          id: input
          onClicked: { clickCount += 1 }
        }
      }
    `), jsEngine)

    document.ids.get('input')?.emitSignal('clicked')

    expect(document.ids.get('root')?.getProperty('clickCount')).toBe(1)
  })

  it('activates declarative State and PropertyChanges objects', async () => {
    const document = activateQmlDocument(parseQML(`
      Item {
        id: root
        Rectangle { id: panel; x: 0; opacity: 1 }
        states: [
          State {
            name: "moved"
            PropertyChanges { target: panel; x: 80; opacity: 0.5 }
          }
        ]
      }
    `), jsEngine)
    const root = document.ids.get('root')!
    const panel = document.ids.get('panel')!

    root.setProperty('state', 'moved')
    await Promise.resolve()
    expect(panel.getProperty('x')).toBe(80)
    expect(panel.getProperty('opacity')).toBe(0.5)

    root.setProperty('state', '')
    await Promise.resolve()
    expect(panel.getProperty('x')).toBe(0)
    expect(panel.getProperty('opacity')).toBe(1)
    expect(document.stateMachines).toHaveLength(1)
    document.dispose()
  })

  it('reflects a state selected by when on the owning state property', async () => {
    const document = activateQmlDocument(parseQML(`
      Item {
        id: root
        property bool active: false
        Rectangle {
          id: panel
          states: [
            State {
              name: "enabledState"
              when: root.active
              PropertyChanges { target: panel; x: 10 }
            },
            State {
              name: "inactive"
              when: !root.active
              PropertyChanges { target: panel; x: 0 }
            }
          ]
        }
      }
    `), jsEngine)
    const root = document.ids.get('root')!
    const panel = document.ids.get('panel')!
    const states = panel.getProperty('states') as QmlObject[]

    expect(states.map(state => state.getProperty('name'))).toEqual(['enabledState', 'inactive'])
    expect(states.map(state => state.getProperty('when'))).toEqual([false, true])
    await vi.waitFor(() => expect(panel.getProperty('state')).toBe('inactive'))
    root.setProperty('active', true)
    expect(states.map(state => state.getProperty('when'))).toEqual([true, false])
    expect(states.map(state => state.getProperty('name'))).toEqual(['enabledState', 'inactive'])
    await vi.waitFor(() => expect(panel.getProperty('state')).toBe('enabledState'))
    document.dispose()
  })

  it('installs inline ListView and Repeater delegate controllers', () => {
    const document = activateQmlDocument(parseQML(`
      Item {
        ListView {
          id: list
          width: 100
          height: 40
          model: 3
          delegate: Rectangle { property int index: -1; width: 100; height: 20 }
        }
        Repeater {
          id: repeater
          model: 2
          delegate: Item { property int index: -1 }
        }
      }
    `), jsEngine)
    const list = document.ids.get('list')!
    const repeater = document.ids.get('repeater')!

    expect(list.getProperty('count')).toBe(3)
    expect(list.children).toHaveLength(2)
    expect((list.callMethod('itemAtIndex', 1) as QmlObject).getProperty('index')).toBe(1)
    expect(repeater.getProperty('count')).toBe(2)
    expect((repeater.callMethod('itemAt', 1) as QmlObject).getProperty('index')).toBe(1)

    document.dispose()
    expect(list.children).toHaveLength(0)
    expect(repeater.getProperty('count')).toBe(0)
  })

  it('installs and disposes declarative Timer scheduling', () => {
    vi.useFakeTimers()
    const document = activateQmlDocument(parseQML(`
      Timer { id: timer; interval: 20; repeat: true; running: true }
    `), jsEngine)
    const timer = document.ids.get('timer')!
    const triggered = vi.fn()
    timer.connectSignal('triggered', triggered)

    vi.advanceTimersByTime(40)
    expect(triggered).toHaveBeenCalledTimes(2)
    document.dispose()
    vi.advanceTimersByTime(100)
    expect(triggered).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('installs standalone animation lifecycle methods', async () => {
    let time = 0
    let nextHandle = 1
    const callbacks = new Map<number, (timestamp: number) => void>()
    const scheduler = {
      now: () => time,
      request: (callback: (timestamp: number) => void) => {
        const handle = nextHandle++
        callbacks.set(handle, callback)
        return handle
      },
      cancel: (handle: number) => { callbacks.delete(handle) },
      advance: (milliseconds: number) => {
        time += milliseconds
        const pending = [...callbacks.values()]
        callbacks.clear()
        pending.forEach(callback => callback(time))
      },
    }
    const document = activateQmlDocument(parseQML(`
      Item {
        id: target
        NumberAnimation {
          id: animation
          target: target
          property: "x"
          from: 0
          to: 80
          duration: 100
        }
      }
    `), jsEngine, createBuiltinQmlTypeRegistry(), { animationScheduler: scheduler })
    const target = document.ids.get('target')!
    const animation = document.ids.get('animation')!
    const finished = vi.fn()
    animation.connectSignal('finished', finished)

    animation.callMethod('restart')
    scheduler.advance(100)
    await Promise.resolve()

    expect(target.getProperty('x')).toBe(80)
    expect(animation.getProperty('running')).toBe(false)
    expect(finished).toHaveBeenCalledOnce()
    document.dispose()
  })

  it('evaluates nested object arrays and template literals', () => {
    const document = activateQmlDocument(parseQML(`
      Item {
        id: root
        property var points: [{ x: 1, meta: { label: "first" } }, { x: 2 }]
        property string summary: \`\${points[0].meta.label}:\${points[1].x}\`
      }
    `), jsEngine)

    expect(document.ids.get('root')?.getProperty('points')).toEqual([
      { x: 1, meta: { label: 'first' } },
      { x: 2 },
    ])
    expect(document.ids.get('root')?.getProperty('summary')).toBe('first:2')
  })
})
