import { beforeAll, describe, expect, it } from 'vitest'
import { QmlJsEngine } from './QmlJsEngine'

describe('QmlJsEngine', () => {
  let engine: QmlJsEngine

  beforeAll(async () => {
    engine = await QmlJsEngine.create({ timeoutMs: 200 })
  })

  it('evaluates JavaScript expressions in an isolated scope', () => {
    expect(engine.evaluate('count * 2 + Math.max(offset, 1)', {
      count: 3,
      offset: 4,
    })).toBe(10)
    expect(engine.evaluate('[1, 2, 3].map(value => value * 2)')).toEqual([2, 4, 6])
  })

  it('executes handler bodies and returns changed scope values', () => {
    const result = engine.execute(`
      count += step
      label = "Count: " + count
    `, {
      count: 1,
      step: 2,
      label: '',
    })

    expect(result).toMatchObject({ count: 3, step: 2, label: 'Count: 3' })
  })

  it('does not expose host globals', () => {
    expect(engine.evaluate('typeof process')).toBe('undefined')
    expect(engine.evaluate('typeof window')).toBe('undefined')
  })

  it('propagates script errors and interrupts infinite execution', async () => {
    expect(() => engine.evaluate('missing.value')).toThrow()
    const interruptEngine = await QmlJsEngine.create({ timeoutMs: 20 })
    expect(() => interruptEngine.execute('while (true) {}')).toThrow(/interrupted/i)
  })

  it('calls functions with arguments, return values, and scope changes', () => {
    const result = engine.call(
      'function add(step) { count += step; return count * 2 }',
      [3],
      { count: 2 },
    )

    expect(result).toEqual({ value: 10, scope: { count: 5 } })
  })

  it('bridges live context properties, object methods, and signals', () => {
    let count = 2
    const signals: unknown[][] = []
    const bridge = {
      scope: {},
      objectIds: ['root'],
      hostFunctions: [],
      contextProperties: ['count'],
      getContextProperty: () => count,
      setContextProperty: (_name: string, value: unknown) => { count = Number(value) },
      getObjectMemberKind: (_id: string, name: string) => (
        name === 'count' ? 'property' as const : name === 'increment' ? 'method' as const : 'signal' as const
      ),
      getObjectProperty: () => count,
      setObjectProperty: (_id: string, _name: string, value: unknown) => { count = Number(value) },
      callObjectMethod: (_id: string, _name: string, args: unknown[]) => { count += Number(args[0]); return count },
      emitObjectSignal: (_id: string, _name: string, args: unknown[]) => { signals.push(args) },
      callHostFunction: () => undefined,
    }

    engine.executeLive('count += 1; root.increment(3); root.activated(count)', bridge)

    expect(count).toBe(6)
    expect(signals).toEqual([[6]])
    expect(engine.evaluateLive('root.count + count', bridge)).toBe(12)
  })
})
