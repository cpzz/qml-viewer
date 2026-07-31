import { QmlObject } from './QmlObject'

export class QmlStackViewController {
  private stack: QmlObject[]

  constructor(private readonly view: QmlObject) {
    if (view.typeName !== 'StackView') throw new Error('QmlStackViewController requires a StackView object')
    const initialIndex = Math.max(0, Math.min(view.children.length - 1, Number(view.getProperty('currentIndex')) || 0))
    this.stack = view.children.slice(0, initialIndex + 1)
    const initial = view.getProperty('initialItem')
    if (initial instanceof QmlObject && !this.stack.includes(initial)) this.stack.push(initial)
    this.sync()
    view.defineMethod('push', item => this.push(item))
    view.defineMethod('pop', item => this.pop(item))
    view.defineMethod('replace', (...args) => this.replace(args.at(-1)))
    view.defineMethod('clear', () => this.clear())
    view.defineMethod('get', index => this.get(Number(index)))
  }

  push(value: unknown): QmlObject | null {
    const values = Array.isArray(value) ? value : [value]
    const items = values
      .map(item => typeof item === 'number' ? this.view.children[item] : item)
      .filter((item): item is QmlObject => item instanceof QmlObject)
    for (const item of items) {
      if (this.stack.includes(item)) continue
      if (!item.parent) item.attachTo(this.view)
      this.stack.push(item)
    }
    this.sync()
    return this.stack.at(-1) ?? null
  }

  pop(target?: unknown): QmlObject | null {
    if (this.stack.length <= 1) return null
    let removed: QmlObject | null = null
    if (target instanceof QmlObject) {
      while (this.stack.length > 1 && this.stack.at(-1) !== target) removed = this.stack.pop() ?? null
    } else if (target === null) {
      while (this.stack.length > 1) removed = this.stack.pop() ?? null
    } else removed = this.stack.pop() ?? null
    this.sync()
    return removed
  }

  replace(value: unknown): QmlObject | null {
    if (this.stack.length) this.stack.pop()
    return this.push(value)
  }

  clear(): void {
    this.stack = []
    this.sync()
  }

  get(index: number): QmlObject | null {
    return this.stack[index] ?? null
  }

  dispose(): void {}

  private sync(): void {
    const current = this.stack.at(-1) ?? null
    this.view.setInternalProperty('depth', this.stack.length)
    this.view.setInternalProperty('empty', this.stack.length === 0)
    this.view.setInternalProperty('currentItem', current)
    this.view.setProperty('currentIndex', current ? this.view.children.indexOf(current) : -1)
  }
}
