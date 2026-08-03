import { describe, expect, it } from 'vitest'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'
import { QmlItemController } from './QmlItemController'

const rect = (object: ReturnType<ReturnType<typeof createBuiltinQmlTypeRegistry>['create']>, values: Record<string, unknown>) => {
  for (const [name, value] of Object.entries(values)) object.setProperty(name, value)
  return object
}

describe('QmlItemController', () => {
  it('projects Item children and resources through inherited properties', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const parent = registry.create('Rectangle')
    const child = registry.create('Text', parent)
    const resource = registry.create('QtObject', parent)
    const controller = new QmlItemController(parent)

    expect(parent.getProperty('children')).toEqual([child])
    expect(parent.getProperty('visibleChildren')).toEqual([child])
    expect(parent.getProperty('resources')).toEqual([resource])

    controller.dispose()
  })

  it('updates childrenRect for negative coordinates and geometry changes', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const parent = registry.create('Item')
    const first = rect(registry.create('Rectangle', parent), { x: -10, y: 5, width: 30, height: 20 })
    rect(registry.create('Rectangle', parent), { x: 40, y: -5, width: 10, height: 15, visible: false })
    const controller = new QmlItemController(parent)

    expect([
      parent.getProperty('childrenRect.x'),
      parent.getProperty('childrenRect.y'),
      parent.getProperty('childrenRect.width'),
      parent.getProperty('childrenRect.height'),
    ]).toEqual([-10, -5, 60, 30])
    expect((parent.getProperty('visibleChildren') as unknown[]).length).toBe(1)

    first.setProperty('width', 80)
    expect(parent.getProperty('childrenRect.width')).toBe(80)

    controller.dispose()
  })

  it('tracks parent and list changes after reparenting', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const firstParent = registry.create('Item')
    const secondParent = registry.create('Item')
    const child = registry.create('Rectangle', firstParent)
    const firstController = new QmlItemController(firstParent)
    const secondController = new QmlItemController(secondParent)
    const childController = new QmlItemController(child)

    child.reparentTo(secondParent)

    expect(firstParent.getProperty('children')).toEqual([])
    expect(secondParent.getProperty('children')).toEqual([child])
    expect(child.getProperty('parent')).toBe(secondParent)

    firstController.dispose()
    secondController.dispose()
    childController.dispose()
  })

  it('supports writable parent and sibling stacking methods', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const firstParent = registry.create('Item')
    const secondParent = registry.create('Item')
    const first = registry.create('Rectangle', firstParent)
    const second = registry.create('Rectangle', firstParent)
    const third = registry.create('Rectangle', firstParent)
    const controller = new QmlItemController(second)

    first.callMethod('stackAfter', third)
    expect(firstParent.children).toEqual([second, third, first])
    first.callMethod('stackBefore', second)
    expect(firstParent.children).toEqual([first, second, third])

    second.setProperty('parent', secondParent)
    expect(second.parent).toBe(secondParent)
    expect(second.getProperty('parent')).toBe(secondParent)

    controller.dispose()
  })

  it('maintains one active focus item and its FocusScope chain', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const root = registry.create('Item')
    const scope = registry.create('FocusScope', root)
    const first = registry.create('Rectangle', scope)
    const second = registry.create('Rectangle', scope)

    first.callMethod('forceActiveFocus')
    expect(first.getProperty('activeFocus')).toBe(true)
    expect(scope.getProperty('activeFocus')).toBe(true)

    second.callMethod('forceActiveFocus')
    expect(first.getProperty('activeFocus')).toBe(false)
    expect(second.getProperty('activeFocus')).toBe(true)
    expect(scope.getProperty('activeFocus')).toBe(true)
  })

  it('cycles through effectively visible tab focus items', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const root = registry.create('Item')
    const first = registry.create('Rectangle', root)
    const hidden = registry.create('Rectangle', root)
    const last = registry.create('Rectangle', root)
    first.setProperty('activeFocusOnTab', true)
    hidden.setProperty('activeFocusOnTab', true)
    hidden.setProperty('visible', false)
    last.setProperty('focusPolicy', 'Qt.TabFocus')

    expect(first.callMethod('nextItemInFocusChain')).toBe(last)
    expect(last.callMethod('nextItemInFocusChain')).toBe(first)
    expect(first.callMethod('nextItemInFocusChain', false)).toBe(last)
  })

  it('restores locally requested visibility and enabled state after an ancestor recovers', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const parent = registry.create('Item')
    const child = registry.create('Rectangle', parent)
    const parentController = new QmlItemController(parent)
    const childController = new QmlItemController(child)

    parent.setProperty('visible', false)
    parent.setProperty('enabled', false)
    expect(child.getProperty('visible')).toBe(false)
    expect(child.getProperty('enabled')).toBe(false)

    child.setProperty('visible', true)
    child.setProperty('enabled', true)
    expect(child.getProperty('visible')).toBe(false)
    expect(child.getProperty('enabled')).toBe(false)

    parent.setProperty('visible', true)
    parent.setProperty('enabled', true)
    expect(child.getProperty('visible')).toBe(true)
    expect(child.getProperty('enabled')).toBe(true)

    parentController.dispose()
    childController.dispose()
  })

  it('inherits palette roles reactively and preserves explicit child roles', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const parent = registry.create('Item')
    const child = registry.create('Rectangle', parent)
    const childController = new QmlItemController(child)

    parent.setProperty('palette.text', '#123456')
    expect(child.getProperty('palette.text')).toBe('#123456')

    child.setProperty('palette.text', '#abcdef')
    parent.setProperty('palette.text', '#654321')
    expect(child.getProperty('palette.text')).toBe('#abcdef')

    child.reparentTo(null)
    expect(child.getProperty('palette.button')).toBe('#efefef')
    expect(child.getProperty('palette.text')).toBe('#abcdef')

    childController.dispose()
  })
})
