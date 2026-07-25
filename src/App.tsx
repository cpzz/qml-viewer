import React, { useState, useCallback, useEffect } from 'react'
import Toolbar from './components/Toolbar'
import SplitPane from './components/SplitPane'
import EditorPanel from './components/EditorPanel'
import PreviewPanel from './components/PreviewPanel'
import exampleQml from './example.qml?raw'

const DEFAULT_CODE = exampleQml

declare global {
  interface Window {
    electronAPI?: {
      openFile: () => Promise<{ content: string; filePath: string } | null>
      saveFile: (content: string, filePath?: string | null) => Promise<string | null>
    }
  }
}

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE)
  const [initialCode, setInitialCode] = useState(DEFAULT_CODE)
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)
  const [isLight, setIsLight] = useState(false)

  const hasChanges = code !== initialCode

  const handleOpen = useCallback(async () => {
    try {
      const result = await window.electronAPI?.openFile()
      if (result) {
        setCode(result.content)
        setInitialCode(result.content)
        setCurrentFilePath(result.filePath)
      }
    } catch (err) {
      console.error('Failed to open file:', err)
    }
  }, [])

  const handleSave = useCallback(async () => {
    try {
      const savedPath = await window.electronAPI?.saveFile(code, currentFilePath)
      if (savedPath) {
        setCurrentFilePath(savedPath)
        setInitialCode(code)
      }
    } catch (err) {
      console.error('Failed to save file:', err)
    }
  }, [code, currentFilePath])

  const handleToggleTheme = useCallback(() => {
    setIsLight((prev) => !prev)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('light', isLight)
  }, [isLight])

  return (
    <div className="app-container">
      <Toolbar
        isLight={isLight}
        onToggleTheme={handleToggleTheme}
        onOpen={handleOpen}
        onSave={handleSave}
        hasChanges={hasChanges}
      />
      <div className="main-content">
        <SplitPane
          left={<EditorPanel code={code} onChange={setCode} isLight={isLight} />}
          right={<PreviewPanel code={code} isLight={isLight} />}
        />
      </div>
    </div>
  )
}
