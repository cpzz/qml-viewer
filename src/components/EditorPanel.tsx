import React, { useRef, useEffect } from 'react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import 'monaco-editor/esm/vs/base/browser/ui/codicons/codiconStyles'
import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController'
import 'monaco-editor/esm/vs/editor/contrib/folding/browser/folding'
import 'monaco-editor/esm/vs/editor/contrib/semanticTokens/browser/documentSemanticTokens'
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController'
import { registerQMLLanguage } from '../utils/qmlLang'
import { showQMLChildHelp, showQMLContextHelp } from '../utils/qmlCompletion'
import { useI18n } from '../i18n'

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
  readOnly: boolean
}

export default function EditorPanel({ code, onChange, isLight, readOnly }: EditorPanelProps) {
  const { locale, t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const onChangeRef = useRef(onChange)
  const labelsRef = useRef({ findReplace: '', find: '', replace: '' })
  const updateFindWidgetRef = useRef<() => void>(() => {})
  onChangeRef.current = onChange
  labelsRef.current = {
    findReplace: t('editor.findReplace'),
    find: t('editor.find'),
    replace: t('editor.replace'),
  }

  useEffect(() => {
    registerQMLLanguage()
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const editor = monaco.editor.create(containerRef.current, {
      value: code,
      language: 'qml',
      theme: isLight ? 'qml-light' : 'qml-dark',
      readOnly,
      'semanticHighlighting.enabled': true,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on',
      folding: true,
      showFoldingControls: 'mouseover',
      quickSuggestions: { other: true, comments: false, strings: false },
      suggestOnTriggerCharacters: true,
      tabCompletion: 'on',
      snippetSuggestions: 'top',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      find: {
        seedSearchStringFromSelection: 'always',
        autoFindInSelection: 'multiline',
        loop: true,
      },
    })

    editorRef.current = editor

    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Slash, () => {
      showQMLContextHelp(editor)
    })
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Period, () => {
      showQMLChildHelp(editor)
    })

    editor.onDidChangeModelContent(() => {
      onChangeRef.current(editor.getValue())
    })

    const updateFindWidget = () => {
      const labels = labelsRef.current
      const widget = containerRef.current?.querySelector<HTMLElement>('.find-widget')
      widget?.setAttribute('aria-label', labels.findReplace)
      const findInput = widget?.querySelector<HTMLTextAreaElement>('textarea[aria-label="Find"], textarea[aria-label="查找"]')
      const replaceInput = widget?.querySelector<HTMLTextAreaElement>('textarea[aria-label="Replace"], textarea[aria-label="替换"]')
      if (findInput) {
        findInput.placeholder = labels.find
        findInput.setAttribute('aria-label', labels.find)
      }
      if (replaceInput) {
        replaceInput.placeholder = labels.replace
        replaceInput.setAttribute('aria-label', labels.replace)
      }

      containerRef.current?.querySelectorAll<HTMLElement>('.workbench-hover-container').forEach((hover) => {
        const text = hover.textContent?.trim()
        if (text === 'Find' || text === 'Replace' || text === '查找' || text === '替换') {
          hover.dataset.findInputHover = 'true'
        } else {
          delete hover.dataset.findInputHover
        }
      })
    }
    updateFindWidgetRef.current = updateFindWidget
    const hoverObserver = new MutationObserver(updateFindWidget)
    hoverObserver.observe(containerRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    return () => {
      hoverObserver.disconnect()
      updateFindWidgetRef.current = () => {}
      editor.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    updateFindWidgetRef.current()
  }, [locale])

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        theme: isLight ? 'qml-light' : 'qml-dark',
      })
    }
  }, [isLight])

  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly })
  }, [readOnly])

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
