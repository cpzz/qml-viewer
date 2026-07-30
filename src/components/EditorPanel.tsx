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

const PROPERTY_DEFAULT_VALUES: Record<string, { text: string; cursorBack: number }> = {
  int:    { text: '0',             cursorBack: 0 },
  real:   { text: '0.0',           cursorBack: 0 },
  double: { text: '0.0',           cursorBack: 0 },
  bool:   { text: 'false',         cursorBack: 0 },
  string: { text: '""',            cursorBack: 1 },
  color:  { text: '"transparent"', cursorBack: 0 },
  url:    { text: '""',            cursorBack: 1 },
  list:   { text: '[]',            cursorBack: 0 },
  date:   { text: 'new Date()',    cursorBack: 0 },
}

function getPropertyDefaultValue(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
): { text: string; cursorBack: number } | null {
  const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
  const match = linePrefix.match(
    /^\s*(?:(?:readonly|default)\s+)?property\s+([A-Za-z_]\w*)\s+[A-Za-z_]\w*\s*:$/,
  )
  if (!match) return null
  return PROPERTY_DEFAULT_VALUES[match[1].toLowerCase()] ?? null
}

function isQmlPropertyColon(model: monaco.editor.ITextModel, position: monaco.Position): boolean {
  const colonOffset = model.getOffsetAt(position) - 1
  const source = model.getValue().slice(0, colonOffset + 1)
  let state: 'code' | 'single' | 'double' | 'lineComment' | 'blockComment' = 'code'

  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    const next = source[index + 1]
    const previous = source[index - 1]
    if (state === 'lineComment') {
      if (char === '\n') state = 'code'
      continue
    }
    if (state === 'blockComment') {
      if (char === '*' && next === '/') { state = 'code'; index++ }
      continue
    }
    if (state === 'single' || state === 'double') {
      const quote = state === 'single' ? "'" : '"'
      if (char === quote && previous !== '\\') state = 'code'
      continue
    }
    if (char === '/' && next === '/') { state = 'lineComment'; index++; continue }
    if (char === '/' && next === '*') { state = 'blockComment'; index++; continue }
    if (char === "'") { state = 'single'; continue }
    if (char === '"') state = 'double'
  }
  if (state !== 'code') return false

  const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
  return /^\s*[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\s*:$/.test(linePrefix) ||
    /^\s*(?:(?:readonly|default)\s+)?property\s+(?:alias|[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s+[A-Za-z_]\w*\s*:$/.test(linePrefix)
}

export default function EditorPanel({ code, onChange, isLight, readOnly }: EditorPanelProps) {
  const { locale, t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const onChangeRef = useRef(onChange)
  const readOnlyRef = useRef(readOnly)
  const labelsRef = useRef({ findReplace: '', find: '', replace: '' })
  const updateFindWidgetRef = useRef<() => void>(() => {})
  onChangeRef.current = onChange
  readOnlyRef.current = readOnly
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

    editor.onDidChangeModelContent((event) => {
      if (event.isFlush) return
      onChangeRef.current(editor.getValue())
    })

    editor.onDidType((text) => {
      if (text !== ':' || readOnlyRef.current) return
      const model = editor.getModel()
      const position = editor.getPosition()
      if (!model || !position || !isQmlPropertyColon(model, position)) return
      const nextCharacter = model.getValueInRange(new monaco.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column + 1,
      ))
      if (/\s/.test(nextCharacter)) return
      const defaultVal = getPropertyDefaultValue(model, position)
      const insertText = defaultVal ? ` ${defaultVal.text}` : ' '
      editor.executeEdits('qml-colon-spacing', [{
        range: new monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column,
        ),
        text: insertText,
      }])
      const newColumn = position.column + insertText.length - (defaultVal?.cursorBack ?? 0)
      editor.setPosition({ lineNumber: position.lineNumber, column: newColumn })
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
