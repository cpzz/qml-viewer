import React, { useState, useCallback } from 'react'
import { FolderSync, X, FileText, ChevronRight } from 'lucide-react'
import type { FileItem } from '../electron/fileOps'
import { useI18n } from '../i18n'

interface FileExplorerProps {
  items: FileItem[]
  onOpenFile: (filePath: string) => void
  onRemoveItem: (path: string) => void
  onReadDirectory?: (dirPath: string) => Promise<FileItem[]>
  activeFilePath?: string | null
}

function FileTreeItem({
  item,
  onOpenFile,
  onRemoveItem,
  onReadDirectory,
  activeFilePath,
}: {
  item: FileItem
  onOpenFile: (path: string) => void
  onRemoveItem: (path: string) => void
  onReadDirectory?: (dirPath: string) => Promise<FileItem[]>
  activeFilePath?: string | null
}) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)

  const loadChildren = useCallback(async () => {
    setLoading(true)
    try {
      let result: FileItem[] | undefined
      // 优先使用自定义读取函数（Web 端），否则使用 Electron API
      if (onReadDirectory) {
        result = await onReadDirectory(item.path)
      } else if (window.electronAPI?.readDirectory) {
        result = await window.electronAPI.readDirectory(item.path)
      }
      setChildren(result || [])
      setExpanded(true)
    } catch {
      setChildren([])
      setExpanded(true)
    }
    setLoading(false)
  }, [item.path, onReadDirectory])

  const handleToggle = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (item.type === 'directory') {
      if (expanded) {
        setExpanded(false)
      } else {
        await loadChildren()
      }
    }
  }

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await loadChildren()
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (item.type === 'directory') {
      handleToggle()
    } else {
      onOpenFile(item.path)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (item.type === 'file') {
      onOpenFile(item.path)
    }
  }

  // 移除子项：更新本地 children state，并通知父组件关闭相关标签页
  const handleRemoveChild = useCallback((childPath: string) => {
    const pathPrefix = childPath.endsWith('/') ? childPath : childPath + '/'
    // 从本地 children 中移除该项及其所有子项
    setChildren(prev => prev.filter(c => c.path !== childPath && !c.path.startsWith(pathPrefix)))
    // 通知父组件关闭相关标签页
    onRemoveItem(childPath)
  }, [onRemoveItem])

  return (
    <div>
      <div 
        className={`file-tree-item${item.path === activeFilePath ? ' active' : ''}`} 
        onDoubleClick={handleDoubleClick} 
        onClick={handleClick} 
        title={item.path}
      >
        <span className="file-tree-icon">
          {item.type === 'directory' ? (
            <span
              className={'file-tree-arrow' + (expanded ? ' expanded' : '')}
              onClick={handleToggle}
              style={{ cursor: 'pointer' }}
            >
              <ChevronRight size={14} />
            </span>
          ) : (
            <span className="file-tree-file-icon">
              <FileText size={14} />
            </span>
          )}
        </span>
        <span className="file-tree-name">{item.name}</span>
        {item.type === 'directory' && (
          <button
            className="file-tree-refresh"
            onClick={handleRefresh}
            title={t('fileExplorer.refresh')}
          >
            <FolderSync size={12} />
          </button>
        )}
        <button
          className="file-tree-remove"
          onClick={(e) => { e.stopPropagation(); onRemoveItem(item.path) }}
          title={t('fileExplorer.remove')}
        >
          <X size={12} />
        </button>
      </div>
      {item.type === 'directory' && expanded && (
        <div className="file-tree-children">
          {loading ? (
            <div className="file-tree-status">{t('fileExplorer.loading')}</div>
          ) : children.length > 0 ? (
            children.map((child) => (
              <FileTreeItem
                key={child.path}
                item={child}
                onOpenFile={onOpenFile}
                onRemoveItem={handleRemoveChild}
                onReadDirectory={onReadDirectory}
                activeFilePath={activeFilePath}
              />
            ))
          ) : (
            <div className="file-tree-status">{t('fileExplorer.emptyDirectory')}</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function FileExplorer({ items, onOpenFile, onRemoveItem, onReadDirectory, activeFilePath }: FileExplorerProps) {
  const { t } = useI18n()
  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <span className="file-explorer-title">{t('fileExplorer.files')}</span>
      </div>
      <div className="file-explorer-list">
        {items.length === 0 ? (
          <div className="file-explorer-empty">{t('fileExplorer.dropFiles')}</div>
        ) : (
          items.map((item) => (
            <FileTreeItem
              key={item.path}
              item={item}
              onOpenFile={onOpenFile}
              onRemoveItem={onRemoveItem}
              onReadDirectory={onReadDirectory}
              activeFilePath={activeFilePath}
            />
          ))
        )}
      </div>
    </div>
  )
}
