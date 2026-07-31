import { describe, expect, it } from 'vitest'
import { QmlEasing, type QmlAnimationScheduler } from './QmlAnimation'
import { QmlBehavior, QmlStateMachine } from './QmlStateMachine'
import { QmlObject } from './QmlObject'

class ManualScheduler implements QmlAnimationScheduler {
  private time = 0
  private nextHandle = 1
  private callbacks = new Map<number, (timestamp: number) => void>()
  now(): number { return this.time }
  request(callback: (timestamp: number) => void): number {
    const handle = this.nextHandle++
    this.callbacks.set(handle, callback)
    return handle
  }
  cancel(handle: number): void { this.callbacks.delete(handle) }
  advance(milliseconds: number): void {
    this.time += milliseconds
    const callbacks = [...this.callbacks.values()]
    this.callbacks.clear()
    callbacks.forEach(callback => callback(this.time))
  }
}

function stateObject() {
  const object = new QmlObject('Rectangle')
  object.defineProperty({ name: 'x', type: 'real', initialValue: 0 })
  object.defineProperty({ name: 'opacity', type: 'real', initialValue: 1 })
  object.defineProperty({ name: 'color', type: 'color', initialValue: 'red' })
  return object
}

describe('QmlStateMachine', () => {
  it('applies state changes and restores base values', async () => {
    const object = stateObject()
    const machine = new QmlStateMachine([
      { name: 'moved', changes: [{ target: object, values: { x: 100, color: 'blue' } }] },
    ])

    await machine.setState('moved')
    expect(object.getProperty('x')).toBe(100)
    expect(object.getProperty('color')).toBe('blue')

    await machine.setState('')
    expect(object.getProperty('x')).toBe(0)
    expect(object.getProperty('color')).toBe('red')
  })

  it('animates color state changes', async () => {
    const scheduler = new ManualScheduler()
    const target = new QmlObject('Rectangle')
    target.defineProperty({ name: 'color', type: 'color', initialValue: '#000000' })
    const machine = new QmlStateMachine([
      { name: 'bright', changes: [{ target, values: { color: '#ffffff' } }] },
    ], [{ to: 'bright', duration: 100, scheduler, valueType: 'color' }])

    const completed = machine.setState('bright')
    scheduler.advance(50)
    expect(target.getProperty('color')).toBe('#808080')
    scheduler.advance(50)
    await completed
    expect(target.getProperty('color')).toBe('#ffffff')
  })

  it('animates matching numeric transition properties', async () => {
    const scheduler = new ManualScheduler()
    const object = stateObject()
    const machine = new QmlStateMachine([
      { name: 'moved', changes: [{ target: object, values: { x: 100, opacity: 0 } }] },
    ], [{ from: '', to: 'moved', properties: ['x'], duration: 100, easing: QmlEasing.Linear, scheduler }])
    const completed = machine.setState('moved')

    expect(object.getProperty('opacity')).toBe(0)
    scheduler.advance(50)
    expect(object.getProperty('x')).toBe(50)
    scheduler.advance(50)
    await completed
    expect(object.getProperty('x')).toBe(100)
  })

  it('selects the first matching conditional state', async () => {
    const object = stateObject()
    let active = false
    const machine = new QmlStateMachine([
      { name: 'active', when: () => active, changes: [{ target: object, values: { opacity: 1 } }] },
      { name: 'inactive', when: () => !active, changes: [{ target: object, values: { opacity: 0.4 } }] },
    ])

    await machine.refresh()
    expect(machine.state).toBe('inactive')
    expect(object.getProperty('opacity')).toBe(0.4)
    active = true
    await machine.refresh()
    expect(machine.state).toBe('active')
  })

  it('rejects unknown state properties and names', async () => {
    const object = stateObject()
    expect(() => new QmlStateMachine([
      { name: 'invalid', changes: [{ target: object, values: { missing: 1 } }] },
    ])).toThrow('Unknown state property missing')

    const machine = new QmlStateMachine([])
    await expect(machine.setState('missing')).rejects.toThrow('Unknown QML state missing')
  })
})

describe('QmlBehavior', () => {
  it('animates direct numeric property assignments', async () => {
    const scheduler = new ManualScheduler()
    const object = stateObject()
    const behavior = new QmlBehavior({ target: object, property: 'x', duration: 100, scheduler })

    object.setProperty('x', 100)
    expect(object.getProperty('x')).toBe(0)
    scheduler.advance(50)
    expect(object.getProperty('x')).toBe(50)
    scheduler.advance(50)
    await Promise.resolve()
    expect(object.getProperty('x')).toBe(100)

    behavior.dispose()
    object.setProperty('x', 10)
    expect(object.getProperty('x')).toBe(10)
  })
})
