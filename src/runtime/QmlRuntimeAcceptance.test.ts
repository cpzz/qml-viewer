// @vitest-environment jsdom

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { parseQMLDocument } from '../renderer/parser'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'
import { activateQmlDocument } from './QmlDocument'
import { QmlDomSceneGraph } from './QmlDomSceneGraph'
import { QmlJsEngine } from './QmlJsEngine'

describe('QML runtime acceptance fixture', () => {
  let engine: QmlJsEngine

  beforeAll(async () => {
    engine = await QmlJsEngine.create()
  })

  it('runs bindings, controls, states, events, and Canvas in one retained scene', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillStyle: '',
      fillRect: vi.fn(),
    } as never)
    const ast = parseQMLDocument(`
      import QtQuick
      import QtQuick.Controls
      ApplicationWindow {
        id: root
        width: 320
        height: 200
        property int count: 1
        Rectangle { id: panel; width: 100; height: 60; x: 0; color: "red" }
        Text { id: label; y: 70; text: \`Count \${count}\` }
        Button {
          id: action; y: 100; width: 90; height: 30; text: "Activate"
          onClicked: { count += 1; root.state = "active" }
        }
        Canvas { id: canvas; x: 120; width: 80; height: 60 }
        states: [
          State { name: "active"; PropertyChanges { target: panel; x: 40; color: "blue" } }
        ]
      }
    `)
    expect(ast.diagnostics).toEqual([])
    const active = activateQmlDocument(ast.nodes, engine, createBuiltinQmlTypeRegistry())
    const container = document.createElement('main')
    document.body.append(container)
    const scene = new QmlDomSceneGraph(document)
    scene.mount(active, container)

    scene.getElement(active.ids.get('action')!)?.click()
    await Promise.resolve()

    expect(active.ids.get('root')?.getProperty('count')).toBe(2)
    expect(active.ids.get('label')?.getProperty('text')).toBe('Count 2')
    expect(scene.getElement(active.ids.get('panel')!)?.style.left).toBe('40px')
    expect(scene.getElement(active.ids.get('panel')!)?.style.backgroundColor).toBe('blue')
    expect(scene.getElement(active.ids.get('canvas')!)?.tagName).toBe('CANVAS')

    scene.dispose()
    active.dispose()
  })

  it('activates and disposes document-level Shortcuts', () => {
    const ast = parseQMLDocument(`
      Item {
        id: root
        property int activations: 0
        Shortcut { sequence: "Ctrl+S"; onActivated: root.activations += 1 }
      }
    `)
    const active = activateQmlDocument(ast.nodes, engine, createBuiltinQmlTypeRegistry(), {
      shortcutEventTarget: document,
    })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
    expect(active.ids.get('root')?.getProperty('activations')).toBe(1)

    active.dispose()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
    expect(active.ids.get('root')?.getProperty('activations')).toBe(1)
  })
})