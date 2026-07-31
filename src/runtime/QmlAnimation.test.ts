import { describe, expect, it, vi } from 'vitest'
import {
  QmlEasing,
  QmlKeyframeAnimation,
  QmlParallelAnimation,
  QmlLoopAnimation,
  QmlPauseAnimation,
  QmlPropertyAnimation,
  QmlScriptAction,
  QmlSequentialAnimation,
  QmlValueAnimation,
  type QmlAnimation,
  type QmlAnimationScheduler,
} from './QmlAnimation'
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

function animatedObject() {
  const object = new QmlObject('Item')
  object.defineProperty({ name: 'x', type: 'real', initialValue: 0 })
  return object
}

describe('QmlPropertyAnimation', () => {
  it('interpolates properties with easing on a deterministic scheduler', async () => {
    const scheduler = new ManualScheduler()
    const object = animatedObject()
    const animation = new QmlPropertyAnimation({
      target: object,
      property: 'x',
      to: 100,
      duration: 100,
      easing: QmlEasing.InQuad,
      scheduler,
    })
    const completed = animation.start()

    scheduler.advance(50)
    expect(object.getProperty('x')).toBe(25)
    scheduler.advance(50)
    await completed

    expect(object.getProperty('x')).toBe(100)
  })

  it('stops without applying the final value', async () => {
    const scheduler = new ManualScheduler()
    const object = animatedObject()
    const animation = new QmlPropertyAnimation({ target: object, property: 'x', to: 100, scheduler })
    const completed = animation.start()
    scheduler.advance(50)
    animation.stop()
    await completed

    expect(object.getProperty('x')).toBe(20)
  })

  it('runs offset keyframes as deterministic segments', async () => {
    const scheduler = new ManualScheduler()
    const object = animatedObject()
    const animation = new QmlKeyframeAnimation(object, 'x', [
      { offset: 0, value: 0 },
      { offset: 0.25, value: 50 },
      { offset: 1, value: 100 },
    ], 100, scheduler)
    const completed = animation.start()
    scheduler.advance(25)
    await Promise.resolve()
    expect(object.getProperty('x')).toBe(50)
    scheduler.advance(75)
    await completed
    expect(object.getProperty('x')).toBe(100)
  })
})

describe('QML animation groups', () => {
  function controlledAnimation(): QmlAnimation & { finish: () => void; start: ReturnType<typeof vi.fn> } {
    let finish = () => {}
    return {
      start: vi.fn(() => new Promise<void>(resolve => { finish = resolve })),
      stop: vi.fn(),
      finish: () => finish(),
    }
  }

  it('runs parallel children together', async () => {
    const first = controlledAnimation()
    const second = controlledAnimation()
    const group = new QmlParallelAnimation([first, second])
    const completed = group.start()

    expect(first.start).toHaveBeenCalledOnce()
    expect(second.start).toHaveBeenCalledOnce()
    first.finish()
    second.finish()
    await completed
  })

  it('runs sequential children in order', async () => {
    const first = controlledAnimation()
    const second = controlledAnimation()
    const group = new QmlSequentialAnimation([first, second])
    const completed = group.start()

    expect(first.start).toHaveBeenCalledOnce()
    expect(second.start).not.toHaveBeenCalled()
    first.finish()
    await Promise.resolve()
    expect(second.start).toHaveBeenCalledOnce()
    second.finish()
    await completed
  })

  it('interpolates colors and vectors', async () => {
    const scheduler = new ManualScheduler()
    const object = animatedObject()
    object.defineProperty({ name: 'color', type: 'color', initialValue: '#000000' })
    object.defineProperty({ name: 'vector', type: 'vector3d', initialValue: [0, 10, 20] })
    const color = new QmlValueAnimation({ target: object, property: 'color', to: '#ffffff', duration: 100, scheduler })
    const vector = new QmlValueAnimation({ target: object, property: 'vector', to: [10, 20, 30], duration: 100, scheduler })
    const completed = Promise.all([color.start(), vector.start()])
    scheduler.advance(50)
    expect(object.getProperty('color')).toBe('#808080')
    expect(object.getProperty('vector')).toEqual([5, 15, 25])
    scheduler.advance(50)
    await completed
  })

  it('runs pause, script, and finite loop actions', async () => {
    const scheduler = new ManualScheduler()
    const action = vi.fn()
    const sequence = new QmlSequentialAnimation([
      new QmlPauseAnimation(50, scheduler),
      new QmlScriptAction(action),
    ])
    const loop = new QmlLoopAnimation(sequence, 2)
    const completed = loop.start()
    scheduler.advance(50)
    for (let turn = 0; turn < 4; turn++) await Promise.resolve()
    expect(action).toHaveBeenCalledTimes(1)
    scheduler.advance(50)
    await completed
    expect(action).toHaveBeenCalledTimes(2)
  })
})
