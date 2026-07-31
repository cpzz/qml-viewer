import {
  QmlLoopAnimation,
  QmlParallelAnimation,
  QmlPauseAnimation,
  QmlPropertyAnimation,
  QmlSequentialAnimation,
  QmlValueAnimation,
  type QmlAnimation,
  type QmlAnimationScheduler,
} from './QmlAnimation'
import { QmlObject } from './QmlObject'

const animationTypes = new Set([
  'NumberAnimation',
  'PropertyAnimation',
  'ColorAnimation',
  'Vector3dAnimation',
  'PauseAnimation',
  'SequentialAnimation',
  'ParallelAnimation',
])

export function isDeclarativeAnimation(object: QmlObject): boolean {
  return animationTypes.has(object.typeName)
}

export class QmlAnimationController {
  private active: QmlAnimation | null = null
  private generation = 0
  private disposed = false
  private changingRunning = false
  private readonly unsubscribe: () => void

  constructor(
    private readonly object: QmlObject,
    private readonly scheduler?: QmlAnimationScheduler,
  ) {
    if (!isDeclarativeAnimation(object)) throw new Error('QmlAnimationController requires an animation object')
    object.defineMethod('start', () => this.start())
    object.defineMethod('stop', () => this.stop())
    object.defineMethod('restart', () => this.restart())
    this.unsubscribe = object.hasProperty('running')
      ? object.onPropertyChanged('running', change => {
        if (this.changingRunning) return
        if (change.value) this.start()
        else this.stop()
      })
      : () => {}
    if (object.hasProperty('running') && object.getProperty('running')) this.start()
  }

  start(): void {
    if (this.disposed || this.active) return
    const animation = this.createAnimation(this.object)
    const generation = ++this.generation
    this.active = animation
    this.setRunning(true)
    if (this.object.hasSignal('started')) this.object.emitSignal('started')
    void animation.start().then(() => {
      if (this.disposed || this.generation !== generation || this.active !== animation) return
      this.active = null
      this.setRunning(false)
      if (this.object.hasSignal('finished')) this.object.emitSignal('finished')
    })
  }

  stop(): void {
    if (!this.active) {
      this.setRunning(false)
      return
    }
    this.generation++
    this.active.stop()
    this.active = null
    this.setRunning(false)
    if (this.object.hasSignal('stopped')) this.object.emitSignal('stopped')
  }

  restart(): void {
    this.stop()
    this.start()
  }

  dispose(): void {
    if (this.disposed) return
    this.unsubscribe()
    this.stop()
    this.disposed = true
  }

  private createAnimation(object: QmlObject): QmlAnimation {
    if (object.typeName === 'PauseAnimation') {
      return new QmlPauseAnimation(Number(object.getProperty('duration')), this.scheduler)
    }
    if (object.typeName === 'SequentialAnimation' || object.typeName === 'ParallelAnimation') {
      const children = object.children.filter(isDeclarativeAnimation).map(child => this.createAnimation(child))
      const group = object.typeName === 'SequentialAnimation'
        ? new QmlSequentialAnimation(children)
        : new QmlParallelAnimation(children)
      return this.withLoops(group, object)
    }

    const target = object.getProperty('target')
    if (!(target instanceof QmlObject)) throw new Error(`${object.typeName} requires a target`)
    const propertyNames = String(object.getProperty('properties') || object.getProperty('property'))
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)
    if (propertyNames.length === 0) throw new Error(`${object.typeName} requires a property`)
    const animations = propertyNames.map(property => {
      const options = {
        target,
        property,
        from: object.getProperty('from'),
        to: object.getProperty('to'),
        duration: Number(object.getProperty('duration')),
        scheduler: this.scheduler,
      }
      return object.typeName === 'ColorAnimation' || object.typeName === 'Vector3dAnimation'
        ? new QmlValueAnimation(options)
        : new QmlPropertyAnimation({ ...options, from: Number(options.from), to: Number(options.to) })
    })
    const animation = animations.length === 1 ? animations[0] : new QmlParallelAnimation(animations)
    return this.withLoops(animation, object)
  }

  private withLoops(animation: QmlAnimation, object: QmlObject): QmlAnimation {
    const loops = object.hasProperty('loops') ? Number(object.getProperty('loops')) : 1
    return loops === 1 ? animation : new QmlLoopAnimation(animation, loops)
  }

  private setRunning(value: boolean): void {
    if (!this.object.hasProperty('running') || this.object.getProperty('running') === value) return
    this.changingRunning = true
    this.object.setProperty('running', value)
    this.changingRunning = false
  }
}
