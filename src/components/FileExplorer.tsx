import React, { useState } from 'react'
import type { FileItem } from '../electron/fileOps'

interface FileExplorerProps {
  items: FileItem[]
  onOpenFile: (filePath: string) => void
  onRemoveItem: (path: string) => void
}

function FileTreeItem({
  item,
  onOpenFile,
  onRemoveItem,
}: {
  item: FileItem
  onOpenFile: (path: string) => void
  onRemoveItem: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileItem[] | null>(null)
  const [loading, setLoading] = useState(false)

  const handleDoubleClick = async () => {
    if (item.type === 'directory') {
      if (children) {
        setExpanded(!expanded)
      } else {
        setLoading(true)
        try {
          const result = await window.electronAPI?.readDirectory(item.path)
          setChildren(result || [])
          setExpanded(true)
        } catch {
          setChildren([])
          setExpanded(true)
        }
        setLoading(false)
      }
    } else {
      onOpenFile(item.path)
    }
  }

  const handleClick = () => {
    if (item.type === 'file') {
      onOpenFile(item.path)
    }
  }

  return (
    <div>
      <div className="file-tree-item" onDoubleClick={handleDoubleClick} onClick={handleClick} title={item.path}>
        <span className="file-tree-icon">
          {item.type === 'directory' ? (
            <span className={'file-tree-arrow' + (expanded ? ' expanded' : '')}>&#9654;</span>
          ) : (
            <span className="file-tree-file-icon">&#128196;</span>
          )}
        </span>
        <span className="file-tree-name">{item.name}</span>
        <button
          className="file-tree-remove"
          onClick={(e) => { e.stopPropagation(); onRemoveItem(item.path) }}
          title="Remove"
        >
          &#10005;
        </button>
      </div>
      {item.type === 'directory' && expanded && (
        <div className="file-tree-children">
          {loading ? (
            <div className="file-tree-status">Loading...</div>
          ) : children && children.length > 0 ? (
            children.map((child) => (
              <FileTreeItem
                key={child.path}
                item={child}
                onOpenFile={onOpenFile}
                onRemoveItem={onRemoveItem}
              />
            ))
          ) : (
            <div className="file-tree-status">Empty directory</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function FileExplorer({ items, onOpenFile, onRemoveItem }: FileExplorerProps) {
  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <span className="file-explorer-title">FILES</span>
      </div>
      <div className="file-explorer-list">
        {items.length === 0 ? (
          <div className="file-explorer-empty">Drop files here</div>
        ) : (
          items.map((item) => (
            <FileTreeItem
              key={item.path}
              item={item}
              onOpenFile={onOpenFile}
              onRemoveItem={onRemoveItem}
            />
          ))
        )}
      </div>
    </div>
  )
}
