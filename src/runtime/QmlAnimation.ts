import { parseQmlColor, toQmlColorString, type QmlColorTuple } from './QmlColor'
import { QmlObject } from './QmlObject'

export interface QmlAnimationScheduler {
  now(): number
  request(callback: (timestamp: number) => void): number
  cancel(handle: number): void
}

export interface QmlAnimation {
  start(): Promise<void>
  stop(): void
}

export type QmlEasingFunction = (progress: number) => number

const pi = Math.PI

/** Qt OutIn 组合：前一半用 out，后一半用 in */
function outIn(out: QmlEasingFunction, easeIn: QmlEasingFunction): QmlEasingFunction {
  return progress => progress < 0.5
    ? 0.5 * out(2 * progress)
    : 0.5 * easeIn(2 * progress - 1) + 0.5
}

function easeOutElastic(t: number): number {
  const p = 0.3
  return 2 ** (-10 * t) * Math.sin((t - p / 4) * (2 * pi) / p) + 1
}

function easeOutBounce(t: number): number {
  if (t < 1 / 2.75) return 7.5625 * t * t
  if (t < 2 / 2.75) {
    const y = t - 1.5 / 2.75
    return 7.5625 * y * y + 0.75
  }
  if (t < 2.5 / 2.75) {
    const y = t - 2.25 / 2.75
    return 7.5625 * y * y + 0.9375
  }
  const y = t - 2.625 / 2.75
  return 7.5625 * y * y + 0.984375
}

