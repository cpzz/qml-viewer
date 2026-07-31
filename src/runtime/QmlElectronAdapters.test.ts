import { describe, expect, it, vi } from 'vitest'
import { createQmlElectronHostFunctions, QmlElectronFileProvider, type QmlElectronApi } from './QmlElectronAdapters'

function api(): QmlElectronApi {
  return {
    qmlReadText: vi.fn(async path => `read:${path}`),
    qmlWriteText: vi.fn(async () => undefined),
    qmlFetchText: vi.fn(async url => ({ status: 200, headers: {}, body: `fetch:${url}` })),
    qmlClipboardRead: vi.fn(async () => 'clipboard'),
    qmlClipboardWrite: vi.fn(async () => undefined),
  }
}

describe('QmlElectronAdapters', () => {
  it('loads file URLs through the preload API', async () => {
    const electron = api()
    const provider = new QmlElectronFileProvider(electron)

    expect(await provider.readText('file:///tmp/My%20Module/Card.qml')).toBe('read:/tmp/My Module/Card.qml')
  })

  it('exposes only explicit asynchronous platform functions', async () => {
    const electron = api()
    const functions = createQmlElectronHostFunctions(electron)

    expect(Object.keys(functions).sort()).toEqual([
      'fetchText', 'readClipboardText', 'readTextFile', 'writeClipboardText', 'writeTextFile',
    ])
    expect(await functions.fetchText('https://example.test')).toMatchObject({ body: 'fetch:https://example.test' })
    expect(await functions.readClipboardText()).toBe('clipboard')
  })
})