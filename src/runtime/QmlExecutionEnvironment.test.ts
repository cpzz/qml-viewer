import { beforeAll, describe, expect, it } from 'vitest'
import { BindingEngine } from './BindingEngine'
import { QmlExecutionEnvironment } from './QmlExecutionEnvironment'
import { QmlJsEngine } from './QmlJsEngine'
import { QmlObject } from './QmlObject'
import { QmlScope } from './QmlScope'

describe('QmlExecutionEnvironment', () => {
  let jsEngine: QmlJsEngine

  beforeAll(async () => {
    jsEngine = await QmlJsEngine.create()
  })

  function createEnvironment(hostFunctions: Record<string, (...args: unknown[]) => unknown> = {}) {
    const scope = new QmlScope()
    const root = new QmlObject('Item')
    const field = new QmlObject('TextInput', root)
    root.defineProperty({ name: 'count', type: 'int', initialValue: 2 })
    root.defineProperty({ name: 'accent', type: 'color', initialValue: 'red' })
    field.defineProperty({ name: 'text', type: 'string', initialValue: 'Hello' })
    scope.defineId('root', root)
    scope.defineId('field', field)
    return {
      root,
      field,
      environment: new QmlExecutionEnvironment(jsEngine, scope, hostFunctions),
    }
  }

  it('evaluates expressions with context properties and ids', () => {
    const { root, field, environment } = createEnvironment()
    root.defineProperty({ name: 'width', type: 'real', initialValue: 420 })

    expect(environment.evaluate('count + field.text.length', field)).toBe(7)
    expect(environment.evaluate('root.accent', field)).toBe('red')
    expect(environment.evaluate('parent.width', field)).toBe(420)
  })

  it('writes handler changes back to context and id properties', () => {
    const { root, field, environment } = createEnvironment()

    environment.execute(`
      count += 3
      field.text = field.text + " World"
    `, root)

    expect(root.getProperty('count')).toBe(5)
    expect(field.getProperty('text')).toBe('Hello World')
  })

  it('calls methods with return values and writes their changes back', () => {
    const { root, environment } = createEnvironment()

    const value = environment.call(
      'function increment(step) { count += step; return count }',
      [4],
      root,
    )

    expect(value).toBe(6)
    expect(root.getProperty('count')).toBe(6)
  })

  it('provides reactive dependencies for JavaScript bindings', () => {
    const { root, environment } = createEnvironment()
    const text = new QmlObject('Text', root)
    text.defineProperty({ name: 'color', type: 'color', initialValue: '' })
    const bindings = new BindingEngine()

    bindings.bind(text, 'color', () => environment.evaluate('accent', text))
    root.setProperty('accent', 'blue')

    expect(text.getProperty('color')).toBe('blue')
  })

  it('calls QML methods and signals against live object state', () => {
    const { root, environment } = createEnvironment()
    const activations: unknown[][] = []
    root.defineMethod('increment', step => {
      root.setProperty('count', Number(root.getProperty('count')) + Number(step))
      return root.getProperty('count')
    })
    root.defineSignal('activated')
    root.connectSignal('activated', (...args) => activations.push(args))

    environment.execute('count = root.increment(3); root.activated(count)', root)

    expect(root.getProperty('count')).toBe(5)
    expect(activations).toEqual([[5]])
  })

  it('proxies QML objects returned from methods', () => {
    const { root, field, environment } = createEnvironment()
    root.defineMethod('currentField', () => field)

    expect(environment.evaluate('root.currentField().text', root)).toBe('Hello')
  })

  it('exposes only explicitly allowlisted host functions', () => {
    const { root, environment } = createEnvironment({
      formatCount: value => `Count: ${value}`,
    })

    expect(environment.evaluate('formatCount(count)', root)).toBe('Count: 2')
    expect(environment.evaluate('typeof process', root)).toBe('undefined')
  })

  it('recursively proxies object-valued properties', () => {
    const { root, field, environment } = createEnvironment()
    root.defineProperty({ name: 'contentItem', type: 'Item', initialValue: field })

    environment.execute('root.contentItem.text += " World"', root)

    expect(field.getProperty('text')).toBe('Hello World')
    expect(environment.evaluate('contentItem.text', root)).toBe('Hello World')
  })

  it('awaits asynchronous host functions and propagates rejections', async () => {
    const { root, environment } = createEnvironment({
      loadCount: async (offset: unknown) => 10 + Number(offset),
      failLoad: async () => { throw new Error('load failed') },
    })

    expect(await environment.evaluateAsync('loadCount(count)', root)).toBe(12)
    await expect(environment.evaluateAsync('failLoad()', root)).rejects.toThrow('load failed')
  })
})
