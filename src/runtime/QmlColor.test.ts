import { describe, expect, it } from 'vitest'
import {
  parseQmlColor,
  qmlHslToRgb,
  qmlHsvToRgb,
  toCssColor,
  toQmlColorString,
} from './QmlColor'

describe('parseQmlColor', () => {
  it('parses Qt ARGB hex formats with alpha in the highest byte', () => {
    expect(parseQmlColor('#ff0000')).toEqual([255, 0, 0, 255]) // #RRGGBB
    expect(parseQmlColor('#80FF0000')).toEqual([255, 0, 0, 128]) // #AARRGGBB
    expect(parseQmlColor('#f00')).toEqual([255, 0, 0, 255]) // 短 #RGB
    expect(parseQmlColor('#8f00')).toEqual([255, 0, 0, 136]) // 短 #ARGB
  })

  it('parses named colors case-insensitively', () => {
    expect(parseQmlColor('red')).toEqual([255, 0, 0, 255])
    expect(parseQmlColor('GREEN')).toEqual([0, 128, 0, 255])
    expect(parseQmlColor('transparent')).toEqual([0, 0, 0, 0])
  })

  it('returns null for non-QML color values', () => {
    expect(parseQmlColor('')).toBeNull()
    expect(parseQmlColor('#12345')).toBeNull()
    expect(parseQmlColor('notacolor')).toBeNull()
    expect(parseQmlColor('rgb(255,0,0)')).toBeNull() // CSS 函数式不是 QML 语法
  })
})

describe('color output', () => {
  it('emits Qt strings with alpha in front', () => {
    expect(toQmlColorString([255, 0, 0, 255])).toBe('#ff0000')
    expect(toQmlColorString([255, 0, 0, 128])).toBe('#80ff0000')
  })

  it('emits browser CSS strings with alpha in the back', () => {
    expect(toCssColor([255, 0, 0, 255])).toBe('#ff0000')
    expect(toCssColor([255, 0, 0, 128])).toBe('#ff000080')
  })
})

describe('Qt color conversions', () => {
  it('converts HSV to RGB', () => {
    expect(qmlHsvToRgb(0, 1, 1)).toEqual([1, 0, 0]) // 红
    expect(qmlHsvToRgb(1 / 3, 1, 1)).toEqual([0, 1, 0]) // 绿
    expect(qmlHsvToRgb(0, 0, 1)).toEqual([1, 1, 1]) // 白
  })

  it('converts HSL to RGB', () => {
    expect(qmlHslToRgb(0, 1, 0.5)).toEqual([1, 0, 0]) // 红
    expect(qmlHslToRgb(0, 0, 0.5)).toEqual([0.5, 0.5, 0.5]) // 灰
    expect(qmlHslToRgb(1 / 3, 1, 0.5)).toEqual([0, 1, 0]) // 绿
  })
})
