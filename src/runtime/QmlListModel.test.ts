import { describe, expect, it, vi } from 'vitest'
import { QmlListModel } from './QmlListModel'

describe('QmlListModel', () => {
  it('supports role-based mutation and emits one change per operation', () => {
    const model = new QmlListModel([{ name: 'First', value: 1 }])
    const changed = vi.fn()
    model.subscribe(changed)

    model.append({ name: 'Third', value: 3 })
    model.insert(1, { name: 'Second', value: 2 })
    model.setProperty(0, 'value', 10)
    model.move(2, 1)
    model.remove(2)

    expect(model.count).toBe(2)
    expect(model.toArray()).toEqual([
      { name: 'First', value: 10 },
      { name: 'Third', value: 3 },
    ])
    expect(changed).toHaveBeenCalledTimes(5)
  })

  it('returns row copies and validates mutation ranges', () => {
    const model = new QmlListModel([{ value: 1 }])
    const row = model.get(0)!
    row.value = 99

    expect(model.get(0)).toEqual({ value: 1 })
    expect(() => model.remove(2)).toThrow('Invalid QML model index 2')
    expect(() => model.move(0, 0, 2)).toThrow('Invalid QML model move count')
  })
})