export const QmlEasing = {
  Linear: (progress: number) => progress,
  InQuad: (progress: number) => progress * progress,
  OutQuad: (progress: number) => 1 - (1 - progress) * (1 - progress),
  InOutQuad: (progress: number) => progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2,
  OutInQuad: outIn(p => 1 - (1 - p) * (1 - p), p => p * p),
  InCubic: (progress: number) => progress ** 3,
  OutCubic: (progress: number) => 1 - (1 - progress) ** 3,
  InOutCubic: (progress: number) => progress < 0.5
    ? 4 * progress ** 3
    : 1 - Math.pow(-2 * progress + 2, 3) / 2,
  OutInCubic: outIn(p => 1 - (1 - p) ** 3, p => p ** 3),
  InQuart: (progress: number) => progress ** 4,
  OutQuart: (progress: number) => 1 - (1 - progress) ** 4,
  InOutQuart: (progress: number) => progress < 0.5
    ? 8 * progress ** 4
    : 1 - Math.pow(-2 * progress + 2, 4) / 2,
  OutInQuart: outIn(p => 1 - (1 - p) ** 4, p => p ** 4),
  InQuint: (progress: number) => progress ** 5,
  OutQuint: (progress: number) => 1 - (1 - progress) ** 5,
  InOutQuint: (progress: number) => progress < 0.5
    ? 16 * progress ** 5
    : 1 - Math.pow(-2 * progress + 2, 5) / 2,
  OutInQuint: outIn(p => 1 - (1 - p) ** 5, p => p ** 5),
  InSine: (progress: number) => 1 - Math.cos(progress * pi / 2),
  OutSine: (progress: number) => Math.sin(progress * pi / 2),
  InOutSine: (progress: number) => -(Math.cos(pi * progress) - 1) / 2,
  OutInSine: outIn(p => Math.sin(p * pi / 2), p => 1 - Math.cos(p * pi / 2)),
  InExpo: (progress: number) => progress === 0 ? 0 : 2 ** (10 * progress - 10),
  OutExpo: (progress: number) => progress === 1 ? 1 : 1 - 2 ** (-10 * progress),
  InOutExpo: (progress: number) => progress === 0
    ? 0
    : progress === 1
      ? 1
      : progress < 0.5
        ? 2 ** (20 * progress - 10) / 2
        : (2 - 2 ** (-20 * progress + 10)) / 2,
  OutInExpo: outIn(p => p === 1 ? 1 : 1 - 2 ** (-10 * p), p => p === 0 ? 0 : 2 ** (10 * p - 10)),
  InCirc: (progress: number) => 1 - Math.sqrt(1 - progress * progress),
  OutCirc: (progress: number) => Math.sqrt(1 - (progress - 1) ** 2),
  InOutCirc: (progress: number) => progress < 0.5
    ? (1 - Math.sqrt(1 - 4 * progress * progress)) / 2
    : (Math.sqrt(1 - Math.pow(-2 * progress + 2, 2)) + 1) / 2,
  OutInCirc: outIn(p => Math.sqrt(1 - (p - 1) ** 2), p => 1 - Math.sqrt(1 - p * p)),
  InElastic: (progress: number) => {
    const p = 0.3
    return 2 ** (10 * (progress - 1)) * Math.sin((progress - 1 - p / 4) * (2 * pi) / p)
  },
  OutElastic: easeOutElastic,
  InOutElastic: (progress: number) => {
    const p = 0.45
    if (progress < 0.5) {
      return 0.5 * 2 ** (10 * (2 * progress - 1)) * Math.sin((2 * progress - 1 - p / 4) * (2 * pi) / p)
    }
    return 0.5 * 2 ** (-10 * (2 * progress - 1)) * Math.sin((2 * progress - 1 - p / 4) * (2 * pi) / p) + 1
  },
  OutInElastic: outIn(easeOutElastic, progress => {
    const p = 0.3
    return 2 ** (10 * (progress - 1)) * Math.sin((progress - 1 - p / 4) * (2 * pi) / p)
  }),
  InBack: (progress: number) => {
    const overshoot = 1.70158
    return (progress - 1) * (progress - 1) * ((overshoot + 1) * (progress - 1) + overshoot) + 1
  },
  OutBack: (progress: number) => {
    const overshoot = 1.70158
    return 1 + (overshoot + 1) * (progress - 1) ** 3 + overshoot * (progress - 1) ** 2
  },
  InOutBack: (progress: number) => {
    let overshoot = 1.70158
    if (progress < 0.5) {
      overshoot *= 1.525
      const t = 2 * progress
      return 0.5 * (t * t * ((overshoot + 1) * t - overshoot))
    }
    overshoot *= 1.525
    const t = 2 * progress - 2
    return 0.5 * (t * t * ((overshoot + 1) * t + overshoot) + 2)
  },
  OutInBack: outIn(
    (progress: number) => {
      const overshoot = 1.70158
      return 1 + (overshoot + 1) * (progress - 1) ** 3 + overshoot * (progress - 1) ** 2
    },
    (progress: number) => {
      const overshoot = 1.70158
      return (progress - 1) * (progress - 1) * ((overshoot + 1) * (progress - 1) + overshoot) + 1
    },
  ),
  InBounce: (progress: number) => 1 - easeOutBounce(1 - progress),
  OutBounce: easeOutBounce,
  InOutBounce: (progress: number) => progress < 0.5
    ? (1 - easeOutBounce(1 - 2 * progress)) / 2
    : (1 + easeOutBounce(2 * progress - 1)) / 2,
  OutInBounce: outIn(easeOutBounce, progress => 1 - easeOutBounce(1 - progress)),
} satisfies Record<string, QmlEasingFunction>

/** 按 QEasingCurve::Type 枚举索引取 easing 函数 */
export const QML_EASING_BY_INDEX: QmlEasingFunction[] = [
  QmlEasing.Linear,
  QmlEasing.InQuad, QmlEasing.OutQuad, QmlEasing.InOutQuad, QmlEasing.OutInQuad,
  QmlEasing.InCubic, QmlEasing.OutCubic, QmlEasing.InOutCubic, QmlEasing.OutInCubic,
  QmlEasing.InQuart, QmlEasing.OutQuart, QmlEasing.InOutQuart, QmlEasing.OutInQuart,
  QmlEasing.InQuint, QmlEasing.OutQuint, QmlEasing.InOutQuint, QmlEasing.OutInQuint,
  QmlEasing.InSine, QmlEasing.OutSine, QmlEasing.InOutSine, QmlEasing.OutInSine,
  QmlEasing.InExpo, QmlEasing.OutExpo, QmlEasing.InOutExpo, QmlEasing.OutInExpo,
  QmlEasing.InCirc, QmlEasing.OutCirc, QmlEasing.InOutCirc, QmlEasing.OutInCirc,
  QmlEasing.InElastic, QmlEasing.OutElastic, QmlEasing.InOutElastic, QmlEasing.OutInElastic,
  QmlEasing.InBack, QmlEasing.OutBack, QmlEasing.InOutBack, QmlEasing.OutInBack,
  QmlEasing.InBounce, QmlEasing.OutBounce, QmlEasing.InOutBounce, QmlEasing.OutInBounce,
]

