import { QmlObject } from './QmlObject'

export interface QmlPoint { x: number; y: number }
export interface QmlRect extends QmlPoint { width: number; height: number }

type Matrix = [number, number, number, number, number, number]

const identity: Matrix = [1, 0, 0, 1, 0, 0]

function multiply(left: Matrix, right: Matrix): Matrix {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ]
}

function inverse(matrix: Matrix): Matrix | null {
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2]
  if (Math.abs(determinant) < Number.EPSILON) return null
  return [
    matrix[3] / determinant,
    -matrix[1] / determinant,
    -matrix[2] / determinant,
    matrix[0] / determinant,
    (matrix[2] * matrix[5] - matrix[3] * matrix[4]) / determinant,
    (matrix[1] * matrix[4] - matrix[0] * matrix[5]) / determinant,
  ]
}

function apply(matrix: Matrix, point: QmlPoint): QmlPoint {
  return {
    x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
    y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
  }
}

function transformOrigin(item: QmlObject): QmlPoint {
  const width = Number(item.getProperty('width')) || 0
  const height = Number(item.getProperty('height')) || 0
  const value = item.getProperty('transformOrigin')
  const origins: Record<string, QmlPoint> = {
    '0': { x: 0, y: 0 }, TopLeft: { x: 0, y: 0 }, 'Item.TopLeft': { x: 0, y: 0 },
    '1': { x: width / 2, y: 0 }, Top: { x: width / 2, y: 0 }, 'Item.Top': { x: width / 2, y: 0 },
    '2': { x: width, y: 0 }, TopRight: { x: width, y: 0 }, 'Item.TopRight': { x: width, y: 0 },
    '3': { x: 0, y: height / 2 }, Left: { x: 0, y: height / 2 }, 'Item.Left': { x: 0, y: height / 2 },
    '4': { x: width / 2, y: height / 2 }, Center: { x: width / 2, y: height / 2 }, 'Item.Center': { x: width / 2, y: height / 2 },
    '5': { x: width, y: height / 2 }, Right: { x: width, y: height / 2 }, 'Item.Right': { x: width, y: height / 2 },
    '6': { x: 0, y: height }, BottomLeft: { x: 0, y: height }, 'Item.BottomLeft': { x: 0, y: height },
    '7': { x: width / 2, y: height }, Bottom: { x: width / 2, y: height }, 'Item.Bottom': { x: width / 2, y: height },
    '8': { x: width, y: height }, BottomRight: { x: width, y: height }, 'Item.BottomRight': { x: width, y: height },
  }
  return origins[String(value)] ?? origins['Item.Center']
}

function localMatrix(item: QmlObject): Matrix {
  const x = Number(item.getProperty('x')) || 0
  const y = Number(item.getProperty('y')) || 0
  const scale = Number(item.getProperty('scale'))
  const angle = (Number(item.getProperty('rotation')) || 0) * Math.PI / 180
  const cosine = Math.cos(angle) * scale
  const sine = Math.sin(angle) * scale
  const origin = transformOrigin(item)
  let matrix: Matrix = [
    cosine,
    sine,
    -sine,
    cosine,
    x + origin.x - cosine * origin.x + sine * origin.y,
    y + origin.y - sine * origin.x - cosine * origin.y,
  ]
  const value = item.getProperty('transform')
  const transforms = Array.isArray(value) ? value : value instanceof QmlObject ? [value] : []
  transforms.filter((transform): transform is QmlObject => transform instanceof QmlObject)
    .forEach(transform => { matrix = multiply(matrix, transformMatrix(transform)) })
  return matrix
}

function transformMatrix(transform: QmlObject): Matrix {
  if (transform.typeName === 'Translate') {
    return [1, 0, 0, 1, Number(transform.getProperty('x')) || 0, Number(transform.getProperty('y')) || 0]
  }
  const originX = Number(transform.getProperty('origin.x')) || 0
  const originY = Number(transform.getProperty('origin.y')) || 0
  if (transform.typeName === 'Scale') {
    const xScale = Number(transform.getProperty('xScale'))
    const yScale = Number(transform.getProperty('yScale'))
    return [xScale, 0, 0, yScale, originX - xScale * originX, originY - yScale * originY]
  }
  if (transform.typeName === 'Rotation') {
    const angle = (Number(transform.getProperty('angle')) || 0) * Math.PI / 180
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    return [
      cosine, sine, -sine, cosine,
      originX - cosine * originX + sine * originY,
      originY - sine * originX - cosine * originY,
    ]
  }
  return identity
}

