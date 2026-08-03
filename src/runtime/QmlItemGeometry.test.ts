import { describe, expect, it } from 'vitest'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'

describe('Item geometry methods', () => {
  it('maps points between nested items and global coordinates', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const root = registry.create('Item')
    const parent = registry.create('Item', root)
    const child = registry.create('Rectangle', parent)
    parent.setProperty('x', 10)
    parent.setProperty('y', 20)
    child.setProperty('x', 5)
    child.setProperty('y', 7)

    expect(child.callMethod('mapToGlobal', { x: 2, y: 3 })).toEqual({ x: 17, y: 30 })
    expect(child.callMethod('mapFromGlobal', 17, 30)).toEqual({ x: 2, y: 3 })
    expect(parent.callMethod('mapFromItem', child, { x: 0, y: 0 })).toEqual({ x: 5, y: 7 })
  })

  it('applies scale and rotation around transformOrigin to points and rectangles', () => {
    const item = createBuiltinQmlTypeRegistry().create('Item')
    item.setProperty('x', 10)
    item.setProperty('y', 20)
    item.setProperty('width', 20)
    item.setProperty('height', 10)
    item.setProperty('transformOrigin', 'Item.TopLeft')
    item.setProperty('scale', 2)

    expect(item.callMethod('mapToGlobal', 3, 4)).toEqual({ x: 16, y: 28 })

    item.setProperty('scale', 1)
    item.setProperty('rotation', 90)
    const rect = item.callMethod('mapToGlobal', { x: 0, y: 0, width: 20, height: 10 }) as Record<string, number>
    expect(rect.x).toBeCloseTo(0)
    expect(rect.y).toBeCloseTo(20)
    expect(rect.width).toBeCloseTo(10)
    expect(rect.height).toBeCloseTo(20)
  })

  it('applies Transform objects from the inherited transform list', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const item = registry.create('Rectangle')
    const translate = registry.create('Translate')
    const scale = registry.create('Scale')
    translate.setProperty('x', 12)
    translate.setProperty('y', -4)
    scale.setProperty('xScale', 2)
    scale.setProperty('yScale', 3)
    item.setInternalProperty('transform', [translate, scale])

    expect(item.callMethod('mapToGlobal', 5, 2)).toEqual({ x: 22, y: 2 })
    expect(item.callMethod('mapFromGlobal', 22, 2)).toEqual({ x: 5, y: 2 })
  })

  it('finds the topmost visible child using inverse transforms', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const parent = registry.create('Item')
    const lower = registry.create('Rectangle', parent)
    const upper = registry.create('Rectangle', parent)
    lower.setProperty('width', 30)
    lower.setProperty('height', 30)
    upper.setProperty('x', 10)
    upper.setProperty('width', 20)
    upper.setProperty('height', 20)
    upper.setProperty('z', 2)
    upper.setProperty('scale', 2)
    upper.setProperty('transformOrigin', 'Item.TopLeft')

    expect(parent.callMethod('childAt', 15, 10)).toBe(upper)
    upper.setProperty('visible', false)
    expect(parent.callMethod('childAt', 15, 10)).toBe(lower)
    expect(parent.callMethod('childAt', 40, 40)).toBeNull()
  })

  it('uses containmentMask when one is assigned', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const item = registry.create('Item')
    const mask = registry.create('QtObject')
    item.setProperty('width', 100)
    item.setProperty('height', 100)
    mask.defineMethod('contains', point => Number((point as { x: number }).x) < 10)
    item.setProperty('containmentMask', mask)

    expect(item.callMethod('contains', { x: 5, y: 50 })).toBe(true)
    expect(item.callMethod('contains', { x: 20, y: 50 })).toBe(false)
  })
})
