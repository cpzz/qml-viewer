import { QmlObject } from './QmlObject'

export interface QmlTimerScheduler {
  setTimeout(callback: () => void, delay: number): unknown
  clearTimeout(handle: unknown): void
}

const defaultScheduler: QmlTimerScheduler = {
  setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimeout: handle => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export class QmlTimerController {
  private handle: unknown = null
  private disposed = false
  private readonly unsubscribe: Array<() => void>

  constructor(
    private readonly timer: QmlObject,
    private readonly scheduler: QmlTimerScheduler = defaultScheduler,
  ) {
    if (timer.typeName !== 'Timer') throw new Error('QmlTimerController requires a Timer object')
    this.unsubscribe = [
      timer.onPropertyChanged('running', () => this.syncRunning()),
      timer.onPropertyChanged('interval', () => this.resetIfRunning()),
      timer.onPropertyChanged('repeat', () => this.resetIfRunning()),
      timer.onPropertyChanged('triggeredOnStart', () => this.resetIfRunning()),
    ]
    this.syncRunning()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.unsubscribe.forEach(unsubscribe => unsubscribe())
    this.cancel()
  }

  private syncRunning(): void {
    this.cancel()
    if (this.disposed || !this.timer.getProperty('running')) return
    if (this.timer.getProperty('triggeredOnStart')) this.timer.emitSignal('triggered')
    this.schedule()
  }

  private resetIfRunning(): void {
    if (!this.timer.getProperty('running')) return
    this.cancel()
    this.schedule()
  }

  private schedule(): void {
    const delay = Math.max(0, Number(this.timer.getProperty('interval')) || 0)
    this.handle = this.scheduler.setTimeout(() => {
      this.handle = null
      if (this.disposed || !this.timer.getProperty('running')) return
      this.timer.emitSignal('triggered')
      if (this.timer.getProperty('repeat')) this.schedule()
      else this.timer.setProperty('running', false)
    }, delay)
  }

  private cancel(): void {
    if (this.handle === null) return
    this.scheduler.clearTimeout(this.handle)
    this.handle = null
  }
}
