import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseQML } from '../renderer/parser'
import { instantiateQmlDocument } from './QmlDocument'
import { QmlItemController } from './QmlItemController'

describe('Item example fixture', () => {
  it('parses and computes the shared Item foundation without type-specific APIs', () => {
    const source = readFileSync(resolve(process.cwd(), 'examples/item/Item.qml'), 'utf8')
    const nodes = parseQML(source)
    const document = instantiateQmlDocument(nodes)
    const root = document.ids.get('root')!
    const content = document.ids.get('content')!
    const leftPanel = document.ids.get('leftPanel')!
    const rightPanel = document.ids.get('rightPanel')!
    const rootController = new QmlItemController(root)
    const contentController = new QmlItemController(content)

    expect(nodes[0].properties['Keys.onPressed']).toContain('keyPressCount += 1')
    expect(root.getProperty('transformOrigin')).toBe('Item.TopLeft')
    expect(root.getProperty('layer.enabled')).toBe(true)
    expect(leftPanel.hasMethod('mapToItem')).toBe(true)
    expect(rightPanel.getProperty('KeyNavigation.left')).toBe('leftPanel')
    expect([
      content.getProperty('childrenRect.x'),
      content.getProperty('childrenRect.y'),
      content.getProperty('childrenRect.width'),
      content.getProperty('childrenRect.height'),
    ]).toEqual([-24, 16, 590, 284])

    rootController.dispose()
    contentController.dispose()
  })
})
