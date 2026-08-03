import { describe, expect, it, vi } from 'vitest'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'
import { createDomGrabProvider, grabToImage, registerItemGrabProvider } from './QmlItemGrab'

describe('Item grabToImage', () => {
  it('returns false when the Item is not mounted', () => {
    const item = createBuiltinQmlTypeRegistry().create('Item')
    expect(item.callMethod('grabToImage', () => undefined)).toBe(false)
  })

  it('delivers an asynchronous SVG data URL and unregisters its provider', async () => {
    const item = createBuiltinQmlTypeRegistry().create('Rectangle')
    const element = {
      offsetWidth: 80,
      offsetHeight: 40,
      outerHTML: '<div style="background:red"></div>',
    } as HTMLElement
    const unregister = registerItemGrabProvider(item, createDomGrabProvider(element))
    const callback = vi.fn()

    expect(grabToImage(item, callback, { width: 160, height: 90 })).toBe(true)
    expect(callback).not.toHaveBeenCalled()
    await Promise.resolve()

    const result = callback.mock.calls[0][0]
    expect(result.url).toMatch(/^data:image\/svg\+xml/)
    expect(decodeURIComponent(result.url)).toContain('width="160" height="90"')
    expect(result.saveToFile('preview.png')).toBe(false)

    unregister()
    expect(grabToImage(item, callback)).toBe(false)
  })
})
