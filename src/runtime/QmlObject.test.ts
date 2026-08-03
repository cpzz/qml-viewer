import { describe, expect, it, vi } from 'vitest'
import { QmlObject } from './QmlObject'

describe('QmlObject', () => {
  it('owns child objects and initializes typed defaults', () => {
    const root = new QmlObject('Item')
    const child = new QmlObject('Rectangle', root)
    child.defineProperty({ name: 'visible', type: 'bool' })
    child.defineProperty({ name: 'width', type: 'real' })
    child.defineProperty({ name: 'title', type: 'string' })

    expect(root.children).toEqual([child])
    expect(child.parent).toBe(root)
    expect(child.getProperty('visible')).toBe(false)
    expect(child.getProperty('width')).toBe(0)
    expect(child.getProperty('title')).toBe('')
  })

  it('destroys owned subtrees and removes default-property references', () => {
    const root = new QmlObject('Item')
    root.defineProperty({ name: 'data', type: 'list<QtObject>', initialValue: [], default: true })
    const child = new QmlObject('Rectangle', root)
    const grandchild = new QmlObject('Text', child)
    root.appendDefaultChild(child)

    child.destroy()

    expect(root.children).toEqual([])
    expect(root.getProperty('data')).toEqual([])
    expect(child.parent).toBeNull()
    expect(grandchild.parent).toBeNull()
  })

  it('reparents objects with consistent parent, children, and default data notifications', () => {
    const first = new QmlObject('Item')
    const second = new QmlObject('Item')
    for (const parent of [first, second]) {
      parent.defineProperty({ name: 'data', type: 'list<QtObject>', initialValue: [], default: true })
      parent.defineSignal('childrenChanged')
    }
    const child = new QmlObject('Rectangle', first)
    child.defineSignal('parentChanged')
    first.appendDefaultChild(child)
    const firstChanged = vi.fn()
    const secondChanged = vi.fn()
    const parentChanged = vi.fn()
    first.connectSignal('childrenChanged', firstChanged)
    second.connectSignal('childrenChanged', secondChanged)
    child.connectSignal('parentChanged', parentChanged)

    child.reparentTo(second)
    second.appendDefaultChild(child)

    expect(first.children).toEqual([])
    expect(first.getProperty('data')).toEqual([])
    expect(second.children).toEqual([child])
    expect(second.getProperty('data')).toEqual([child])
    expect(child.parent).toBe(second)
    expect(firstChanged).toHaveBeenCalledOnce()
    expect(secondChanged).toHaveBeenCalledOnce()
    expect(parentChanged).toHaveBeenCalledWith(second)
  })

  it('rejects indirect ownership cycles and emits destroyed once', () => {
    const root = new QmlObject('Item')
    root.defineSignal('destroyed')
    const child = new QmlObject('Item', root)
    const destroyed = vi.fn()
    root.connectSignal('destroyed', destroyed)

    expect(() => root.reparentTo(child)).toThrow('circular ownership')
    root.destroy()
    root.destroy()

    expect(destroyed).toHaveBeenCalledOnce()
    expect(child.parent).toBeNull()
  })

  it('disconnects property and signal listeners when destroyed', () => {
    const object = new QmlObject('Item')
    object.defineProperty({ name: 'value', type: 'int', initialValue: 0 })
    object.defineSignal('activated')
    const changed = vi.fn()
    const activated = vi.fn()
    object.onPropertyChanged('value', changed)
    object.connectSignal('activated', activated)

    object.destroy()
    object.setProperty('value', 1)
    object.emitSignal('activated')

    expect(changed).not.toHaveBeenCalled()
    expect(activated).not.toHaveBeenCalled()
  })

  it('emits change notifications only when a value changes', () => {
    const object = new QmlObject('Item')
    object.defineProperty({ name: 'count', type: 'int', initialValue: 1 })
    const listener = vi.fn()
    object.onPropertyChanged('count', listener)

    object.setProperty('count', 2)
    object.setProperty('count', 2)

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith({ name: 'count', previousValue: 1, value: 2 })
  })

  it('tracks external assignments even when the assigned value equals the default', () => {
    const object = new QmlObject('Item')
    object.defineProperty({ name: 'color', type: 'color', initialValue: 'black' })
    object.defineProperty({ name: 'inheritedColor', type: 'color', initialValue: 'black' })
    object.defineProperty({ name: 'runtimeColor', type: 'color', initialValue: 'black' })

    object.initializeProperty('color', 'black')
    object.setInternalProperty('inheritedColor', 'red')
    object.setProperty('runtimeColor', 'red')

    expect(object.isExplicitlySet('color')).toBe(true)
    expect(object.isPropertyAssigned('color')).toBe(true)
    expect(object.isPropertyAssigned('inheritedColor')).toBe(false)
    expect(object.isPropertyAssigned('runtimeColor')).toBe(true)
  })

  it('enforces readonly and required property semantics', () => {
    const object = new QmlObject('Card')
    object.defineProperty({ name: 'title', type: 'string', required: true })
    object.defineProperty({ name: 'createdAt', type: 'date', readonly: true })

    object.initializeProperty('title', 'Welcome')
    object.initializeProperty('createdAt', new Date(0))
    expect(() => object.complete()).not.toThrow()

    const missing = new QmlObject('Card')
    missing.defineProperty({ name: 'model', type: 'var', required: true })
    expect(() => missing.complete()).toThrow('Missing required properties on Card: model')

    expect(() => object.setProperty('createdAt', new Date())).toThrow(
      'Cannot assign to readonly property createdAt on Card',
    )
    object.setInternalProperty('createdAt', new Date(1000))
    expect(object.getProperty('createdAt')).toEqual(new Date(1000))
  })

  it('rejects duplicate and unknown properties', () => {
    const object = new QmlObject('Item')
    object.defineProperty({ name: 'width', type: 'real' })

    expect(() => object.defineProperty({ name: 'width', type: 'int' })).toThrow(
      'Property width is already defined on Item',
    )
    expect(() => object.getProperty('missing')).toThrow('Unknown property missing on Item')
  })

  it('forwards property and object aliases', () => {
    const root = new QmlObject('Item')
    const panel = new QmlObject('Rectangle', root)
    panel.defineProperty({ name: 'width', type: 'real', initialValue: 100 })
    root.defineAlias('panelWidth', panel, 'width')
    root.defineAlias('panelRef', panel)
    const changes: unknown[] = []
    const signalValues: unknown[] = []
    root.onPropertyChanged('panelWidth', change => changes.push(change))
    root.connectSignal('panelWidthChanged', value => signalValues.push(value))

    root.setProperty('panelWidth', 200)

    expect(panel.getProperty('width')).toBe(200)
    expect(root.getProperty('panelWidth')).toBe(200)
    expect(root.getProperty('panelRef')).toBe(panel)
    expect(changes).toEqual([{ name: 'panelWidth', previousValue: 100, value: 200 }])
    expect(signalValues).toEqual([200])
    expect(() => root.setProperty('panelRef', null)).toThrow('Cannot assign to object alias panelRef')
  })

  it('emits custom and property change signals', () => {
    const object = new QmlObject('Button')
    object.defineProperty({ name: 'checked', type: 'bool', initialValue: false })
    object.defineSignal('clicked')
    const checkedValues: unknown[] = []
    const clicks: unknown[][] = []
    object.connectSignal('checkedChanged', value => checkedValues.push(value))
    const disconnect = object.connectSignal('clicked', (...args) => clicks.push(args))

    object.setProperty('checked', true)
    object.emitSignal('clicked', 10, 20)
    disconnect()
    object.emitSignal('clicked', 30, 40)

    expect(checkedValues).toEqual([true])
    expect(clicks).toEqual([[10, 20]])
  })

  it('registers and invokes methods with the object as closure context', () => {
    const object = new QmlObject('Counter')
    object.defineProperty({ name: 'count', type: 'int', initialValue: 1 })
    object.defineMethod('increment', (step) => {
      object.setProperty('count', Number(object.getProperty('count')) + Number(step))
      return object.getProperty('count')
    })

    expect(object.callMethod('increment', 2)).toBe(3)
    expect(() => object.callMethod('missing')).toThrow('Unknown method missing on Counter')
  })
})
