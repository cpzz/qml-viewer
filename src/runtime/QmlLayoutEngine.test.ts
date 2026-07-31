import { describe, expect, it } from 'vitest'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'
import { QmlLayoutEngine } from './QmlLayoutEngine'

describe('QmlLayoutEngine', () => {
  it('distributes RowLayout space between fixed and fill children', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const layout = registry.create('RowLayout')
    layout.setProperty('width', 300)
    layout.setProperty('height', 80)
    layout.setProperty('spacing', 10)
    const fixed = registry.create('Rectangle', layout)
    fixed.setProperty('Layout.preferredWidth', 80)
    fixed.setProperty('Layout.fillHeight', true)
    const fill = registry.create('Rectangle', layout)
    fill.setProperty('Layout.fillWidth', true)
    fill.setProperty('Layout.fillHeight', true)
    const engine = new QmlLayoutEngine(layout)

    expect(fixed.getProperty('x')).toBe(0)
    expect(fixed.getProperty('width')).toBe(80)
    expect(fixed.getProperty('height')).toBe(80)
    expect(fill.getProperty('x')).toBe(90)
    expect(fill.getProperty('width')).toBe(210)
  })

  it('reacts to ColumnLayout geometry and attached-property changes', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const layout = registry.create('ColumnLayout')
    layout.setProperty('width', 120)
    layout.setProperty('height', 200)
    const first = registry.create('Item', layout)
    const second = registry.create('Item', layout)
    first.setProperty('Layout.fillHeight', true)
    second.setProperty('Layout.fillHeight', true)
    const engine = new QmlLayoutEngine(layout)

    expect(first.getProperty('height')).toBe(97.5)
    expect(second.getProperty('y')).toBe(102.5)

    layout.setProperty('height', 300)
    expect(first.getProperty('height')).toBe(147.5)
    expect(second.getProperty('y')).toBe(152.5)
    engine.dispose()
  })

  it('places GridLayout children with explicit cells and spans', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const layout = registry.create('GridLayout')
    layout.setProperty('width', 210)
    layout.setProperty('height', 110)
    layout.setProperty('columns', 2)
    layout.setProperty('columnSpacing', 10)
    layout.setProperty('rowSpacing', 10)
    const first = registry.create('Item', layout)
    const spanning = registry.create('Item', layout)
    spanning.setProperty('Layout.row', 1)
    spanning.setProperty('Layout.column', 0)
    spanning.setProperty('Layout.columnSpan', 2)
    const engine = new QmlLayoutEngine(layout)

    expect(first.getProperty('width')).toBe(100)
    expect(first.getProperty('height')).toBe(50)
    expect(spanning.getProperty('x')).toBe(0)
    expect(spanning.getProperty('y')).toBe(60)
    expect(spanning.getProperty('width')).toBe(210)
  })

  it('uses reactive implicit sizes when no preferred size is set', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const layout = registry.create('RowLayout')
    layout.setProperty('width', 200)
    layout.setProperty('height', 40)
    const label = registry.create('Text', layout)
    label.setInternalProperty('implicitWidth', 60)
    label.setInternalProperty('implicitHeight', 20)
    const fill = registry.create('Item', layout)
    fill.setProperty('Layout.fillWidth', true)
    const engine = new QmlLayoutEngine(layout)

    expect(label.getProperty('width')).toBe(60)
    expect(fill.getProperty('x')).toBe(65)
    expect(fill.getProperty('width')).toBe(135)

    label.setInternalProperty('implicitWidth', 80)
    expect(label.getProperty('width')).toBe(80)
    expect(fill.getProperty('width')).toBe(115)
    engine.dispose()
  })

  it('aligns linear children on the cross axis', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const row = registry.create('RowLayout')
    row.setProperty('width', 120)
    row.setProperty('height', 80)
    const top = registry.create('Item', row)
    top.setProperty('Layout.preferredWidth', 20)
    top.setProperty('Layout.preferredHeight', 20)
    top.setProperty('Layout.alignment', 'Qt.AlignTop')
    const bottom = registry.create('Item', row)
    bottom.setProperty('Layout.preferredWidth', 20)
    bottom.setProperty('Layout.preferredHeight', 20)
    bottom.setProperty('Layout.alignment', 'Qt.AlignBottom')
    const engine = new QmlLayoutEngine(row)

    expect(top.getProperty('y')).toBe(0)
    expect(bottom.getProperty('y')).toBe(60)
    engine.dispose()
  })

  it('aligns preferred-size children inside GridLayout cells', () => {
    const registry = createBuiltinQmlTypeRegistry()
    const grid = registry.create('GridLayout')
    grid.setProperty('width', 200)
    grid.setProperty('height', 100)
    const child = registry.create('Item', grid)
    child.setProperty('Layout.preferredWidth', 40)
    child.setProperty('Layout.preferredHeight', 20)
    child.setProperty('Layout.alignment', 4 | 32)
    const engine = new QmlLayoutEngine(grid)

    expect(child.getProperty('x')).toBe(80)
    expect(child.getProperty('y')).toBe(40)
    expect(child.getProperty('width')).toBe(40)
    expect(child.getProperty('height')).toBe(20)
    engine.dispose()
  })

  it('rejects non-layout objects', () => {
    const registry = createBuiltinQmlTypeRegistry()
    expect(() => new QmlLayoutEngine(registry.create('Item'))).toThrow('requires a QML Layout')
  })
})
