import React, { useState, useCallback, useEffect, useRef } from 'react'
import Toolbar from './components/Toolbar'
import SplitPane from './components/SplitPane'
import EditorPanel from './components/EditorPanel'
import PreviewPanel from './components/PreviewPanel'
import FileExplorer from './components/FileExplorer'
import type { FileTab } from './components/FileList'
import type { FileItem } from '../electron/fileOps'
import exampleQml from './example.qml?raw'

const DEFAULT_CODE = exampleQml

declare global {
  interface Window {
    electronAPI?: {
      newFile: () => Promise<{ content: string; filePath: string } | null>
      openFile: () => Promise<{ content: string; filePath: string } | null>
      saveFile: (content: string, filePath?: string | null) => Promise<string | null>
      readFileByPath: (filePath: string) => Promise<{ content: string; filePath: string } | null>
      readDirectory: (dirPath: string) => Promise<Array<{ name: string; path: string; type: 'file' | 'directory' }>>
      statBatch: (paths: string[]) => Promise<Array<{ path: string; name: string; type: 'file' | 'directory' }>>
      onFilesDropped: (callback: (paths: string[]) => void) => void
    }
  }
}

let _tabId = 1
function nextId(): string { return 'tab-' + (_tabId++) }

export default function App() {
  const [files, setFiles] = useState<FileTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isLight, setIsLight] = useState(false)
  const [showFileList, setShowFileList] = useState(true)
  const [fileListWidth, setFileListWidth] = useState(200)
  const [isDraggingFL, setIsDraggingFL] = useState(false)
  const [fileItems, setFileItems] = useState<FileItem[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const filesRef = useRef(files)
  filesRef.current = files
  const initializedRef = useRef(false)

  // Create default untitled tab on first mount
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    const tab: FileTab = {
      id: nextId(),
      name: 'untitled.qml',
      path: null,
      content: DEFAULT_CODE,
      originalContent: DEFAULT_CODE,
    }
    setFiles([tab])
    setActiveId(tab.id)
  }, [])

  const activeTab = files.find((f) => f.id === activeId) ?? null
  const code = activeTab?.content ?? DEFAULT_CODE
  const initialCode = activeTab?.originalContent ?? DEFAULT_CODE
  const currentFilePath = activeTab?.path ?? null
  const hasChanges = code !== initialCode

  // --- File list drag resize ---

  const handleFLMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingFL(true)
  }, [])

  useEffect(() => {
    if (!isDraggingFL) return
    const handleMouseMove = (e: MouseEvent) => {
      setFileListWidth(Math.max(120, Math.min(500, e.clientX)))
    }
    const handleMouseUp = () => setIsDraggingFL(false)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingFL])

  // --- Drag and drop files (window-level) ---

  useEffect(() => {
    console.log('[drag] effect mounted, electronAPI:', !!window.electronAPI, 'statBatch:', typeof window.electronAPI?.statBatch)

    const handleDragOver = (e: DragEvent) => {
      console.log('[drag] dragover event')
      e.preventDefault()
    }

    const handleDrop = async (e: DragEvent) => {
      console.log('[drag] drop event fired!')
      e.preventDefault()
      const paths: string[] = []
      const fileList: Array<{ file: File; name: string }> = []

      if (e.dataTransfer?.files) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const f = e.dataTransfer.files[i]
          const p = (f as any).path
          console.log('[drag] dropped file:', f.name, 'path:', p, 'size:', f.size)
          if (p) {
            paths.push(p)
          } else {
            // Electron v43+ contextIsolation 下 File.path 不可用，直接读取内容
            if (f.name.toLowerCase().endsWith('.qml')) {
              fileList.push({ file: f, name: f.name })
            }
          }
        }
      }
      console.log('[drag] extracted paths:', paths, 'fileList:', fileList.length)

      // 处理有真实路径的文件（旧方式兼容）
      if (paths.length > 0 && window.electronAPI?.statBatch) {
        const results = await window.electronAPI.statBatch(paths)
        console.log('[drag] statBatch results:', JSON.stringify(results))
        setFileItems(prev => {
          const existing = new Set(prev.map(i => i.path))
          const toAdd = results.filter(i => !existing.has(i.path))
          return [...prev, ...toAdd]
        })
        if (results.length === 1 && results[0].type === 'file') {
          const single = results[0]
          const currentFiles = filesRef.current
          const content = await window.electronAPI.readFileByPath(single.path)
          if (content) {
            const existing = currentFiles.find(f => f.path === single.path)
            if (existing) {
              setActiveId(existing.id)
            } else {
              const tab: FileTab = {
                id: 'tab-' + (_tabId++),
                name: single.name,
                path: single.path,
                content: content.content,
                originalContent: content.content,
              }
              setFiles(prev => [...prev, tab])
              setActiveId(tab.id)
            }
          }
        }
      }

      // 处理无路径的文件（直接从 renderer 读取内容）
      for (const entry of fileList) {
        const content = await entry.file.text()
        const virtualPath = 'dropped:' + entry.name
        setFileItems(prev => {
          if (prev.some(i => i.path === virtualPath)) return prev
          return [...prev, { path: virtualPath, name: entry.name, type: 'file' }]
        })
        const currentFiles = filesRef.current
        const existing = currentFiles.find(f => f.path === virtualPath)
        if (!existing) {
          const tab: FileTab = {
            id: 'tab-' + (_tabId++),
            name: entry.name,
            path: virtualPath,
            content,
            originalContent: content,
          }
          setFiles(prev => [...prev, tab])
          setActiveId(tab.id)
        }
      }
    }

    // 使用 capture phase 确保在 Electron 默认行为之前截获
    window.addEventListener('dragover', handleDragOver, true)
    window.addEventListener('drop', handleDrop, true)
    document.addEventListener('dragover', handleDragOver, true)
    document.addEventListener('drop', handleDrop, true)
    return () => {
      window.removeEventListener('dragover', handleDragOver, true)
      window.removeEventListener('drop', handleDrop, true)
      document.removeEventListener('dragover', handleDragOver, true)
      document.removeEventListener('drop', handleDrop, true)
    }
  }, [])

  // --- 监听 preload 通过 IPC 发送的拖拽路径 ---
  useEffect(() => {
    if (!window.electronAPI?.onFilesDropped) return
    window.electronAPI.onFilesDropped(async (paths) => {
      console.log('[App] onFilesDropped received:', paths)
      const results = await window.electronAPI!.statBatch(paths)
      console.log('[App] statBatch results:', JSON.stringify(results))
      setFileItems(prev => {
        const existing = new Set(prev.map(i => i.path))
        const toAdd = results.filter(i => !existing.has(i.path))
        return [...prev, ...toAdd]
      })
      if (results.length === 1 && results[0].type === 'file') {
        const single = results[0]
        const currentFiles = filesRef.current
        const content = await window.electronAPI!.readFileByPath(single.path)
        if (content) {
          const existing = currentFiles.find(f => f.path === single.path)
          if (existing) {
            setActiveId(existing.id)
          } else {
            const tab: FileTab = {
              id: 'tab-' + (_tabId++),
              name: single.name,
              path: single.path,
              content: content.content,
              originalContent: content.content,
            }
            setFiles(prev => [...prev, tab])
            setActiveId(tab.id)
          }
        }
      }
    })
  }, [])

  // --- File tree callbacks ---

  const handleOpenFileFromExplorer = useCallback(async (filePath: string) => {
    const existing = files.find(f => f.path === filePath)
    if (existing) {
      setActiveId(existing.id)
      return
    }
    const content = await window.electronAPI?.readFileByPath(filePath)
    if (!content) return
    const tab: FileTab = {
      id: 'tab-' + (_tabId++),
      name: filePath.split(/[\\/]/).pop() || 'unknown.qml',
      path: filePath,
      content: content.content,
      originalContent: content.content,
    }
    setFiles(prev => [...prev, tab])
    setActiveId(tab.id)
  }, [files])

  const handleRemoveFileItem = useCallback((path: string) => {
    setFileItems(prev => prev.filter(i => i.path !== path))
    setFiles(prev => {
      const toClose = prev.find(f => f.path === path)
      if (toClose) {
        const idx = prev.indexOf(toClose)
        const next = prev.filter(f => f.path !== path)
        if (toClose.id === activeId) {
          if (next.length > 0) {
            const newIdx = Math.min(idx, next.length - 1)
            setTimeout(() => setActiveId(next[newIdx].id), 0)
          } else {
            setTimeout(() => setActiveId(null), 0)
          }
        }
        return next
      }
      return prev
    })
  }, [activeId])

  // --- File operations ---

  const handleNew = useCallback(async () => {
    const result = await window.electronAPI?.newFile()
    if (!result) return
    const tab: FileTab = {
      id: 'tab-' + (_tabId++),
      name: result.filePath.split(/[\\/]/).pop() || 'untitled.qml',
      path: result.filePath,
      content: result.content,
      originalContent: result.content,
    }
    setFiles((prev) => [...prev, tab])
    setActiveId(tab.id)
  }, [])

  const handleOpen = useCallback(async () => {
    const result = await window.electronAPI?.openFile()
    if (!result) return
    const existing = files.find((f) => f.path === result.filePath)
    if (existing) {
      setActiveId(existing.id)
      return
    }
    const tab: FileTab = {
      id: 'tab-' + (_tabId++),
      name: result.filePath.split(/[\\/]/).pop() || 'unknown.qml',
      path: result.filePath,
      content: result.content,
      originalContent: result.content,
    }
    setFiles((prev) => [...prev, tab])
    setActiveId(tab.id)
  }, [files])

  const handleSave = useCallback(async () => {
    if (!activeTab) return
    const savedPath = await window.electronAPI?.saveFile(activeTab.content, currentFilePath)
    if (savedPath) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === activeTab.id
            ? { ...f, path: savedPath, originalContent: f.content, name: savedPath.split(/[\\/]/).pop() || f.name }
            : f
        )
      )
    }
  }, [activeTab, currentFilePath])

  const handleCodeChange = useCallback((newCode: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === activeId ? { ...f, content: newCode } : f))
    )
  }, [activeId])

  const handleToggleTheme = useCallback(() => {
    setIsLight((prev) => !prev)
  }, [])

  const handleToggleFileList = useCallback(() => {
    setShowFileList((prev) => !prev)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('light', isLight)
  }, [isLight])

  return (
    <div className="app-container">
      <Toolbar
        isLight={isLight}
        onToggleTheme={handleToggleTheme}
        onNew={handleNew}
        onOpen={handleOpen}
        onSave={handleSave}
        hasChanges={hasChanges}
        showFileList={showFileList}
        onToggleFileList={handleToggleFileList}
      />
      <div
        ref={containerRef}
        className={'main-content-with-filelist' + (isDraggingFL ? ' dragging-fl' : '')}
      >
        {showFileList && (
          <>
            <div className="file-list-panel" style={{ width: fileListWidth }}>
              <FileExplorer
                items={fileItems}
                onOpenFile={handleOpenFileFromExplorer}
                onRemoveItem={handleRemoveFileItem}
              />
            </div>
            <div className="divider divider-fl" onMouseDown={handleFLMouseDown}>
              <div className="divider-line" />
            </div>
          </>
        )}
        <SplitPane
          left={<EditorPanel code={code} onChange={handleCodeChange} isLight={isLight} />}
          right={<PreviewPanel code={code} isLight={isLight} />}
        />
      </div>
    </div>
  )
}