function worldMatrix(item: QmlObject | null): Matrix {
  if (!item) return identity
  return multiply(worldMatrix(item.parent), localMatrix(item))
}

function mapping(from: QmlObject | null, to: QmlObject | null): Matrix | null {
  const toInverse = inverse(worldMatrix(to))
  return toInverse ? multiply(toInverse, worldMatrix(from)) : null
}

function valuePoint(value: unknown, y?: unknown): QmlPoint {
  if (typeof value === 'object' && value !== null) {
    const point = value as Partial<QmlPoint>
    return { x: Number(point.x) || 0, y: Number(point.y) || 0 }
  }
  return { x: Number(value) || 0, y: Number(y) || 0 }
}

function mappedValue(matrix: Matrix | null, value: unknown, y?: unknown, width?: unknown, height?: unknown): QmlPoint | QmlRect {
  if (!matrix) return { x: 0, y: 0 }
  const point = valuePoint(value, y)
  const source = typeof value === 'object' && value !== null ? value as Partial<QmlRect> : null
  const rectWidth = source?.width ?? width
  const rectHeight = source?.height ?? height
  if (rectWidth === undefined || rectHeight === undefined) return apply(matrix, point)
  const corners = [
    point,
    { x: point.x + Number(rectWidth), y: point.y },
    { x: point.x, y: point.y + Number(rectHeight) },
    { x: point.x + Number(rectWidth), y: point.y + Number(rectHeight) },
  ].map(corner => apply(matrix, corner))
  const left = Math.min(...corners.map(corner => corner.x))
  const top = Math.min(...corners.map(corner => corner.y))
  const right = Math.max(...corners.map(corner => corner.x))
  const bottom = Math.max(...corners.map(corner => corner.y))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function mapToItem(item: QmlObject, target: QmlObject | null, value: unknown, y?: unknown, width?: unknown, height?: unknown): QmlPoint | QmlRect {
  return mappedValue(mapping(item, target), value, y, width, height)
}

export function mapFromItem(item: QmlObject, source: QmlObject | null, value: unknown, y?: unknown, width?: unknown, height?: unknown): QmlPoint | QmlRect {
  return mappedValue(mapping(source, item), value, y, width, height)
}

export function contains(item: QmlObject, value: unknown, y?: unknown): boolean {
  const point = valuePoint(value, y)
  const mask = item.getProperty('containmentMask')
  if (mask instanceof QmlObject && mask.hasMethod('contains')) return Boolean(mask.callMethod('contains', point))
  const width = Number(item.getProperty('width')) || 0
  const height = Number(item.getProperty('height')) || 0
  return point.x >= 0 && point.y >= 0 && point.x <= width && point.y <= height
}

export function childAt(item: QmlObject, x: unknown, y: unknown): QmlObject | null {
  return item.children
    .filter(child => child.hasProperty('visible') && child.getProperty('visible'))
    .map((child, index) => ({ child, index, z: Number(child.getProperty('z')) || 0 }))
    .sort((left, right) => right.z - left.z || right.index - left.index)
    .find(({ child }) => contains(child, mapFromItem(child, item, x, y)))?.child ?? null
}

export function cssTransformOrigin(item: QmlObject): string {
  const origin = transformOrigin(item)
  return `${origin.x}px ${origin.y}px`
}

export function cssItemTransform(item: QmlObject): string {
  const transforms = item.getProperty('transform')
  const values = (Array.isArray(transforms) ? transforms : transforms instanceof QmlObject ? [transforms] : [])
    .filter((transform): transform is QmlObject => transform instanceof QmlObject)
    .map(transform => {
      if (transform.typeName === 'Translate') {
        return `translate(${Number(transform.getProperty('x')) || 0}px, ${Number(transform.getProperty('y')) || 0}px)`
      }
      const originX = Number(transform.getProperty('origin.x')) || 0
      const originY = Number(transform.getProperty('origin.y')) || 0
      if (transform.typeName === 'Scale') {
        return `translate(${originX}px, ${originY}px) scale(${Number(transform.getProperty('xScale'))}, ${Number(transform.getProperty('yScale'))}) translate(${-originX}px, ${-originY}px)`
      }
      if (transform.typeName === 'Rotation') {
        return `translate(${originX}px, ${originY}px) rotate(${Number(transform.getProperty('angle')) || 0}deg) translate(${-originX}px, ${-originY}px)`
      }
      return ''
    }).filter(Boolean)
  return [`rotate(${Number(item.getProperty('rotation')) || 0}deg)`, `scale(${Number(item.getProperty('scale'))})`, ...values].join(' ')
}
