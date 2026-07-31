import { describe, expect, it, vi } from 'vitest'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'
import { QmlComponent } from './QmlComponent'
import { QmlLoaderController, QmlLoaderStatus } from './QmlLoaderController'
import type { QmlObject } from './QmlObject'

describe('QmlLoaderController', () => {
  it('loads, replaces, and unloads source components', async () => {
    const registry = createBuiltinQmlTypeRegistry()
    const loader = registry.create('Loader')
    const firstComponent = new QmlComponent('Rectangle { id: first; color: "red" }', registry)
    const secondComponent = new QmlComponent('Text { id: second; text: "Ready" }', registry)
    const loaded = vi.fn()
    loader.connectSignal('loaded', loaded)
    const controller = new QmlLoaderController(loader)

    loader.setProperty('sourceComponent', firstComponent)
    const firstItem = loader.getProperty('item') as QmlObject

    expect(loader.getProperty('status')).toBe(QmlLoaderStatus.Ready)
    expect(loader.getProperty('progress')).toBe(1)
    expect(firstItem.typeName).toBe('Rectangle')
    expect(firstItem.parent).toBe(loader)
    expect(loader.getProperty('data')).toContain(firstItem)

    loader.setProperty('sourceComponent', secondComponent)
    const secondItem = loader.getProperty('item') as QmlObject

    expect(firstItem.parent).toBeNull()
    expect(secondItem.typeName).toBe('Text')
    expect(loaded).toHaveBeenCalledTimes(2)

    loader.setProperty('active', false)

    expect(loader.getProperty('item')).toBeNull()
    expect(loader.getProperty('status')).toBe(QmlLoaderStatus.Null)
    expect(secondItem.parent).toBeNull()
  })

  it('loads source URLs through the host resolver and reports errors', async () => {
    const registry = createBuiltinQmlTypeRegistry()
    const loader = registry.create('Loader')
    const resolveSource = vi.fn(async (source: string) => {
      if (source === 'Panel.qml') return new QmlComponent('Rectangle { id: panel }', registry, source)
      throw new Error(`Missing ${source}`)
    })
    const controller = new QmlLoaderController(loader, resolveSource)

    loader.setProperty('source', 'Panel.qml')
    await controller.reload()
    expect(resolveSource).toHaveBeenCalledWith('Panel.qml')
    expect((loader.getProperty('item') as { typeName: string }).typeName).toBe('Rectangle')

    loader.setProperty('sourceComponent', null)
    loader.setProperty('source', 'Missing.qml')
    await controller.reload()

    expect(loader.getProperty('status')).toBe(QmlLoaderStatus.Error)
    expect(controller.error?.message).toBe('Missing Missing.qml')
  })

  it('rejects non-Loader objects', () => {
    const registry = createBuiltinQmlTypeRegistry()
    expect(() => new QmlLoaderController(registry.create('Item'))).toThrow(
      'requires a Loader object',
    )
  })
})
