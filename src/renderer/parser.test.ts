import { describe, expect, it } from 'vitest'
import { parseQML, parseQMLDocument } from './parser'

describe('parseQML compatibility baseline', () => {
  it('preserves module, path, version, and alias imports', () => {
    const document = parseQMLDocument(`
      import QtQuick 2.15
      import QtQuick.Controls as Controls
      import "components" as Local
      Item {}
    `)

    expect(document.imports).toMatchObject([
      { uri: 'QtQuick', version: '2.15', alias: undefined, isPath: false },
      { uri: 'QtQuick.Controls', version: undefined, alias: 'Controls', isPath: false },
      { uri: 'components', version: undefined, alias: 'Local', isPath: true },
    ])
    expect(document.imports.map(entry => entry.sourceRange?.start.line)).toEqual([2, 3, 4])
    expect(document.nodes[0].type).toBe('Item')
  })

  it('parses Behavior on <property> as a Behavior child element', () => {
    const [root] = parseQML(`
      import QtQuick
      Rectangle {
        color: "#333"
        Behavior on color { ColorAnimation { duration: 200 } }
      }
    `)
    expect(root.type).toBe('Rectangle')
    const behavior = root.children.find(child => child.type === 'Behavior')
    expect(behavior).toBeTruthy()
    expect(behavior?.behaviorOn).toBe('color')
    const animation = behavior?.children.find(child => child.type === 'ColorAnimation')
    expect(animation?.properties.duration).toBe('200')
  })

  it('parses transition block property on a DelayButton', () => {
    const [root] = parseQML(`
      import QtQuick.Controls
      DelayButton {
        delay: 2000
        transition: Transition {
          NumberAnimation {
            property: "progress"
            duration: 200
            easing.type: Easing.Linear
          }
        }
      }
    `)
    expect(root.type).toBe('DelayButton')
    const transition = root.blockProperties?.transition
    expect(transition?.type).toBe('Transition')
    const animation = transition?.children.find(child => child.type === 'NumberAnimation')
    expect(animation?.properties.duration).toBe('200')
    expect(animation?.properties['easing.type']).toBe('Easing.Linear')
  })

  it('parses imports, typed properties, expressions, and ids', () => {
    const [root] = parseQML(`
      import QtQuick
      import QtQuick.Controls

      ApplicationWindow {
        id: root
        property int count: 1
        property string label: "Count " + count
        width: 640
      }
    `)

    expect(root.type).toBe('ApplicationWindow')
    expect(root.id).toBe('root')
    expect(root.properties).toMatchObject({
      id: 'root',
      count: '1',
      label: '"Count " + count',
      width: '640',
    })
  })

  it('parses methods, child objects, and object-valued properties', () => {
    const [root] = parseQML(`
      ApplicationWindow {
        function increment(step) { count += step }

        header: ToolBar {
          height: 40
        }

        Column {
          Text { text: "Hello" }
        }
      }
    `)

    expect(root.methods?.increment).toContain('count += step')
    expect(root.blockProperties?.header).toMatchObject({
      type: 'ToolBar',
      properties: { height: '40' },
    })
    expect(root.children[0]).toMatchObject({
      type: 'Column',
      children: [{ type: 'Text', properties: { text: 'Hello' } }],
    })
  })

  it('retains handler blocks and qualified properties', () => {
    const [button] = parseQML(`
      Button {
        anchors.centerIn: parent
        onClicked: {
          console.log("clicked")
        }
      }
    `)

    expect(button.properties['anchors.centerIn']).toBe('parent')
    expect(button.properties.onClicked).toContain('console.log("clicked")')
  })

  it('preserves property types, modifiers, and optional initializers', () => {
    const [item] = parseQML(`
      Item {
        default property color accent: "red"
        required property string title
        readonly property list<Item> entries: []
      }
    `)

    expect(item.propertyDeclarations).toEqual({
      accent: {
        name: 'accent',
        type: 'color',
        isDefault: true,
        isRequired: false,
        isReadonly: false,
        value: 'red',
      },
      title: {
        name: 'title',
        type: 'string',
        isDefault: false,
        isRequired: true,
        isReadonly: false,
      },
      entries: {
        name: 'entries',
        type: 'list<Item>',
        isDefault: false,
        isRequired: false,
        isReadonly: true,
        value: '[]',
      },
    })
    expect(item.properties).toMatchObject({ accent: 'red', entries: '[]' })
  })

  it('preserves signal names and typed parameters', () => {
    const [item] = parseQML(`
      Item {
        signal activated(int index, string text)
        signal dismissed()
      }
    `)

    expect(item.signals).toEqual({
      activated: {
        name: 'activated',
        parameters: [
          { name: 'index', type: 'int' },
          { name: 'text', type: 'string' },
        ],
      },
      dismissed: { name: 'dismissed', parameters: [] },
    })
  })

  it('tracks source ranges for root and nested objects', () => {
    const document = parseQMLDocument(`import QtQuick
Item {
  Rectangle {
    width: 20
  }
}`)

    expect(document.nodes[0].sourceRange).toMatchObject({
      start: { offset: 15, line: 2, column: 1 },
      end: { line: 6, column: 2 },
    })
    expect(document.nodes[0].children[0].sourceRange).toMatchObject({
      start: { line: 3, column: 3 },
      end: { line: 5, column: 4 },
    })
  })

  it('recovers at the next valid top-level object', () => {
    const document = parseQMLDocument(`not valid QML here
Item { width: 10 }
Rectangle { height: 20 }`)

    expect(document.nodes.map(node => node.type)).toEqual(['Item', 'Rectangle'])
    expect(document.diagnostics).toMatchObject([
      { code: 'unexpected-token', range: { start: { line: 1, column: 1 } } },
    ])
  })

  it('tracks property source ranges', () => {
    const [item] = parseQML(`Item {
  width: parent.width / 2
}`)

    expect(item.propertyRanges?.width).toMatchObject({
      start: { line: 2, column: 3 },
      end: { line: 2, column: 26 },
    })
  })

  it('parses object-list properties for declarative runtime objects', () => {
    const [item] = parseQML(`Item {
      states: [
        State { name: "active" },
        State { name: "disabled" }
      ]
    }`)

    expect(item.objectListProperties?.states.map(state => state.properties.name)).toEqual([
      'active',
      'disabled',
    ])
  })

  it('preserves nested JavaScript literals and template expressions', () => {
    const [item] = parseQML(`Item {
      property var points: [{ x: 1, meta: { label: "a" } }, { x: 2 }]
      property string message: \`value: \${points[0].x}\`
    }`)

    expect(item.properties.points).toBe('[{ x: 1, meta: { label: "a" } }, { x: 2 }]')
    expect(item.properties.message).toBe('`value: ${points[0].x}`')
  })

  it('reports invalid imports and unterminated structures with locations', () => {
    const document = parseQMLDocument(`import 12Broken
Item {
  text: "unfinished`)

    expect(document.diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'invalid-import',
      'unterminated-object',
      'unterminated-string',
    ])
    expect(document.diagnostics[1].range.start).toMatchObject({ line: 2, column: 6 })
    expect(document.diagnostics[2].range.start).toMatchObject({ line: 3, column: 9 })
  })

  it('diagnoses empty properties and unterminated templates', () => {
    const empty = parseQMLDocument('Item {\n  width:\n  height: 20\n}')
    const template = parseQMLDocument('Item { text: `unfinished }')

    expect(empty.diagnostics).toMatchObject([
      { code: 'missing-property-value', range: { start: { line: 2, column: 8 } } },
    ])
    expect(template.diagnostics.map(diagnostic => diagnostic.code)).toContain('unterminated-template')
  })

  it('parses multi-line ternary expressions without swallowing following properties', () => {
    const [checkBox] = parseQML(`
      CheckBox {
        text: "Third"
        tristate: true
        checkState: allChildrenChecked ? Qt.Checked :
                    anyChildChecked ? Qt.PartiallyChecked : Qt.Unchecked
        nextCheckState: function() {
          if (checkState === Qt.Checked) return Qt.Unchecked
          else return Qt.Checked
        }
        onClicked: { console.log("clicked") }
        onPressed: { console.log("pressed") }
        onToggled: { console.log("toggled") }
      }
    `)

    expect(checkBox.properties.checkState).toBe(
      'allChildrenChecked ? Qt.Checked :\n          anyChildChecked ? Qt.PartiallyChecked : Qt.Unchecked',
    )
    expect(checkBox.methods?.nextCheckState).toContain('return Qt.Unchecked')
    expect(checkBox.properties.onClicked).toContain('console.log("clicked")')
    expect(checkBox.properties.onPressed).toContain('console.log("pressed")')
    expect(checkBox.properties.onToggled).toContain('console.log("toggled")')
  })

  it('parses single-line ternary followed by another property', () => {
    const [rect] = parseQML(`
      Rectangle {
        width: visible ? 100 : 0
        height: 200
      }
    `)

    expect(rect.properties.width).toBe('visible ? 100 : 0')
    expect(rect.properties.height).toBe('200')
  })
})
