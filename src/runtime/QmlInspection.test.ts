import { describe, expect, it } from 'vitest'
import { parseQML } from '../renderer/parser'
import { instantiateQmlDocument } from './QmlDocument'
import { inspectQmlDocument } from './QmlInspection'

describe('inspectQmlDocument', () => {
  it('serializes ids, scalar properties, object references, and ownership', () => {
    const document = instantiateQmlDocument(parseQML(`
      Item {
        id: root
        width: 320
        property var metadata: [1, "two"]
        Rectangle { id: panel; anchors.fill: parent }
      }
    `))
    document.ids.get('panel')!.setInternalProperty('anchors.fill', document.ids.get('root'))

    const snapshot = inspectQmlDocument(document)

    expect(snapshot.objectCount).toBe(2)
    expect(snapshot.roots[0]).toMatchObject({
      type: 'Item',
      id: 'root',
      properties: { width: 320, metadata: ['1', 'two'] },
      children: [{ type: 'Rectangle', id: 'panel' }],
    })
    expect(snapshot.roots[0].children[0].properties['anchors.fill']).toBe('[Item]')
    expect(() => JSON.stringify(snapshot)).not.toThrow()
  })
})
