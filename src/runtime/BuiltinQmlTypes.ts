import type { QmlRuntimePropertyDefinition } from './QmlObject'
import { QmlTypeRegistry, type QmlTypeDefinition } from './QmlTypeRegistry'

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
  property('implicitWidth', 'real', 0, { readonly: true }),
  property('implicitHeight', 'real', 0, { readonly: true }),
  property('visible', 'bool', true),
  property('enabled', 'bool', true),
  property('opacity', 'real', 1),
  property('clip', 'bool', false),
  property('rotation', 'real', 0),
  property('scale', 'real', 1),
  property('focus', 'bool', false),
  property('activeFocus', 'bool', false, { readonly: true }),
  property('KeyNavigation.left', 'var', null),
  property('KeyNavigation.right', 'var', null),
  property('KeyNavigation.up', 'var', null),
  property('KeyNavigation.down', 'var', null),
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
  property('anchors.margins', 'real', 0),
  property('anchors.leftMargin', 'real', 0),
  property('anchors.rightMargin', 'real', 0),
  property('anchors.topMargin', 'real', 0),
  property('anchors.bottomMargin', 'real', 0),
  property('Layout.fillWidth', 'bool', false),
  property('Layout.fillHeight', 'bool', false),
  property('Layout.preferredWidth', 'real', 0),
  property('Layout.preferredHeight', 'real', 0),
  property('Layout.minimumWidth', 'real', 0),
  property('Layout.minimumHeight', 'real', 0),
  property('Layout.maximumWidth', 'real', Number.MAX_SAFE_INTEGER),
  property('Layout.maximumHeight', 'real', Number.MAX_SAFE_INTEGER),
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
  {
    name: 'Item',
    baseType: 'QtObject',
    properties: itemProperties,
    signals: ['childrenChanged', 'keyPressed', 'keyReleased'],
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
    ],
  },
  { name: 'Label', baseType: 'Text', properties: [property('padding', 'real', 0)] },
  {
    name: 'Image',
    baseType: 'Item',
    properties: [
      property('source', 'url', ''),
      property('fillMode', 'var', 'Image.Stretch'),
      property('status', 'int', 0, { readonly: true }),
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
    ],
    signals: ['closing'],
  },
  {
    name: 'ApplicationWindow',
    baseType: 'Window',
    properties: [
      property('header', 'var', null),
      property('footer', 'var', null),
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
      property('highlight', 'var', null),
      property('highlightItem', 'var', null, { readonly: true }),
      property('snapMode', 'var', 'ListView.NoSnap'),
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
    properties: [property('spacing', 'real', 5)],
  },
  {
    name: 'ColumnLayout',
    baseType: 'Item',
    properties: [property('spacing', 'real', 5)],
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
    ],
  },
  {
    name: 'Button',
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
      property('flat', 'bool', false),
      property('highlighted', 'bool', false),
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
  { name: 'RoundButton', baseType: 'Button', properties: [property('radius', 'real', 999)] },
  { name: 'ToolButton', baseType: 'Button', properties: [property('implicitHeight', 'real', 40, { readonly: true })] },
  {
    name: 'ItemDelegate',
    baseType: 'Button',
    properties: [property('highlighted', 'bool', false), property('implicitHeight', 'real', 30, { readonly: true })],
  },
  {
    name: 'CheckBox',
    baseType: 'Button',
    properties: [
      property('checkState', 'int', 0), // Qt.Unchecked = 0, Qt.PartiallyChecked = 1, Qt.Checked = 2
      property('tristate', 'bool', false),
      property('nextCheckState', 'var', null),
    ],
  },
  {
    name: 'RadioButton',
    baseType: 'CheckBox',
    properties: [property('ButtonGroup.group', 'var', null)],
    methods: {
      toggle() { if (!this.getProperty('checked')) this.setProperty('checked', true) },
    },
  },
  { name: 'Switch', baseType: 'CheckBox' },
  { name: 'TabButton', baseType: 'Button' },
  {
    name: 'TabBar',
    baseType: 'Control',
    properties: [property('currentIndex', 'int', 0)],
  },
  {
    name: 'TextField',
    baseType: 'Control',
    properties: [
      property('text', 'string', ''),
      property('placeholderText', 'string', ''),
      property('readOnly', 'bool', false),
      property('echoMode', 'var', 'TextInput.Normal'),
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
      property('model', 'var', []), property('currentIndex', 'int', -1),
      property('currentText', 'string', '', { readonly: true }),
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
  { name: 'Page', baseType: 'Control', properties: [property('title', 'string', '')] },
  { name: 'Pane', baseType: 'Control' },
  { name: 'Frame', baseType: 'Control' },
  { name: 'GroupBox', baseType: 'Frame', properties: [property('title', 'string', '')] },
  { name: 'BusyIndicator', baseType: 'Control', properties: [property('running', 'bool', true)] },
  {
    name: 'Calendar',
    baseType: 'Control',
    properties: [property('selectedDate', 'date', new Date()), property('displayedMonth', 'date', new Date()), property('locale', 'string', 'en-US')],
  },
  { name: 'DatePicker', baseType: 'Control', properties: [property('selectedDate', 'date', new Date()), property('locale', 'string', 'en-US')] },
  { name: 'TimePicker', baseType: 'Control', properties: [property('time', 'string', '00:00'), property('locale', 'string', 'en-US')] },
  {
    name: 'ScrollIndicator',
    baseType: 'Item',
    properties: [property('position', 'real', 0), property('size', 'real', 0), property('active', 'bool', false)],
  },
  {
    name: 'ScrollBar',
    baseType: 'Item',
    properties: [
      property('orientation', 'var', 'Qt.Vertical'), property('position', 'real', 0),
      property('size', 'real', 0), property('active', 'bool', false),
    ],
  },
  { name: 'StackLayout', baseType: 'Item', properties: [property('currentIndex', 'int', 0)] },
  { name: 'SwipeView', baseType: 'Control', properties: [property('currentIndex', 'int', 0), property('orientation', 'var', 'Qt.Horizontal')] },
  {
    name: 'StackView',
    baseType: 'Control',
    properties: [
      property('currentIndex', 'int', -1), property('depth', 'int', 0, { readonly: true }),
      property('currentItem', 'var', null, { readonly: true }), property('empty', 'bool', true, { readonly: true }),
      property('busy', 'bool', false, { readonly: true }), property('initialItem', 'var', null),
    ],
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
  { name: 'MenuSeparator', baseType: 'Item', properties: [property('implicitHeight', 'real', 1, { readonly: true })] },
  { name: 'MenuBar', baseType: 'Control' },
  { name: 'ToolBar', baseType: 'Control', properties: [property('implicitHeight', 'real', 40, { readonly: true })] },
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

export function createBuiltinQmlTypeRegistry(): QmlTypeRegistry {
  const registry = new QmlTypeRegistry()
  builtinQmlTypeDefinitions.forEach(type => registry.register(type))
  return registry
}
