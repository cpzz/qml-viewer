import { useState, useRef, useEffect, useCallback } from 'react'

interface SplitPaneProps {
  left: React.ReactNode
  right: React.ReactNode
}

export default function SplitPane({ left, right }: SplitPaneProps) {
  const [leftWidth, setLeftWidth] = useState(400)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newWidth = e.clientX - rect.left
      const maxWidth = rect.width - 200
      setLeftWidth(Math.max(200, Math.min(maxWidth, newWidth)))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return (
    <div ref={containerRef} className={`split-pane${isDragging ? ' dragging' : ''}`}>
      <div className="left-pane" style={{ width: leftWidth }}>
        {left}
      </div>
      <div className="divider" onMouseDown={handleMouseDown}>
        <div className="divider-line" />
      </div>
      <div className="right-pane">{right}</div>
    </div>
  )
}
