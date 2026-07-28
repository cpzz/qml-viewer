import React, { useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react'
import Toolbar from './components/Toolbar'
import SplitPane from './components/SplitPane'
import PreviewPanel from './components/PreviewPanel'
import FileExplorer from './components/FileExplorer'
import { useI18n } from './i18n'
import type { FileTab } from './components/FileList'
import type { FileItem } from '../electron/fileOps'

const NEW_FILE_CONTENT = ''

declare global {
  interface Window {
    electronAPI?: {
      newFile: () => Promise<{ content: string; filePath: string } | null>
      openFile: () => Promise<{ content: string; filePath: string } | null>
      openFiles: () => Promise<Array<{ content: string; filePath: string }>
      >
      openDirectory: () => Promise<Array<{ name: string; path: string; type: 'file' | 'directory' }>>
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

const EditorPanel = lazy(() => import('./components/EditorPanel'))

export default function App() {
  const { t } = useI18n()
  const [files, setFiles] = useState<FileTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isLight, setIsLight] = useState(false)
  const [showFileList, setShowFileList] = useState(true)
  const [showEditor, setShowEditor] = useState(true)
  const [showPreview, setShowPreview] = useState(true)
  const [fileListWidth, setFileListWidth] = useState(200)
  const [isDraggingFL, setIsDraggingFL] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [fileItems, setFileItems] = useState<FileItem[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const filesRef = useRef(files)
  const browserFileStoreRef = useRef<Map<string, string>>(new Map())
  const browserFileHandleRef = useRef<Map<string, any>>(new Map())
  const browserDirectoryHandlesRef = useRef<any[]>([])
  const tabFileHandleRef = useRef<Map<string, any>>(new Map())
  filesRef.current = files

  const activeTab = files.find((f) => f.id === activeId) ?? null
  const code = activeTab?.content ?? NEW_FILE_CONTENT
  const initialCode = activeTab?.originalContent ?? NEW_FILE_CONTENT
  const hasChanges = code !== initialCode
  const hasRefreshSource = !!activeTab && (
    (!!window.electronAPI?.readFileByPath && !!activeTab.path) ||
    tabFileHandleRef.current.has(activeTab.id) ||
    (!!activeTab.path && browserFileHandleRef.current.has(activeTab.path))
  )
  const canRefresh = hasChanges && hasRefreshSource && !isRefreshing

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

  // --- File tree callbacks ---

  const addFileItems = useCallback((itemsToAdd: FileItem[]) => {
    setFileItems(prev => {
      const existing = new Set(prev.map(i => i.path))
      const uniqueItems = itemsToAdd.filter((item) => {
        if (existing.has(item.path)) return false
        existing.add(item.path)
        return true
      })
      if (uniqueItems.length === 0) return prev
      return [...prev, ...uniqueItems]
    })
  }, [])

  const findMatchingHandlePath = useCallback(async (handle: any): Promise<string | null> => {
    for (const [path, existingHandle] of browserFileHandleRef.current) {
      if (handle === existingHandle) return path
      if (typeof handle?.isSameEntry !== 'function') continue
      try {
        if (await handle.isSameEntry(existingHandle)) return path
      } catch {
        // Ignore stale or revoked handles and continue checking.
      }
    }
    return null
  }, [])

  const hasMatchingDirectoryHandle = useCallback(async (handle: any): Promise<boolean> => {
    for (const existingHandle of browserDirectoryHandlesRef.current) {
      if (handle === existingHandle) return true
      if (typeof handle?.isSameEntry !== 'function') continue
      try {
        if (await handle.isSameEntry(existingHandle)) return true
      } catch {
        // Ignore stale or revoked handles and continue checking.
      }
    }
    return false
  }, [])

  // --- Drag and drop files (window-level) ---

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault()

      if (window.electronAPI?.onFilesDropped) {
        return
      }

      const dataItems = Array.from(e.dataTransfer?.items || [])
      const fsItems = dataItems.filter(item => item.kind === 'file' && typeof (item as any).getAsFileSystemHandle === 'function')
      if (fsItems.length === 0) {
        window.alert(t('alerts.unsupportedOpenFiles'))
        return
      }

      const existingPaths = new Set<string>([
        ...Array.from(browserFileStoreRef.current.keys()),
        ...filesRef.current.map(f => f.path).filter((p): p is string => !!p),
      ])

      const getUniquePath = (basePath: string) => {
        if (!existingPaths.has(basePath)) {
          existingPaths.add(basePath)
          return basePath
        }
        const dotIndex = basePath.lastIndexOf('.')
        const base = dotIndex > 0 ? basePath.slice(0, dotIndex) : basePath
        const ext = dotIndex > 0 ? basePath.slice(dotIndex) : ''
        let idx = 1
        let candidate = `${base} (${idx})${ext}`
        while (existingPaths.has(candidate)) {
          idx += 1
          candidate = `${base} (${idx})${ext}`
        }
        existingPaths.add(candidate)
        return candidate
      }

      const loadedItems: FileItem[] = []

      const loadFileHandle = async (fileHandle: any, preferredPath?: string) => {
        if (await findMatchingHandlePath(fileHandle)) return
        const file = await fileHandle.getFile()
        if (!file.name.toLowerCase().endsWith('.qml')) return
        const path = getUniquePath(preferredPath || `web:/${file.name}`)
        const content = await file.text()
        browserFileStoreRef.current.set(path, content)
        browserFileHandleRef.current.set(path, fileHandle)
        loadedItems.push({
          name: path.split(/[\\/]/).pop() || file.name,
          path,
          type: 'file',
        })
      }

      const walkDir = async (dirHandle: any, prefix: string) => {
        for await (const entry of dirHandle.values()) {
          const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name
          if (entry.kind === 'directory') {
            await walkDir(entry, nextPrefix)
            continue
          }
          if (entry.kind === 'file') {
            await loadFileHandle(entry, `web:/${nextPrefix}`)
          }
        }
      }

      for (const item of fsItems) {
        let handle: any = null
        try {
          handle = await (item as any).getAsFileSystemHandle()
        } catch {
          handle = null
        }
        if (!handle) continue
        if (handle.kind === 'directory') {
          if (await hasMatchingDirectoryHandle(handle)) continue
          browserDirectoryHandlesRef.current.push(handle)
          await walkDir(handle, handle.name || '')
        } else if (handle.kind === 'file') {
          await loadFileHandle(handle)
        }
      }

      if (loadedItems.length === 0) return

      addFileItems(loadedItems)
      const firstPath = loadedItems[0].path
      const currentFiles = filesRef.current
      const existing = currentFiles.find(f => f.path === firstPath)
      if (existing) {
        setActiveId(existing.id)
        return
      }
      const content = browserFileStoreRef.current.get(firstPath)
      if (content == null) return
      const tab: FileTab = {
        id: 'tab-' + (_tabId++),
        name: firstPath.split(/[\\/]/).pop() || 'unknown.qml',
        path: firstPath,
        content,
        originalContent: content,
      }
      const webHandle = browserFileHandleRef.current.get(firstPath)
      if (webHandle) {
        tabFileHandleRef.current.set(tab.id, webHandle)
      }
      setFiles(prev => [...prev, tab])
      setActiveId(tab.id)
    }

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
  }, [addFileItems, findMatchingHandlePath, hasMatchingDirectoryHandle, t])

  // --- 监听 preload 通过 IPC 发送的拖拽路径 ---
  useEffect(() => {
    if (!window.electronAPI?.onFilesDropped) return
    window.electronAPI.onFilesDropped(async (paths) => {
      const results = await window.electronAPI!.statBatch(paths)
      const qmlItems = results.filter(item => item.type === 'file' && item.name.toLowerCase().endsWith('.qml'))
      if (qmlItems.length === 0) return

      addFileItems(qmlItems)

      const first = qmlItems[0]
      const currentFiles = filesRef.current
      const existing = currentFiles.find(f => f.path === first.path)
      if (existing) {
        setActiveId(existing.id)
        return
      }

      const content = await window.electronAPI!.readFileByPath(first.path)
      if (!content) return
      const tab: FileTab = {
        id: 'tab-' + (_tabId++),
        name: first.name,
        path: first.path,
        content: content.content,
        originalContent: content.content,
      }
      setFiles(prev => [...prev, tab])
      setActiveId(tab.id)
    })
  }, [addFileItems])

  const getUniqueWebPath = useCallback((basePath: string) => {
    const existingPaths = new Set([
      ...fileItems.map(i => i.path),
      ...browserFileStoreRef.current.keys(),
    ])
    if (!existingPaths.has(basePath)) return basePath
    const dotIndex = basePath.lastIndexOf('.')
    const base = dotIndex > 0 ? basePath.slice(0, dotIndex) : basePath
    const ext = dotIndex > 0 ? basePath.slice(dotIndex) : ''
    let idx = 1
    let candidate = `${base} (${idx})${ext}`
    while (existingPaths.has(candidate)) {
      idx += 1
      candidate = `${base} (${idx})${ext}`
    }
    return candidate
  }, [fileItems])

  const loadWebFileHandle = useCallback(async (handle: any, preferredPath?: string) => {
    if (await findMatchingHandlePath(handle)) return null
    const file = await handle.getFile()
    if (!file.name.toLowerCase().endsWith('.qml')) return null
    const content = await file.text()
    const basePath = preferredPath || `web:/${file.name}`
    const filePath = getUniqueWebPath(basePath)
    browserFileStoreRef.current.set(filePath, content)
    browserFileHandleRef.current.set(filePath, handle)
    return { filePath, content }
  }, [findMatchingHandlePath, getUniqueWebPath])

  const openWebFilesWithHandles = useCallback(async () => {
    const picker = (window as any).showOpenFilePicker
    if (!picker) {
      window.alert(t('alerts.unsupportedOpenFiles'))
      return [] as Array<{ filePath: string; content: string }>
    }
    const handles: any[] = await picker({
      multiple: true,
      types: [{ description: 'QML Files', accept: { 'text/plain': ['.qml'] } }],
      excludeAcceptAllOption: true,
    })
    const loaded: Array<{ filePath: string; content: string }> = []
    for (const handle of handles) {
      const item = await loadWebFileHandle(handle)
      if (item) loaded.push(item)
    }
    return loaded
  }, [loadWebFileHandle])

  const openWebDirectoryWithHandles = useCallback(async () => {
    const picker = (window as any).showDirectoryPicker
    if (!picker) {
      window.alert(t('alerts.unsupportedOpenDirectory'))
      return [] as Array<{ name: string; path: string; type: 'file' | 'directory' }>
    }

    const root = await picker()
    if (await hasMatchingDirectoryHandle(root)) return []
    browserDirectoryHandlesRef.current.push(root)
    const results: Array<{ name: string; path: string; type: 'file' | 'directory' }> = []

    const walk = async (dirHandle: any, prefix: string) => {
      for await (const entry of dirHandle.values()) {
        const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.kind === 'directory') {
          await walk(entry, nextPrefix)
          continue
        }
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.qml')) {
          const loaded = await loadWebFileHandle(entry, `web:/${nextPrefix}`)
          if (loaded) {
            results.push({
              name: loaded.filePath.split(/[\\/]/).pop() || entry.name,
              path: loaded.filePath,
              type: 'file',
            })
          }
        }
      }
    }

    await walk(root, '')
    return results
  }, [hasMatchingDirectoryHandle, loadWebFileHandle])

  const saveTab = useCallback(async (tab: FileTab): Promise<boolean> => {
    if (!window.electronAPI?.saveFile) {
      const savePicker = (window as any).showSaveFilePicker
      if (!savePicker) {
        window.alert(t('alerts.unsupportedSaveFile'))
        return false
      }

      let pathToSave = tab.path || `web:/${tab.name}`
      let handle = tabFileHandleRef.current.get(tab.id) || (pathToSave ? browserFileHandleRef.current.get(pathToSave) : null)
      if (!handle) {
        handle = await savePicker({
          suggestedName: tab.name.toLowerCase().endsWith('.qml') ? tab.name : `${tab.name}.qml`,
          types: [{ description: 'QML Files', accept: { 'text/plain': ['.qml'] } }],
          excludeAcceptAllOption: true,
        })
        const selectedName = handle?.name || tab.name
        pathToSave = pathToSave.startsWith('web:/') ? pathToSave : `web:/${selectedName}`
      }

      browserFileHandleRef.current.set(pathToSave, handle)
      tabFileHandleRef.current.set(tab.id, handle)

      const writable = await handle.createWritable()
      await writable.write(tab.content)
      await writable.close()

      setFiles((prev) =>
        prev.map((f) =>
          f.id === tab.id
            ? { ...f, path: pathToSave, name: handle.name || f.name, originalContent: f.content, isNew: false }
            : f
        )
      )
      browserFileStoreRef.current.set(pathToSave, tab.content)
      addFileItems([{ name: handle.name || tab.name, path: pathToSave, type: 'file' }])
      return true
    }

    const savedPath = await window.electronAPI.saveFile(tab.content, tab.path)
    if (!savedPath) return false

    setFiles((prev) =>
      prev.map((f) =>
        f.id === tab.id
          ? { ...f, path: savedPath, originalContent: f.content, name: savedPath.split(/[\\/]/).pop() || f.name, isNew: false }
          : f
      )
    )
    return true
  }, [addFileItems])

  const ensureCurrentSavedBeforeSwitch = useCallback(async (nextFilePath: string): Promise<boolean> => {
    const current = filesRef.current.find(f => f.id === activeId)
    if (!current) return true
    if (current.path === nextFilePath) return true

    const hasUnsaved = current.content !== current.originalContent
    if (!hasUnsaved) return true

    const shouldSave = window.confirm('当前文件有未保存内容，是否先保存再切换？')
    if (!shouldSave) return true

    return await saveTab(current)
  }, [activeId, saveTab])

  const openPathInTab = useCallback(async (filePath: string) => {
    const existing = filesRef.current.find(f => f.path === filePath)
    if (existing) {
      setActiveId(existing.id)
      return
    }
    let contentText: string | null = null
    if (window.electronAPI?.readFileByPath) {
      const content = await window.electronAPI.readFileByPath(filePath)
      contentText = content?.content ?? null
    } else {
      contentText = browserFileStoreRef.current.get(filePath) ?? null
    }
    if (contentText === null) return
    const tab: FileTab = {
      id: 'tab-' + (_tabId++),
      name: filePath.split(/[\\/]/).pop() || 'unknown.qml',
      path: filePath,
      content: contentText,
      originalContent: contentText,
    }
    const webHandle = browserFileHandleRef.current.get(filePath)
    if (webHandle) {
      tabFileHandleRef.current.set(tab.id, webHandle)
    }
    setFiles(prev => [...prev, tab])
    setActiveId(tab.id)
  }, [])

  const handleOpenFileFromExplorer = useCallback(async (filePath: string) => {
    const canSwitch = await ensureCurrentSavedBeforeSwitch(filePath)
    if (!canSwitch) return
    await openPathInTab(filePath)
  }, [ensureCurrentSavedBeforeSwitch, openPathInTab])

  const handleRemoveFileItem = useCallback((path: string) => {
    browserFileStoreRef.current.delete(path)
    browserFileHandleRef.current.delete(path)
    for (const file of filesRef.current) {
      if (file.path === path) {
        tabFileHandleRef.current.delete(file.id)
      }
    }
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
    if (!window.electronAPI?.newFile) {
      const savePicker = (window as any).showSaveFilePicker
      if (!savePicker) {
        window.alert(t('alerts.unsupportedSaveFile'))
        return
      }

      let handle: any
      try {
        handle = await savePicker({
          suggestedName: 'untitled.qml',
          types: [{ description: 'QML Files', accept: { 'text/plain': ['.qml'] } }],
          excludeAcceptAllOption: true,
        })
      } catch {
        return
      }

      const webPath = getUniqueWebPath(`web:/${handle.name || 'untitled.qml'}`)
      browserFileStoreRef.current.set(webPath, NEW_FILE_CONTENT)
      browserFileHandleRef.current.set(webPath, handle)

      const tab: FileTab = {
        id: 'tab-' + (_tabId++),
        name: handle.name || 'untitled.qml',
        path: webPath,
        content: NEW_FILE_CONTENT,
        originalContent: NEW_FILE_CONTENT,
        isNew: true,
      }
      tabFileHandleRef.current.set(tab.id, handle)
      setFiles((prev) => [...prev, tab])
      setActiveId(tab.id)
      addFileItems([{ name: tab.name, path: webPath, type: 'file' }])

      try {
        const writable = await handle.createWritable()
        await writable.write(NEW_FILE_CONTENT)
        await writable.close()
        setFiles((prev) =>
          prev.map((f) =>
            f.id === tab.id ? { ...f, originalContent: NEW_FILE_CONTENT, isNew: false } : f
          )
        )
      } catch {
        window.alert(t('alerts.createFileFailed'))
      }
      return
    }

    const result = await window.electronAPI.newFile()
    if (!result) return
    const tab: FileTab = {
      id: 'tab-' + (_tabId++),
      name: result.filePath.split(/[\\/]/).pop() || 'untitled.qml',
      path: result.filePath,
      content: result.content,
      originalContent: result.content,
      isNew: false,
    }
    setFiles((prev) => [...prev, tab])
    setActiveId(tab.id)
    if (tab.path) {
      addFileItems([{ name: tab.name, path: tab.path, type: 'file' }])
    }
  }, [addFileItems])

  const handleOpenFiles = useCallback(async () => {
    let results: Array<{ content: string; filePath: string }> = []
    if (window.electronAPI?.openFiles) {
      results = await window.electronAPI.openFiles()
    } else {
      results = await openWebFilesWithHandles()
    }
    if (!results || results.length === 0) return

    addFileItems(results.map((item) => ({
      name: item.filePath.split(/[\\/]/).pop() || 'unknown.qml',
      path: item.filePath,
      type: 'file',
    })))

    await openPathInTab(results[0].filePath)
  }, [addFileItems, openPathInTab, openWebFilesWithHandles])

  const handleOpenDirectory = useCallback(async () => {
    let results: Array<{ name: string; path: string; type: 'file' | 'directory' }> = []
    if (window.electronAPI?.openDirectory) {
      results = await window.electronAPI.openDirectory()
    } else {
      results = await openWebDirectoryWithHandles()
    }
    if (!results || results.length === 0) return

    const qmlFiles = results.filter(item => item.type === 'file' && item.name.toLowerCase().endsWith('.qml'))
    if (qmlFiles.length === 0) return

    addFileItems(qmlFiles)
    await openPathInTab(qmlFiles[0].path)
  }, [addFileItems, openPathInTab, openWebDirectoryWithHandles])

  const handleSave = useCallback(async () => {
    if (!activeTab) return
    await saveTab(activeTab)
  }, [activeTab, saveTab])

  const handleRefresh = useCallback(async () => {
    if (!activeTab || !hasChanges || !hasRefreshSource || isRefreshing) return
    if (!window.confirm(t('alerts.confirmRefresh'))) return

    setIsRefreshing(true)
    try {
      let refreshedContent: string | null = null
      if (window.electronAPI?.readFileByPath && activeTab.path) {
        const result = await window.electronAPI.readFileByPath(activeTab.path)
        refreshedContent = result?.content ?? null
      } else {
        const handle = tabFileHandleRef.current.get(activeTab.id) ||
          (activeTab.path ? browserFileHandleRef.current.get(activeTab.path) : null)
        if (handle) {
          const file = await handle.getFile()
          refreshedContent = await file.text()
        }
      }

      if (refreshedContent == null) {
        window.alert(t('alerts.refreshFailed'))
        return
      }

      if (activeTab.path) {
        browserFileStoreRef.current.set(activeTab.path, refreshedContent)
      }
      setFiles((prev) => prev.map((file) =>
        file.id === activeTab.id
          ? { ...file, content: refreshedContent, originalContent: refreshedContent }
          : file
      ))
    } catch {
      window.alert(t('alerts.refreshFailed'))
    } finally {
      setIsRefreshing(false)
    }
  }, [activeTab, hasChanges, hasRefreshSource, isRefreshing, t])

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

  const handleToggleEditor = useCallback(() => {
    setShowEditor((prev) => !prev)
  }, [])

  const handleTogglePreview = useCallback(() => {
    setShowPreview((prev) => !prev)
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
        onOpenFiles={handleOpenFiles}
        onOpenDirectory={handleOpenDirectory}
        onSave={handleSave}
        onRefresh={handleRefresh}
        hasChanges={hasChanges}
        canRefresh={canRefresh}
        showFileList={showFileList}
        onToggleFileList={handleToggleFileList}
        showEditor={showEditor}
        onToggleEditor={handleToggleEditor}
        showPreview={showPreview}
        onTogglePreview={handleTogglePreview}
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
          showLeft={showEditor}
          showRight={showPreview}
          left={
            <Suspense fallback={<div className="editor-panel"><div className="editor-container" /></div>}>
              <EditorPanel code={code} onChange={handleCodeChange} isLight={isLight} readOnly={!activeTab} />
            </Suspense>
          }
          right={<PreviewPanel code={code} isLight={isLight} />}
        />
      </div>
    </div>
  )
}
