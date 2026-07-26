/**
 * QML Layout Engine - Phase 1
 * Converts QML layout properties (anchors, x, y, width, height) to CSS
 */

import type { StyleMap } from './elements'

/**
 * Parse numeric value from string, returning raw number or null.
 */
function numVal(v: string | undefined): number | null {
  if (!v) return null
  const clean = v.replace(/px|pt|dp/gi, '').trim()
  const n = parseFloat(clean)
  return isNaN(n) ? null : n
}

function px(v: string | undefined): string | undefined {
  if (!v) return undefined
  const n = numVal(v)
  if (n === null) return undefined
  return `${n}px`
}

/**
 * Compute layout-related CSS styles from QML properties.
 * Handles: width, height, x, y, visible, opacity, anchors.*
 */
export function computeLayoutStyles(props: Record<string, string>): StyleMap {
  const styles: StyleMap = {}

  // --- Position: absolute when using anchors or x/y ---
  // Only positioning anchors (not margin-only properties) trigger absolute positioning
  const positioningAnchorKeys = ['anchors.fill', 'anchors.left', 'anchors.right', 'anchors.top', 'anchors.bottom', 'anchors.horizontalCenter', 'anchors.verticalCenter', 'anchors.centerIn']
  const hasAnchors = positioningAnchorKeys.some(k => props[k] !== undefined)
  const useAbsolute = hasAnchors || props.x !== undefined || props.y !== undefined

  if (useAbsolute) {
    styles['position'] = 'absolute'
  }

  // --- width / height ---
  // Map parent.width/parent.height to CSS 100%
  if (props.width === 'parent.width') {
    styles['width'] = '100%'
  } else {
    const w = px(props.width)
    if (w) styles['width'] = w
  }

  if (props.height === 'parent.height') {
    styles['height'] = '100%'
  } else {
    const h = px(props.height)
    if (h) styles['height'] = h
  }

  // --- Layout.fillWidth / Layout.fillHeight ---
  if (props['Layout.fillWidth'] === 'true') {
    styles['width'] = '100%'
    styles['flex'] = '1'
  }
  if (props['Layout.fillHeight'] === 'true') {
    styles['height'] = '100%'
    styles['flex'] = '1'
  }

  // --- x, y ---
  const x = px(props.x)
  const y = px(props.y)
  if (x) styles['left'] = x
  if (y) styles['top'] = y

  // --- anchors.fill: parent ---
  if (props['anchors.fill'] === 'parent') {
    styles['inset'] = '0'
  }

  // --- anchors.centerIn: parent ---
  if (props['anchors.centerIn'] === 'parent') {
    styles['left'] = '50%'
    styles['top'] = '50%'
    styles['transform'] = 'translate(-50%, -50%)'
  }

  // --- anchors.left / right / top / bottom ---
  const leftRef = props['anchors.left']
  const rightRef = props['anchors.right']
  const topRef = props['anchors.top']
  const bottomRef = props['anchors.bottom']
  const hCenterRef = props['anchors.horizontalCenter']
  const vCenterRef = props['anchors.verticalCenter']

  // anchors.left: parent.left → left: 0
  // anchors.left: parent.right → left: 100%
  if (leftRef) {
    styles['left'] = leftRef === 'parent.right' ? '100%' : '0'
  }
  if (rightRef) {
    styles['right'] = rightRef === 'parent.right' ? '0' : '100%'
  }
  if (topRef) {
    styles['top'] = topRef === 'parent.bottom' ? '100%' : '0'
  }
  if (bottomRef) {
    styles['bottom'] = bottomRef === 'parent.bottom' ? '0' : '100%'
  }

  // anchors.horizontalCenter: parent.horizontalCenter → left: 50%
  if (hCenterRef) {
    styles['left'] = '50%'
    styles['transform'] = styles['transform'] 
      ? `${styles['transform']} translateX(-50%)` 
      : 'translateX(-50%)'
  }

  // anchors.verticalCenter: parent.verticalCenter → top: 50%
  if (vCenterRef) {
    styles['top'] = '50%'
    styles['transform'] = styles['transform']
      ? `${styles['transform']} translateY(-50%)`
      : 'translateY(-50%)'
  }

  // --- anchors.margins ---
  const margins = px(props['anchors.margins'])
  if (margins && hasAnchors) {
    // Only apply if not overridden by specific margin
    if (!props['anchors.leftMargin'] && leftRef) styles['left'] = margins
    if (!props['anchors.rightMargin'] && rightRef) styles['right'] = margins
    if (!props['anchors.topMargin'] && topRef) styles['top'] = margins
    if (!props['anchors.bottomMargin'] && bottomRef) styles['bottom'] = margins
    // For anchors.fill
    if (props['anchors.fill'] === 'parent') {
      styles['inset'] = margins
    }
  }

  // Specific margin overrides
  const lm = px(props['anchors.leftMargin'])
  const rm = px(props['anchors.rightMargin'])
  const tm = px(props['anchors.topMargin'])
  const bm = px(props['anchors.bottomMargin'])
  if (lm) styles['left'] = lm
  if (rm) styles['right'] = rm
  if (tm) styles['top'] = tm
  if (bm) styles['bottom'] = bm

  // --- visible ---
  if (props['visible'] === 'false') {
    styles['display'] = 'none'
  }

  // --- opacity ---
  const opacity = numVal(props['opacity'])
  if (opacity !== null && opacity >= 0 && opacity <= 1) {
    styles['opacity'] = String(opacity)
  }

  return styles
}
