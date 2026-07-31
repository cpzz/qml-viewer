// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { parseQML } from '../renderer/parser'
import { createBuiltinQmlTypeRegistry } from './BuiltinQmlTypes'
import { activateQmlDocument, instantiateQmlDocument } from './QmlDocument'
import { QmlDomSceneGraph } from './QmlDomSceneGraph'
import { QmlComponent } from './QmlComponent'
import { QmlJsEngine } from './QmlJsEngine'
import { QmlItemViewController } from './QmlItemViewController'
import { QmlLoaderController } from './QmlLoaderController'
import type { QmlObject } from './QmlObject'

describe('QmlDomSceneGraph', () => {
  function createScene() {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        id: root
        width: 320
        height: 200
        Rectangle {
          id: panel
          x: 10
          y: 20
          width: 120
          height: 80
          color: "red"
          Text {
            id: label
            width: 100
            height: 24
            text: "Hello"
          }
        }
      }
    `))
    const container = document.createElement('main')
    document.body.append(container)
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, container)
    return { qmlDocument, container, sceneGraph }
  }

  it('projects ApplicationWindow as a header-content-footer shell', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      ApplicationWindow {
        id: window
        width: 640
        height: 480
        visible: true
        header: MenuBar { Menu { title: "File" }; Menu { title: "Help" } }
        footer: MenuBar { Menu { title: "Status" } }
        ScrollView { id: content; anchors.fill: parent; ColumnLayout { id: column; width: parent.width; anchors.margins: 16; Label { text: "Body" }; ListView { id: list; width: parent.width; height: 100 }; RowLayout { Button { text: "One" }; Button { text: "Two" } }; GroupBox { id: group; title: "Options"; ColumnLayout { id: options; CheckBox { text: "Enabled" } } } } }
      }
    `))
    const sceneGraph = new QmlDomSceneGraph(document)
    const container = document.createElement('main')
    document.body.append(container)
    sceneGraph.mount(qmlDocument, container)
    const windowObject = qmlDocument.ids.get('window')!
    const content = qmlDocument.ids.get('content')!
    const windowElement = sceneGraph.getElement(windowObject)!
    const header = sceneGraph.getElement(windowObject.getProperty('header') as QmlObject)!
    const footer = sceneGraph.getElement(windowObject.getProperty('footer') as QmlObject)!

    expect(windowElement.style.display).toBe('grid')
    expect(windowElement.style.gridTemplateRows).toBe('36px minmax(0, 1fr) 32px')
    expect(header.style.gridRow).toBe('1')
    expect(header.textContent).toContain('File')
    expect(header.textContent).toContain('Help')
    expect(sceneGraph.getElement(content)?.style.gridRow).toBe('2')
    expect(content.getProperty('width')).toBe(640)
    expect(sceneGraph.getElement(qmlDocument.ids.get('list')!)?.style.maxWidth).toBe('100%')
    expect(sceneGraph.getElement(qmlDocument.ids.get('list')!)?.style.width).toBe('auto')
    expect(sceneGraph.getElement(qmlDocument.ids.get('column')!)?.style.height).toBe('auto')
    expect(sceneGraph.getElement(qmlDocument.ids.get('column')!)?.style.width).toBe('auto')
    expect(sceneGraph.getElement(qmlDocument.ids.get('group')!)?.style.height).toBe('auto')
    expect(sceneGraph.getElement(qmlDocument.ids.get('options')!)?.style.position).toBe('relative')
    expect(footer.style.gridRow).toBe('3')
    expect(footer.textContent).toContain('Status')
    sceneGraph.dispose()
  })

  it('projects live Canvas, chart, particle, and shader contexts', () => {
    const context = {
      fillStyle: '',
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        Canvas { id: canvas; width: 100; height: 50 }
        ChartView { id: chart; width: 120; height: 60; series: [1, 2, 3] }
        ParticleSystem { id: particles; width: 80; height: 40; particles: [{ x: 10, y: 12, size: 3 }] }
        ShaderEffect { id: shader; width: 64; height: 64; fragmentShader: "void main() {}"; fallbackFilter: "opacity(0.5)" }
      }
    `))
    const sceneGraph = new QmlDomSceneGraph(document)
    const container = document.createElement('main')
    document.body.append(container)
    sceneGraph.mount(qmlDocument, container)
    const canvas = qmlDocument.ids.get('canvas')!
    const particles = qmlDocument.ids.get('particles')!
    const shader = qmlDocument.ids.get('shader')!

    particles.setProperty('particles', [{ x: 10, y: 12, size: 3 }])
    canvas.callMethod('getContext').callMethod('fillRect', 1, 2, 3, 4)
    expect(context.fillRect).toHaveBeenCalledWith(1, 2, 3, 4)
    expect((sceneGraph.getElement(canvas) as HTMLCanvasElement).width).toBe(100)
    expect(context.arc).toHaveBeenCalled()
    expect(sceneGraph.getElement(shader)?.dataset.fragmentShader).toBe('void main() {}')
    expect(sceneGraph.getElement(shader)?.style.filter).toBe('')
    sceneGraph.dispose()
  })

  it('projects browser-backed web, media, and visual effects', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        width: 500; height: 300
        WebEngineView { id: web; width: 200; height: 120; url: "https://example.com" }
        VideoOutput { id: video; x: 210; width: 200; height: 120; source: "movie.mp4"; autoPlay: false; muted: true; controls: true }
        DropShadow { id: shadow; y: 140; width: 100; height: 80; radius: 12; horizontalOffset: 2; verticalOffset: 4; color: "#80000000" }
        OpacityMask { id: mask; x: 120; y: 140; width: 100; height: 80; maskSource: "mask.png" }
      }
    `))
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, document.createElement('main'))
    const web = qmlDocument.ids.get('web')!
    const video = qmlDocument.ids.get('video')!
    const webElement = sceneGraph.getElement(web) as HTMLIFrameElement
    const videoElement = sceneGraph.getElement(video) as HTMLVideoElement
    const started = vi.fn()
    const stopped = vi.fn()
    video.connectSignal('started', started)
    video.connectSignal('stopped', stopped)
    videoElement.dispatchEvent(new Event('play'))
    videoElement.dispatchEvent(new Event('pause'))

    expect(webElement.tagName).toBe('IFRAME')
    expect(webElement.referrerPolicy).toBe('no-referrer')
    expect(videoElement.getAttribute('src')).toBe('movie.mp4')
    expect(videoElement.controls).toBe(true)
    expect(started).toHaveBeenCalledOnce()
    expect(stopped).toHaveBeenCalledOnce()
    expect(sceneGraph.getElement(qmlDocument.ids.get('shadow')!)?.style.filter).toContain('drop-shadow')
    expect(sceneGraph.getElement(qmlDocument.ids.get('mask')!)?.style.maskImage).toContain('mask.png')
    sceneGraph.dispose()
  })

  it('mounts a retained DOM tree with type-specific content and styles', () => {
    const { qmlDocument, container, sceneGraph } = createScene()
    const root = qmlDocument.ids.get('root')!
    const panel = qmlDocument.ids.get('panel')!
    const label = qmlDocument.ids.get('label')!

    expect(container.querySelectorAll('.qml-runtime-node')).toHaveLength(3)
    expect(sceneGraph.getElement(root)?.style.width).toBe('320px')
    expect(sceneGraph.getElement(panel)?.style.backgroundColor).toBe('red')
    expect(sceneGraph.getElement(panel)?.style.left).toBe('10px')
    expect(sceneGraph.getElement(label)?.textContent).toBe('Hello')
    expect(sceneGraph.getElement(label)?.parentElement).toBe(sceneGraph.getElement(panel))
  })

  it('preserves caller-defined container positioning', () => {
    const qmlDocument = instantiateQmlDocument(parseQML('Item { width: 100; height: 100 }'))
    const container = document.createElement('main')
    container.style.position = 'absolute'
    const sceneGraph = new QmlDomSceneGraph(document)

    sceneGraph.mount(qmlDocument, container)

    expect(container.style.position).toBe('absolute')
    sceneGraph.dispose()
  })

  it('updates existing elements when runtime properties change', () => {
    const { qmlDocument, sceneGraph } = createScene()
    const panel = qmlDocument.ids.get('panel')!
    const label = qmlDocument.ids.get('label')!
    const panelElement = sceneGraph.getElement(panel)
    const labelElement = sceneGraph.getElement(label)

    panel.setProperty('color', 'blue')
    panel.setProperty('x', 40)
    label.setProperty('text', 'Updated')

    expect(sceneGraph.getElement(panel)).toBe(panelElement)
    expect(panelElement?.style.backgroundColor).toBe('blue')
    expect(panelElement?.style.left).toBe('40px')
    expect(sceneGraph.getElement(label)).toBe(labelElement)
    expect(labelElement?.textContent).toBe('Updated')
  })

  it('projects reactive implicit sizes for text and controls', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        Text { id: label; text: "Hello"; font.pixelSize: 20 }
        Button { id: button; text: "Continue" }
      }
    `))
    const container = document.createElement('main')
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, container)
    const label = qmlDocument.ids.get('label')!
    const button = qmlDocument.ids.get('button')!

    expect(label.getProperty('implicitWidth')).toBe(60)
    expect(label.getProperty('implicitHeight')).toBe(24)
    expect(sceneGraph.getElement(label)?.style.width).toBe('60px')
    expect(button.getProperty('implicitWidth')).toBe(88)
    expect(sceneGraph.getElement(button)?.style.height).toBe('30px')

    label.setProperty('text', 'Hello world')
    expect(label.getProperty('implicitWidth')).toBe(132)
    expect(sceneGraph.getElement(label)?.style.width).toBe('132px')
    sceneGraph.dispose()
  })

  it('enforces control tab and click focus policies', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        Button { id: button; text: "Focus" }
      }
    `))
    const container = document.createElement('main')
    document.body.append(container)
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, container)
    const button = qmlDocument.ids.get('button')!
    const element = sceneGraph.getElement(button)!

    expect(element.tabIndex).toBe(0)
    button.setProperty('focusPolicy', 'Qt.ClickFocus')
    expect(element.tabIndex).toBe(-1)

    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(button.getProperty('activeFocus')).toBe(true)

    button.setProperty('focusPolicy', 'Qt.NoFocus')
    element.blur()
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(button.getProperty('activeFocus')).toBe(false)
    sceneGraph.dispose()
  })

  it('projects Control background and contentItem block properties in layer order', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        Button {
          id: button
          width: 100
          height: 40
          padding: 6
          text: "Fallback"
          background: Rectangle { id: background; color: "red" }
          contentItem: Text { id: content; text: "Custom" }
        }
      }
    `))
    const container = document.createElement('main')
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, container)
    const button = qmlDocument.ids.get('button')!
    const background = qmlDocument.ids.get('background')!
    const content = qmlDocument.ids.get('content')!
    const buttonElement = sceneGraph.getElement(button)!

    expect(button.getProperty('background')).toBe(background)
    expect(button.getProperty('contentItem')).toBe(content)
    expect(buttonElement.children[0]).toBe(sceneGraph.getElement(background))
    expect(buttonElement.children[1]).toBe(sceneGraph.getElement(content))
    expect(background.getProperty('width')).toBe(100)
    expect(content.getProperty('x')).toBe(6)
    expect(content.getProperty('width')).toBe(88)
    expect(buttonElement.textContent).toBe('Custom')
    sceneGraph.dispose()
  })

  it('mounts popups in an overlay and applies lifecycle close policies', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        Popup { id: popup; width: 120; height: 80 }
        Dialog { id: dialog; modal: true }
        Menu { id: menu; MenuItem { id: action; text: "Open" } }
      }
    `))
    const container = document.createElement('main')
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, container)
    const popup = qmlDocument.ids.get('popup')!
    const dialog = qmlDocument.ids.get('dialog')!
    const menu = qmlDocument.ids.get('menu')!
    const action = qmlDocument.ids.get('action')!
    const popupElement = sceneGraph.getElement(popup)!
    const overlay = container.querySelector('.qml-runtime-overlay')!
    const popupEvents: string[] = []
    popup.connectSignal('aboutToShow', () => popupEvents.push('aboutToShow'))
    popup.connectSignal('opened', () => popupEvents.push('opened'))
    popup.connectSignal('closed', () => popupEvents.push('closed'))

    expect(popupElement.parentElement).toBe(overlay)
    expect(popupElement.style.display).toBe('none')
    popup.callMethod('open')
    expect(popupEvents).toEqual(['aboutToShow', 'opened'])
    expect(popupElement.style.display).toBe('')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(popup.getProperty('visible')).toBe(false)
    expect(popupEvents.at(-1)).toBe('closed')

    let accepted = false
    dialog.connectSignal('accepted', () => { accepted = true })
    dialog.callMethod('open')
    dialog.callMethod('accept')
    expect(accepted).toBe(true)
    expect(dialog.getProperty('visible')).toBe(false)

    let triggered = false
    action.connectSignal('clicked', () => { triggered = true })
    menu.callMethod('open')
    sceneGraph.getElement(action)?.click()
    expect(triggered).toBe(true)
    expect(menu.getProperty('visible')).toBe(false)
    sceneGraph.dispose()
  })

  it('applies MouseArea propagation policy and maps touch pointers', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      MouseArea {
        id: outer
        width: 100
        height: 100
        MouseArea { id: inner; width: 50; height: 50 }
      }
    `))
    const container = document.createElement('main')
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, container)
    const outer = qmlDocument.ids.get('outer')!
    const inner = qmlDocument.ids.get('inner')!
    const innerElement = sceneGraph.getElement(inner)!
    let outerClicks = 0
    let innerClicks = 0
    outer.connectSignal('clicked', () => { outerClicks++ })
    inner.connectSignal('clicked', () => { innerClicks++ })

    innerElement.click()
    expect([innerClicks, outerClicks]).toEqual([1, 0])
    inner.setProperty('propagateComposedEvents', true)
    innerElement.click()
    expect([innerClicks, outerClicks]).toEqual([2, 1])

    const touchEvent = (name: string) => {
      const event = new Event(name, { bubbles: true })
      Object.assign(event, { pointerType: 'touch', pointerId: 7, isPrimary: true, pressure: 0.5, buttons: 1, offsetX: 4, offsetY: 6 })
      return event
    }
    innerElement.dispatchEvent(touchEvent('pointerdown'))
    expect(inner.getProperty('pressed')).toBe(true)
    innerElement.dispatchEvent(touchEvent('pointerup'))
    expect(inner.getProperty('pressed')).toBe(false)
    expect(innerClicks).toBe(3)
    sceneGraph.dispose()
  })

  it('unsubscribes and removes mounted nodes on disposal', () => {
    const { qmlDocument, container, sceneGraph } = createScene()
    const label = qmlDocument.ids.get('label')!
    const labelElement = sceneGraph.getElement(label)!

    sceneGraph.dispose()
    label.setProperty('text', 'After disposal')

    expect(container.childElementCount).toBe(0)
    expect(sceneGraph.getElement(label)).toBeUndefined()
    expect(labelElement.textContent).toBe('Hello')
  })

  it('reflects reactive JavaScript binding changes in the mounted DOM', async () => {
    const jsEngine = await QmlJsEngine.create()
    const qmlDocument = activateQmlDocument(parseQML(`
      Item {
        id: root
        property color accent: "red"
        Rectangle {
          id: panel
          width: 100
          height: 60
          color: accent
        }
      }
    `), jsEngine)
    const container = document.createElement('main')
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, container)
    const root = qmlDocument.ids.get('root')!
    const panel = qmlDocument.ids.get('panel')!
    const panelElement = sceneGraph.getElement(panel)!

    expect(panelElement.style.backgroundColor).toBe('red')
    root.setProperty('accent', 'blue')

    expect(sceneGraph.getElement(panel)).toBe(panelElement)
    expect(panelElement.style.backgroundColor).toBe('blue')
  })

  it('recomputes fill and center anchors when parent geometry changes', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        id: root
        width: 300
        height: 200
        Rectangle {
          id: fillItem
          anchors.fill: parent
          anchors.margins: 10
        }
        Rectangle {
          id: centeredItem
          width: 100
          height: 40
          anchors.centerIn: parent
        }
      }
    `))
    const container = document.createElement('main')
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, container)
    const root = qmlDocument.ids.get('root')!
    const fillElement = sceneGraph.getElement(qmlDocument.ids.get('fillItem')!)!
    const centeredElement = sceneGraph.getElement(qmlDocument.ids.get('centeredItem')!)!

    expect(fillElement.style.cssText).toContain('left: 10px')
    expect(fillElement.style.width).toBe('280px')
    expect(fillElement.style.height).toBe('180px')
    expect(centeredElement.style.left).toBe('100px')
    expect(centeredElement.style.top).toBe('80px')

    root.setProperty('width', 400)

    expect(fillElement.style.width).toBe('380px')
    expect(centeredElement.style.left).toBe('150px')
  })

  it('bridges DOM pointer events to MouseArea state and QML handlers', async () => {
    const jsEngine = await QmlJsEngine.create()
    const qmlDocument = activateQmlDocument(parseQML(`
      Item {
        id: root
        property int clickCount: 0
        width: 200
        height: 100
        MouseArea {
          id: input
          anchors.fill: parent
          onClicked: { clickCount += 1 }
        }
      }
    `), jsEngine)
    const container = document.createElement('main')
    document.body.append(container)
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, container)
    const input = qmlDocument.ids.get('input')!
    const inputElement = sceneGraph.getElement(input)!

    inputElement.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    inputElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    expect(input.getProperty('containsMouse')).toBe(true)
    expect(input.getProperty('pressed')).toBe(true)

    inputElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }))
    inputElement.click()

    expect(input.getProperty('pressed')).toBe(false)
    expect(qmlDocument.ids.get('root')?.getProperty('clickCount')).toBe(1)
  })

  it('tracks active focus and forwards keyboard events', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        id: root
        width: 100
        height: 50
        focus: true
      }
    `))
    const container = document.createElement('main')
    document.body.append(container)
    const sceneGraph = new QmlDomSceneGraph(document)
    const pressed: Event[] = []
    const root = qmlDocument.ids.get('root')!
    root.connectSignal('keyPressed', event => pressed.push(event as Event))
    sceneGraph.mount(qmlDocument, container)
    const rootElement = sceneGraph.getElement(root)!

    rootElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    expect(document.activeElement).toBe(rootElement)
    expect(root.getProperty('activeFocus')).toBe(true)
    expect((pressed[0] as KeyboardEvent).key).toBe('Enter')
  })

  it('reconciles retained nodes created and removed by Loader', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        width: 200
        height: 100
        Loader {
          id: loader
          width: 200
          height: 100
        }
      }
    `))
    const container = document.createElement('main')
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, container)
    const loader = qmlDocument.ids.get('loader')!
    const controller = new QmlLoaderController(loader)
    const component = new QmlComponent(`
      Rectangle {
        width: 80
        height: 40
        color: "green"
      }
    `, createBuiltinQmlTypeRegistry())

    loader.setProperty('sourceComponent', component)
    const item = loader.getProperty('item') as QmlObject
    const itemElement = sceneGraph.getElement(item)

    expect(item.parent).toBe(loader)
    expect(itemElement?.style.backgroundColor).toBe('green')
    expect(itemElement?.parentElement).toBe(sceneGraph.getElement(loader))

    loader.setProperty('sourceComponent', null)

    expect(loader.getProperty('item')).toBeNull()
    expect(sceneGraph.getElement(item)).toBeUndefined()
    expect(itemElement?.isConnected).toBe(false)
    controller.dispose()
  })

  it('mounts declarative Component content only through an active Loader', async () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      ColumnLayout {
        width: 240
        Component { id: card; Rectangle { width: 180; height: 36; color: "gold"; Label { text: "Card" } } }
        Loader { id: loader; active: true; sourceComponent: card }
      }
    `))
    const loader = qmlDocument.ids.get('loader')!
    loader.setProperty('sourceComponent', qmlDocument.ids.get('card'))
    const controller = new QmlLoaderController(loader)
    await controller.reload()
    const sceneGraph = new QmlDomSceneGraph(document)
    const container = document.createElement('main')
    sceneGraph.mount(qmlDocument, container)
    const item = loader.getProperty('item') as QmlObject

    expect(sceneGraph.getElement(item)?.parentElement).toBe(sceneGraph.getElement(loader))
    expect(sceneGraph.getElement(loader)?.style.height).toBe('36px')
    expect(container.textContent).toContain('Card')
    loader.setProperty('active', false)
    await vi.waitFor(() => expect(loader.getProperty('item')).toBeNull())
    expect(container.textContent).not.toContain('Card')
    controller.dispose()
    sceneGraph.dispose()
  })

  it('renders and scrolls virtualized ListView delegates', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      ListView {
        id: view
        width: 100
        height: 40
      }
    `))
    const view = qmlDocument.ids.get('view')!
    view.setProperty('model', Array.from({ length: 20 }, (_, index) => `Row ${index}`))
    view.setProperty('delegate', new QmlComponent(`
      Text {
        property int index: -1
        property var modelData
        width: 100
        height: 20
        text: "row"
      }
    `, createBuiltinQmlTypeRegistry()))
    const controller = new QmlItemViewController(view)
    const container = document.createElement('main')
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, container)

    expect(view.children).toHaveLength(2)
    expect(sceneGraph.getElement(view)?.style.overflow).toBe('hidden')
    expect(sceneGraph.getElement(controller.itemAt(0)!)?.style.top).toBe('0px')

    controller.positionViewAtIndex(10)

    expect(controller.itemAt(10)).not.toBeNull()
    expect(sceneGraph.getElement(controller.itemAt(10)!)?.style.top).toBe('0px')
    expect(view.children).toHaveLength(2)
    controller.dispose()
  })

  it('projects basic controls and bridges native DOM interaction', async () => {
    const jsEngine = await QmlJsEngine.create()
    const qmlDocument = activateQmlDocument(parseQML(`
      Item {
        id: root
        property int clicks: 0
        width: 300
        height: 200
        Button {
          id: button
          width: 100
          height: 30
          text: "Run"
          onClicked: { clicks += 1 }
        }
        TextField { id: field; width: 120; height: 30 }
        CheckBox { id: check; width: 20; height: 20; text: "Enabled" }
        Slider { id: slider; width: 150; height: 24; from: 0; to: 10 }
      }
    `), jsEngine)
    const container = document.createElement('main')
    document.body.append(container)
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, container)
    const button = qmlDocument.ids.get('button')!
    const field = qmlDocument.ids.get('field')!
    const check = qmlDocument.ids.get('check')!
    const slider = qmlDocument.ids.get('slider')!
    const accepted: unknown[] = []
    field.connectSignal('accepted', () => accepted.push(true))

    const buttonElement = sceneGraph.getElement(button) as HTMLButtonElement
    const fieldElement = sceneGraph.getElement(field) as HTMLInputElement
    const checkElement = sceneGraph.getElement(check)!
    const sliderElement = sceneGraph.getElement(slider)!
    buttonElement.click()
    fieldElement.value = 'Hello'
    fieldElement.dispatchEvent(new InputEvent('input', { bubbles: true }))
    fieldElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    checkElement.querySelector('input')?.click()
    const sliderInput = sliderElement.querySelector<HTMLInputElement>('.qml-range-native')!
    sliderInput.value = '7'
    sliderInput.dispatchEvent(new InputEvent('input', { bubbles: true }))

    expect(buttonElement.tagName).toBe('BUTTON')
    expect(buttonElement.textContent).toBe('Run')
    expect(qmlDocument.ids.get('root')?.getProperty('clicks')).toBe(1)
    expect(field.getProperty('text')).toBe('Hello')
    expect(accepted).toEqual([true])
    expect(check.getProperty('checked')).toBe(true)
    expect(slider.getProperty('value')).toBe(7)
    expect(sliderElement.querySelector('.qml-slider-track')).not.toBeNull()
    expect(sliderElement.querySelector('.qml-slider-fill')).not.toBeNull()
    expect(sliderElement.querySelector('.qml-slider-handle')).not.toBeNull()
  })

  it('projects common text, button, container, and status controls', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        width: 400; height: 300
        Label { id: label; text: "Name" }
        TextArea { id: area; y: 30; width: 160; height: 60; placeholderText: "Notes" }
        RadioButton { id: radio; y: 100; width: 100; height: 24; text: "Choice"; ButtonGroup.group: "choices" }
        RoundButton { id: round; y: 130; width: 32; height: 32; text: "+" }
        ScrollView { id: scroll; y: 170; width: 120; height: 80 }
        GroupBox { id: group; x: 180; width: 160; height: 100; title: "Settings" }
        BusyIndicator { id: busy; x: 180; y: 120; width: 24; height: 24; running: true }
      }
    `))
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, document.createElement('main'))
    const area = qmlDocument.ids.get('area')!
    const areaElement = sceneGraph.getElement(area) as HTMLTextAreaElement

    areaElement.value = 'Updated'
    areaElement.dispatchEvent(new InputEvent('input', { bubbles: true }))

    expect(sceneGraph.getElement(qmlDocument.ids.get('label')!)?.textContent).toBe('Name')
    expect(areaElement.placeholder).toBe('Notes')
    expect(area.getProperty('text')).toBe('Updated')
    expect(sceneGraph.getElement(qmlDocument.ids.get('radio')!)?.querySelector('input')?.type).toBe('radio')
    expect(sceneGraph.getElement(qmlDocument.ids.get('radio')!)?.textContent).toContain('Choice')
    expect(sceneGraph.getElement(qmlDocument.ids.get('round')!)?.tagName).toBe('BUTTON')
    expect(sceneGraph.getElement(qmlDocument.ids.get('scroll')!)?.style.overflow).toBe('auto')
    expect(sceneGraph.getElement(qmlDocument.ids.get('group')!)?.getAttribute('aria-label')).toBe('Settings')
    expect(sceneGraph.getElement(qmlDocument.ids.get('busy')!)?.getAttribute('aria-busy')).toBe('true')
    sceneGraph.dispose()
  })

  it('moves focus through explicit KeyNavigation targets', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        Button { id: first; width: 80; height: 30; text: "First"; KeyNavigation.right: second }
        Button { id: second; x: 90; width: 80; height: 30; text: "Second"; KeyNavigation.left: first }
      }
    `))
    qmlDocument.ids.get('first')!.setProperty('KeyNavigation.right', qmlDocument.ids.get('second'))
    qmlDocument.ids.get('second')!.setProperty('KeyNavigation.left', qmlDocument.ids.get('first'))
    const sceneGraph = new QmlDomSceneGraph(document)
    const container = document.createElement('main')
    document.body.append(container)
    sceneGraph.mount(qmlDocument, container)
    const first = sceneGraph.getElement(qmlDocument.ids.get('first')!)!
    const second = sceneGraph.getElement(qmlDocument.ids.get('second')!)!
    first.focus()
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(second)
    sceneGraph.dispose()
  })

  it('projects extended controls and traps focus in centered popups', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        width: 400; height: 300
        ComboBox { id: combo; width: 120; height: 30; model: ["One", "Two"]; currentIndex: 0 }
        SpinBox { id: spin; width: 80; height: 30; from: 1; to: 10; value: 2 }
        Switch { id: toggle; width: 40; height: 24 }
        ProgressBar { id: progress; width: 100; height: 12; from: 0; to: 10; value: 4 }
        Popup {
          id: popup; width: 200; height: 100; visible: true; centerInOverlay: true
          Button { id: first; width: 60; height: 24; text: "First" }
          Button { id: last; x: 70; width: 60; height: 24; text: "Last" }
        }
      }
    `))
    const container = document.createElement('main')
    Object.defineProperties(container, {
      clientWidth: { value: 400 },
      clientHeight: { value: 300 },
    })
    document.body.append(container)
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, container)
    const combo = qmlDocument.ids.get('combo')!
    const spin = qmlDocument.ids.get('spin')!
    const toggle = qmlDocument.ids.get('toggle')!
    const progress = qmlDocument.ids.get('progress')!
    const popup = qmlDocument.ids.get('popup')!
    const comboElement = sceneGraph.getElement(combo) as HTMLSelectElement

    comboElement.selectedIndex = 1
    comboElement.dispatchEvent(new Event('change', { bubbles: true }))
    expect(combo.getProperty('currentIndex')).toBe(1)
    expect(combo.getProperty('currentText')).toBe('Two')

    const spinElement = sceneGraph.getElement(spin) as HTMLInputElement
    spinElement.value = '7'
    spinElement.dispatchEvent(new Event('input', { bubbles: true }))
    expect(spin.getProperty('value')).toBe(7)
    expect(sceneGraph.getElement(toggle)?.querySelector('input')?.type).toBe('checkbox')
    expect((sceneGraph.getElement(progress) as HTMLProgressElement).value).toBe(4)
    expect(sceneGraph.getElement(popup)?.style.left).toBe('100px')
    expect(sceneGraph.getElement(popup)?.style.top).toBe('100px')

    const first = sceneGraph.getElement(qmlDocument.ids.get('first')!)!
    const last = sceneGraph.getElement(qmlDocument.ids.get('last')!)!
    last.focus()
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(first)
    sceneGraph.dispose()
  })

  it('projects advanced controls, navigation containers, and overlays', () => {
    vi.useFakeTimers()
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        width: 500; height: 400
        RangeSlider { id: range; width: 180; height: 40; from: 0; to: 10; first.value: 2; second.value: 8 }
        Dial { id: dial; y: 50; width: 80; height: 80; from: 0; to: 100; value: 25 }
        Tumbler { id: tumbler; y: 140; width: 100; height: 40; model: ["A", "B"]; currentIndex: 0 }
        DelayButton { id: delayed; y: 190; width: 100; height: 30; text: "Hold"; delay: 32 }
        StackLayout {
          id: stack; x: 200; width: 200; height: 100; currentIndex: 1
          Item { id: firstPage }
          Item { id: secondPage }
        }
        SplitView { id: split; x: 200; y: 120; width: 200; height: 100; orientation: Qt.Vertical }
        Drawer { id: drawer; width: 120; height: 200; visible: true }
        ToolTip { id: tip; width: 100; height: 30; visible: true; text: "Helpful" }
      }
    `))
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, document.createElement('main'))
    const range = qmlDocument.ids.get('range')!
    const rangeTrack = sceneGraph.getElement(range)!.querySelector('.qml-range-track')
    expect(rangeTrack).toBeTruthy()
    expect(sceneGraph.getElement(range)?.querySelectorAll('.qml-range-handle')).toHaveLength(2)
    expect(sceneGraph.getElement(qmlDocument.ids.get('dial')!)?.classList.contains('qml-dial-control')).toBe(true)
    expect(sceneGraph.getElement(qmlDocument.ids.get('tumbler')!)?.classList.contains('qml-tumbler-control')).toBe(true)
    expect(sceneGraph.getElement(qmlDocument.ids.get('tumbler')!)?.querySelectorAll('.qml-tumbler-item')).toHaveLength(3)
    // Simulate dragging first handle to value 9 (clamped to second=8)
    const rangeEl = sceneGraph.getElement(range)!
    vi.spyOn(rangeEl, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 100, top: 0, bottom: 10, right: 100, height: 10, x: 0, y: 0 } as DOMRect)
    rangeEl.querySelector('.qml-range-handle[data-range-handle="first"]')!
      .dispatchEvent(new MouseEvent('mousedown', { clientX: 90, bubbles: true }))
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 90 }))
    document.dispatchEvent(new MouseEvent('mouseup', {}))
    const dial = qmlDocument.ids.get('dial')!
    const dialInput = sceneGraph.getElement(dial)!.querySelector<HTMLInputElement>('.qml-range-native')!
    dialInput.value = '60'
    dialInput.dispatchEvent(new InputEvent('input', { bubbles: true }))
    const tumbler = qmlDocument.ids.get('tumbler')!
    const tumblerElement = sceneGraph.getElement(tumbler)!
    ;(tumblerElement.querySelector('[data-index="1"]') as HTMLElement).click()
    const delayed = qmlDocument.ids.get('delayed')!
    const activated = vi.fn()
    delayed.connectSignal('activated', activated)
    sceneGraph.getElement(delayed)?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    vi.advanceTimersByTime(32)
    expect(sceneGraph.getElement(delayed)?.getAttribute('aria-pressed')).toBe('true')
    expect(sceneGraph.getElement(delayed)?.style.backgroundImage).toBe('')
    sceneGraph.getElement(delayed)?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(range.getProperty('first.value')).toBe(8)
    expect(dial.getProperty('value')).toBe(60)
    expect(tumbler.getProperty('currentItem')).toBe('B')
    expect(activated).toHaveBeenCalledOnce()
    expect(delayed.getProperty('checked')).toBe(true)
    expect(sceneGraph.getElement(qmlDocument.ids.get('firstPage')!)?.style.display).toBe('none')
    expect(sceneGraph.getElement(qmlDocument.ids.get('secondPage')!)?.style.display).toBe('')
    expect(sceneGraph.getElement(qmlDocument.ids.get('split')!)?.style.flexDirection).toBe('column')
    expect(sceneGraph.getElement(qmlDocument.ids.get('drawer')!)?.parentElement?.className).toBe('qml-runtime-overlay')
    expect(sceneGraph.getElement(qmlDocument.ids.get('tip')!)?.textContent).toBe('Helpful')
    sceneGraph.dispose()
    vi.useRealTimers()
  })

  it('supports keyboard button activation, radio exclusivity, and canceled delay holds', () => {
    vi.useFakeTimers()
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        Button { id: button; checkable: true }
        RadioButton { id: first; checked: true }
        RadioButton { id: second }
        DelayButton { id: delayed; delay: 100 }
      }
    `))
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, document.createElement('main'))
    const button = qmlDocument.ids.get('button')!
    const clicked = vi.fn()
    button.connectSignal('clicked', clicked)
    const buttonElement = sceneGraph.getElement(button)!

    buttonElement.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(button.getProperty('pressed')).toBe(true)
    buttonElement.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }))
    expect(button.getProperty('checked')).toBe(true)
    expect(clicked).toHaveBeenCalledOnce()

    sceneGraph.getElement(qmlDocument.ids.get('second')!)?.querySelector('input')?.click()
    expect(qmlDocument.ids.get('first')?.getProperty('checked')).toBe(false)
    expect(qmlDocument.ids.get('second')?.getProperty('checked')).toBe(true)

    const delayed = qmlDocument.ids.get('delayed')!
    const activated = vi.fn()
    delayed.connectSignal('activated', activated)
    const delayElement = sceneGraph.getElement(delayed)!
    delayElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    vi.advanceTimersByTime(48)
    expect(Number(delayed.getProperty('progress'))).toBeGreaterThan(0)
    delayElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    expect(delayed.getProperty('progress')).toBe(0)
    vi.advanceTimersByTime(100)
    expect(activated).not.toHaveBeenCalled()

    sceneGraph.dispose()
    vi.useRealTimers()
  })

  it('supports numeric keyboard stepping and Tumbler wheel wrapping', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        Slider { id: slider; from: 0; to: 10; value: 5; stepSize: 2 }
        SpinBox { id: spin; value: 3; stepSize: 2 }
        Tumbler { id: tumbler; model: ["A", "B"]; currentIndex: 1 }
      }
    `))
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, document.createElement('main'))

    sceneGraph.getElement(qmlDocument.ids.get('slider')!)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    sceneGraph.getElement(qmlDocument.ids.get('spin')!)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    sceneGraph.getElement(qmlDocument.ids.get('tumbler')!)?.dispatchEvent(new WheelEvent('wheel', { deltaY: 1, bubbles: true, cancelable: true }))

    expect(qmlDocument.ids.get('slider')?.getProperty('value')).toBe(7)
    expect(qmlDocument.ids.get('slider')?.getProperty('position')).toBe(0.7)
    expect(qmlDocument.ids.get('spin')?.getProperty('value')).toBe(5)
    expect(qmlDocument.ids.get('tumbler')?.getProperty('currentIndex')).toBe(0)
    expect(qmlDocument.ids.get('tumbler')?.getProperty('currentItem')).toBe('A')
    sceneGraph.dispose()
  })

  it('projects date controls with usable calendar content', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Column {
        Calendar { id: calendar }
        DatePicker { id: datePicker }
        TimePicker { id: timePicker; time: "13:45" }
      }
    `))
    qmlDocument.ids.get('calendar')!.setProperty('displayedMonth', new Date('2026-07-01'))
    qmlDocument.ids.get('calendar')!.setProperty('selectedDate', new Date('2026-07-15'))
    qmlDocument.ids.get('datePicker')!.setProperty('selectedDate', new Date('2026-07-15'))
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, document.createElement('main'))
    const calendar = sceneGraph.getElement(qmlDocument.ids.get('calendar')!)!
    const datePicker = sceneGraph.getElement(qmlDocument.ids.get('datePicker')!) as HTMLInputElement
    const timePicker = sceneGraph.getElement(qmlDocument.ids.get('timePicker')!) as HTMLInputElement

    expect(calendar.querySelector('.qml-calendar-title')?.textContent).toBeTruthy()
    expect(calendar.querySelectorAll('.qml-calendar-weekday')).toHaveLength(7)
    expect(calendar.querySelectorAll('.qml-calendar-day').length).toBeGreaterThanOrEqual(28)
    expect(datePicker.type).toBe('date')
    expect(datePicker.value).toBe('2026-07-15')
    expect(datePicker.style.width).toBe('140px')
    expect(datePicker.style.height).toBe('30px')
    expect(timePicker.type).toBe('time')
    expect(timePicker.value).toBe('13:45')
    sceneGraph.dispose()
  })

  it('projects structured table and tree models with selection and expansion', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      Item {
        width: 500; height: 300
        TableView { id: table; width: 240; height: 160; columns: ["name", "age"]; headers: ["Name", "Age"] }
        TreeView { id: tree; x: 260; width: 200; height: 160; idRole: "nodeId"; parentRole: "parentId"; textRole: "label" }
      }
    `))
    const table = qmlDocument.ids.get('table')!
    const tree = qmlDocument.ids.get('tree')!
    table.setProperty('model', [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 40 }])
    table.setProperty('resizableColumns', true)
    tree.setProperty('model', [
      { nodeId: 'root', parentId: null, label: 'Root' },
      { nodeId: 'child', parentId: 'root', label: 'Child' },
    ])
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, document.createElement('main'))
    const tableElement = sceneGraph.getElement(table)!
    const treeElement = sceneGraph.getElement(tree)!

    expect(tableElement.querySelectorAll('[role="columnheader"]')).toHaveLength(2)
    expect(tableElement.querySelectorAll('[role="gridcell"]')).toHaveLength(4)
    ;(tableElement.querySelector('[data-row-index="1"]') as HTMLElement).click()
    expect(table.getProperty('currentIndex')).toBe(1)
    expect(table.getProperty('selectedIndexes')).toEqual([1])
    expect(tableElement.querySelector('[data-row-index="1"]')?.getAttribute('aria-selected')).toBe('true')
    ;(tableElement.querySelector('[data-row-index="0"]') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    expect(table.getProperty('selectedIndexes')).toEqual([1, 0])
    const header = tableElement.querySelector<HTMLElement>('[data-column-index="0"]')!
    header.getBoundingClientRect = () => ({ left: 0, right: 100, width: 100 } as DOMRect)
    header.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 98 }))
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 118 }))
    document.dispatchEvent(new MouseEvent('mouseup'))
    expect(table.getProperty('columnWidths')).toEqual([120])
    table.callMethod('clearSelection')
    expect(table.getProperty('currentIndex')).toBe(-1)
    expect(table.getProperty('selectedIndexes')).toEqual([])
    ;(tableElement.querySelector('[data-row-index="0"]') as HTMLElement).click()
    expect(table.getProperty('selectedIndexes')).toEqual([0])

    expect(treeElement.textContent).toContain('Root')
    expect(treeElement.textContent).not.toContain('Child')
    ;(treeElement.querySelector('[data-node-id="root"]') as HTMLElement).click()
    expect(tree.getProperty('expandedIds')).toEqual(['root'])
    expect(treeElement.textContent).toContain('Child')
    expect(treeElement.querySelector('[data-node-id="root"]')?.getAttribute('aria-selected')).toBe('true')

    tree.setProperty('expanded', true)
    ;(treeElement.querySelector('[data-node-id="root"]') as HTMLElement).click()
    expect(tree.getProperty('expanded')).toBe(false)
    expect(treeElement.textContent).not.toContain('Child')
    sceneGraph.dispose()
  })

  it('keeps only the current stack page visible after child updates', () => {
    const qmlDocument = instantiateQmlDocument(parseQML(`
      StackLayout {
        id: stack; width: 200; height: 40; currentIndex: 0
        Label { id: first; text: "First" }
        Label { id: second; text: "Second" }
      }
    `))
    const sceneGraph = new QmlDomSceneGraph(document)
    sceneGraph.mount(qmlDocument, document.createElement('main'))
    const stack = qmlDocument.ids.get('stack')!
    stack.setProperty('currentIndex', 1)
    qmlDocument.ids.get('first')!.setProperty('text', 'Updated first')

    expect(sceneGraph.getElement(qmlDocument.ids.get('first')!)?.style.display).toBe('none')
    expect(sceneGraph.getElement(qmlDocument.ids.get('second')!)?.style.display).toBe('')
    sceneGraph.dispose()
  })
})
