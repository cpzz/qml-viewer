import { QmlObject, type QmlRuntimePropertyDefinition } from './QmlObject'
import { QmlTypeRegistry, type QmlTypeDefinition } from './QmlTypeRegistry'
import { forceActiveFocus, nextItemInFocusChain, stackItem } from './QmlItemController'
import { childAt, contains, mapFromItem, mapToItem } from './QmlItemGeometry'
import { grabToImage } from './QmlItemGrab'
import type { QmlControlStyle } from './QmlControlStyle'

const property = (
  name: string,
  type: string,
  initialValue: unknown,
  options: Partial<QmlRuntimePropertyDefinition> = {},
): QmlRuntimePropertyDefinition => ({ name, type, initialValue, ...options })

const itemProperties: QmlRuntimePropertyDefinition[] = [
  property('data', 'list<QtObject>', [], { default: true }),
  property('x', 'real', 0),
  property('y', 'real', 0),
  property('z', 'real', 0),
  property('width', 'real', 0),
  property('height', 'real', 0),
  property('implicitWidth', 'real', 0),
  property('implicitHeight', 'real', 0),
  property('parent', 'Item', null),
  property('children', 'list<Item>', [], { readonly: true }),
  property('visibleChildren', 'list<Item>', [], { readonly: true }),
  property('resources', 'list<QtObject>', [], { readonly: true }),
  property('childrenRect.x', 'real', 0, { readonly: true }),
  property('childrenRect.y', 'real', 0, { readonly: true }),
  property('childrenRect.width', 'real', 0, { readonly: true }),
  property('childrenRect.height', 'real', 0, { readonly: true }),
  // font.* is an inherited property in QML (all Items can propagate it)
  property('font.family', 'string', ''),
  property('font.pixelSize', 'real', 0),
  property('font.pointSize', 'real', 0),
  property('font.bold', 'bool', false),
  property('font.italic', 'bool', false),
  // ToolTip attached properties (Qt Quick Controls 2)
  property('ToolTip.text', 'string', ''),
  property('ToolTip.visible', 'bool', false),
  property('ToolTip.delay', 'int', 0),
  property('ToolTip.timeout', 'int', -1),
  property('visible', 'bool', true),
  property('enabled', 'bool', true),
  property('opacity', 'real', 1),
  property('clip', 'bool', false),
  property('rotation', 'real', 0),
  property('scale', 'real', 1),
  property('transformOrigin', 'var', 'Item.Center'),
  property('transform', 'list<Transform>', [], { readonly: true }),
  property('smooth', 'bool', true),
  property('antialiasing', 'bool', false),
  property('baselineOffset', 'real', 0),
  property('containmentMask', 'var', null),
  property('palette', 'var', null),
  property('palette.accent', 'color', '#308cc6'),
  property('palette.alternateBase', 'color', '#f7f7f7'),
  property('palette.base', 'color', '#ffffff'),
  property('palette.brightText', 'color', '#ffffff'),
  property('palette.button', 'color', '#efefef'),
  property('palette.buttonText', 'color', '#000000'),
  property('palette.dark', 'color', '#9f9f9f'),
  property('palette.highlight', 'color', '#308cc6'),
  property('palette.highlightedText', 'color', '#ffffff'),
  property('palette.light', 'color', '#ffffff'),
  property('palette.link', 'color', '#0000ff'),
  property('palette.linkVisited', 'color', '#ff00ff'),
  property('palette.mid', 'color', '#b8b8b8'),
  property('palette.midlight', 'color', '#cacaca'),
  property('palette.placeholderText', 'color', '#80000000'),
  property('palette.shadow', 'color', '#767676'),
  property('palette.text', 'color', '#000000'),
  property('palette.toolTipBase', 'color', '#ffffdc'),
  property('palette.toolTipText', 'color', '#000000'),
  property('palette.window', 'color', '#efefef'),
  property('palette.windowText', 'color', '#000000'),
  // palette color groups (Qt 6.4+)
  ...(['active', 'inactive', 'disabled'] as const).flatMap(g => {
    const d = g === 'disabled'
    return [
      property(`palette.${g}.accent`,          'color', d ? '#7fb4d8' : '#308cc6'),
      property(`palette.${g}.alternateBase`,    'color', '#f7f7f7'),
      property(`palette.${g}.base`,             'color', '#ffffff'),
      property(`palette.${g}.brightText`,       'color', d ? '#808080' : '#ffffff'),
      property(`palette.${g}.button`,           'color', '#efefef'),
      property(`palette.${g}.buttonText`,       'color', d ? '#808080' : '#000000'),
      property(`palette.${g}.dark`,             'color', '#9f9f9f'),
      property(`palette.${g}.highlight`,        'color', d ? '#aac4e0' : '#308cc6'),
      property(`palette.${g}.highlightedText`,  'color', d ? '#808080' : '#ffffff'),
      property(`palette.${g}.light`,            'color', '#ffffff'),
      property(`palette.${g}.link`,             'color', d ? '#808080' : '#0000ff'),
      property(`palette.${g}.linkVisited`,      'color', d ? '#808080' : '#ff00ff'),
      property(`palette.${g}.mid`,              'color', '#b8b8b8'),
      property(`palette.${g}.midlight`,         'color', '#cacaca'),
      property(`palette.${g}.placeholderText`,  'color', d ? '#80808080' : '#80000000'),
      property(`palette.${g}.shadow`,           'color', '#767676'),
      property(`palette.${g}.text`,             'color', d ? '#808080' : '#000000'),
      property(`palette.${g}.toolTipBase`,      'color', '#ffffdc'),
      property(`palette.${g}.toolTipText`,      'color', d ? '#808080' : '#000000'),
      property(`palette.${g}.window`,           'color', '#efefef'),
      property(`palette.${g}.windowText`,       'color', d ? '#808080' : '#000000'),
    ]
  }),
  property('focus', 'bool', false),
  property('activeFocus', 'bool', false, { readonly: true }),
  property('activeFocusOnTab', 'bool', false),
  property('focusPolicy', 'var', 'Qt.NoFocus'),
  property('layer.effect', 'var', null),
  property('layer.enabled', 'bool', false),
  property('layer.format', 'var', 'ShaderEffectSource.RGBA8'),
  property('layer.live', 'bool', true),
  property('layer.mipmap', 'bool', false),
  property('layer.samplerName', 'string', 'source'),
  property('layer.samples', 'int', 0),
  property('layer.smooth', 'bool', false),
  property('layer.sourceRect', 'var', null),
  property('layer.textureMirroring', 'var', 'ShaderEffectSource.MirrorVertically'),
  property('layer.textureSize', 'var', null),
  property('layer.wrapMode', 'var', 'ShaderEffectSource.ClampToEdge'),
  property('KeyNavigation.left', 'var', null),
  property('KeyNavigation.right', 'var', null),
  property('KeyNavigation.up', 'var', null),
  property('KeyNavigation.down', 'var', null),
  property('KeyNavigation.tab', 'var', null),
  property('KeyNavigation.backtab', 'var', null),
  property('KeyNavigation.priority', 'var', 'KeyNavigation.AfterItem'),
  property('Keys.enabled', 'bool', true),
  property('Keys.forwardTo', 'list<Item>', []),
  property('Keys.priority', 'var', 'Keys.BeforeItem'),
  property('Drag.active', 'bool', false),
  property('Drag.source', 'var', null),
  property('Drag.target', 'Item', null, { readonly: true }),
  property('Drag.hotSpot.x', 'real', 0),
  property('Drag.hotSpot.y', 'real', 0),
  property('Drag.imageSource', 'url', ''),
  property('Drag.imageSourceSize.width', 'int', 0),
  property('Drag.imageSourceSize.height', 'int', 0),
  property('Drag.keys', 'list<string>', []),
  property('Drag.mimeData', 'var', null),
  property('Drag.proposedAction', 'var', 'Qt.IgnoreAction', { readonly: true }),
  property('Drag.supportedActions', 'var', 'Qt.MoveAction'),
  property('Drag.dragType', 'var', 'Drag.Internal'),
  property('state', 'string', ''),
  property('states', 'list<State>', []),
  property('transitions', 'list<Transition>', []),
  property('anchors.fill', 'var', null),
  property('anchors.centerIn', 'var', null),
  property('anchors.left', 'var', null),
  property('anchors.right', 'var', null),
  property('anchors.top', 'var', null),
  property('anchors.bottom', 'var', null),
  property('anchors.horizontalCenter', 'var', null),
  property('anchors.verticalCenter', 'var', null),
  property('anchors.baseline', 'var', null),
  property('anchors.margins', 'real', 0),
  property('anchors.leftMargin', 'real', 0),
  property('anchors.rightMargin', 'real', 0),
  property('anchors.topMargin', 'real', 0),
  property('anchors.bottomMargin', 'real', 0),
  property('anchors.horizontalCenterOffset', 'real', 0),
  property('anchors.verticalCenterOffset', 'real', 0),
  property('anchors.baselineOffset', 'real', 0),
  property('anchors.alignWhenCentered', 'bool', true),
  property('Layout.fillWidth', 'bool', false),
  property('Layout.fillHeight', 'bool', false),
  property('Layout.preferredWidth', 'real', -1),
  property('Layout.preferredHeight', 'real', -1),
  property('Layout.minimumWidth', 'real', 0),
  property('Layout.minimumHeight', 'real', 0),
  property('Layout.maximumWidth', 'real', Number.MAX_SAFE_INTEGER),
  property('Layout.maximumHeight', 'real', Number.MAX_SAFE_INTEGER),
  property('Layout.margins', 'real', 0),
  property('Layout.leftMargin', 'real', -1),
  property('Layout.rightMargin', 'real', -1),
  property('Layout.topMargin', 'real', -1),
  property('Layout.bottomMargin', 'real', -1),
  property('Layout.horizontalStretchFactor', 'int', -1),
  property('Layout.verticalStretchFactor', 'int', -1),
  property('Layout.row', 'int', -1),
  property('Layout.column', 'int', -1),
  property('Layout.rowSpan', 'int', 1),
  property('Layout.columnSpan', 'int', 1),
  property('Layout.alignment', 'var', 0),
]

