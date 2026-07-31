export type QmlListModelRow = Record<string, unknown>
export type QmlListModelListener = () => void

export class QmlListModel {
  private readonly rows: QmlListModelRow[] = []
  private readonly listeners = new Set<QmlListModelListener>()

  constructor(initialRows: QmlListModelRow[] = []) {
    this.rows = initialRows.map(row => ({ ...row }))
  }

  get count(): number {
    return this.rows.length
  }

  get(index: number): QmlListModelRow | undefined {
    const row = this.rows[index]
    return row ? { ...row } : undefined
  }

  append(row: QmlListModelRow): void {
    this.rows.push({ ...row })
    this.notify()
  }

  insert(index: number, row: QmlListModelRow): void {
    this.assertInsertIndex(index)
    this.rows.splice(index, 0, { ...row })
    this.notify()
  }

  set(index: number, row: QmlListModelRow): void {
    this.assertIndex(index)
    this.rows[index] = { ...row }
    this.notify()
  }

  setProperty(index: number, name: string, value: unknown): void {
    this.assertIndex(index)
    this.rows[index] = { ...this.rows[index], [name]: value }
    this.notify()
  }

  move(from: number, to: number, count = 1): void {
    this.assertIndex(from)
    if (count < 1 || from + count > this.rows.length) throw new Error('Invalid QML model move count')
    if (to < 0 || to > this.rows.length - count) throw new Error(`Invalid QML model index ${to}`)
    const moved = this.rows.splice(from, count)
    this.rows.splice(to, 0, ...moved)
    this.notify()
  }

  remove(index: number, count = 1): void {
    this.assertIndex(index)
    if (count < 1 || index + count > this.rows.length) throw new Error('Invalid QML model remove count')
    this.rows.splice(index, count)
    this.notify()
  }

  clear(): void {
    if (this.rows.length === 0) return
    this.rows.splice(0)
    this.notify()
  }

  subscribe(listener: QmlListModelListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  toArray(): QmlListModelRow[] {
    return this.rows.map(row => ({ ...row }))
  }

  private assertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.rows.length) {
      throw new Error(`Invalid QML model index ${index}`)
    }
  }

  private assertInsertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index > this.rows.length) {
      throw new Error(`Invalid QML model index ${index}`)
    }
  }

  private notify(): void {
    ;[...this.listeners].forEach(listener => listener())
  }
}
