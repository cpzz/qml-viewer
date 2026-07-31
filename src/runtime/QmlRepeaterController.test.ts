import { describe, expect, it, vi } from 'vitest'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'
import { QmlComponent } from './QmlComponent'
import { QmlListModel } from './QmlListModel'
import { QmlRepeaterController } from './QmlRepeaterController'

describe('QmlRepeaterController', () => {
  it('creates delegate instances with index and model roles', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const repeater = registry.create('Repeater')
    const model = new QmlListModel([{ name: 'One' }, { name: 'Two' }])
    const delegate = new QmlComponent(`
      Text {
        property int index: -1
        property var modelData
        property string name: ""
        width: 100
        height: 20
      }
    `, registry)
    const added = vi.fn()
    repeater.connectSignal('itemAdded', added)
    const controller = new QmlRepeaterController(repeater)

    repeater.setProperty('model', model)
    repeater.setProperty('delegate', delegate)

    expect(repeater.getProperty('count')).toBe(2)
    expect(controller.itemAt(0)?.getProperty('index')).toBe(0)
    expect(controller.itemAt(0)?.getProperty('name')).toBe('One')
    expect(controller.itemAt(1)?.getProperty('modelData')).toEqual({ name: 'Two' })
    expect(added).toHaveBeenCalledTimes(2)
  })

  it('rebuilds delegates when an observed model changes', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const repeater = registry.create('Repeater')
    const model = new QmlListModel([{ value: 1 }])
    const delegate = new QmlComponent('Rectangle { property int value: 0 }', registry)
    const controller = new QmlRepeaterController(repeater)
    repeater.setProperty('model', model)
    repeater.setProperty('delegate', delegate)
    const previous = controller.itemAt(0)!

    model.append({ value: 2 })

    expect(repeater.getProperty('count')).toBe(2)
    expect(previous.parent).toBeNull()
    expect(controller.itemAt(1)?.getProperty('value')).toBe(2)
  })

  it('supports numeric and array models', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const row = registry.create('RowLayout')
    const repeater = registry.create('Repeater', row)
    const delegate = new QmlComponent('Item { property var modelData }', registry)
    const controller = new QmlRepeaterController(repeater)
    repeater.setProperty('delegate', delegate)

    repeater.setProperty('model', 3)
    expect(repeater.getProperty('count')).toBe(3)
    expect(controller.itemAt(2)?.getProperty('modelData')).toBe(2)
    expect(controller.itemAt(2)?.parent).toBe(row)

    repeater.setProperty('model', ['a', 'b'])
    expect(repeater.getProperty('count')).toBe(2)
    expect(controller.itemAt(1)?.getProperty('modelData')).toBe('b')
  })
})