const positionerProperties: QmlRuntimePropertyDefinition[] = [
  property('spacing', 'real', 0),
  property('padding', 'real', 0),
]

export const builtinQmlTypeDefinitions: QmlTypeDefinition[] = [
  {
    name: 'QtObject',
    properties: [property('objectName', 'string', '')],
    signals: ['destroyed'],
  },
  {
    name: 'Connections',
    baseType: 'QtObject',
    properties: [property('target', 'var', null), property('enabled', 'bool', true)],
  },
  {
    name: 'ListModel',
    baseType: 'QtObject',
    properties: [property('count', 'int', 0, { readonly: true })],
    signals: ['childrenChanged'],
  },
  { name: 'ListElement', baseType: 'QtObject' },
  { name: 'Transform', baseType: 'QtObject' },
  {
    name: 'Translate',
    baseType: 'Transform',
    properties: [property('x', 'real', 0), property('y', 'real', 0)],
  },
  {
    name: 'Scale',
    baseType: 'Transform',
    properties: [
      property('origin.x', 'real', 0), property('origin.y', 'real', 0),
      property('xScale', 'real', 1), property('yScale', 'real', 1),
    ],
  },
  {
    name: 'Rotation',
    baseType: 'Transform',
    properties: [
      property('angle', 'real', 0), property('origin.x', 'real', 0), property('origin.y', 'real', 0),
      property('axis.x', 'real', 0), property('axis.y', 'real', 0), property('axis.z', 'real', 1),
    ],
  },
  {
    name: 'Item',
    baseType: 'QtObject',
    properties: itemProperties,
    signals: ['keyPressed', 'keyReleased', 'Keys.pressed', 'Keys.released', 'Keys.shortcutOverride'],
    methods: {
      childAt(x, y) { return childAt(this, x, y) },
      contains(point, y) { return contains(this, point, y) },
      dumpItemTree() {
        const lines: string[] = []
        const visit = (item: QmlObject, depth: number) => {
          const objectName = item.getProperty('objectName')
          lines.push(`${'  '.repeat(depth)}${item.typeName}${objectName ? ` ${objectName}` : ''}`)
          item.children.filter(child => child.hasProperty('visible')).forEach(child => visit(child, depth + 1))
        }
        visit(this, 0)
        return lines.join('\n')
      },
      ensurePolished() {},
      forceActiveFocus() { forceActiveFocus(this) },
      grabToImage(callback, targetSize) { return grabToImage(this, callback, targetSize) },
      mapFromGlobal(point, y, width, height) { return mapFromItem(this, null, point, y, width, height) },
      mapFromItem(item, point, y, width, height) { return mapFromItem(this, item as QmlObject | null, point, y, width, height) },
      mapToGlobal(point, y, width, height) { return mapToItem(this, null, point, y, width, height) },
      mapToItem(item, point, y, width, height) { return mapToItem(this, item as QmlObject | null, point, y, width, height) },
      nextItemInFocusChain(forward = true) { return nextItemInFocusChain(this, Boolean(forward)) },
      polish() {},
      stackAfter(sibling) { stackItem(this, sibling as QmlObject, true) },
      stackBefore(sibling) { stackItem(this, sibling as QmlObject, false) },
    },
  },
  { name: 'FocusScope', baseType: 'Item' },
  {
    name: 'Rectangle',
    baseType: 'Item',
    properties: [
      property('color', 'color', 'white'),
      property('radius', 'real', 0),
      property('border.width', 'real', 0),
      property('border.color', 'color', 'black'),
    ],
  },
  {
    name: 'Text',
    baseType: 'Item',
    properties: [
      property('text', 'string', ''),
      property('color', 'color', 'black'),
      property('font.pixelSize', 'real', 0),
      property('font.pointSize', 'real', 0),
      property('font.bold', 'bool', false),
      property('font.italic', 'bool', false),
      property('font.family', 'string', ''),
      property('horizontalAlignment', 'var', 'Text.AlignLeft'),
      property('verticalAlignment', 'var', 'Text.AlignTop'),
      property('wrapMode', 'var', 'Text.NoWrap'),
      property('elide', 'var', 'Text.ElideNone'),
      property('maximumLineCount', 'int', 2147483647),
      property('lineHeight', 'real', 1.0),
      property('lineHeightMode', 'var', 'Text.ProportionalHeight'),
      property('contentWidth', 'real', 0, { readonly: true }),
      property('contentHeight', 'real', 0, { readonly: true }),
      property('truncated', 'bool', false, { readonly: true }),
    ],
  },
  { name: 'Label', baseType: 'Control', properties: [
    property('text', 'string', ''),
    property('color', 'color', 'black'),
    property('focusPolicy', 'var', 'Qt.NoFocus'),
    property('wrapMode', 'var', 'Text.NoWrap'),
    property('elide', 'var', 'Text.ElideNone'),
    property('maximumLineCount', 'int', 2147483647),
    property('lineHeight', 'real', 1.0),
    property('lineHeightMode', 'var', 'Text.ProportionalHeight'),
    property('horizontalAlignment', 'var', 'Text.AlignLeft'),
    property('verticalAlignment', 'var', 'Text.AlignTop'),
    property('contentWidth', 'real', 0, { readonly: true }),
    property('contentHeight', 'real', 0, { readonly: true }),
    property('truncated', 'bool', false, { readonly: true }),
  ] },
  {
    name: 'Image',
    baseType: 'Item',
    properties: [
      property('source', 'url', ''),
      property('fillMode', 'var', 'Image.Stretch'),
      property('status', 'int', 0, { readonly: true }),
      property('sourceSize.width', 'int', 0),
      property('sourceSize.height', 'int', 0),
      property('paintedWidth', 'real', 0, { readonly: true }),
      property('paintedHeight', 'real', 0, { readonly: true }),
      property('horizontalAlignment', 'var', 'Image.AlignHCenter'),
      property('verticalAlignment', 'var', 'Image.AlignVCenter'),
      property('cache', 'bool', true),
      property('asynchronous', 'bool', false),
      property('mirror', 'bool', false),
      property('mipmap', 'bool', false),
    ],
  },
  {
    name: 'Canvas',
    baseType: 'Item',
    properties: [
      property('contextType', 'string', '2d'),
      property('context', 'var', null, { readonly: true }),
      property('available', 'bool', false, { readonly: true }),
    ],
    signals: ['paint'],
    methods: {
      getContext() { return this.getProperty('context') },
      requestPaint() { this.emitSignal('paint', this.getProperty('context')) },
    },
  },
  {
    name: 'ShaderEffect',
    baseType: 'Canvas',
    properties: [
      property('contextType', 'string', 'webgl'),
      property('vertexShader', 'string', ''),
      property('fragmentShader', 'string', ''),
      property('fallbackFilter', 'string', ''),
    ],
  },
  {
    name: 'DropShadow',
    baseType: 'Item',
    properties: [
      property('source', 'var', null), property('radius', 'real', 8), property('color', 'color', '#80000000'),
      property('horizontalOffset', 'real', 0), property('verticalOffset', 'real', 0),
    ],
  },
  { name: 'OpacityMask', baseType: 'Item', properties: [property('source', 'var', null), property('maskSource', 'url', '')] },
  {
    name: 'ParticleSystem',
    baseType: 'Canvas',
    properties: [property('running', 'bool', true), property('particles', 'var', [])],
  },
  {
    name: 'ChartView',
    baseType: 'Canvas',
    properties: [
      property('title', 'string', ''),
      property('series', 'var', []),
      property('antialiasing', 'bool', true),
    ],
  },
  { name: 'LineSeries', baseType: 'QtObject', properties: [property('name', 'string', ''), property('color', 'color', '#2563eb'), property('points', 'var', [])] },
  { name: 'SplineSeries', baseType: 'LineSeries' },
  { name: 'BarSeries', baseType: 'QtObject', properties: [property('name', 'string', ''), property('color', 'color', '#2563eb'), property('values', 'var', [])] },
  { name: 'BarSet', baseType: 'QtObject', properties: [property('label', 'string', ''), property('values', 'var', [])] },
  { name: 'PieSeries', baseType: 'QtObject', properties: [property('values', 'var', [])] },
  { name: 'XYPoint', baseType: 'QtObject', properties: [property('x', 'real', 0), property('y', 'real', 0)] },
  {
    name: 'WebEngineView',
    baseType: 'Item',
    properties: [property('url', 'url', 'about:blank'), property('loading', 'bool', false, { readonly: true })],
  },
  {
    name: 'VideoOutput',
    baseType: 'Item',
    properties: [
      property('source', 'url', ''), property('fillMode', 'var', 'VideoOutput.PreserveAspectFit'),
      property('autoPlay', 'bool', true), property('muted', 'bool', true), property('controls', 'bool', false),
      property('playing', 'bool', false, { readonly: true }),
    ],
    signals: ['started', 'stopped', 'errorOccurred'],
  },
  { name: 'Row', baseType: 'Item', properties: positionerProperties },
  { name: 'Column', baseType: 'Item', properties: positionerProperties },
  { name: 'Grid', baseType: 'Item', properties: positionerProperties },
  {
    name: 'Flow',
    baseType: 'Item',
    properties: [
      ...positionerProperties,
      property('flow', 'var', 'Flow.LeftToRight'),
    ],
  },
  {
    name: 'Flickable',
    baseType: 'Item',
    properties: [
      property('contentX', 'real', 0),
      property('contentY', 'real', 0),
      property('contentWidth', 'real', 0),
      property('contentHeight', 'real', 0),
      property('interactive', 'bool', true),
      property('flickableDirection', 'var', 'Flickable.AutoFlickIfNeeded'),
      property('maximumFlickVelocity', 'real', 2500),
      property('flickDeceleration', 'real', 1500),
      property('atXBeginning', 'bool', true, { readonly: true }),
      property('atXEnd', 'bool', false, { readonly: true }),
      property('atYBeginning', 'bool', true, { readonly: true }),
      property('atYEnd', 'bool', false, { readonly: true }),
      property('flicking', 'bool', false, { readonly: true }),
      property('flickingHorizontally', 'bool', false, { readonly: true }),
      property('flickingVertically', 'bool', false, { readonly: true }),
      property('dragging', 'bool', false, { readonly: true }),
      property('moving', 'bool', false, { readonly: true }),
      property('originX', 'real', 0, { readonly: true }),
      property('originY', 'real', 0, { readonly: true }),
    ],
    signals: ['flickStarted', 'flickEnded'],
  },
  { name: 'ScrollView', baseType: 'Flickable' },
  {
    name: 'MouseArea',
    baseType: 'Item',
    properties: [
      property('acceptedButtons', 'var', 'Qt.LeftButton'),
      property('hoverEnabled', 'bool', false),
      property('preventStealing', 'bool', false),
      property('propagateComposedEvents', 'bool', false),
      property('containsMouse', 'bool', false, { readonly: true }),
      property('pressed', 'bool', false, { readonly: true }),
      property('mouseX', 'real', 0, { readonly: true }),
      property('mouseY', 'real', 0, { readonly: true }),
    ],
    signals: ['clicked', 'doubleClicked', 'entered', 'exited', 'pressed', 'released', 'canceled', 'positionChanged'],
  },
  {
    name: 'Window',
    baseType: 'Item',
    properties: [
      property('visible', 'bool', false),
      property('title', 'string', ''),
      property('color', 'color', 'transparent'),
      property('font.family', 'string', ''),
      property('font.pixelSize', 'real', 0),
      property('font.pointSize', 'real', 0),
      property('font.bold', 'bool', false),
      property('font.italic', 'bool', false),
    ],
    signals: ['closing'],
  },
  {
    name: 'ApplicationWindow',
    baseType: 'Window',
    properties: [
      property('menuBar', 'MenuBar', null),
      property('header', 'Item', null),
      property('footer', 'Item', null),
    ],
  },
  {
    name: 'Timer',
    baseType: 'QtObject',
    properties: [
      property('interval', 'int', 1000),
      property('running', 'bool', false),
      property('repeat', 'bool', false),
      property('triggeredOnStart', 'bool', false),
    ],
    signals: ['triggered'],
    methods: {
      start() { this.setProperty('running', true) },
      stop() { this.setProperty('running', false) },
      restart() {
        this.setProperty('running', false)
        this.setProperty('running', true)
      },
    },
  },
  {
    name: 'Component',
    baseType: 'QtObject',
    properties: [
      property('status', 'int', 0, { readonly: true }),
      property('progress', 'real', 1, { readonly: true }),
    ],
    signals: ['completed', 'destruction'],
  },
  {
    name: 'Loader',
    baseType: 'Item',
    properties: [
      property('active', 'bool', true),
      property('asynchronous', 'bool', false),
      property('source', 'url', ''),
      property('sourceComponent', 'var', null),
      property('item', 'var', null, { readonly: true }),
      property('status', 'int', 0, { readonly: true }),
      property('progress', 'real', 0, { readonly: true }),
    ],
    signals: ['loaded'],
  },
  {
    name: 'Repeater',
    baseType: 'Item',
    properties: [
      property('model', 'var', 0),
      property('delegate', 'var', null),
      property('count', 'int', 0, { readonly: true }),
    ],
    signals: ['itemAdded', 'itemRemoved'],
  },
  {
    name: 'ListView',
    baseType: 'Flickable',
    properties: [
      property('model', 'var', 0),
      property('delegate', 'var', null),
      property('count', 'int', 0, { readonly: true }),
      property('currentIndex', 'int', -1),
      property('currentItem', 'var', null, { readonly: true }),
      property('spacing', 'real', 0),
      property('orientation', 'var', 'ListView.Vertical'),
      property('cacheBuffer', 'real', 0),
      property('section.property', 'string', ''),
      property('section.delegate', 'var', null),
      property('highlight', 'var', null),
      property('highlightItem', 'var', null, { readonly: true }),
      property('highlightMoveDuration', 'int', 300),
      property('highlightMoveVelocity', 'real', 400),
      property('snapMode', 'var', 'ListView.NoSnap'),
      property('header', 'var', null),
      property('footer', 'var', null),
      property('headerItem', 'var', null, { readonly: true }),
      property('footerItem', 'var', null, { readonly: true }),
      property('layoutDirection', 'var', 'Qt.LeftToRight'),
      property('verticalLayoutDirection', 'var', 'ListView.TopToBottom'),
    ],
    signals: ['activated'],
  },
  {
    name: 'GridView',
    baseType: 'Flickable',
    properties: [
      property('model', 'var', 0),
      property('delegate', 'var', null),
      property('count', 'int', 0, { readonly: true }),
      property('currentIndex', 'int', -1),
      property('currentItem', 'var', null, { readonly: true }),
      property('cellWidth', 'real', 100),
      property('cellHeight', 'real', 100),
      property('cacheBuffer', 'real', 0),
    ],
    signals: ['activated'],
  },
  {
    name: 'PathView',
    baseType: 'Flickable',
    properties: [
      property('model', 'var', 0),
      property('delegate', 'var', null),
      property('count', 'int', 0, { readonly: true }),
      property('currentIndex', 'int', -1),
      property('currentItem', 'var', null, { readonly: true }),
      property('pathItemCount', 'int', 0),
      property('offset', 'real', 0),
      property('path', 'var', null),
    ],
    signals: ['activated'],
  },
  {
    name: 'TableView',
    baseType: 'Flickable',
    properties: [
      property('model', 'var', []), property('columns', 'var', []), property('headers', 'var', []),
      property('columnWidths', 'var', []), property('editable', 'bool', false),
      property('currentIndex', 'int', -1), property('selectedIndexes', 'var', [], { readonly: true }),
      property('selectionMode', 'var', 'SelectionMode.SingleSelection'), property('resizableColumns', 'bool', false),
    ],
    signals: ['activated'],
    methods: {
      select(index, mode = 'ClearAndSelect') {
        const selected = mode === 'Add' ? this.getProperty('selectedIndexes') as unknown[] : []
        const next = [...new Set([...selected, index])]
        this.setInternalProperty('selectedIndexes', next)
        this.setProperty('currentIndex', Number(index))
      },
      clearSelection() {
        this.setInternalProperty('selectedIndexes', [])
        this.setProperty('currentIndex', -1)
      },
    },
  },
  {
    name: 'TreeView',
    baseType: 'Flickable',
    properties: [
      property('model', 'var', []), property('idRole', 'string', 'id'), property('parentRole', 'string', 'parentId'),
      property('textRole', 'string', 'text'), property('currentIndex', 'int', -1),
      property('selectedIndexes', 'var', [], { readonly: true }), property('expandedIds', 'var', []),
      property('expanded', 'bool', false),
      property('selectionMode', 'var', 'SelectionMode.SingleSelection'),
    ],
    signals: ['activated', 'expanded', 'collapsed'],
    methods: {
      select(index, mode = 'ClearAndSelect') {
        const selected = mode === 'Add' ? this.getProperty('selectedIndexes') as unknown[] : []
        this.setInternalProperty('selectedIndexes', [...new Set([...selected, index])])
      },
      clearSelection() {
        this.setInternalProperty('selectedIndexes', [])
        this.setProperty('currentIndex', -1)
      },
    },
  },
  { name: 'HorizontalHeaderView', baseType: 'Item', properties: [property('syncView', 'var', null)] },
  { name: 'VerticalHeaderView', baseType: 'Item', properties: [property('syncView', 'var', null)] },
  {
    name: 'Path',
    baseType: 'QtObject',
    properties: [
      property('elements', 'list<QtObject>', [], { default: true }),
      property('startX', 'real', 0),
      property('startY', 'real', 0),
    ],
  },
  { name: 'PathLine', baseType: 'QtObject', properties: [property('x', 'real', 0), property('y', 'real', 0)] },
  {
    name: 'PathQuad',
    baseType: 'PathLine',
    properties: [property('controlX', 'real', 0), property('controlY', 'real', 0)],
  },
  {
    name: 'PathAttribute',
    baseType: 'QtObject',
    properties: [property('name', 'string', ''), property('value', 'real', 0)],
  },
  {
    name: 'State',
    baseType: 'QtObject',
    properties: [
      property('name', 'string', ''),
      property('when', 'bool', false),
      property('changes', 'list<QtObject>', [], { default: true }),
    ],
  },
  {
    name: 'PropertyChanges',
    baseType: 'QtObject',
    properties: [property('target', 'var', null)],
  },
  {
    name: 'Transition',
    baseType: 'QtObject',
    properties: [
      property('from', 'string', '*'),
      property('to', 'string', '*'),
      property('reversible', 'bool', false),
      property('animations', 'list<QtObject>', [], { default: true }),
    ],
  },
  {
    name: 'Behavior',
    baseType: 'QtObject',
    properties: [
      property('enabled', 'bool', true),
      property('animation', 'var', null, { default: true }),
      property('behaviorOn', 'string', ''),
    ],
  },
  {
    name: 'NumberAnimation',
    baseType: 'QtObject',
    properties: [
      property('target', 'var', null),
      property('property', 'string', ''),
      property('properties', 'string', ''),
      property('from', 'real', 0),
      property('to', 'real', 0),
      property('duration', 'int', 250),
      property('easing.type', 'var', 'Easing.Linear'),
      property('running', 'bool', false),
      property('loops', 'int', 1),
      property('behaviorOn', 'string', ''),
    ],
    signals: ['started', 'stopped', 'finished'],
  },
  {
    name: 'PropertyAnimation',
    baseType: 'NumberAnimation',
  },
  { name: 'ColorAnimation', baseType: 'NumberAnimation' },
  { name: 'Vector3dAnimation', baseType: 'NumberAnimation' },
  {
    name: 'PauseAnimation',
    baseType: 'QtObject',
    properties: [property('duration', 'int', 250)],
  },
  {
    name: 'ScriptAction',
    baseType: 'QtObject',
    properties: [property('script', 'var', null)],
  },
  {
    name: 'SequentialAnimation',
    baseType: 'QtObject',
    properties: [
      property('animations', 'list<QtObject>', [], { default: true }),
      property('running', 'bool', false),
      property('loops', 'int', 1),
    ],
    signals: ['started', 'stopped', 'finished'],
  },
  {
    name: 'ParallelAnimation',
    baseType: 'SequentialAnimation',
  },
  {
    name: 'RowLayout',
    baseType: 'Item',
    properties: [property('spacing', 'real', 5), property('layoutDirection', 'var', 'Qt.LeftToRight')],
  },
  {
    name: 'ColumnLayout',
    baseType: 'Item',
    properties: [
      property('spacing', 'real', 5),
      property('layoutDirection', 'var', 'Qt.LeftToRight'),
      property('uniformCellSizes', 'bool', false),
    ],
  },
  {
    name: 'GridLayout',
    baseType: 'Item',
    properties: [
      property('columns', 'int', 1),
      property('rows', 'int', 0),
      property('rowSpacing', 'real', 5),
      property('columnSpacing', 'real', 5),
      property('spacing', 'real', 5),
    ],
  },
  {
    name: 'Control',
    baseType: 'Item',
    properties: [
      property('padding', 'real', 0),
      property('topPadding', 'real', 0),
      property('bottomPadding', 'real', 0),
      property('leftPadding', 'real', 0),
      property('rightPadding', 'real', 0),
      property('availableWidth', 'real', 0, { readonly: true }),
      property('availableHeight', 'real', 0, { readonly: true }),
      property('hovered', 'bool', false, { readonly: true }),
      property('pressed', 'bool', false, { readonly: true }),
      property('focusPolicy', 'var', 'Qt.StrongFocus'),
      property('background', 'Item', null),
      property('contentItem', 'Item', null),
      property('transition', 'Transition', null),
      property('palette.button', 'color', '#f3f3f3'),
      property('palette.buttonText', 'color', '#202020'),
      property('palette.highlight', 'color', '#2563eb'),
      property('font.family', 'string', ''),
      property('font.pixelSize', 'real', 14),
      property('font.pointSize', 'real', 0),
      property('font.bold', 'bool', false),
      property('font.italic', 'bool', false),
    ],
  },
  {
    name: 'AbstractButton',
    baseType: 'Control',
    properties: [
      property('text', 'string', ''),
      property('checkable', 'bool', false),
      property('checked', 'bool', false),
      property('autoExclusive', 'bool', false),
      property('autoRepeat', 'bool', false),
      property('autoRepeatDelay', 'int', 300),
      property('autoRepeatInterval', 'int', 100),
      property('display', 'enum', 0),
      property('down', 'bool', false),
      property('pressed', 'bool', false, { readonly: true }),
      property('pressX', 'real', 0, { readonly: true }),
      property('pressY', 'real', 0, { readonly: true }),
      property('implicitIndicatorWidth', 'real', 0, { readonly: true }),
      property('implicitIndicatorHeight', 'real', 0, { readonly: true }),
      property('indicator', 'component', null),
      property('icon.name', 'string', ''),
      property('icon.source', 'url', ''),
      property('icon.width', 'int', -1),
      property('icon.height', 'int', -1),
      property('icon.color', 'color', ''),
      property('icon.cache', 'bool', true),
      property('action', 'var', null),
    ],
    signals: ['canceled', 'clicked', 'doubleClicked', 'pressAndHold', 'pressed', 'released', 'toggled'],
    methods: {
      toggle() { if (this.getProperty('checkable')) this.setProperty('checked', !this.getProperty('checked')) },
      click() {
        if (!this.getProperty('enabled')) return
        this.emitSignal('pressed')
        this.emitSignal('released')
        if (this.getProperty('checkable')) {
          this.callMethod('toggle')
          this.emitSignal('toggled')
        }
        this.emitSignal('clicked')
      },
    },
  },
  {
    name: 'Button',
    baseType: 'AbstractButton',
    properties: [
      property('flat', 'bool', false),
      property('highlighted', 'bool', false),
    ],
  },
  { name: 'RoundButton', baseType: 'Button', properties: [property('radius', 'real', 999)] },
  { name: 'ToolButton', baseType: 'Button', properties: [property('implicitHeight', 'real', 40, { readonly: true })] },
  {
    name: 'ItemDelegate',
    baseType: 'Button',
    properties: [property('highlighted', 'bool', false), property('implicitHeight', 'real', 30, { readonly: true })],
  },
  {
    name: 'CheckBox',
    baseType: 'AbstractButton',
    properties: [
      property('checkable', 'bool', true),
      property('checkState', 'int', 0), // Qt.Unchecked = 0, Qt.PartiallyChecked = 1, Qt.Checked = 2
      property('tristate', 'bool', false),
      property('nextCheckState', 'var', null),
    ],
  },
  {
    name: 'RadioButton',
    baseType: 'Button',
    properties: [
      property('checkable', 'bool', true),
      property('autoExclusive', 'bool', true),
      property('ButtonGroup.group', 'var', null),
    ],
    methods: {
      toggle() { if (!this.getProperty('checked')) this.setProperty('checked', true) },
    },
  },
  {
    name: 'Switch',
    baseType: 'Button',
    properties: [
      property('checkable', 'bool', true),
      property('position', 'real', 0, { readonly: true }),
      property('visualPosition', 'real', 0, { readonly: true }),
    ],
  },
  {
    name: 'TabButton',
    baseType: 'Button',
    properties: [
      property('checkable', 'bool', true),
      property('autoExclusive', 'bool', true),
    ],
  },
  {
    name: 'TabBar',
    baseType: 'Control',
    properties: [
      property('currentIndex', 'int', 0),
      property('implicitHeight', 'real', 34, { readonly: true }),
    ],
    signals: ['activated'],
  },
  {
    name: 'TextField',
    baseType: 'Control',
    properties: [
      property('text', 'string', ''),
      property('color', 'color', '#000000'),
      property('placeholderText', 'string', ''),
      property('placeholderTextColor', 'color', '#80000000'),
      property('readOnly', 'bool', false),
      property('echoMode', 'var', 'TextInput.Normal'),
      property('maximumLength', 'int', 32767),
      property('cursorPosition', 'int', 0),
      property('length', 'int', 0, { readonly: true }),
      property('selectedText', 'string', '', { readonly: true }),
      property('selectionStart', 'int', 0, { readonly: true }),
      property('selectionEnd', 'int', 0, { readonly: true }),
    ],
    signals: ['accepted', 'editingFinished'],
  },
  { name: 'TextInput', baseType: 'TextField' },
  {
    name: 'TextArea',
    baseType: 'TextField',
    properties: [property('wrapMode', 'var', 'TextEdit.WordWrap')],
  },
  { name: 'TextEdit', baseType: 'TextArea' },
  {
    name: 'Slider',
    baseType: 'Control',
    properties: [
      property('from', 'real', 0),
      property('to', 'real', 1),
      property('value', 'real', 0),
      property('stepSize', 'real', 0),
      property('orientation', 'var', 'Qt.Horizontal'),
      property('position', 'real', 0, { readonly: true }),
      property('visualPosition', 'real', 0, { readonly: true }),
      property('pressed', 'bool', false, { readonly: true }),
      property('live', 'bool', true),
      property('snapMode', 'var', 'Slider.NoSnap'),
    ],
    signals: ['moved'],
    methods: {
      valueAt(position) {
        const from = Number(this.getProperty('from'))
        return from + Math.max(0, Math.min(1, Number(position))) * (Number(this.getProperty('to')) - from)
      },
      increase() {
        const step = Number(this.getProperty('stepSize')) || 0.1
        this.setProperty('value', Math.min(Number(this.getProperty('to')), Number(this.getProperty('value')) + step))
      },
      decrease() {
        const step = Number(this.getProperty('stepSize')) || 0.1
        this.setProperty('value', Math.max(Number(this.getProperty('from')), Number(this.getProperty('value')) - step))
      },
    },
  },
  {
    name: 'RangeSlider',
    baseType: 'Control',
    properties: [
      property('from', 'real', 0), property('to', 'real', 1),
      property('first.value', 'real', 0), property('second.value', 'real', 1),
      property('stepSize', 'real', 0), property('orientation', 'var', 'Qt.Horizontal'),
    ],
    signals: ['moved'],
  },
  { name: 'Dial', baseType: 'Slider', properties: [property('wrap', 'bool', false)] },
  {
    name: 'SpinBox',
    baseType: 'Control',
    properties: [
      property('from', 'int', 0), property('to', 'int', 99),
      property('value', 'int', 0), property('stepSize', 'int', 1),
      property('editable', 'bool', true),
      property('wrap', 'bool', false),
      property('textFromValue', 'var', null),
      property('valueFromText', 'var', null),
    ],
    signals: ['valueModified'],
  },
  {
    name: 'Tumbler',
    baseType: 'Control',
    properties: [property('model', 'var', []), property('currentIndex', 'int', 0), property('currentItem', 'var', null, { readonly: true }), property('wrap', 'bool', true)],
    signals: ['activated'],
  },
  {
    name: 'DelayButton',
    baseType: 'Button',
    properties: [property('delay', 'int', 3000), property('progress', 'real', 0, { readonly: true })],
    signals: ['activated'],
  },
  {
    name: 'ComboBox',
    baseType: 'Control',
    properties: [
      property('model', 'var', []), property('count', 'int', 0, { readonly: true }),
      property('currentIndex', 'int', -1),
      property('currentText', 'string', '', { readonly: true }),
      property('displayText', 'string', '', { readonly: true }),
      property('textRole', 'string', ''),
      property('editable', 'bool', false), property('placeholderText', 'string', ''),
    ],
    signals: ['activated'],
  },
  {
    name: 'ProgressBar',
    baseType: 'Control',
    properties: [
      property('from', 'real', 0), property('to', 'real', 1),
      property('value', 'real', 0), property('indeterminate', 'bool', false),
    ],
  },
  { name: 'Pane', baseType: 'Control' },
  { name: 'Page', baseType: 'Pane', properties: [property('title', 'string', '')] },
  { name: 'Frame', baseType: 'Pane' },
  { name: 'GroupBox', baseType: 'Frame', properties: [property('title', 'string', '')] },
  {
    name: 'BusyIndicator',
    baseType: 'Control',
    properties: [
      property('running', 'bool', true),
      property('focusPolicy', 'var', 'Qt.NoFocus'),
      property('implicitWidth', 'real', 24, { readonly: true }),
      property('implicitHeight', 'real', 24, { readonly: true }),
    ],
  },
  {
    name: 'Calendar',
    baseType: 'Control',
    properties: [property('selectedDate', 'date', new Date()), property('displayedMonth', 'date', new Date()), property('locale', 'string', 'en-US')],
  },
  { name: 'DatePicker', baseType: 'Control', properties: [property('selectedDate', 'date', new Date()), property('locale', 'string', 'en-US')] },
  { name: 'TimePicker', baseType: 'Control', properties: [property('time', 'string', '00:00'), property('locale', 'string', 'en-US')] },
  {
    name: 'ScrollIndicator',
    baseType: 'Control',
    properties: [property('position', 'real', 0), property('size', 'real', 0), property('active', 'bool', false)],
  },
  {
    name: 'ScrollBar',
    baseType: 'Control',
    properties: [
      property('orientation', 'var', 'Qt.Vertical'), property('position', 'real', 0),
      property('size', 'real', 0), property('stepSize', 'real', 0), property('active', 'bool', false),
      property('policy', 'var', 'ScrollBar.AsNeeded'),
    ],
  },
  {
    name: 'StackLayout',
    baseType: 'Item',
    properties: [property('currentIndex', 'int', 0), property('count', 'int', 0, { readonly: true })],
  },
  { name: 'SwipeView', baseType: 'Control', properties: [property('currentIndex', 'int', 0), property('orientation', 'var', 'Qt.Horizontal')] },
  {
    name: 'StackView',
    baseType: 'Control',
    properties: [
      property('currentIndex', 'int', -1), property('depth', 'int', 0, { readonly: true }),
      property('currentItem', 'var', null, { readonly: true }), property('empty', 'bool', true, { readonly: true }),
      property('busy', 'bool', false, { readonly: true }), property('initialItem', 'var', null),
    ],
    signals: ['pushed', 'popped', 'replaced'],
    methods: {
      push(item) {
        const depth = Number(this.getProperty('depth')) + 1
        this.setInternalProperty('depth', depth)
        this.setInternalProperty('currentIndex', depth - 1)
        this.setInternalProperty('empty', false)
        if (item instanceof QmlObject) this.setInternalProperty('currentItem', item)
        this.emitSignal('pushed', item)
        return item
      },
      pop(item) {
        const depth = Number(this.getProperty('depth'))
        if (depth <= 1) return null
        const newDepth = depth - 1
        this.setInternalProperty('depth', newDepth)
        this.setInternalProperty('currentIndex', newDepth - 1)
        this.setInternalProperty('empty', newDepth === 0)
        const popped = this.getProperty('currentItem')
        this.emitSignal('popped', popped)
        return popped
      },
      replace(target, item) {
        const resolved = item instanceof QmlObject ? item : target
        if (resolved instanceof QmlObject) this.setInternalProperty('currentItem', resolved)
        this.emitSignal('replaced', resolved)
        return resolved
      },
      clear() {
        this.setInternalProperty('depth', 0)
        this.setInternalProperty('currentIndex', -1)
        this.setInternalProperty('currentItem', null)
        this.setInternalProperty('empty', true)
      },
      get() { return null },
      find() { return null },
    },
  },
  { name: 'SplitView', baseType: 'Control', properties: [property('orientation', 'var', 'Qt.Horizontal')] },
  {
    name: 'Popup',
    baseType: 'Control',
    properties: [
      property('visible', 'bool', false),
      property('modal', 'bool', false),
      property('dim', 'bool', false),
      property('closePolicy', 'var', 'Popup.CloseOnEscape | Popup.CloseOnPressOutside'),
      property('implicitWidth', 'real', 240, { readonly: true }),
      property('implicitHeight', 'real', 160, { readonly: true }),
      property('centerInOverlay', 'bool', false),
      property('focusTrap', 'bool', true),
      property('transitionDuration', 'int', 120),
    ],
    signals: ['aboutToShow', 'opened', 'aboutToHide', 'closed'],
    methods: {
      open() {
        if (this.getProperty('visible')) return
        this.emitSignal('aboutToShow')
        this.setProperty('visible', true)
        this.emitSignal('opened')
      },
      close() {
        if (!this.getProperty('visible')) return
        this.emitSignal('aboutToHide')
        this.setProperty('visible', false)
        this.emitSignal('closed')
      },
    },
  },
  { name: 'Drawer', baseType: 'Popup', properties: [property('edge', 'var', 'Qt.LeftEdge'), property('position', 'real', 0)] },
  { name: 'ToolTip', baseType: 'Popup', properties: [property('text', 'string', ''), property('delay', 'int', 0), property('timeout', 'int', -1)] },
  {
    name: 'Dialog',
    baseType: 'Popup',
    properties: [
      property('title', 'string', ''),
      property('standardButtons', 'var', 0),
      property('implicitWidth', 'real', 360, { readonly: true }),
      property('implicitHeight', 'real', 220, { readonly: true }),
    ],
    signals: ['accepted', 'rejected'],
    methods: {
      accept() {
        this.emitSignal('accepted')
        this.callMethod('close')
      },
      reject() {
        this.emitSignal('rejected')
        this.callMethod('close')
      },
    },
  },
  {
    name: 'Menu',
    baseType: 'Popup',
    properties: [
      property('title', 'string', ''),
      property('implicitWidth', 'real', 180, { readonly: true }),
    ],
  },
  { name: 'MenuItem', baseType: 'Button', properties: [property('shortcut', 'string', '')] },
  { name: 'MenuSeparator', baseType: 'Control', properties: [property('implicitHeight', 'real', 1, { readonly: true })] },
  {
    name: 'MenuBar',
    baseType: 'Control',
    properties: [property('implicitHeight', 'real', 32, { readonly: true })],
  },
  {
    name: 'ToolBar',
    baseType: 'Control',
    properties: [property('implicitHeight', 'real', 40, { readonly: true })],
  },
  {
    name: 'Action',
    baseType: 'QtObject',
    properties: [property('text', 'string', ''), property('enabled', 'bool', true), property('checkable', 'bool', false), property('checked', 'bool', false)],
    signals: ['triggered'],
    methods: { trigger() { if (this.getProperty('enabled')) this.emitSignal('triggered') } },
  },
  { name: 'ActionGroup', baseType: 'QtObject', properties: [property('exclusive', 'bool', true)] },
  { name: 'Shortcut', baseType: 'QtObject', properties: [property('sequence', 'string', ''), property('enabled', 'bool', true)], signals: ['activated'] },
]

export function createBuiltinQmlTypeRegistry(controlStyle: QmlControlStyle = 'Fusion'): QmlTypeRegistry {
  const itemDelegateImplicitHeight: Record<QmlControlStyle, number> = {
    Fusion: 30,
    Universal: 32,
    Material: 36,
  }
  const registry = new QmlTypeRegistry()
  builtinQmlTypeDefinitions.forEach(type => registry.register(type.name === 'ItemDelegate'
    ? {
        ...type,
        properties: type.properties?.map(definition => definition.name === 'implicitHeight'
          ? { ...definition, initialValue: itemDelegateImplicitHeight[controlStyle] }
          : definition),
      }
    : type))
  return registry
}
