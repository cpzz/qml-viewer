import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import Toolbar from './components/Toolbar'
import SplitPane from './components/SplitPane'
import PreviewPanel from './components/PreviewPanel'
import FileExplorer from './components/FileExplorer'
import EditorPanel from './components/EditorPanel'
import { Trash2 } from 'lucide-react'
import { useI18n } from './i18n'
import type { FileTab } from './components/FileList'
import type { FileItem } from '../electron/fileOps'
import type { QmlControlStyle } from './runtime/QmlControlStyle'

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
      qmlReadText: (filePath: string) => Promise<string | undefined>
      qmlWriteText: (filePath: string, content: string) => Promise<void>
      qmlFetchText: (url: string) => Promise<{ status: number; headers: Record<string, string>; body: string }>
      qmlClipboardRead: () => Promise<string>
      qmlClipboardWrite: (text: string) => Promise<void>
      onFilesDropped: (callback: (paths: string[]) => void) => void
    }
  }
}

interface PreviewLogEntry {
  id: string
  level: 'log' | 'info' | 'warn' | 'error'
  message: string
  timestamp: number
}

function formatLogTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

let _tabId = 1
function nextId(): string { return 'tab-' + (_tabId++) }

export default function App() {
  const { t } = useI18n()
  const [files, setFiles] = useState<FileTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isLight, setIsLight] = useState(false)
  const [qmlControlStyle, setQmlControlStyle] = useState<QmlControlStyle>(() => {
    const storedStyle = window.localStorage.getItem('qml-control-style')
    return storedStyle === 'Universal' || storedStyle === 'Material' ? storedStyle : 'Fusion'
  })
  const [showFileList, setShowFileList] = useState(true)
  const [showEditor, setShowEditor] = useState(true)
  const [showPreview, setShowPreview] = useState(true)
  const [showLogPanel, setShowLogPanel] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [logPanelHeight, setLogPanelHeight] = useState(180)
  const [isDraggingLogDivider, setIsDraggingLogDivider] = useState(false)
  const [fileListWidth, setFileListWidth] = useState(200)
  const [isDraggingFL, setIsDraggingFL] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [editorRevision, setEditorRevision] = useState(0)
  const [previewLogs, setPreviewLogs] = useState<PreviewLogEntry[]>([])
  const previewStackRef = useRef<HTMLDivElement>(null)
  const logListRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<any>(null)
  const [fileItems, setFileItems] = useState<FileItem[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const filesRef = useRef(files)
  const browserFileStoreRef = useRef<Map<string, string>>(new Map())
  const browserFileHandleRef = useRef<Map<string, any>>(new Map())
  const browserDirectoryHandlesRef = useRef<any[]>([])
  const browserDirectoryHandleMapRef = useRef<Map<string, any>>(new Map())
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

  useEffect(() => {
    if (!isDraggingLogDivider) return
    const handleMouseMove = (event: MouseEvent) => {
      if ((event.buttons & 1) === 0) {
        setIsDraggingLogDivider(false)
        return
      }
      const container = previewStackRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const minMainHeight = 120
      const minLogHeight = 80
      const nextLogHeight = rect.bottom - event.clientY
      const maxLogHeight = Math.max(minLogHeight, rect.height - minMainHeight)
      setLogPanelHeight(Math.max(minLogHeight, Math.min(maxLogHeight, nextLogHeight)))
    }
    const handleMouseUp = () => setIsDraggingLogDivider(false)
    const handleWindowBlur = () => setIsDraggingLogDivider(false)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mouseup', handleMouseUp, true)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mouseup', handleMouseUp, true)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [isDraggingLogDivider])

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
          // 添加目录项本身，而不是递归遍历文件
          const dirPath = `web:/${handle.name || 'directory'}`
          // 存储目录 handle 以便后续展开时读取
          browserDirectoryHandleMapRef.current.set(dirPath, handle)
          loadedItems.push({
            name: handle.name || 'directory',
            path: dirPath,
            type: 'directory',
          })
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

      // 分离目录和文件
      const dirItems = results.filter(item => item.type === 'directory')
      const qmlItems = results.filter(item => item.type === 'file' && item.name.toLowerCase().endsWith('.qml'))

      // 添加目录项
      if (dirItems.length > 0) {
        addFileItems(dirItems)
      }

      // 添加文件项
      if (qmlItems.length > 0) {
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
      }
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

    // 返回目录项本身，让用户可以展开查看
    const dirPath = `web:/${root.name || 'directory'}`
    // 存储目录 handle 以便后续展开时读取
    browserDirectoryHandleMapRef.current.set(dirPath, root)

    return [{ name: root.name || 'directory', path: dirPath, type: 'directory' as const }]
  }, [hasMatchingDirectoryHandle])

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
      // 只有顶层路径（web:/name.qml）才加入全局文件树；
      // 目录内文件（路径含 /）由目录展开时动态加载，加入会导致顶层出现重复同名项
      if (!pathToSave.slice('web:/'.length).includes('/')) {
        addFileItems([{ name: handle.name || tab.name, path: pathToSave, type: 'file' }])
      }
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
    // 删除目录时，需要删除所有子路径
    const pathPrefix = path.endsWith('/') ? path : path + '/'
    const isDirectory = fileItems.some(i => i.path === path && i.type === 'directory')

    // 收集所有需要删除的路径（包括 fileItems 中的项和子项路径）
    const pathsToRemove = isDirectory
      ? fileItems.filter(i => i.path === path || i.path.startsWith(pathPrefix)).map(i => i.path)
      : [path]

    // 始终包含被删除的路径本身（子项路径可能不在 fileItems 中）
    if (!pathsToRemove.includes(path)) {
      pathsToRemove.push(path)
    }

    // 如果是目录，先从映射中获取 handle，再从 browserDirectoryHandlesRef 中移除
    if (isDirectory) {
      const dirHandle = browserDirectoryHandleMapRef.current.get(path)
      if (dirHandle) {
        browserDirectoryHandlesRef.current = browserDirectoryHandlesRef.current.filter(
          (h: any) => h !== dirHandle
        )
      }
    }

    // 删除浏览器文件存储和目录 handle 映射（包括所有子路径）
    for (const p of pathsToRemove) {
      browserFileStoreRef.current.delete(p)
      browserFileHandleRef.current.delete(p)
      browserDirectoryHandleMapRef.current.delete(p)
    }

    // 清理所有以 pathPrefix 开头的子路径数据
    if (isDirectory) {
      // 清理 browserFileStoreRef
      for (const key of Array.from(browserFileStoreRef.current.keys())) {
        if (key.startsWith(pathPrefix)) {
          browserFileStoreRef.current.delete(key)
        }
      }
      // 清理 browserFileHandleRef
      for (const key of Array.from(browserFileHandleRef.current.keys())) {
        if (key.startsWith(pathPrefix)) {
          browserFileHandleRef.current.delete(key)
        }
      }
      // 清理 browserDirectoryHandleMapRef
      for (const key of Array.from(browserDirectoryHandleMapRef.current.keys())) {
        if (key.startsWith(pathPrefix)) {
          browserDirectoryHandleMapRef.current.delete(key)
        }
      }
    }

    // 删除标签页文件句柄
    for (const file of filesRef.current) {
      if (file.path && pathsToRemove.some(p => file.path === p || file.path.startsWith(pathPrefix))) {
        tabFileHandleRef.current.delete(file.id)
      }
    }

    // 更新文件列表
    setFileItems(prev => prev.filter(i => !pathsToRemove.includes(i.path)))

    // 更新标签页：关闭所有路径匹配的标签页
    setFiles(prev => {
      const toClose = prev.filter(f => f.path && pathsToRemove.some(p => f.path === p || f.path!.startsWith(pathPrefix)))
      if (toClose.length > 0) {
        const next = prev.filter(f => !f.path || (!pathsToRemove.some(p => f.path === p) && !f.path.startsWith(pathPrefix)))
        // 如果当前活动标签页被关闭，切换到其他标签页
        if (toClose.some(f => f.id === activeId)) {
          if (next.length > 0) {
            setTimeout(() => setActiveId(next[0].id), 0)
          } else {
            setTimeout(() => setActiveId(null), 0)
          }
        }
        return next
      }
      return prev
    })
  }, [activeId, fileItems])

  const handleReadDirectory = useCallback(async (dirPath: string): Promise<FileItem[]> => {
    // Electron 环境：使用 IPC 读取目录
    if (window.electronAPI?.readDirectory) {
      return await window.electronAPI.readDirectory(dirPath)
    }

    // Web 环境：通过 directory handle 读取
    const dirHandle = browserDirectoryHandleMapRef.current.get(dirPath)
    if (!dirHandle) return []

    const results: FileItem[] = []
    for await (const entry of (dirHandle as any).values()) {
      if (entry.kind === 'directory') {
        const childPath = `${dirPath}/${entry.name}`
        // 存储子目录 handle 以便后续展开
        browserDirectoryHandleMapRef.current.set(childPath, entry)
        results.push({
          name: entry.name,
          path: childPath,
          type: 'directory',
        })
      } else if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.qml')) {
        const childPath = `${dirPath}/${entry.name}`
        // 读取文件内容并缓存
        const file = await entry.getFile()
        const content = await file.text()
        browserFileStoreRef.current.set(childPath, content)
        browserFileHandleRef.current.set(childPath, entry)
        results.push({
          name: entry.name,
          path: childPath,
          type: 'file',
        })
      }
    }
    return results
  }, [])

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

    // 添加目录项本身
    const dirItems = results.filter(item => item.type === 'directory')
    if (dirItems.length > 0) {
      addFileItems(dirItems)
    }

    // 同时添加根目录下的 .qml 文件
    const qmlFiles = results.filter(item => item.type === 'file' && item.name.toLowerCase().endsWith('.qml'))
    if (qmlFiles.length > 0) {
      addFileItems(qmlFiles)
      await openPathInTab(qmlFiles[0].path)
    } else if (dirItems.length > 0) {
      // 如果没有文件，不需要自动打开任何标签页
    }
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
      let reopenedPath = activeTab.path
      let webHandle: any = null
      if (window.electronAPI?.readFileByPath && activeTab.path) {
        const result = await window.electronAPI.readFileByPath(activeTab.path)
        refreshedContent = result?.content ?? null
        reopenedPath = result?.filePath ?? activeTab.path
      } else {
        webHandle = tabFileHandleRef.current.get(activeTab.id) ||
          (activeTab.path ? browserFileHandleRef.current.get(activeTab.path) : null)
        if (webHandle) {
          const file = await webHandle.getFile()
          refreshedContent = await file.text()
        }
      }

      if (refreshedContent == null) {
        window.alert(t('alerts.refreshFailed'))
        return
      }

      if (reopenedPath) {
        browserFileStoreRef.current.set(reopenedPath, refreshedContent)
      }
      const reopenedTab: FileTab = {
        ...activeTab,
        id: nextId(),
        name: reopenedPath?.split(/[\\/]/).pop() || activeTab.name,
        path: reopenedPath,
        content: refreshedContent,
        originalContent: refreshedContent,
        isNew: false,
      }
      tabFileHandleRef.current.delete(activeTab.id)
      if (webHandle) tabFileHandleRef.current.set(reopenedTab.id, webHandle)
      setFiles((prev) => prev.map((file) => file.id === activeTab.id ? reopenedTab : file))
      setActiveId(reopenedTab.id)
      setEditorRevision((revision) => revision + 1)
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

  const handleToggleLogPanel = useCallback(() => {
    setShowLogPanel((prev) => !prev)
  }, [])

  const handleFormat = useCallback(() => {
    editorRef.current?.format()
  }, [])

  const handleClearPreviewLogs = useCallback(() => {
    setPreviewLogs([])
  }, [])

  const handleLogDividerMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    setIsDraggingLogDivider(true)
  }, [])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || data.type !== 'qml-preview-log') return
      const level = data.level === 'info' || data.level === 'warn' || data.level === 'error' ? data.level : 'log'
      const args = Array.isArray(data.args) ? data.args : [String(data.args ?? '')]
      const message = args.map((part) => String(part)).join(' ')
      const entry: PreviewLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        level,
        message,
        timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
      }
      setPreviewLogs((current) => {
        const next = [...current, entry]
        return next.length > 200 ? next.slice(next.length - 200) : next
      })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    setPreviewLogs([])
  }, [activeId])

  // Auto-scroll the log list to the latest entry
  useEffect(() => {
    const el = logListRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [previewLogs])

  useEffect(() => {
    document.documentElement.classList.toggle('light', isLight)
  }, [isLight])

  useEffect(() => {
    window.localStorage.setItem('qml-control-style', qmlControlStyle)
  }, [qmlControlStyle])

  return (
    <div className="app-container">
      <Toolbar
        isLight={isLight}
        onToggleTheme={handleToggleTheme}
        qmlControlStyle={qmlControlStyle}
        onQmlControlStyleChange={setQmlControlStyle}
        onNew={handleNew}
        onOpenFiles={handleOpenFiles}
        onOpenDirectory={handleOpenDirectory}
        onSave={handleSave}
        onRefresh={handleRefresh}
        onFormat={handleFormat}
        hasChanges={hasChanges}
        canRefresh={canRefresh}
        showFileList={showFileList}
        onToggleFileList={handleToggleFileList}
        showEditor={showEditor}
        onToggleEditor={handleToggleEditor}
        showPreview={showPreview}
        onTogglePreview={handleTogglePreview}
        showLogPanel={showLogPanel}
        onToggleLogPanel={handleToggleLogPanel}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen(!inspectorOpen)}
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
                onReadDirectory={handleReadDirectory}
                activeFilePath={activeTab?.path}
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
              <EditorPanel ref={editorRef} key={editorRevision} code={code} onChange={handleCodeChange} isLight={isLight} readOnly={!activeTab} />
            </Suspense>
          }
          right={(
            <div ref={previewStackRef} className={`preview-stack${isDraggingLogDivider ? ' preview-stack-dragging' : ''}`}>
              <div className="preview-stack-main">
                <PreviewPanel code={code} isLight={isLight} qmlControlStyle={qmlControlStyle} filePath={activeTab?.path} inspectorOpen={inspectorOpen} onToggleInspector={() => setInspectorOpen(!inspectorOpen)} />
              </div>
              {showLogPanel && (
                <>
                  <div className="preview-log-divider" onMouseDown={handleLogDividerMouseDown}>
                    <div className="preview-log-divider-line" />
                  </div>
                  <div className="preview-log-panel" style={{ height: logPanelHeight }}>
                    <div className="preview-log-toolbar">
                      <button
                        className="preview-log-clear"
                        type="button"
                        title={t('toolbar.clearLogs')}
                        aria-label={t('toolbar.clearLogs')}
                        disabled={previewLogs.length === 0}
                        onClick={handleClearPreviewLogs}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="preview-log-list" ref={logListRef}>
                      {previewLogs.length === 0 ? (
                        <div className="preview-log-empty">{t('logPanel.empty')}</div>
                      ) : previewLogs.map((entry) => {
                        const time = formatLogTimestamp(entry.timestamp)
                        return (
                          <div key={entry.id} className={`preview-log-item preview-log-item-${entry.level}`}>
                            <span className="preview-log-time">[{time}]</span>
                            <span className="preview-log-level">[{entry.level.toUpperCase()}]</span>
                            <span className="preview-log-message">{entry.message}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        />
      </div>
    </div>
  )
}
