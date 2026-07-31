// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'
import { QmlShortcutController } from './QmlShortcutController'

describe('QmlShortcutController', () => {
  it('emits activated for a matching enabled key sequence', () => {
    const shortcut = createBuiltinQmlTypeRegistry().create('Shortcut')
    shortcut.setProperty('sequence', 'Ctrl+Shift+S')
    const activated = vi.fn()
    shortcut.connectSignal('activated', activated)
    const controller = new QmlShortcutController(shortcut, document)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, shiftKey: true }))
    expect(activated).toHaveBeenCalledTimes(1)

    shortcut.setProperty('enabled', false)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, shiftKey: true }))
    expect(activated).toHaveBeenCalledTimes(1)

    controller.dispose()
    shortcut.setProperty('enabled', true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, shiftKey: true }))
    expect(activated).toHaveBeenCalledTimes(1)
  })
})
