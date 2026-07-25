import React, { useState, useEffect } from 'react'
import { parseAndRender } from '../renderer/renderer'

interface PreviewPanelProps {
  code: string
  isLight: boolean
}

export default function PreviewPanel({ code, isLight }: PreviewPanelProps) {
  const [previewHTML, setPreviewHTML] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  useEffect(() => {
    try {
      const html = parseAndRender(code, isLight)
      setPreviewHTML(html)
      setError(null)
    } catch (e: any) {
      setError(e?.message || String(e))
      setPreviewHTML('')
    }
  }, [code, isLight])

  return (
    <div className="preview-panel">
      <div className="preview-content">
        {error ? (
          <div style={{ padding: 16, color: '#e74c3c', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' }}>
            <strong>Render Error:</strong>
            <div>{error}</div>
          </div>
        ) : (
          <iframe
            className="preview-iframe"
            srcDoc={previewHTML}
            title="preview"
          />
        )}
      </div>
    </div>
  )
}
