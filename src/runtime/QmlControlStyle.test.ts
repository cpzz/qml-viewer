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
    expect(stylesheet).toMatch(/:hover/)
    expect(stylesheet).toMatch(/:active/)
    expect(stylesheet).toMatch(/:focus-visible/)
    expect(stylesheet).toMatch(/:checked/)
    expect(stylesheet).toMatch(/:disabled/)
  })
})
