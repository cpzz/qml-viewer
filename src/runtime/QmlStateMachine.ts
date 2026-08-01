import {
  QmlEasing,
  QmlParallelAnimation,
  QmlPropertyAnimation,
  QmlValueAnimation,
  type QmlAnimation,
  type QmlAnimationScheduler,
  type QmlEasingFunction,
} from './QmlAnimation'
import { QmlObject } from './QmlObject'

export interface QmlPropertyChanges {
  target: QmlObject
  values: Record<string, unknown>
}

export interface QmlStateDefinition {
  name: string
  when?: () => boolean
  changes: QmlPropertyChanges[]
}

export interface QmlTransitionDefinition {
  from?: string
  to?: string
  properties?: string[]
  duration?: number
  easing?: QmlEasingFunction
  scheduler?: QmlAnimationScheduler
  valueType?: 'number' | 'color' | 'vector'
}

interface PropertyTarget {
  target: QmlObject
  property: string
  value: unknown
}

export class QmlStateMachine {
  private readonly states = new Map<string, QmlStateDefinition>()
  private readonly baseValues = new Map<QmlObject, Map<string, unknown>>()
  private current = ''
  private running: QmlAnimation | null = null

  constructor(
    states: QmlStateDefinition[],
    private readonly transitions: QmlTransitionDefinition[] = [],
  ) {
    for (const state of states) {
      if (!state.name) throw new Error('QML state requires a name')
      if (this.states.has(state.name)) throw new Error(`Duplicate QML state ${state.name}`)
      this.states.set(state.name, state)
      for (const change of state.changes) {
        const values = this.baseValues.get(change.target) ?? new Map<string, unknown>()
        for (const property of Object.keys(change.values)) {
          if (!change.target.hasProperty(property)) {
            throw new Error(`Unknown state property ${property} on ${change.target.typeName}`)
          }
          if (!values.has(property)) values.set(property, change.target.getProperty(property))
        }
        this.baseValues.set(change.target, values)
      }
    }
  }

  get state(): string {
    return this.current
  }

  async setState(name: string): Promise<void> {
    if (name && !this.states.has(name)) throw new Error(`Unknown QML state ${name}`)
    if (name === this.current) return
    const previous = this.current
    const targets = this.targetsFor(name)
    const transition = this.transitions.find(candidate => (
      (candidate.from === undefined || candidate.from === '*' || candidate.from === previous) &&
      (candidate.to === undefined || candidate.to === '*' || candidate.to === name)
    ))
    this.running?.stop()
    this.current = name

    const animations: QmlAnimation[] = []
    for (const target of targets) {
      const previousValue = target.target.getProperty(target.property)
      const valueType = transition?.valueType ?? 'number'
      const compatibleValue = valueType === 'number'
        ? typeof target.value === 'number' && typeof previousValue === 'number'
        : valueType === 'color'
          ? typeof target.value === 'string' && typeof previousValue === 'string'
          : Array.isArray(target.value) && Array.isArray(previousValue)
      const canAnimate = transition && compatibleValue &&
        (!transition.properties || transition.properties.includes(target.property))
      if (canAnimate) {
        const Animation = valueType === 'number' ? QmlPropertyAnimation : QmlValueAnimation
        animations.push(new Animation({
          target: target.target,
          property: target.property,
          to: target.value as never,
          duration: transition.duration,
          easing: transition.easing ?? QmlEasing.Linear,
          scheduler: transition.scheduler,
        }))
      } else {
        target.target.setProperty(target.property, target.value)
      }
    }
    if (animations.length > 0) {
      this.running = new QmlParallelAnimation(animations)
      await this.running.start()
      this.running = null
    }
  }

  async refresh(): Promise<void> {
    const matched = [...this.states.values()].find(state => state.when?.())
    await this.setState(matched?.name ?? '')
  }

  stop(): void {
    this.running?.stop()
    this.running = null
  }

  private targetsFor(stateName: string): PropertyTarget[] {
    const values = new Map<QmlObject, Map<string, unknown>>()
    for (const [target, properties] of this.baseValues) {
      values.set(target, new Map(properties))
    }
    const state = this.states.get(stateName)
    for (const change of state?.changes ?? []) {
      const targetValues = values.get(change.target) ?? new Map<string, unknown>()
      for (const [property, value] of Object.entries(change.values)) {
        targetValues.set(property, value)
      }
      values.set(change.target, targetValues)
    }
    return [...values].flatMap(([target, properties]) => (
      [...properties].map(([property, value]) => ({ target, property, value }))
    ))
  }
}

export interface QmlBehaviorOptions {
  target: QmlObject
  property: string
  duration?: number
  easing?: QmlEasingFunction
  scheduler?: QmlAnimationScheduler
  valueType?: 'number' | 'color' | 'vector'
}

export class QmlBehavior {
  private animation: QmlAnimation | null = null
  private applying = false
  private readonly unsubscribe: () => void

  constructor(private readonly options: QmlBehaviorOptions) {
    this.unsubscribe = options.target.onPropertyChanged(options.property, change => {
      if (this.applying) return
      const colorLike = this.options.valueType === 'color' || this.options.valueType === 'vector'
      const numeric = typeof change.previousValue === 'number' && typeof change.value === 'number'
      if (!colorLike && !numeric) return
      if (colorLike && (change.previousValue == null || change.value == null)) return
      this.applying = true
      options.target.setInternalProperty(options.property, change.previousValue)
      this.animation?.stop()
      const animation = colorLike
        ? new QmlValueAnimation({
          target: options.target,
          property: options.property,
          from: change.previousValue,
          to: change.value,
          duration: options.duration,
          easing: options.easing,
          scheduler: options.scheduler,
        })
        : new QmlPropertyAnimation({
          target: options.target,
          property: options.property,
          from: change.previousValue as number,
          to: change.value as number,
          duration: options.duration,
          easing: options.easing,
          scheduler: options.scheduler,
        })
      this.animation = animation
      void animation.start().finally(() => {
        if (this.animation === animation) {
          this.animation = null
          this.applying = false
        }
      })
    })
  }

  dispose(): void {
    this.unsubscribe()
    this.animation?.stop()
    this.animation = null
    this.applying = false
  }
}
