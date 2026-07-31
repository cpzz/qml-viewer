import { QmlObject } from './QmlObject'

function normalizeKey(key: string): string {
  const normalized = key.toLowerCase()
  if (normalized === 'esc') return 'escape'
  if (normalized === 'return') return 'enter'
  if (normalized === 'space') return ' '
  return normalized
}

function matchesSequence(event: KeyboardEvent, sequence: string): boolean {
  const parts = sequence.split('+').map(part => part.trim()).filter(Boolean)
  if (parts.length === 0 || sequence.includes(',')) return false
  const modifiers = new Set(parts.slice(0, -1).map(part => part.toLowerCase()))
  const key = normalizeKey(parts.at(-1)!)
  const wantsControl = modifiers.has('ctrl') || modifiers.has('control')
  const wantsMeta = modifiers.has('meta') || modifiers.has('cmd') || modifiers.has('command')
  return normalizeKey(event.key) === key &&
    event.ctrlKey === wantsControl &&
    event.altKey === modifiers.has('alt') &&
    event.shiftKey === modifiers.has('shift') &&
    event.metaKey === wantsMeta
}

export class QmlShortcutController {
  private disposed = false
  private readonly onKeyDown = (event: Event) => {
    const keyboardEvent = event as KeyboardEvent
    if (!this.shortcut.getProperty('enabled')) return
    if (matchesSequence(keyboardEvent, String(this.shortcut.getProperty('sequence')))) {
      this.shortcut.emitSignal('activated')
    }
  }

  constructor(
    private readonly shortcut: QmlObject,
    private readonly eventTarget: EventTarget,
  ) {
    if (shortcut.typeName !== 'Shortcut') throw new Error('QmlShortcutController requires a Shortcut object')
    eventTarget.addEventListener('keydown', this.onKeyDown)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.eventTarget.removeEventListener('keydown', this.onKeyDown)
  }
}

export { matchesSequence as matchesShortcutSequence }
