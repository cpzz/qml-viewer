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

  it('reads grouped properties in string expressions and updates bindings reactively', () => {
    const { root, environment } = createEnvironment()
    const text = new QmlObject('Text', root)
    root.defineProperty({ name: 'childrenRect.x', type: 'real', initialValue: -24 })
    root.defineProperty({ name: 'childrenRect.y', type: 'real', initialValue: 16 })
    root.defineProperty({ name: 'childrenRect.width', type: 'real', initialValue: 590 })
    root.defineProperty({ name: 'childrenRect.height', type: 'real', initialValue: 284 })
    text.defineProperty({ name: 'text', type: 'string', initialValue: '' })
    const bindings = new BindingEngine()
    const expression = '"childrenRect: " + root.childrenRect.x + ", " + root.childrenRect.y + " / " + root.childrenRect.width + " x " + root.childrenRect.height'

    bindings.bind(text, 'text', () => environment.evaluate(expression, text))
    expect(text.getProperty('text')).toBe('childrenRect: -24, 16 / 590 x 284')

    root.setProperty('childrenRect.width', 620)
    expect(text.getProperty('text')).toBe('childrenRect: -24, 16 / 620 x 284')
  })

  it('reads and writes grouped properties on the current context', () => {
    const { field, environment } = createEnvironment()
    field.defineProperty({ name: 'font.pixelSize', type: 'real', initialValue: 14 })

    expect(environment.evaluate('font.pixelSize + 2', field)).toBe(16)
    environment.execute('font.pixelSize = 20', field)
    expect(field.getProperty('font.pixelSize')).toBe(20)
  })

  it('prefers grouped properties over a same-named placeholder property', () => {
    const { root, environment } = createEnvironment()
    root.defineProperty({ name: 'palette', type: 'var', initialValue: null })
    root.defineProperty({ name: 'palette.highlight', type: 'color', initialValue: '#0f766e' })

    expect(environment.evaluate('root.palette.highlight', root)).toBe('#0f766e')
    expect(environment.evaluate('palette.highlight', root)).toBe('#0f766e')
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

  it('resolves the control reference to the nearest ancestor with a background property', () => {
    const { root, field, environment } = createEnvironment()
    root.defineProperty({ name: 'background', type: 'Item', initialValue: null })
    root.defineProperty({ name: 'progress', type: 'real', initialValue: 0.5 })

    // field 自身没有 background → control 解析到最近的 Control 祖先（root）
    expect(environment.evaluate('control.progress', field)).toBe(0.5)

    // 更内层出现带 background 的控件时，control 应指向最近的祖先
    const inner = new QmlObject('Button', root)
    inner.defineProperty({ name: 'background', type: 'Item', initialValue: null })
    inner.defineProperty({ name: 'progress', type: 'real', initialValue: 0.25 })
    const rect = new QmlObject('Rectangle', inner)
    expect(environment.evaluate('control.progress', rect)).toBe(0.25)
    expect(environment.evaluate('control.progress', inner)).toBe(0.25)
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
