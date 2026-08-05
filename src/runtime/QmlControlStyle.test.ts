import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { qmlControlStyleAttribute, qmlControlStyles } from './QmlControlStyle'

const stylesheet = readFileSync(resolve(process.cwd(), 'src/styles/main.css'), 'utf8')

describe('QML control styles', () => {
  it('exposes each supported Qt Quick Controls style as a surface attribute', () => {
    expect(qmlControlStyles.map(qmlControlStyleAttribute)).toEqual(['fusion', 'universal', 'material'])
  })

  it.each(qmlControlStyles)('%s has dark and light theme rules', style => {
    const attribute = `[data-qml-style="${qmlControlStyleAttribute(style)}"]`
    expect(stylesheet).toContain(`.qml-runtime-surface${attribute}`)
    expect(stylesheet).toContain(`.preview-panel.light .qml-runtime-surface${attribute}`)
  })

  it('styles interactive control states across the runtime surface', () => {
    expect(stylesheet).toMatch(/data-qml-type="Button"[\s\S]*?:hover/)
    expect(stylesheet).toMatch(/data-qml-type="CheckBox"[\s\S]*?:not\(\.qml-disabled\):hover/)
    expect(stylesheet).toMatch(/data-qml-type="CheckBox"[\s\S]*?:not\(\.qml-disabled\):active/)
    expect(stylesheet).toMatch(/data-qml-type="CheckBox"[\s\S]*?:focus-visible/)
    expect(stylesheet).toMatch(/data-qml-type="TextField"[\s\S]*?:not\(:disabled\):hover/)
    expect(stylesheet).toMatch(/\.qml-slider-control:hover \.qml-slider-handle/)
    expect(stylesheet).toMatch(/\.qml-slider-control:has\(> \.qml-range-native:active\)/)
    expect(stylesheet).toMatch(/\.qml-dial-control:hover/)
    expect(stylesheet).toMatch(/:disabled/)
  })

  it('lets QML runtime geometry control ItemDelegate height', () => {
    expect(stylesheet).toMatch(/\[data-qml-type="ItemDelegate"\]\s*\{\s*min-height:\s*0;/)
  })
})
