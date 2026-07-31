import type { QmlDocumentInstance } from './QmlDocument'
import { QmlObject } from './QmlObject'

export interface QmlInspectionNode {
  type: string
  id?: string
  properties: Record<string, unknown>
  children: QmlInspectionNode[]
}

export interface QmlInspectionSnapshot {
  objectCount: number
  roots: QmlInspectionNode[]
}

function inspectValue(value: unknown): unknown {
  if (value instanceof QmlObject) return `[${value.typeName}]`
  if (Array.isArray(value)) return value.map(inspectValue)
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : value.toISOString()
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value
  return undefined
}

export function inspectQmlDocument(document: QmlDocumentInstance): QmlInspectionSnapshot {
  const ids = new Map<QmlObject, string>()
  document.ids.forEach((object, id) => ids.set(object, id))
  let objectCount = 0

  const inspectObject = (object: QmlObject): QmlInspectionNode => {
    objectCount += 1
    const properties: Record<string, unknown> = {}
    object.getPropertyNames().forEach(name => {
      const value = inspectValue(object.getProperty(name))
      if (value !== undefined) properties[name] = value
    })
    return {
      type: object.typeName,
      ...(ids.has(object) ? { id: ids.get(object) } : {}),
      properties,
      children: object.children.map(inspectObject),
    }
  }

  const roots = document.roots.map(inspectObject)
  return { objectCount, roots }
}
