export const qmlControlStyles = ['Fusion', 'Universal', 'Material'] as const

export type QmlControlStyle = typeof qmlControlStyles[number]

export function qmlControlStyleAttribute(style: QmlControlStyle): string {
  return style.toLowerCase()
}