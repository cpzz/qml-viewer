import type { QmlHostFunctions } from './QmlExecutionEnvironment'
import type { QmlModuleSourceProvider } from './QmlModuleResolver'

export interface QmlElectronApi {
  qmlReadText(filePath: string): Promise<string | undefined>
  qmlWriteText(filePath: string, content: string): Promise<void>
  qmlFetchText(url: string): Promise<{ status: number; headers: Record<string, string>; body: string }>
  qmlClipboardRead(): Promise<string>
  qmlClipboardWrite(text: string): Promise<void>
}

function filePath(url: string): string {
  if (!url.startsWith('file:')) return url
  const parsed = new URL(url)
  return decodeURIComponent(parsed.pathname)
}

export class QmlElectronFileProvider implements QmlModuleSourceProvider {
  constructor(private readonly api: Pick<QmlElectronApi, 'qmlReadText'>) {}

  readText(url: string): Promise<string | undefined> {
    return this.api.qmlReadText(filePath(url))
  }
}

export function createQmlElectronHostFunctions(api: QmlElectronApi): QmlHostFunctions {
  return {
    readTextFile: path => api.qmlReadText(String(path)),
    writeTextFile: (path, content) => api.qmlWriteText(String(path), String(content)),
    fetchText: url => api.qmlFetchText(String(url)),
    readClipboardText: () => api.qmlClipboardRead(),
    writeClipboardText: text => api.qmlClipboardWrite(String(text)),
  }
}