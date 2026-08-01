/**
 * Qt QML `color` 值类型的解析与输出。
 *
 * Qt 官方格式（QColor::setNamedColor / QML color 值类型）：
 *  - 命名颜色（SVG color name）："red"、"lightsteelblue"、"transparent" 等
 *  - 十六进制："#RGB" / "#ARGB"（3/4 位短形式）、"#RRGGBB" / "#AARRGGBB"（6/8 位）
 *    注意 alpha 在最高位（AARRGGBB），与 CSS 的 RRGGBBAA 相反
 *  - Qt.rgba()/hsva()/hsla()/darker()/lighter()/tint() 等函数（见 QmlJsEngine）
 */

/** 内部统一表示：RGBA，各通道 0-255 */
export type QmlColorTuple = [number, number, number, number]

// SVG 命名颜色（Qt 的 SVG color reference）→ [r, g, b]；transparent → [0, 0, 0, 0]
const NAMED_COLORS: Record<string, number[]> = {
  aliceblue: [240, 248, 255], antiquewhite: [250, 235, 215], aqua: [0, 255, 255],
  aquamarine: [127, 255, 212], azure: [240, 255, 255], beige: [245, 245, 220],
  bisque: [255, 228, 196], black: [0, 0, 0], blanchedalmond: [255, 235, 205],
  blue: [0, 0, 255], blueviolet: [138, 43, 226], brown: [165, 42, 42],
  burlywood: [222, 184, 135], cadetblue: [95, 158, 160], chartreuse: [127, 255, 0],
  chocolate: [210, 105, 30], coral: [255, 127, 80], cornflowerblue: [100, 149, 237],
  cornsilk: [255, 248, 220], crimson: [220, 20, 60], cyan: [0, 255, 255],
  darkblue: [0, 0, 139], darkcyan: [0, 139, 139], darkgoldenrod: [184, 134, 11],
  darkgray: [169, 169, 169], darkgreen: [0, 100, 0], darkgrey: [169, 169, 169],
  darkkhaki: [189, 183, 107], darkmagenta: [139, 0, 139], darkolivegreen: [85, 107, 47],
  darkorange: [255, 140, 0], darkorchid: [153, 50, 204], darkred: [139, 0, 0],
  darksalmon: [233, 150, 122], darkseagreen: [143, 188, 143], darkslateblue: [72, 61, 139],
  darkslategray: [47, 79, 79], darkslategrey: [47, 79, 79], darkturquoise: [0, 206, 209],
  darkviolet: [148, 0, 211], deeppink: [255, 20, 147], deepskyblue: [0, 191, 255],
  dimgray: [105, 105, 105], dimgrey: [105, 105, 105], dodgerblue: [30, 144, 255],
  firebrick: [178, 34, 34], floralwhite: [255, 250, 240], forestgreen: [34, 139, 34],
  fuchsia: [255, 0, 255], gainsboro: [220, 220, 220], ghostwhite: [248, 248, 255],
  gold: [255, 215, 0], goldenrod: [218, 165, 32], gray: [128, 128, 128],
  green: [0, 128, 0], greenyellow: [173, 255, 47], grey: [128, 128, 128],
  honeydew: [240, 255, 240], hotpink: [255, 105, 180], indianred: [205, 92, 92],
  indigo: [75, 0, 130], ivory: [255, 255, 240], khaki: [240, 230, 140],
  lavender: [230, 230, 250], lavenderblush: [255, 240, 245], lawngreen: [124, 252, 0],
  lemonchiffon: [255, 250, 205], lightblue: [173, 216, 230], lightcoral: [240, 128, 128],
  lightcyan: [224, 255, 255], lightgoldenrodyellow: [250, 250, 210], lightgray: [211, 211, 211],
  lightgreen: [144, 238, 144], lightgrey: [211, 211, 211], lightpink: [255, 182, 193],
  lightsalmon: [255, 160, 122], lightseagreen: [32, 178, 170], lightskyblue: [135, 206, 250],
  lightslategray: [119, 136, 153], lightslategrey: [119, 136, 153], lightsteelblue: [176, 196, 222],
  lightyellow: [255, 255, 224], lime: [0, 255, 0], limegreen: [50, 205, 50],
  linen: [250, 240, 230], magenta: [255, 0, 255], maroon: [128, 0, 0],
  mediumaquamarine: [102, 205, 170], mediumblue: [0, 0, 205], mediumorchid: [186, 85, 211],
  mediumpurple: [147, 112, 219], mediumseagreen: [60, 179, 113], mediumslateblue: [123, 104, 238],
  mediumspringgreen: [0, 250, 154], mediumturquoise: [72, 209, 204], mediumvioletred: [199, 21, 133],
  midnightblue: [25, 25, 112], mintcream: [245, 255, 250], mistyrose: [255, 228, 225],
  moccasin: [255, 228, 181], navajowhite: [255, 222, 173], navy: [0, 0, 128],
  oldlace: [253, 245, 230], olive: [128, 128, 0], olivedrab: [107, 142, 35],
  orange: [255, 165, 0], orangered: [255, 69, 0], orchid: [218, 112, 214],
  palegoldenrod: [238, 232, 170], palegreen: [152, 251, 152], paleturquoise: [175, 238, 238],
  palevioletred: [219, 112, 147], papayawhip: [255, 239, 213], peachpuff: [255, 218, 185],
  peru: [205, 133, 63], pink: [255, 192, 203], plum: [221, 160, 221],
  powderblue: [176, 224, 230], purple: [128, 0, 128], rebeccapurple: [102, 51, 153],
  red: [255, 0, 0], rosybrown: [188, 143, 143], royalblue: [65, 105, 225],
  saddlebrown: [139, 69, 19], salmon: [250, 128, 114], sandybrown: [244, 164, 96],
  seagreen: [46, 139, 87], seashell: [255, 245, 238], sienna: [160, 82, 45],
  silver: [192, 192, 192], skyblue: [135, 206, 235], slateblue: [106, 90, 205],
  slategray: [112, 128, 144], slategrey: [112, 128, 144], snow: [255, 250, 250],
  springgreen: [0, 255, 127], steelblue: [70, 130, 180], tan: [210, 180, 140],
  teal: [0, 128, 128], thistle: [216, 191, 216], tomato: [255, 99, 71],
  transparent: [0, 0, 0, 0], turquoise: [64, 224, 208], violet: [238, 130, 238],
  wheat: [245, 222, 179], white: [255, 255, 255], whitesmoke: [245, 245, 245],
  yellow: [255, 255, 0], yellowgreen: [154, 205, 50],
}

