import { describe, expect, it, vi } from 'vitest'
import { QmlTypeRegistry } from './QmlTypeRegistry'

describe('QmlTypeRegistry', () => {
  it('creates types with inherited properties, signals, and methods', () => {
    const registry = new QmlTypeRegistry()
    const activated = vi.fn()
    registry.register({
      name: 'Base',
      properties: [{ name: 'enabled', type: 'bool', initialValue: true }],
      signals: ['activated'],
      methods: { reset() { return this.typeName } },
    })
    registry.register({
      name: 'Control',
      baseType: 'Base',
      properties: [{ name: 'text', type: 'string', initialValue: 'Ready' }],
    })

    const control = registry.create('Control')
    control.connectSignal('activated', activated)
    control.emitSignal('activated')

    expect(control.getProperty('enabled')).toBe(true)
    expect(control.getProperty('text')).toBe('Ready')
    expect(control.callMethod('reset')).toBe('Control')
    expect(activated).toHaveBeenCalledOnce()
  })

  it('lets derived types override property metadata and clones defaults per instance', () => {
    const registry = new QmlTypeRegistry()
    registry.register({
      name: 'Base',
      properties: [
        { name: 'visible', type: 'bool', initialValue: true },
        { name: 'data', type: 'list<QtObject>', initialValue: [], default: true },
      ],
    })
    registry.register({
      name: 'Window',
      baseType: 'Base',
      properties: [{ name: 'visible', type: 'bool', initialValue: false }],
    })

    const first = registry.create('Window')
    const second = registry.create('Window')
    ;(first.getProperty('data') as unknown[]).push('owned')

    expect(first.getProperty('visible')).toBe(false)
    expect(first.getProperty('data')).toEqual(['owned'])
    expect(second.getProperty('data')).toEqual([])
  })

  it('rejects duplicate, unknown, and circular type definitions', () => {
    const registry = new QmlTypeRegistry()
    registry.register({ name: 'Item', baseType: 'Missing' })

    expect(() => registry.register({ name: 'Item' })).toThrow('already registered')
    expect(() => registry.create('Item')).toThrow('Unknown QML type Missing')

    const circular = new QmlTypeRegistry()
    circular.register({ name: 'First', baseType: 'Second' })
    circular.register({ name: 'Second', baseType: 'First' })
    expect(() => circular.create('First')).toThrow('Circular QML type inheritance')
  })
})
