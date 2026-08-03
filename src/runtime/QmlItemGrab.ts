import type { QmlObject } from './QmlObject'

export interface QmlItemGrabResult {
  url: string
  saveToFile(fileName: string): boolean
}

type GrabProvider = (targetSize?: unknown) => QmlItemGrabResult

const providers = new WeakMap<QmlObject, GrabProvider>()

export function registerItemGrabProvider(item: QmlObject, provider: GrabProvider): () => void {
  providers.set(item, provider)
  return () => providers.delete(item)
}

export function createDomGrabProvider(element: HTMLElement): GrabProvider {
  return targetSize => {
    const size = typeof targetSize === 'object' && targetSize !== null
      ? targetSize as { width?: unknown; height?: unknown }
      : {}
    const width = Math.max(0, Number(size.width) || element.offsetWidth)
    const height = Math.max(0, Number(size.height) || element.offsetHeight)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${element.outerHTML}</foreignObject></svg>`
    return {
      url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      saveToFile: () => false,
    }
  }
}

export function grabToImage(item: QmlObject, callback: unknown, targetSize?: unknown): boolean {
  const provider = providers.get(item)
  if (!provider || typeof callback !== 'function') return false
  const result = provider(targetSize)
  queueMicrotask(() => callback(result))
  return true
}
