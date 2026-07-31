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
