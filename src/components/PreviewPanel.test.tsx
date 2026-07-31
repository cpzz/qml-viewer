// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { capturePreviewScrollPositions, restorePreviewScrollPositions } from './PreviewPanel'

describe('PreviewPanel scroll preservation', () => {
  it('restores the surface and nested QML scroll containers after remount', () => {
    const before = document.createElement('div')
    const beforeScroll = document.createElement('div')
    beforeScroll.className = 'qml-runtime-node'
    beforeScroll.dataset.qmlType = 'ScrollView'
    before.append(beforeScroll)
    before.scrollLeft = 14
    before.scrollTop = 180
    beforeScroll.scrollTop = 420

    const positions = capturePreviewScrollPositions(before)
    const after = document.createElement('div')
    const afterScroll = document.createElement('div')
    afterScroll.className = 'qml-runtime-node'
    afterScroll.dataset.qmlType = 'ScrollView'
    after.append(afterScroll)
    const surfaceScrollTo = vi.fn((left: number, top: number) => {
      after.scrollLeft = left
      after.scrollTop = top
    })
    const nestedScrollTo = vi.fn((_left: number, top: number) => { afterScroll.scrollTop = top })
    after.scrollTo = surfaceScrollTo
    afterScroll.scrollTo = nestedScrollTo

    restorePreviewScrollPositions(after, positions)

    expect(surfaceScrollTo).toHaveBeenCalledWith(14, 180)
    expect(nestedScrollTo).toHaveBeenCalledWith(0, 420)
  })
})