/** 将 QML 中的 easing.type 值（Easing 枚举数字或 'Easing.Xxx' 字符串）解析为 easing 函数 */
export function resolveQmlEasing(value: unknown): QmlEasingFunction {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < QML_EASING_BY_INDEX.length) {
    return QML_EASING_BY_INDEX[value]
  }
  const name = String(value ?? '').split('.').pop() ?? ''
  return (QmlEasing as Record<string, QmlEasingFunction>)[name] ?? QmlEasing.Linear
}

const browserScheduler: QmlAnimationScheduler = {
  now: () => performance.now(),
  request: callback => globalThis.setTimeout(() => callback(performance.now()), 16) as unknown as number,
  cancel: handle => globalThis.clearTimeout(handle),
}

export interface QmlPropertyAnimationOptions {
  target: QmlObject
  property: string
  from?: number
  to: number
  duration?: number
  easing?: QmlEasingFunction
  scheduler?: QmlAnimationScheduler
}

export class QmlPropertyAnimation implements QmlAnimation {
  private frame: number | null = null
  private resolve: (() => void) | null = null

  constructor(private readonly options: QmlPropertyAnimationOptions) {}

  start(): Promise<void> {
    this.stop()
    const scheduler = this.options.scheduler ?? browserScheduler
    const duration = Math.max(0, this.options.duration ?? 250)
    const from = this.options.from ?? Number(this.options.target.getProperty(this.options.property))
    const easing = this.options.easing ?? QmlEasing.Linear
    const startedAt = scheduler.now()

    return new Promise(resolve => {
      this.resolve = resolve
      const tick = (timestamp: number) => {
        const progress = duration === 0 ? 1 : Math.min(1, Math.max(0, (timestamp - startedAt) / duration))
        const value = from + (this.options.to - from) * easing(progress)
        this.options.target.setProperty(this.options.property, value)
        if (progress >= 1) {
          this.frame = null
          this.resolve = null
          resolve()
          return
        }
        this.frame = scheduler.request(tick)
      }
      this.frame = scheduler.request(tick)
    })
  }

  stop(): void {
    if (this.frame === null) return
    const scheduler = this.options.scheduler ?? browserScheduler
    scheduler.cancel(this.frame)
    this.frame = null
    this.resolve?.()
    this.resolve = null
  }
}

export interface QmlKeyframe {
  offset: number
  value: number
  easing?: QmlEasingFunction
}

export class QmlKeyframeAnimation implements QmlAnimation {
  private animation: QmlPropertyAnimation | null = null
  private stopped = false

  constructor(
    private readonly target: QmlObject,
    private readonly property: string,
    private readonly keyframes: QmlKeyframe[],
    private readonly duration = 250,
    private readonly scheduler: QmlAnimationScheduler = browserScheduler,
  ) {}

  async start(): Promise<void> {
    this.stop()
    this.stopped = false
    const frames = [...this.keyframes].sort((left, right) => left.offset - right.offset)
    if (frames.length === 0) return
    this.target.setProperty(this.property, frames[0].value)
    for (let index = 1; index < frames.length && !this.stopped; index++) {
      const previous = frames[index - 1]
      const frame = frames[index]
      this.animation = new QmlPropertyAnimation({
        target: this.target,
        property: this.property,
        from: previous.value,
        to: frame.value,
        duration: Math.max(0, frame.offset - previous.offset) * this.duration,
        easing: frame.easing,
        scheduler: this.scheduler,
      })
      await this.animation.start()
    }
    this.animation = null
  }

  stop(): void {
    this.stopped = true
    this.animation?.stop()
    this.animation = null
  }
}

// CSS 命名颜色已迁移到 QmlColor.ts；QML 颜色解析见 parseQmlColor/toQmlColorString

export interface QmlValueAnimationOptions {
  target: QmlObject
  property: string
  from?: unknown
  to: unknown
  duration?: number
  easing?: QmlEasingFunction
  scheduler?: QmlAnimationScheduler
}

