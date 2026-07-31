import { describe, expect, it, vi } from 'vitest'
import { BindingEngine } from './BindingEngine'
import { QmlObject } from './QmlObject'

function property(object: QmlObject, name: string, type: string, initialValue: unknown): void {
  object.defineProperty({ name, type, initialValue })
}

describe('BindingEngine', () => {
  it('tracks property reads and updates dependent values', () => {
    const source = new QmlObject('Item')
    const target = new QmlObject('Text')
    property(source, 'count', 'int', 1)
    property(target, 'text', 'string', '')
    const engine = new BindingEngine()

    engine.bind(target, 'text', () => `Count: ${source.getProperty('count')}`)
    expect(target.getProperty('text')).toBe('Count: 1')

    source.setProperty('count', 2)
    expect(target.getProperty('text')).toBe('Count: 2')
  })

  it('replaces dependencies when conditional expressions change branches', () => {
    const source = new QmlObject('Item')
    const target = new QmlObject('Text')
    property(source, 'enabled', 'bool', true)
    property(source, 'primary', 'string', 'red')
    property(source, 'secondary', 'string', 'blue')
    property(target, 'color', 'color', '')
    const engine = new BindingEngine()
    const evaluate = vi.fn(() => (
      source.getProperty('enabled')
        ? source.getProperty('primary')
        : source.getProperty('secondary')
    ))

    engine.bind(target, 'color', evaluate)
    source.setProperty('secondary', 'green')
    expect(evaluate).toHaveBeenCalledOnce()

    source.setProperty('enabled', false)
    expect(target.getProperty('color')).toBe('green')
    source.setProperty('primary', 'orange')
    expect(evaluate).toHaveBeenCalledTimes(2)
    source.setProperty('secondary', 'purple')
    expect(target.getProperty('color')).toBe('purple')
  })

  it('stops updating after a binding is disposed', () => {
    const source = new QmlObject('Item')
    const target = new QmlObject('Item')
    property(source, 'width', 'real', 100)
    property(target, 'width', 'real', 0)
    const engine = new BindingEngine()

    const dispose = engine.bind(target, 'width', () => source.getProperty('width'))
    dispose()
    source.setProperty('width', 200)

    expect(target.getProperty('width')).toBe(100)
  })

  it('does not recursively re-enter a self-referencing binding', () => {
    const object = new QmlObject('Item')
    property(object, 'value', 'int', 1)
    const engine = new BindingEngine()

    expect(() => engine.bind(object, 'value', () => object.getProperty('value'))).not.toThrow()
    object.setProperty('value', 2)
    expect(object.getProperty('value')).toBe(2)
  })

  it('tracks the target property behind an alias', () => {
    const source = new QmlObject('Item')
    const target = new QmlObject('Text')
    property(source, 'accent', 'color', 'red')
    source.defineAlias('themeColor', source, 'accent')
    property(target, 'color', 'color', '')
    const engine = new BindingEngine()

    engine.bind(target, 'color', () => source.getProperty('themeColor'))
    source.setProperty('accent', 'blue')

    expect(target.getProperty('color')).toBe('blue')
  })
})
