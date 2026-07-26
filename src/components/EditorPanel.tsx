import React, { useRef, useEffect } from 'react'
import * as monaco from 'monaco-editor'
import { registerQMLLanguage } from '../utils/qmlLang'

// Configure Monaco Editor workers to load from CDN
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

;(self as any).MonacoEnvironment = {
  getWorker(_workerId: string, _label: string) {
    return new EditorWorker()
  },
}

interface EditorPanelProps {
  code: string
  onChange: (value: string) => void
  isLight: boolean
}

export default function EditorPanel({ code, onChange, isLight }: EditorPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    registerQMLLanguage()
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const editor = monaco.editor.create(containerRef.current, {
      value: code,
      language: 'qml',
      theme: isLight ? 'vs' : 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
    })

    editorRef.current = editor

    editor.onDidChangeModelContent(() => {
      onChangeRef.current(editor.getValue())
    })

    return () => editor.dispose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        theme: isLight ? 'vs' : 'vs-dark',
      })
    }
  }, [isLight])

  // Sync editor content when `code` prop changes
  useEffect(() => {
    const editor = editorRef.current
    if (editor) {
      const current = editor.getValue()
      if (current !== code) {
        editor.setValue(code)
      }
    }
  }, [code])

  return (
    <div className="editor-panel">
      <div ref={containerRef} className="editor-container" />
    </div>
  )
}
