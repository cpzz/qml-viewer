import { describe, expect, it, vi } from 'vitest'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'
import { QmlTimerController } from './QmlTimerController'

describe('QmlTimerController', () => {
  it('triggers once and clears running', () => {
    vi.useFakeTimers()
    const timer = createBuiltinQmlTypeRegistry().create('Timer')
    timer.setProperty('interval', 20)
    const triggered = vi.fn()
    timer.connectSignal('triggered', triggered)
    const controller = new QmlTimerController(timer)

    timer.callMethod('start')
    vi.advanceTimersByTime(20)

    expect(triggered).toHaveBeenCalledTimes(1)
    expect(timer.getProperty('running')).toBe(false)
    controller.dispose()
    vi.useRealTimers()
  })

  it('repeats, resets on property changes, and stops after disposal', () => {
    vi.useFakeTimers()
    const timer = createBuiltinQmlTypeRegistry().create('Timer')
    timer.setProperty('interval', 20)
    timer.setProperty('repeat', true)
    timer.setProperty('triggeredOnStart', true)
    const triggered = vi.fn()
    timer.connectSignal('triggered', triggered)
    const controller = new QmlTimerController(timer)

    timer.callMethod('start')
    expect(triggered).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10)
    timer.setProperty('interval', 30)
    vi.advanceTimersByTime(29)
    expect(triggered).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(triggered).toHaveBeenCalledTimes(2)

    controller.dispose()
    vi.advanceTimersByTime(100)
    expect(triggered).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