export class QmlValueAnimation implements QmlAnimation {
  private frame: number | null = null
  private resolve: (() => void) | null = null

  constructor(private readonly options: QmlValueAnimationOptions) {}

  start(): Promise<void> {
    this.stop()
    const scheduler = this.options.scheduler ?? browserScheduler
    const duration = Math.max(0, this.options.duration ?? 250)
    const originalFrom = this.options.from ?? this.options.target.getProperty(this.options.property)
    const fromColor = parseQmlColor(originalFrom)
    const toColor = parseQmlColor(this.options.to)
    const fromVector = Array.isArray(originalFrom) ? originalFrom.map(Number) : null
    const toVector = Array.isArray(this.options.to) ? this.options.to.map(Number) : null
    if ((!fromColor || !toColor) && (!fromVector || !toVector || fromVector.length !== toVector.length)) {
      throw new Error('QmlValueAnimation requires matching color or vector values')
    }
    const from = fromColor ?? fromVector!
    const to = toColor ?? toVector!
    const easing = this.options.easing ?? QmlEasing.Linear
    const startedAt = scheduler.now()
    return new Promise(resolve => {
      this.resolve = resolve
      const tick = (timestamp: number) => {
        const progress = duration === 0 ? 1 : Math.min(1, Math.max(0, (timestamp - startedAt) / duration))
        const eased = easing(progress)
        const value = from.map((component, index) => component + (to[index] - component) * eased)
        this.options.target.setProperty(this.options.property, fromColor ? toQmlColorString(value as QmlColorTuple) : value)
        if (progress >= 1) {
          this.frame = null
          this.resolve = null
          resolve()
        } else this.frame = scheduler.request(tick)
      }
      this.frame = scheduler.request(tick)
    })
  }

  stop(): void {
    if (this.frame === null) return
    ;(this.options.scheduler ?? browserScheduler).cancel(this.frame)
    this.frame = null
    this.resolve?.()
    this.resolve = null
  }
}

export class QmlPauseAnimation implements QmlAnimation {
  private frame: number | null = null
  private resolve: (() => void) | null = null

  constructor(
    private readonly duration: number,
    private readonly scheduler: QmlAnimationScheduler = browserScheduler,
  ) {}

  start(): Promise<void> {
    this.stop()
    const startedAt = this.scheduler.now()
    return new Promise(resolve => {
      this.resolve = resolve
      const tick = (timestamp: number) => {
        if (timestamp - startedAt >= this.duration) {
          this.frame = null
          this.resolve = null
          resolve()
        } else this.frame = this.scheduler.request(tick)
      }
      this.frame = this.scheduler.request(tick)
    })
  }

  stop(): void {
    if (this.frame === null) return
    this.scheduler.cancel(this.frame)
    this.frame = null
    this.resolve?.()
    this.resolve = null
  }
}

export class QmlScriptAction implements QmlAnimation {
  constructor(private readonly action: () => void) {}
  async start(): Promise<void> { this.action() }
  stop(): void {}
}

export class QmlLoopAnimation implements QmlAnimation {
  private stopped = false
  constructor(private readonly animation: QmlAnimation, private readonly loops: number) {}
  async start(): Promise<void> {
    this.stop()
    this.stopped = false
    for (let iteration = 0; !this.stopped && (this.loops < 0 || iteration < this.loops); iteration++) {
      await this.animation.start()
    }
  }
  stop(): void {
    this.stopped = true
    this.animation.stop()
  }
}

export class QmlParallelAnimation implements QmlAnimation {
  constructor(private readonly animations: QmlAnimation[]) {}

  async start(): Promise<void> {
    await Promise.all(this.animations.map(animation => animation.start()))
  }

  stop(): void {
    this.animations.forEach(animation => animation.stop())
  }
}

export class QmlSequentialAnimation implements QmlAnimation {
  private stopped = false
  private current: QmlAnimation | null = null

  constructor(private readonly animations: QmlAnimation[]) {}

  async start(): Promise<void> {
    this.stop()
    this.stopped = false
    for (const animation of this.animations) {
      if (this.stopped) return
      this.current = animation
      await animation.start()
    }
    this.current = null
  }

  stop(): void {
    this.stopped = true
    this.current?.stop()
    this.current = null
  }
}
