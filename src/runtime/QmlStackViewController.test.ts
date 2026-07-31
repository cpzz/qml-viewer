import { describe, expect, it } from 'vitest'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'
import { QmlStackViewController } from './QmlStackViewController'

describe('QmlStackViewController', () => {
  it('pushes, pops, replaces, and clears item stacks', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const view = registry.create('StackView')
    const first = registry.create('Item', view)
    const second = registry.create('Item')
    const third = registry.create('Item')
    const controller = new QmlStackViewController(view)

    expect(view.getProperty('depth')).toBe(1)
    expect(view.getProperty('currentItem')).toBe(first)
    expect(view.callMethod('pop')).toBeNull()

    expect(view.callMethod('push', second)).toBe(second)
    expect(view.getProperty('depth')).toBe(2)
    expect(view.callMethod('get', 0)).toBe(first)
    expect(view.callMethod('replace', third)).toBe(third)
    expect(view.getProperty('currentItem')).toBe(third)
    expect(view.callMethod('pop')).toBe(third)
    expect(view.getProperty('currentItem')).toBe(first)

    expect(view.callMethod('push', 1)).toBe(second)
    expect(view.getProperty('currentItem')).toBe(second)

    view.callMethod('clear')
    expect(view.getProperty('empty')).toBe(true)
    expect(view.getProperty('currentItem')).toBeNull()
    controller.dispose()
  })

  it('starts at the declared static page and exposes later pages to indexed push', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const view = registry.create('StackView')
    const first = registry.create('Item', view)
    const second = registry.create('Item', view)
    view.setProperty('currentIndex', 0)
    new QmlStackViewController(view)

    expect(view.getProperty('depth')).toBe(1)
    expect(view.getProperty('currentItem')).toBe(first)
    expect(view.callMethod('push', 1)).toBe(second)
    expect(view.getProperty('depth')).toBe(2)
  })
})
