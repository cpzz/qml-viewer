import React, { useEffect, useRef, useState } from 'react'
import { parseQMLDocument } from '../renderer/parser'
import { createBuiltinQmlTypeRegistry } from '../runtime/BuiltinQmlTypes'
import { activateQmlDocument, type ActiveQmlDocument } from '../runtime/QmlDocument'
import { QmlDomSceneGraph } from '../runtime/QmlDomSceneGraph'
import { QmlElectronFileProvider } from '../runtime/QmlElectronAdapters'
import { QmlComponent } from '../runtime/QmlComponent'
import { QmlJsEngine } from '../runtime/QmlJsEngine'
import { QmlModuleResolver } from '../runtime/QmlModuleResolver'
import { inspectQmlDocument, type QmlInspectionSnapshot } from '../runtime/QmlInspection'
import { qmlControlStyleAttribute, type QmlControlStyle } from '../runtime/QmlControlStyle'

interface PreviewPanelProps {
  code: string
  isLight: boolean
  qmlControlStyle: QmlControlStyle
  filePath?: string | null
  inspectorOpen?: boolean
  onToggleInspector?: () => void
}

const PREVIEW_UPDATE_DELAY_MS = 200
const engine = QmlJsEngine.create()

export type PreviewScrollPositions = Map<string, { left: number; top: number }>

export function capturePreviewScrollPositions(surface: HTMLElement): PreviewScrollPositions {
  const positions: PreviewScrollPositions = new Map()
  const counts = new Map<string, number>()
  for (const element of [surface, ...surface.querySelectorAll<HTMLElement>('.qml-runtime-node')]) {
    const type = element.dataset.qmlType ?? 'surface'
    const index = counts.get(type) ?? 0
    counts.set(type, index + 1)
    if (element.scrollLeft || element.scrollTop) {
      positions.set(`${type}:${index}`, { left: element.scrollLeft, top: element.scrollTop })
    }
  }
  return positions
}

export function restorePreviewScrollPositions(surface: HTMLElement, positions: PreviewScrollPositions): void {
  const counts = new Map<string, number>()
  for (const element of [surface, ...surface.querySelectorAll<HTMLElement>('.qml-runtime-node')]) {
    const type = element.dataset.qmlType ?? 'surface'
    const index = counts.get(type) ?? 0
    counts.set(type, index + 1)
    const position = positions.get(`${type}:${index}`)
    if (position) element.scrollTo(position.left, position.top)
  }
}

function directoryName(filePath: string): string {
  const separator = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return separator < 0 ? '.' : filePath.slice(0, separator)
}

export default function PreviewPanel({ code, isLight, qmlControlStyle, filePath, inspectorOpen = false, onToggleInspector }: PreviewPanelProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef<{ document: ActiveQmlDocument; scene: QmlDomSceneGraph } | null>(null)
  const versionRef = useRef(0)
  const inspectorOpenRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<QmlInspectionSnapshot | null>(null)

  const toggleInspector = () => {
    if (onToggleInspector) onToggleInspector()
  }

  useEffect(() => {
    const version = ++versionRef.current
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const ast = parseQMLDocument(code)
        if (ast.diagnostics.length) {
          throw new Error(ast.diagnostics.map(diagnostic => (
            `${diagnostic.range.start.line}:${diagnostic.range.start.column} ${diagnostic.message}`
          )).join('\n'))
        }
        const registry = createBuiltinQmlTypeRegistry()
        if (filePath && window.electronAPI?.qmlReadText) {
          const basePath = directoryName(filePath)
          try {
            const qmlDir = await window.electronAPI.qmlReadText(`${basePath}/qmldir`)
            if (qmlDir) {
              const resolver = new QmlModuleResolver()
              await resolver.registerQmlDirAsync(basePath, qmlDir, new QmlElectronFileProvider(window.electronAPI))
              resolver.installImportedTypes(ast.imports, registry)
            }
          } catch {
            // A qmldir file is optional for standalone documents.
          }
        }
        const jsEngine = await engine
        if (cancelled || version !== versionRef.current || !surfaceRef.current) return
        const document = activateQmlDocument(ast.nodes, jsEngine, registry, {
          resolveLoaderSource: async source => {
            if (!filePath || !window.electronAPI?.qmlReadText) {
              throw new Error(`No file provider available for Loader source ${source}`)
            }
            const url = `${directoryName(filePath)}/${source}`
            const componentSource = await window.electronAPI.qmlReadText(url)
            if (componentSource === undefined) throw new Error(`Unable to read QML component ${url}`)
            return new QmlComponent(componentSource, registry, url)
          },
        })
        const scene = new QmlDomSceneGraph(window.document)
        const scrollPositions = capturePreviewScrollPositions(surfaceRef.current)
        activeRef.current?.scene.dispose()
        activeRef.current?.document.dispose()
        scene.mount(document, surfaceRef.current)
        const surface = surfaceRef.current
        restorePreviewScrollPositions(surface, scrollPositions)
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          if (!cancelled && version === versionRef.current) restorePreviewScrollPositions(surface, scrollPositions)
        }))
        activeRef.current = { document, scene }
        if (inspectorOpenRef.current) setSnapshot(inspectQmlDocument(document))
        setError(null)
      } catch (renderError) {
        if (cancelled || version !== versionRef.current) return
        setError(renderError instanceof Error ? renderError.message : String(renderError))
      }
    }, PREVIEW_UPDATE_DELAY_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [code, filePath])

  useEffect(() => () => {
    activeRef.current?.scene.dispose()
    activeRef.current?.document.dispose()
    activeRef.current = null
  }, [])

  useEffect(() => {
    inspectorOpenRef.current = inspectorOpen
    if (inspectorOpen && activeRef.current) setSnapshot(inspectQmlDocument(activeRef.current.document))
  }, [inspectorOpen])

  return (
    <div className={`preview-panel${isLight ? ' light' : ''}`}>
      <div className="preview-content">
        <div
          ref={surfaceRef}
          className="qml-runtime-surface"
          data-qml-style={qmlControlStyleAttribute(qmlControlStyle)}
        />
        {inspectorOpen && snapshot && (
          <aside className="preview-inspector" aria-label="Runtime object inspector">
            <header>
              <strong>Runtime objects</strong>
              <span>{snapshot.objectCount}</span>
            </header>
            <pre>{JSON.stringify(snapshot.roots, null, 2)}</pre>
          </aside>
        )}
        {error && (
          <div className="preview-error">
            <strong>Render Error:</strong>
            <div>{error}</div>
          </div>
        )}
      </div>
    </div>
  )
}