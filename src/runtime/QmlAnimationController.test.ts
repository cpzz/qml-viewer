import { describe, expect, it, vi } from 'vitest'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'
import type { QmlAnimationScheduler } from './QmlAnimation'
import { QmlAnimationController } from './QmlAnimationController'

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

describe('QmlAnimationController', () => {
  it('runs and restarts a declarative NumberAnimation', async () => {
    const registry = createBuiltinQmlTypeRegistry()
    const target = registry.create('Item')
    const animation = registry.create('NumberAnimation')
    animation.setProperty('target', target)
    animation.setProperty('property', 'x')
    animation.setProperty('from', 0)
    animation.setProperty('to', 100)
    animation.setProperty('duration', 100)
    const finished = vi.fn()
    animation.connectSignal('finished', finished)
    const scheduler = new ManualScheduler()
    const controller = new QmlAnimationController(animation, scheduler)

    animation.callMethod('restart')
    expect(animation.getProperty('running')).toBe(true)
    scheduler.advance(50)
    expect(target.getProperty('x')).toBe(50)

    animation.callMethod('restart')
    expect(target.getProperty('x')).toBe(50)
    scheduler.advance(100)
    await Promise.resolve()

    expect(target.getProperty('x')).toBe(100)
    expect(animation.getProperty('running')).toBe(false)
    expect(finished).toHaveBeenCalledTimes(1)
    controller.dispose()
  })

  it('stops active animation work on disposal', async () => {
    const registry = createBuiltinQmlTypeRegistry()
    const target = registry.create('Item')
    const animation = registry.create('NumberAnimation')
    animation.setProperty('target', target)
    animation.setProperty('property', 'x')
    animation.setProperty('to', 100)
    const scheduler = new ManualScheduler()
    const controller = new QmlAnimationController(animation, scheduler)

    animation.callMethod('start')
    scheduler.advance(50)
    const stoppedAt = target.getProperty('x')
    controller.dispose()
    scheduler.advance(500)
    await Promise.resolve()

    expect(target.getProperty('x')).toBe(stoppedAt)
    expect(animation.getProperty('running')).toBe(false)
  })
})
