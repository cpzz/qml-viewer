// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseQML } from '../renderer/parser'
import { activateQmlDocument } from './QmlDocument'
import { QmlDomSceneGraph } from './QmlDomSceneGraph'
import { QmlJsEngine } from './QmlJsEngine'

describe('Item example DOM fixture', () => {
  it('renders both transformed Rectangle children and the computed text', async () => {
    const source = readFileSync(resolve(process.cwd(), 'examples/item/Item.qml'), 'utf8')
    const qmlDocument = activateQmlDocument(parseQML(source), await QmlJsEngine.create())
    const container = document.createElement('main')
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, container)

    const left = sceneGraph.getElement(qmlDocument.ids.get('leftPanel')!)!
    const right = sceneGraph.getElement(qmlDocument.ids.get('rightPanel')!)!
    const background = sceneGraph.getElement(qmlDocument.ids.get('background')!)!
    const content = sceneGraph.getElement(qmlDocument.ids.get('content')!)!
    const childrenRectText = qmlDocument.roots[0].children
      .find(child => child.typeName === 'Item' && child.getProperty('objectName') === '')
      ?.children.find(child => child.typeName === 'Text')
    const titleText = qmlDocument.roots[0].children
      .find(child => child.typeName === 'Text' && child.getProperty('text') === 'Qt Quick Item foundation')

    expect(left).toBeTruthy()
    expect(left.style.display).toBe('')
    expect(left.style.width).toBe('250px')
    expect(left.style.height).toBe('250px')
    expect(qmlDocument.ids.get('leftPanel')!.getProperty('color')).toBe('#0f766e')
    expect(left.style.backgroundColor).toBe('rgb(15, 118, 110)')
    expect(left.style.transform).toContain('rotate(-4deg)')

    expect(right).toBeTruthy()
    expect(right.style.display).toBe('')
    expect(right.style.width).toBe('280px')
    expect(right.style.height).toBe('220px')
    expect(qmlDocument.ids.get('rightPanel')!.getProperty('color')).toBe('#d97706')
    expect(right.style.backgroundColor).toBe('rgb(217, 119, 6)')
    expect(right.style.transform).toContain('scale(1.08)')

    expect(background.style.backgroundColor).toBe('rgb(244, 241, 234)')
    expect(content.style.backgroundColor).toBe('')

    expect(childrenRectText?.getProperty('text')).toBe('childrenRect: -24, 16 / 590 x 284')
    expect(sceneGraph.getElement(childrenRectText!)?.style.color).toBe('rgb(0, 0, 0)')
    expect(sceneGraph.getElement(titleText!)?.style.color).toBe('rgb(0, 0, 0)')

    sceneGraph.dispose()
    qmlDocument.dispose()
  })
})
