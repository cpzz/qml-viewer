import { describe, expect, it, vi } from 'vitest'
import { qmlTypes } from '../utils/qmlCatalog'
import { builtinQmlTypeDefinitions, createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'

describe('built-in QML types', () => {
  it('creates visual types with inherited QtObject and Item properties', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const rectangle = registry.create('Rectangle')

    expect(rectangle.getProperty('objectName')).toBe('')
    expect(rectangle.getProperty('visible')).toBe(true)
    expect(rectangle.getProperty('opacity')).toBe(1)
    expect(rectangle.getProperty('color')).toBe('white')
    expect(rectangle.getProperty('border.color')).toBe('black')
  })

  it('routes Item children through the inherited data default property', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const root = registry.create('Item')
    const rectangle = registry.create('Rectangle', root)

    root.appendDefaultChild(rectangle)

    expect(root.children).toEqual([rectangle])
    expect(root.getProperty('data')).toEqual([rectangle])
  })

  it('provides input signals and stateful Timer methods', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const mouseArea = registry.create('MouseArea')
    const timer = registry.create('Timer')
    const clicked = vi.fn()
    mouseArea.connectSignal('clicked', clicked)

    mouseArea.emitSignal('clicked', { x: 10, y: 20 })
    timer.callMethod('start')
    expect(timer.getProperty('running')).toBe(true)
    timer.callMethod('stop')

    expect(clicked).toHaveBeenCalledWith({ x: 10, y: 20 })
    expect(timer.getProperty('running')).toBe(false)
  })

  it('uses Window-specific defaults inherited by ApplicationWindow', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const window = registry.create('ApplicationWindow')

    expect(window.getProperty('visible')).toBe(false)
    expect(window.getProperty('title')).toBe('')
    expect(window.getProperty('header')).toBeNull()
  })

  it('registers state, transition, behavior, and animation group types', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const state = registry.create('State')
    const transition = registry.create('Transition')
    const animation = registry.create('NumberAnimation')
    const group = registry.create('ParallelAnimation')

    expect(state.getProperty('changes')).toEqual([])
    expect(transition.getProperty('from')).toBe('*')
    expect(animation.getProperty('duration')).toBe(250)
    expect(group.getProperty('animations')).toEqual([])
  })

  it('provides Slider value conversion and stepping methods', () => {
    const slider = createBuiltinQmlTypeRegistry().create('Slider')
    slider.setProperty('from', 10)
    slider.setProperty('to', 20)
    slider.setProperty('value', 15)
    slider.setProperty('stepSize', 2)

    expect(slider.callMethod('valueAt', 0.25)).toBe(12.5)
    slider.callMethod('increase')
    expect(slider.getProperty('value')).toBe(17)
    slider.callMethod('decrease')
    expect(slider.getProperty('value')).toBe(15)
  })

  it('gives ItemDelegate a measurable default height for item views', () => {
    const delegate = createBuiltinQmlTypeRegistry().create('ItemDelegate')

    expect(delegate.getProperty('implicitHeight')).toBe(30)
  })

  it('keeps editor type suggestions aligned with runtime registrations', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const runtimeNames = builtinQmlTypeDefinitions.map(type => type.name)

    expect(qmlTypes.map(type => type.name)).toEqual(runtimeNames)
    expect(runtimeNames.every(name => registry.has(name))).toBe(true)
  })
})
