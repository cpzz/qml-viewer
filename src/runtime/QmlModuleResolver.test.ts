import { describe, expect, it } from 'vitest'
import { parseQMLDocument } from '../renderer/parser'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'
import { QmlComponent } from './QmlComponent'
import { activateQmlDocument } from './QmlDocument'
import { QmlJsEngine } from './QmlJsEngine'
import { QmlModuleResolver } from './QmlModuleResolver'
import { parseQmlDir } from './QmlDir'

describe('QmlComponent', () => {
  it('creates independent runtime documents from a QML template', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const component = new QmlComponent(`
      Rectangle {
        id: card
        property string title: "Welcome"
        width: 120
        height: 80
        Text { id: label; text: title }
      }
    `, registry, 'Card.qml')

    const first = component.create()
    const second = component.create()
    first.ids.get('card')?.setProperty('title', 'Changed')

    expect(component.status).toBe('Ready')
    expect(first.ids.get('card')).not.toBe(second.ids.get('card'))
    expect(second.ids.get('card')?.getProperty('title')).toBe('Welcome')
  })

  it('reports components without exactly one root object', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const empty = new QmlComponent('import QtQuick', registry, 'Empty.qml')
    const multiple = new QmlComponent('Item {} Item {}', registry, 'Multiple.qml')

    expect(empty.status).toBe('Error')
    expect(() => empty.create()).toThrow('has no root object')
    expect(multiple.status).toBe('Error')
    expect(() => multiple.create()).toThrow('must have exactly one root object')
  })
})

describe('QmlModuleResolver', () => {
  it('parses qmldir type metadata and diagnostics', () => {
    const document = parseQmlDir(`
      module App.Widgets
      Card 1.0 Card.qml
      singleton Theme 1.0 Theme.qml
      internal Helper Helper.qml
      broken entry
    `)

    expect(document).toMatchObject({
      module: 'App.Widgets',
      types: [
        { name: 'Card', version: '1.0', file: 'Card.qml', singleton: false, internal: false },
        { name: 'Theme', version: '1.0', file: 'Theme.qml', singleton: true, internal: false },
        { name: 'Helper', file: 'Helper.qml', singleton: false, internal: true },
      ],
    })
    expect(document.diagnostics).toHaveLength(1)
  })

  it('registers qmldir components through a source provider', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const resolver = new QmlModuleResolver()
    const files: Record<string, string> = {
      '/modules/App/Widgets/Card.qml': 'Rectangle { id: card; width: 80 }',
      '/modules/App/Widgets/Card2.qml': 'Rectangle { id: card; width: 120 }',
    }
    resolver.registerQmlDir('/modules/App/Widgets', `
      module App.Widgets
      Card 1.0 Card.qml
      Card 2.0 Card2.qml
    `, { readText: url => files[url] })

    const imports = parseQMLDocument('import App.Widgets 2.1\nItem {}').imports
    const component = resolver.resolveComponent(imports, 'Card', registry)

    expect(component.url).toBe('/modules/App/Widgets/Card2.qml')
    expect(component.create().ids.get('card')?.getProperty('width')).toBe(120)
  })

  it('loads async providers and enforces singleton and internal metadata', async () => {
    const registry = createBuiltinQmlTypeRegistry()
    const resolver = new QmlModuleResolver()
    const files: Record<string, string> = {
      '/modules/App/Card.qml': 'Rectangle { width: 80 }',
      '/modules/App/Theme.qml': 'QtObject { property color accent: "blue" }',
      '/modules/App/Helper.qml': 'QtObject {}',
    }
    await resolver.registerQmlDirAsync('/modules/App', `
      module App
      Card 1.0 Card.qml
      singleton Theme 1.0 Theme.qml
      internal Helper 1.0 Helper.qml
    `, { readText: async url => files[url] })
    const imports = parseQMLDocument('import App 1.0\nItem {}').imports

    expect(resolver.resolveComponent(imports, 'Card', registry).url).toBe('/modules/App/Card.qml')
    expect(() => resolver.resolveComponent(imports, 'Theme', registry)).toThrow('Unable to resolve')
    expect(() => resolver.resolveComponent(imports, 'Helper', registry)).toThrow('Unable to resolve')
    expect(resolver.resolveSingleton(imports, 'Theme', registry)).toBe(
      resolver.resolveSingleton(imports, 'Theme', registry),
    )
  })

  it('activates nested custom bindings and handlers with deferred required properties', async () => {
    const registry = createBuiltinQmlTypeRegistry()
    const resolver = new QmlModuleResolver()
    resolver.registerModule('App.Components', {
      version: '1.0',
      types: {
        Card: `Rectangle {
          required property string title
          signal refreshed(int value)
          onRefreshed: { title = "Value " + value }
          Text { text: title }
        }`,
        Page: 'Item { Card { title: "Nested" } }',
      },
    })
    const document = parseQMLDocument('import App.Components 1.0\nItem {}')
    resolver.installImportedTypes(document.imports, registry)

    const component = resolver.resolveComponent(document.imports, 'Page', registry)
    const active = activateQmlDocument(component.ast.nodes, await QmlJsEngine.create(), registry)
    const page = active.roots[0]
    const card = page.children[0]

    expect(card.getProperty('title')).toBe('Nested')
    expect(card.children[0].getProperty('text')).toBe('Nested')

    card.emitSignal('refreshed', 7)

    expect(card.getProperty('title')).toBe('Value 7')
    expect(card.children[0].getProperty('text')).toBe('Value 7')
    active.dispose()

    card.emitSignal('refreshed', 9)
    expect(card.getProperty('title')).toBe('Value 7')
  })

  it('resolves unqualified and aliased component types from imports', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const resolver = new QmlModuleResolver()
    resolver.registerModule('App.Components', {
      version: '1.0',
      types: { Card: 'Rectangle { id: card; color: "red" }' },
    })
    const document = parseQMLDocument(`
      import App.Components 1.2
      import App.Components 1.2 as Local
      Item {}
    `)

    const direct = resolver.resolveComponent(document.imports, 'Card', registry).create()
    const aliased = resolver.resolveComponent(document.imports, 'Local.Card', registry).create()

    expect(direct.ids.get('card')?.getProperty('color')).toBe('red')
    expect(aliased.ids.get('card')?.getProperty('color')).toBe('red')
  })

  it('selects compatible versions and reports unresolved types', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const resolver = new QmlModuleResolver()
    resolver.registerModule('Widgets', {
      version: '2.0',
      types: { Panel: 'Rectangle { color: "blue" }' },
    })
    const oldImport = parseQMLDocument('import Widgets 1.0\nItem {}').imports

    expect(() => resolver.resolveComponent(oldImport, 'Panel', registry)).toThrow(
      'Unable to resolve QML type Panel',
    )
    expect(() => resolver.registerModule('Widgets', { version: '2.0', types: {} })).toThrow(
      'already registered',
    )
  })
})
