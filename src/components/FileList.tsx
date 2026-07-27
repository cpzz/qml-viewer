import React from 'react'
import { X } from 'lucide-react'

export interface FileTab {
  id: string
  name: string
  path: string | null
  content: string
  originalContent: string
  isNew?: boolean
}

interface FileListProps {
  files: FileTab[]
  activeId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

export default function FileList({ files, activeId, onSelect, onClose }: FileListProps) {
  return (
    <div className="file-list-scroll">
      {files.length === 0 ? (
        <div className="file-list-empty">No files opened</div>
      ) : (
        files.map((f) => (
          <div
            key={f.id}
            className={`file-list-item${f.id === activeId ? ' active' : ''}`}
            onClick={() => onSelect(f.id)}
            title={f.path || f.name}
          >
            <span className="file-list-item-name">{f.name}</span>
            <button
              className="file-list-item-close"
              onClick={(e) => { e.stopPropagation(); onClose(f.id) }}
              title="Close"
            >
              <X size={12} />
            </button>
          </div>
        ))
      )}
    </div>
  )
}
