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

export const QmlEasing = {
  Linear: (progress: number) => progress,
  InQuad: (progress: number) => progress * progress,
  OutQuad: (progress: number) => 1 - (1 - progress) * (1 - progress),
  InOutQuad: (progress: number) => progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2,
  InCubic: (progress: number) => progress ** 3,
  OutCubic: (progress: number) => 1 - (1 - progress) ** 3,
  InOutCubic: (progress: number) => progress < 0.5
    ? 4 * progress ** 3
    : 1 - Math.pow(-2 * progress + 2, 3) / 2,
  OutBack: (progress: number) => {
    const overshoot = 1.70158
    return 1 + (overshoot + 1) * (progress - 1) ** 3 + overshoot * (progress - 1) ** 2
  },
} satisfies Record<string, QmlEasingFunction>

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

function parseColor(value: unknown): number[] | null {
  const match = String(value).match(/^#([0-9a-f]{6}|[0-9a-f]{8})$/i)
  if (!match) return null
  return match[1].match(/.{2}/g)!.map(component => parseInt(component, 16))
}

function colorString(value: number[]): string {
  return `#${value.map(component => Math.round(component).toString(16).padStart(2, '0')).join('')}`
}

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
    const fromColor = parseColor(originalFrom)
    const toColor = parseColor(this.options.to)
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
        this.options.target.setProperty(this.options.property, fromColor ? colorString(value) : value)
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