/**
 * 解析 Qt QML 颜色值。
 * 支持 "#RGB" / "#ARGB" / "#RRGGBB" / "#AARRGGBB"（8 位时 alpha 在最高位）
 * 与 SVG 命名颜色。CSS 的 rgb()/rgba() 函数式字符串不是 QML 语法，返回 null。
 */
export function parseQmlColor(value: unknown): QmlColorTuple | null {
  const source = String(value).trim().toLowerCase()
  if (source.startsWith('#')) {
    let hex = source.slice(1)
    // #RGB → #RRGGBB、#ARGB → #AARRGGBB（Qt 短十六进制，alpha 前置）
    if (hex.length === 3 || hex.length === 4) {
      hex = [...hex].map(character => character + character).join('')
    }
    if (!/^[0-9a-f]{6,8}$/.test(hex)) return null
    const [first, second, third, fourth] = hex.match(/.{2}/g)!.map(component => parseInt(component, 16))
    if (fourth === undefined) return [first, second, third, 255] // #RRGGBB
    return [second, third, fourth, first] // #AARRGGBB
  }
  const named = NAMED_COLORS[source]
  if (!named) return null
  return named.length === 3 ? [named[0], named[1], named[2], 255] : [named[0], named[1], named[2], named[3]]
}

/** 输出 Qt 语义颜色字符串：#RRGGBB（不透明）或 #AARRGGBB（alpha 在最高位） */
export function toQmlColorString(color: QmlColorTuple): string {
  const hex = (value: number) => Math.round(value).toString(16).padStart(2, '0')
  const [r, g, b, a] = color
  return a >= 255
    ? `#${hex(r)}${hex(g)}${hex(b)}`
    : `#${hex(a)}${hex(r)}${hex(g)}${hex(b)}`
}

/** 输出浏览器可识别的 CSS 颜色：#RRGGBB 或 #RRGGBBAA（CSS 的 alpha 在末尾） */
export function toCssColor(color: QmlColorTuple): string {
  const hex = (value: number) => Math.round(value).toString(16).padStart(2, '0')
  const [r, g, b, a] = color
  return a >= 255
    ? `#${hex(r)}${hex(g)}${hex(b)}`
    : `#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`
}

/** Qt.hsva() 的 HSV → RGB（各分量 0-1） */
export function qmlHsvToRgb(hue: number, saturation: number, value: number): [number, number, number] {
  const h = ((hue % 1) + 1) % 1
  const section = Math.floor(h * 6)
  const fraction = h * 6 - section
  const p = value * (1 - saturation)
  const q = value * (1 - fraction * saturation)
  const t = value * (1 - (1 - fraction) * saturation)
  switch (section % 6) {
    case 0: return [value, t, p]
    case 1: return [q, value, p]
    case 2: return [p, value, t]
    case 3: return [p, q, value]
    case 4: return [t, p, value]
    default: return [value, p, q]
  }
}

/** Qt.hsla() 的 HSL → RGB（各分量 0-1） */
export function qmlHslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  if (saturation === 0) return [lightness, lightness, lightness]
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation
  const p = 2 * lightness - q
  const channel = (offset: number) => {
    const t = ((hue + offset) % 1 + 1) % 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [channel(1 / 3), channel(0), channel(-1 / 3)]
}
