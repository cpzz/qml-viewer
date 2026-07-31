import React, { useEffect, useRef } from 'react'
import { parseAndRender } from '../renderer/renderer'

interface PreviewPanelProps {
  code: string
  isLight: boolean
}

interface PreviewFrame {
  html: string
  version: number
  isLight: boolean
}

const PREVIEW_UPDATE_DELAY_MS = 200

function attachConsoleBridge(html: string): string {
  const bridge = `<script>(function(){
    const toText = function(value){
      if (typeof value === 'string') return value;
      if (value == null) return String(value);
      if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
      try { return JSON.stringify(value); } catch (_error) { return Object.prototype.toString.call(value); }
    };
    const send = function(level, args){
      try {
        parent.postMessage({
          type: 'qml-preview-log',
          level: level,
          args: Array.prototype.map.call(args, toText),
          timestamp: Date.now(),
        }, '*');
      } catch (_error) {
        // no-op
      }
    };
    ['log','info','warn','error'].forEach(function(level){
      const original = console[level] ? console[level].bind(console) : console.log.bind(console);
      console[level] = function(){
        send(level, arguments);
        return original.apply(console, arguments);
      };
    });
    window.addEventListener('error', function(event){
      send('error', ['Error', event && event.message ? event.message : 'Unknown error']);
    });
    window.addEventListener('unhandledrejection', function(event){
      send('error', ['UnhandledPromiseRejection', event && event.reason !== undefined ? event.reason : 'unknown']);
    });
  })();<\/script>`
  if (html.includes('</head>')) return html.replace('</head>', `${bridge}</head>`)
  if (html.includes('<body')) return html.replace('<body', `${bridge}<body`)
  return `${bridge}${html}`
}

interface PreviewScroll {
  outerTop: number
  outerLeft: number
  innerTop: number
  innerLeft: number
}

export default function PreviewPanel({ code, isLight }: PreviewPanelProps) {
  const [frames, setFrames] = React.useState<PreviewFrame[]>([
    { html: '', version: 0, isLight },
    { html: '', version: 0, isLight },
  ])
  const [activeSlot, setActiveSlot] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const iframeRefs = useRef<Array<HTMLIFrameElement | null>>([null, null])
  const activeSlotRef = useRef(activeSlot)
  const versionRef = useRef(0)
  const previousThemeRef = useRef(isLight)
  const pendingRef = useRef<{ slot: number; version: number; scroll: PreviewScroll } | null>(null)
  activeSlotRef.current = activeSlot

  useEffect(() => {
    const version = ++versionRef.current
    const themeChanged = previousThemeRef.current !== isLight
    previousThemeRef.current = isLight
    const timer = window.setTimeout(() => {
      const currentSlot = activeSlotRef.current
      const nextSlot = currentSlot === 0 ? 1 : 0
      const doc = iframeRefs.current[currentSlot]?.contentDocument
      const outer = doc?.querySelector<HTMLElement>('.qml-preview-root')
      const inner = doc?.querySelector<HTMLElement>('.qml-scrollview')
      const scroll: PreviewScroll = {
        outerTop: outer?.scrollTop ?? 0,
        outerLeft: outer?.scrollLeft ?? 0,
        innerTop: inner?.scrollTop ?? 0,
        innerLeft: inner?.scrollLeft ?? 0,
      }

      try {
        const html = attachConsoleBridge(parseAndRender(code, isLight))
        pendingRef.current = { slot: nextSlot, version, scroll }
        setFrames((current) => current.map((frame, slot) => (
          slot === nextSlot ? { html, version, isLight } : frame
        )))
        setError(null)
      } catch (renderError: unknown) {
        const message = renderError instanceof Error ? renderError.message : String(renderError)
        setError(message)
      }
    }, themeChanged ? 0 : PREVIEW_UPDATE_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [code, isLight])

  const handleFrameLoad = (slot: number, version: number) => {
    const pending = pendingRef.current
    if (!pending || pending.slot !== slot || pending.version !== version || version !== versionRef.current) return

    const doc = iframeRefs.current[slot]?.contentDocument
    const outer = doc?.querySelector<HTMLElement>('.qml-preview-root')
    const inner = doc?.querySelector<HTMLElement>('.qml-scrollview')
    requestAnimationFrame(() => {
      outer?.scrollTo(pending.scroll.outerLeft, pending.scroll.outerTop)
      inner?.scrollTo(pending.scroll.innerLeft, pending.scroll.innerTop)
      requestAnimationFrame(() => {
        if (pendingRef.current?.version !== version) return
        pendingRef.current = null
        activeSlotRef.current = slot
        setActiveSlot(slot)
      })
    })
  }

  return (
    <div className="preview-panel">
      <div className="preview-content">
        {frames.map((frame, slot) => (
          <iframe
            key={`preview-${slot}-${frame.version}`}
            ref={(element) => { iframeRefs.current[slot] = element }}
            className={`preview-iframe preview-iframe-${slot === activeSlot ? 'active' : 'buffer'}`}
            style={{ backgroundColor: frame.isLight ? '#ffffff' : '#1e1e1e' }}
            srcDoc={frame.html}
            title={slot === activeSlot ? 'preview' : 'preview buffer'}
            aria-hidden={slot !== activeSlot}
            onLoad={() => handleFrameLoad(slot, frame.version)}
          />
        ))}
        {error && (
          <div className="preview-error" style={{ padding: 16, color: '#e74c3c', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' }}>
            <strong>Render Error:</strong>
            <div>{error}</div>
          </div>
        )}
      </div>
    </div>
  )
}
