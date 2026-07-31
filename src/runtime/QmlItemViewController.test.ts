import { describe, expect, it, vi } from 'vitest'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'
import { QmlComponent } from './QmlComponent'
import { QmlItemViewController } from './QmlItemViewController'
import { QmlListModel } from './QmlListModel'

function createDelegate(registry: ReturnType<typeof createBuiltinQmlTypeRegistry>) {
  return new QmlComponent(`
    Rectangle {
      property int index: -1
      property var modelData
      property string name: ""
      width: 100
      height: 20
    }
  `, registry)
}

describe('QmlItemViewController', () => {
  it('virtualizes vertical ListView delegates and navigates currentIndex', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const view = registry.create('ListView')
    view.setProperty('width', 100)
    view.setProperty('height', 60)
    view.setProperty('model', Array.from({ length: 100 }, (_, index) => `Item ${index}`))
    view.setProperty('delegate', createDelegate(registry))
    const controller = new QmlItemViewController(view)

    expect(view.getProperty('count')).toBe(100)
    expect(view.children.length).toBe(3)
    expect(controller.itemAt(0)?.getProperty('modelData')).toBe('Item 0')
    expect(view.getProperty('currentIndex')).toBe(0)
    expect(view.getProperty('currentItem')).toBe(controller.itemAt(0))
    expect(view.getProperty('contentHeight')).toBe(2000)

    controller.positionViewAtIndex(50)

    expect(view.getProperty('contentY')).toBe(1000)
    expect(view.getProperty('currentIndex')).toBe(50)
    expect(controller.itemAt(50)).not.toBeNull()
    expect(view.children.length).toBe(3)
  })

  it('lays out a virtualized GridView and updates observed model roles', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const view = registry.create('GridView')
    view.setProperty('width', 220)
    view.setProperty('height', 100)
    view.setProperty('cellWidth', 100)
    view.setProperty('cellHeight', 50)
    const model = new QmlListModel(Array.from({ length: 20 }, (_, index) => ({ name: `Cell ${index}` })))
    view.setProperty('model', model)
    view.setProperty('delegate', createDelegate(registry))
    const controller = new QmlItemViewController(view)

    expect(view.children.length).toBe(4)
    expect(controller.itemAt(3)?.getProperty('x')).toBe(100)
    expect(controller.itemAt(3)?.getProperty('y')).toBe(50)
    expect(view.getProperty('contentHeight')).toBe(500)

    model.setProperty(0, 'name', 'Updated')

    expect(controller.itemAt(0)?.getProperty('name')).toBe('Updated')
  })

  it('positions PathView delegates and emits activation', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const view = registry.create('PathView')
    view.setProperty('width', 200)
    view.setProperty('height', 100)
    view.setProperty('pathItemCount', 3)
    view.setProperty('model', ['a', 'b', 'c', 'd'])
    view.setProperty('delegate', createDelegate(registry))
    const activated = vi.fn()
    view.connectSignal('activated', activated)
    const controller = new QmlItemViewController(view)

    expect(view.children.length).toBe(3)
    expect(controller.itemAt(0)?.getProperty('x')).toBe(50)
    expect(controller.itemAt(0)?.getProperty('y')).toBe(0)

    controller.activate(2)

    expect(view.getProperty('currentIndex')).toBe(2)
    expect(view.getProperty('currentItem')).toBe(controller.itemAt(2))
    expect(activated).toHaveBeenCalledWith(2)
  })

  it('samples declarative Path geometry and exposes path attributes', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const view = registry.create('PathView')
    view.setProperty('width', 200)
    view.setProperty('height', 100)
    view.setProperty('pathItemCount', 3)
    view.setProperty('model', ['a', 'b', 'c'])
    view.setProperty('delegate', createDelegate(registry))
    const path = registry.create('Path')
    path.setProperty('startX', 10)
    path.setProperty('startY', 20)
    const line = registry.create('PathLine', path)
    line.setProperty('x', 110)
    line.setProperty('y', 20)
    path.appendDefaultChild(line)
    const attribute = registry.create('PathAttribute', path)
    attribute.setProperty('name', 'scaleFactor')
    attribute.setProperty('value', 0.75)
    path.appendDefaultChild(attribute)
    view.setProperty('path', path)
    const controller = new QmlItemViewController(view)

    expect(controller.itemAt(0)?.getProperty('x')).toBe(-40)
    expect(controller.itemAt(1)?.getProperty('x')).toBe(10)
    expect(controller.itemAt(2)?.getProperty('x')).toBe(60)
    expect(controller.itemAt(1)?.getProperty('scaleFactor')).toBe(0.75)
    controller.dispose()
  })

  it('supports current-index increment and decrement bounds', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const view = registry.create('ListView')
    view.setProperty('width', 100)
    view.setProperty('height', 40)
    view.setProperty('model', 2)
    view.setProperty('delegate', createDelegate(registry))
    const controller = new QmlItemViewController(view)

    controller.incrementCurrentIndex()
    controller.incrementCurrentIndex()
    expect(view.getProperty('currentIndex')).toBe(1)
    controller.decrementCurrentIndex()
    expect(view.getProperty('currentIndex')).toBe(0)
  })

  it('virtualizes ListView delegates with variable model-driven sizes', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const view = registry.create('ListView')
    view.setProperty('width', 100)
    view.setProperty('height', 25)
    view.setProperty('model', [
      { height: 10 },
      { height: 20 },
      { height: 30 },
      { height: 40 },
    ])
    view.setProperty('delegate', createDelegate(registry))
    const controller = new QmlItemViewController(view)

    expect(view.getProperty('contentHeight')).toBe(100)
    expect(view.children.map(child => child.getProperty('height'))).toEqual([10, 20])

    controller.positionViewAtIndex(3)
    expect(view.getProperty('contentY')).toBe(60)
    expect(controller.itemAt(3)?.getProperty('y')).toBe(60)
    expect(view.children).toHaveLength(1)
    controller.dispose()
  })

  it('exposes sections, follows current item with a highlight, and snaps to metrics', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const view = registry.create('ListView')
    view.setProperty('width', 100)
    view.setProperty('height', 50)
    view.setProperty('model', [
      { group: 'A', height: 20 },
      { group: 'A', height: 30 },
      { group: 'B', height: 40 },
    ])
    view.setProperty('delegate', createDelegate(registry))
    view.setProperty('section.property', 'group')
    view.setProperty('highlight', new QmlComponent('Rectangle { color: "blue" }', registry))
    view.setProperty('snapMode', 'ListView.SnapToItem')
    const controller = new QmlItemViewController(view)

    expect(controller.itemAt(0)?.getProperty('ListView.section')).toBe('A')
    expect(view.getProperty('highlightItem')).toBeInstanceOf(Object)
    expect((view.getProperty('highlightItem') as { getProperty(name: string): unknown }).getProperty('height')).toBe(20)

    view.setProperty('contentY', 37)
    controller.snapToNearest()
    expect(view.getProperty('contentY')).toBe(50)
    controller.dispose()
  })
})
