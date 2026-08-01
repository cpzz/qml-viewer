import { describe, it, expect } from 'vitest'
import { formatQML } from './qmlFormatter'

describe('qmlFormatter unbraced blocks', () => {
  it('formats if/else without braces inside function', () => {
    const source = `CheckBox {
    text: "Third"
    tristate: true
    nextCheckState: function() {
        console.log("nextCheckState: ", checkState)
        if (checkState === Qt.Checked)
        return Qt.Unchecked
        else
        return Qt.Checked
    }
}
`
    const formatted = formatQML(source)
    expect(formatted).toContain('        return Qt.Unchecked')
    expect(formatted).toContain('    else')
    expect(formatted).toContain('        return Qt.Checked')
  })

  it('splits multiple closing braces on one line into separate lines', () => {
    const source = `ColumnLayout {
    DelayButton {
        text: "Test Me"
}}
`
    const formatted = formatQML(source)
    expect(formatted).toBe(`ColumnLayout {
    DelayButton {
        text: "Test Me"
    }
}
`)
  })

  it('aligns closing braces with their opening braces in nested blocks', () => {
    const source = `ColumnLayout {
DelayButton {
text: "A"
}
DelayButton {
background: Rectangle {
Rectangle {
width: 10
}
}
}
}`
    const formatted = formatQML(source)
    expect(formatted).toBe(`ColumnLayout {
    DelayButton {
        text: "A"
    }
    DelayButton {
        background: Rectangle {
            Rectangle {
                width: 10
            }
        }
    }
}
`)
  })
})
