import { describe, expect, it } from 'vitest'
import { QmlObject } from './QmlObject'
import { QmlScope } from './QmlScope'

describe('QmlScope', () => {
  it('uses local ids before ids from an outer component scope', () => {
    const outerScope = new QmlScope()
    const innerScope = new QmlScope(outerScope)
    const outer = new QmlObject('Item')
    const inner = new QmlObject('Rectangle')
    outerScope.defineId('root', outer)
    innerScope.defineId('root', inner)

    expect(innerScope.resolveId('root')).toBe(inner)
    expect(new QmlScope(outerScope).resolveId('root')).toBe(outer)
  })

  it('prefers context properties over ids with the same name', () => {
    const scope = new QmlScope()
    const context = new QmlObject('Item')
    const idObject = new QmlObject('Rectangle')
    context.defineProperty({ name: 'target', type: 'string', initialValue: 'property value' })
    scope.defineId('target', idObject)

    expect(scope.resolve('target', context)).toBe('property value')
  })
})
