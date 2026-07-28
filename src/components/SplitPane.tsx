import { useState, useRef, useEffect, useCallback } from 'react'

interface SplitPaneProps {
  left: React.ReactNode
  right: React.ReactNode
  showLeft: boolean
  showRight: boolean
}

export default function SplitPane({ left, right, showLeft, showRight }: SplitPaneProps) {
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
      if ((e.buttons & 1) === 0) {
        setIsDragging(false)
        return
      }
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newWidth = e.clientX - rect.left
      const maxWidth = rect.width - 200
      setLeftWidth(Math.max(200, Math.min(maxWidth, newWidth)))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    const handleWindowBlur = () => {
      setIsDragging(false)
    }

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
  }, [isDragging])

  return (
    <div ref={containerRef} className={`split-pane${isDragging ? ' dragging' : ''}`}>
      <div className="left-pane" hidden={!showLeft} style={showRight ? { width: leftWidth } : { width: '100%', flex: '1 1 auto' }}>
        {left}
      </div>
      {showLeft && showRight && (
        <div className="divider" onMouseDown={handleMouseDown}>
          <div className="divider-line" />
        </div>
      )}
      <div className="right-pane" hidden={!showRight} style={showLeft ? undefined : { flex: '1 1 auto', width: '100%', minWidth: 0 }}>{right}</div>
    </div>
  )
}
