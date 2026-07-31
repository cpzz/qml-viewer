// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { parseQMLDocument } from '../renderer/parser'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'
import { activateQmlDocument, type ActiveQmlDocument } from './QmlDocument'
import { QmlDomSceneGraph } from './QmlDomSceneGraph'
import { QmlJsEngine } from './QmlJsEngine'
import { QmlObject } from './QmlObject'

const exampleSource = readFileSync(resolve(process.cwd(), 'src/example.qml'), 'utf8')

function findByType(root: QmlObject, typeName: string): QmlObject | undefined {
  if (root.typeName === typeName) return root
  for (const child of root.children) {
    const match = findByType(child, typeName)
    if (match) return match
  }
  return undefined
}

describe('example.qml compatibility', () => {
  let active: ActiveQmlDocument
  let scene: QmlDomSceneGraph

  beforeAll(async () => {
    const ast = parseQMLDocument(exampleSource)
    expect(ast.diagnostics).toEqual([])
    active = activateQmlDocument(ast.nodes, await QmlJsEngine.create(), createBuiltinQmlTypeRegistry())
    scene = new QmlDomSceneGraph(document)
    scene.mount(active, document.body)
    return () => {
      scene.dispose()
      active.dispose()
    }
  })

  it('activates the complete product fixture with resolved runtime objects', () => {
    expect(active.roots[0].typeName).toBe('ApplicationWindow')
    expect(active.ids.get('addFiveBtn')?.typeName).toBe('Button')
    expect(active.ids.get('employeeTable')?.getProperty('model')).toBe(active.ids.get('employeeModel'))
    expect(active.ids.get('projectTree')?.getProperty('model')).toBe(active.ids.get('projectTreeModel'))
    expect(active.ids.get('standaloneAnimation')?.getProperty('target')).toBe(active.ids.get('animatedBox'))
    const calendar = findByType(active.roots[0], 'Calendar')!
    expect(calendar.getProperty('displayedMonth')).toBe('2024-02-01')
    expect(calendar.getProperty('selectedDate')).toBe('2024-02-29')
  })

  it('routes the fixture Connections handler and declarative model roles', () => {
    active.ids.get('addFiveBtn')!.emitSignal('clicked')
    expect(active.ids.get('root')?.getProperty('counter')).toBe(5)

    const model = active.ids.get('employeeModel')!
    expect(model.getProperty('count')).toBe(4)
    expect(model.children.filter(child => child.typeName === 'ListElement').map(row => row.getProperty('name')))
      .toEqual(['Alice', 'Bob', 'Cora', 'Tom'])
    expect(model.children.every(child => child instanceof QmlObject)).toBe(true)
  })

  it('runs the fixture counter controls through DOM events, functions, Connections, bindings, and states', async () => {
    const root = active.ids.get('root')!
    const counterLabel = active.ids.get('incBtn')!.parent!.children.find(child => child.typeName === 'Label')!
    const stateRect = active.ids.get('stateRect')!
    const stateWhenRect = active.ids.get('stateWhenRect')!
    root.setProperty('counter', 0)

    scene.getElement(active.ids.get('incBtn')!)!.click()
    await Promise.resolve()

    expect(root.getProperty('counter')).toBe(1)
    expect(counterLabel.getProperty('text')).toBe('counter=1')
    expect(scene.getElement(counterLabel)?.textContent).toBe('counter=1')
    expect(stateRect.getProperty('state')).toBe('hot')
    expect(stateWhenRect.getProperty('state')).toBe('odd')

    scene.getElement(active.ids.get('addFiveBtn')!)!.click()
    await Promise.resolve()

    expect(root.getProperty('counter')).toBe(6)
    expect(counterLabel.getProperty('text')).toBe('counter=6')
    expect(scene.getElement(counterLabel)?.textContent).toBe('counter=6')
    expect(stateRect.getProperty('state')).toBe('idle')
    expect(stateWhenRect.getProperty('state')).toBe('even')
  })

  it('toggles the fixture declarative Loader item', async () => {
    const root = active.ids.get('root')!
    const loader = active.ids.get('dynLoader')!
    await vi.waitFor(() => expect(loader.getProperty('item')).toBeInstanceOf(QmlObject))

    root.setProperty('showLoaded', false)
    await vi.waitFor(() => expect(loader.getProperty('item')).toBeNull())
    const template = loader.getProperty('sourceComponent') as QmlObject
    expect(template.children[0].getProperty('visible')).toBe(false)

    root.setProperty('showLoaded', true)
    await vi.waitFor(() => expect(loader.getProperty('item')).toBe(template.children[0]))
  })

  it('supports fixture navigation, delegates, calendar selection, and animation replay', async () => {
    const tabBar = active.ids.get('tabBarDemo')!
    const tabButtons = tabBar.children.filter(child => child.typeName === 'TabButton')
    expect(tabButtons).toHaveLength(3)
    scene.getElement(tabButtons[0])!.click()
    expect(tabBar.getProperty('currentIndex')).toBe(0)

    const listView = active.ids.get('listView')!
    expect(listView.getProperty('count')).toBe(10)
    expect(scene.getElement(listView)?.textContent).toContain('Item #0')
    expect(scene.getElement(listView)?.textContent).toContain('Item #4')

    const calendar = findByType(active.roots[0], 'Calendar')!
    const day = [...scene.getElement(calendar)!.querySelectorAll<HTMLButtonElement>('.qml-calendar-day')]
      .find(button => button.textContent === '15')!
    day.click()
    expect(calendar.getProperty('selectedDate')).toBeInstanceOf(Date)
    expect(scene.getElement(calendar)?.querySelector('.qml-calendar-day[aria-selected="true"]')?.textContent).toBe('15')

    const path = active.ids.get('pathDemo')!
    const pathElement = scene.getElement(path)!
    for (const item of path.children.filter(child => child.typeName === 'Rectangle')) {
      const label = item.children.find(child => child.typeName === 'Label')!
      expect(scene.getElement(label)?.parentElement).toBe(scene.getElement(item))
    }
    expect(pathElement.textContent).toContain('P0')

    const animation = active.ids.get('standaloneAnimation')!
    const target = active.ids.get('animatedBox')!
    animation.callMethod('restart')
    await vi.waitFor(() => expect(Number(target.getProperty('x'))).toBeGreaterThan(0))
    animation.callMethod('stop')
  })

  it('routes the fixture Stack buttons and ListView pointer and wheel events', () => {
    const stack = active.ids.get('stackDemo')!
    const stackElement = scene.getElement(stack)!
    const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find(candidate => candidate.textContent === text)!

    button('Stack Push').click()
    expect(stack.getProperty('currentItem')).toBe(active.ids.get('stackPage2'))
    expect(stackElement.textContent).toContain('Stack Page 2')
    button('Stack Pop').click()
    expect(stack.getProperty('currentItem')).toBe(active.ids.get('stackPage1'))
    button('Stack Push').click()
    button('Stack Replace').click()
    expect(stack.getProperty('currentItem')).toBe(active.ids.get('stackPage1'))

    const listView = active.ids.get('listView')!
    const listElement = scene.getElement(listView)!
    const secondItem = [...listElement.querySelectorAll<HTMLButtonElement>('[data-qml-type="ItemDelegate"]')]
      .find(item => item.textContent === 'Item #1')!
    secondItem.click()
    expect(listView.getProperty('currentIndex')).toBe(1)
    expect(secondItem.getAttribute('aria-selected')).toBe('true')

    listElement.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 90 }))
    expect(Number(listView.getProperty('contentY'))).toBeGreaterThan(0)
  })
})
