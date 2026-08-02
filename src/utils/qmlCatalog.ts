import { builtinQmlTypeDefinitions } from '../runtime/BuiltinQmlTypes'

export type QmlPropertyKind =
  | 'string'
  | 'url'
  | 'number'
  | 'boolean'
  | 'color'
  | 'enum'
  | 'array'
  | 'model'
  | 'component'
  | 'date'
  | 'time'
  | 'expression'
  | 'handler'

export interface QmlPropertyDefinition {
  name: string
  kind: QmlPropertyKind
  values?: string[]
  detail?: string
  readOnly?: boolean
}

export interface QmlTypeDefinition {
  name: string
  extends?: string
  properties: QmlPropertyDefinition[]
  methods?: string[]
  detail?: string
}

const property = (
  name: string,
  kind: QmlPropertyKind = 'expression',
  values?: string[],
  detail?: string,
  readOnly = false,
): QmlPropertyDefinition => ({ name, kind, values, detail, readOnly })

const commonProperties: QmlPropertyDefinition[] = [
  property('id', 'expression'),
  property('x', 'number'), property('y', 'number'),
  property('width', 'number'), property('height', 'number'),
  property('visible', 'boolean'), property('enabled', 'boolean'),
  property('opacity', 'number'), property('z', 'number'), property('clip', 'boolean'),
  property('anchors.fill', 'expression'), property('anchors.centerIn', 'expression'),
  property('anchors.left', 'expression'), property('anchors.right', 'expression'),
  property('anchors.top', 'expression'), property('anchors.bottom', 'expression'),
  property('anchors.horizontalCenter', 'expression'), property('anchors.verticalCenter', 'expression'),
  property('anchors.margins', 'number'), property('anchors.leftMargin', 'number'),
  property('anchors.rightMargin', 'number'), property('anchors.topMargin', 'number'),
  property('anchors.bottomMargin', 'number'),
  property('Layout.fillWidth', 'boolean'), property('Layout.fillHeight', 'boolean'),
  property('Layout.preferredWidth', 'number'), property('Layout.preferredHeight', 'number'),
  property('Layout.minimumWidth', 'number'), property('Layout.minimumHeight', 'number'),
  property('Layout.maximumWidth', 'number'), property('Layout.maximumHeight', 'number'),
  property('Layout.alignment', 'enum', [
    'Qt.AlignLeft', 'Qt.AlignRight', 'Qt.AlignHCenter', 'Qt.AlignTop',
    'Qt.AlignBottom', 'Qt.AlignVCenter', 'Qt.AlignCenter',
  ]),
]

const textProperties = [
  property('text', 'string'), property('color', 'color'),
  property('font.pixelSize', 'number'), property('font.pointSize', 'number'),
  property('font.bold', 'boolean'), property('font.italic', 'boolean'), property('font.family', 'string'),
  property('horizontalAlignment', 'enum', ['Text.AlignLeft', 'Text.AlignHCenter', 'Text.AlignRight', 'Text.AlignJustify']),
  property('verticalAlignment', 'enum', ['Text.AlignTop', 'Text.AlignVCenter', 'Text.AlignBottom']),
  property('wrapMode', 'enum', ['Text.NoWrap', 'Text.WordWrap', 'Text.WrapAnywhere', 'Text.WrapAtWordBoundaryOrAnywhere']),
]

const clickProperties = [
  property('text', 'string'), property('checkable', 'boolean'), property('checked', 'boolean'),
  property('autoExclusive', 'boolean'), property('autoRepeat', 'boolean'),
  property('autoRepeatDelay', 'number'), property('autoRepeatInterval', 'number'),
  property('display', 'enum', ['AbstractButton.IconOnly', 'AbstractButton.TextOnly', 'AbstractButton.TextBesideIcon', 'AbstractButton.TextUnderIcon']),
  property('down', 'boolean'), property('pressed', 'boolean', undefined, undefined, true),
  property('pressX', 'number', undefined, undefined, true), property('pressY', 'number', undefined, undefined, true),
  property('flat', 'boolean'), property('highlighted', 'boolean'),
  property('action', 'var'),
  property('icon.name', 'string'), property('icon.source', 'url'),
  property('icon.width', 'number'), property('icon.height', 'number'),
  property('icon.color', 'color'), property('icon.cache', 'boolean'),
  property('implicitIndicatorWidth', 'number', undefined, undefined, true),
  property('implicitIndicatorHeight', 'number', undefined, undefined, true),
  property('indicator', 'component'),
  property('background', 'component'),
  property('transition', 'expression'),
  property('onClicked', 'handler'), property('onPressed', 'handler'), property('onReleased', 'handler'),
  property('onCanceled', 'handler'), property('onDoubleClicked', 'handler'),
  property('onPressAndHold', 'handler'), property('onToggled', 'handler'),
]

const selectionModeValues = [
  'SelectionMode.NoSelection',
  'SelectionMode.SingleSelection',
  'SelectionMode.ContiguousSelection',
  'SelectionMode.ExtendedSelection',
]

// Inheritance map: child type → parent type
const typeExtends: Record<string, string> = {
  ApplicationWindow: 'Window',
  Label: 'Text',
  RoundButton: 'Button',
  ToolButton: 'Button',
  DelayButton: 'Button',
  TabButton: 'Button',
  CheckBox: 'Button',
  Switch: 'CheckBox',
  RadioButton: 'Button',
  TextInput: 'TextField',
  TextEdit: 'TextArea',
  Dial: 'Slider',
  Drawer: 'Popup',
  Dialog: 'Popup',
  MenuItem: 'Button',
  ScrollView: 'Flickable',
  GroupBox: 'Frame',
  Frame: 'Pane',
  Pane: 'Control',
  Page: 'Control',
  BusyIndicator: 'Control',
  DatePicker: 'Control',
  TimePicker: 'Control',
  SwipeView: 'Control',
  SplitView: 'Control',
  ColorAnimation: 'NumberAnimation',
  SplineSeries: 'LineSeries',
}

const typeProperties: Record<string, QmlPropertyDefinition[]> = {
  // ── Window (Qt 6) ──
  Window: [
    property('title', 'string'),
    property('color', 'color'),
    property('visible', 'boolean'),
    property('width', 'number'), property('height', 'number'),
    property('x', 'number'), property('y', 'number'),
    property('minimumWidth', 'number'), property('minimumHeight', 'number'),
    property('maximumWidth', 'number'), property('maximumHeight', 'number'),
    property('opacity', 'number'),
    property('flags', 'enum', ['Qt.Window', 'Qt.FramelessWindowHint', 'Qt.WindowStaysOnTopHint', 'Qt.Dialog', 'Qt.Popup', 'Qt.Tool', 'Qt.SplashScreen', 'Qt.SubWindow']),
    property('modality', 'enum', ['Qt.NonModal', 'Qt.WindowModal', 'Qt.ApplicationModal']),
    property('visibility', 'enum', ['Window.Windowed', 'Window.Minimized', 'Window.Maximized', 'Window.FullScreen', 'Window.Hidden', 'Window.AutomaticVisibility']),
    property('windowState', 'enum', ['Qt.WindowNoState', 'Qt.WindowMinimized', 'Qt.WindowMaximized', 'Qt.WindowFullScreen']),
    property('active', 'boolean', undefined, 'Whether the window has focus', true),
    property('activeFocusItem', 'expression', undefined, 'Item with active focus', true),
    property('contentItem', 'expression', undefined, 'Root content item', true),
    property('data', 'array'),
    property('onClosing', 'handler'),
    property('onActiveFocusItemChanged', 'handler'),
    property('onFrameSwapped', 'handler'),
    property('onWindowStateChanged', 'handler'),
    property('onVisibilityChanged', 'handler'),
  ],
  // ── ApplicationWindow (Qt 6) — extends Window ──
  ApplicationWindow: [
    property('activeFocusControl', 'expression', undefined, 'Control with active focus', true),
    property('background', 'component'),
    property('bottomPadding', 'number'),
    property('contentData', 'array'),
    property('contentItem', 'expression', undefined, 'Content item root', true),
    property('font', 'expression'),
    property('footer', 'component'),
    property('header', 'component'),
    property('leftPadding', 'number'),
    property('locale', 'string'),
    property('menuBar', 'component'),
    property('rightPadding', 'number'),
    property('topPadding', 'number'),
  ],
  Rectangle: [property('color', 'color'), property('radius', 'number'), property('border.width', 'number'), property('border.color', 'color')],
  Text: textProperties,
  Label: textProperties,
  Image: [property('source', 'url'), property('fillMode', 'enum', ['Image.Stretch', 'Image.PreserveAspectFit', 'Image.PreserveAspectCrop', 'Image.Tile'])],
  Row: [property('spacing', 'number'), property('padding', 'number')],
  Column: [property('spacing', 'number'), property('padding', 'number')],
  Flow: [property('spacing', 'number'), property('flow', 'enum', ['Flow.LeftToRight', 'Flow.TopToBottom'])],
  RowLayout: [property('spacing', 'number')],
  ColumnLayout: [property('spacing', 'number')],
  GridLayout: [property('columns', 'number'), property('rows', 'number'), property('rowSpacing', 'number'), property('columnSpacing', 'number')],
  // ── Control (Qt 6 base) ──
  Control: [
    property('background', 'component'),
    property('contentItem', 'expression', undefined, 'Content item', true),
    property('font', 'expression'),
    property('locale', 'string'),
    property('padding', 'number'),
    property('topPadding', 'number'), property('bottomPadding', 'number'),
    property('leftPadding', 'number'), property('rightPadding', 'number'),
    property('spacing', 'number'),
    property('implicitBackgroundWidth', 'number', undefined, undefined, true),
    property('implicitBackgroundHeight', 'number', undefined, undefined, true),
    property('implicitContentWidth', 'number', undefined, undefined, true),
    property('implicitContentHeight', 'number', undefined, undefined, true),
    property('availableWidth', 'number', undefined, 'Available content width', true),
    property('availableHeight', 'number', undefined, 'Available content height', true),
    property('horizontalPadding', 'number'),
    property('verticalPadding', 'number'),
    property('focusPolicy', 'enum', ['Qt.NoFocus', 'Qt.TabFocus', 'Qt.ClickFocus', 'Qt.StrongFocus', 'Qt.WheelFocus']),
    property('hovered', 'boolean', undefined, 'Whether mouse is hovering', true),
    property('visualFocus', 'boolean', undefined, 'Whether has visual focus', true),
    property('enabled', 'boolean'),
    property('wheelEnabled', 'boolean'),
  ],
  // ── Popup (Qt 6 base) ──
  Popup: [
    property('modal', 'boolean'),
    property('visible', 'boolean'),
    property('closePolicy', 'enum', ['Popup.NoAutoClose', 'Popup.CloseOnPressOutside', 'Popup.CloseOnEscape', 'Popup.CloseOnPressOutside | Popup.CloseOnEscape']),
    property('dim', 'boolean'),
    property('focus', 'boolean'),
    property('parent', 'expression'),
    property('x', 'number'), property('y', 'number'),
    property('width', 'number'), property('height', 'number'),
    property('implicitWidth', 'number'), property('implicitHeight', 'number'),
    property('margins', 'number'),
    property('topMargin', 'number'), property('bottomMargin', 'number'),
    property('leftMargin', 'number'), property('rightMargin', 'number'),
    property('topInset', 'number'), property('bottomInset', 'number'),
    property('leftInset', 'number'), property('rightInset', 'number'),
    property('opacity', 'number'),
    property('scale', 'number'),
    property('opened', 'boolean', undefined, 'Whether popup is open', true),
    property('contentWidth', 'number'), property('contentHeight', 'number'),
    property('onOpened', 'handler'), property('onClosed', 'handler'),
    property('onAboutToShow', 'handler'), property('onAboutToHide', 'handler'),
  ],
  // ── Flickable (Qt 6 base) ──
  Flickable: [
    property('contentX', 'number'), property('contentY', 'number'),
    property('contentWidth', 'number'), property('contentHeight', 'number'),
    property('flickableDirection', 'enum', ['Flickable.HorizontalFlick', 'Flickable.VerticalFlick', 'Flickable.AutoFlickDirection']),
    property('boundsBehavior', 'enum', ['Flickable.StopAtBounds', 'Flickable.DragOverBounds', 'Flickable.OvershootBounds', 'Flickable.DragAndOvershootBounds']),
    property('boundsMovement', 'enum', ['Flickable.StopAtBounds', 'Flickable.FollowBoundsBehavior']),
    property('maximumFlickVelocity', 'number'),
    property('pixelAligned', 'boolean'),
    property('pressDelay', 'number'),
    property('rebound', 'expression'),
    property('synchronousDrag', 'boolean'),
    property('dragging', 'boolean', undefined, 'Whether user is dragging', true),
    property('flicking', 'boolean', undefined, 'Whether flicking', true),
    property('moving', 'boolean', undefined, 'Whether moving', true),
    property('atXBeginning', 'boolean', undefined, undefined, true),
    property('atXEnd', 'boolean', undefined, undefined, true),
    property('atYBeginning', 'boolean', undefined, undefined, true),
    property('atYEnd', 'boolean', undefined, undefined, true),
    property('originX', 'number', undefined, undefined, true),
    property('originY', 'number', undefined, undefined, true),
    property('onMovementStarted', 'handler'), property('onMovementEnded', 'handler'),
    property('onFlickStarted', 'handler'), property('onFlickEnded', 'handler'),
    property('onDragStarted', 'handler'), property('onDragEnded', 'handler'),
  ],
  // ── Button (Qt 6 base — extends Control) ──
  Button: clickProperties,
  RoundButton: [property('radius', 'number')],
  ToolButton: [],
  DelayButton: [property('delay', 'number'), property('progress', 'number')],
  CheckBox: [property('checkState', 'number'), property('tristate', 'boolean'), property('nextCheckState', 'expression')],
  RadioButton: [property('ButtonGroup.group', 'expression')],
  Switch: [],
  Slider: [property('from', 'number'), property('to', 'number'), property('value', 'number'), property('stepSize', 'number'), property('orientation', 'enum', ['Qt.Horizontal', 'Qt.Vertical']), property('onValueChanged', 'handler')],
  RangeSlider: [property('from', 'number'), property('to', 'number'), property('first.value', 'number'), property('second.value', 'number'), property('orientation', 'enum', ['Qt.Horizontal', 'Qt.Vertical'])],
  Dial: [property('wrap', 'boolean')],
  SpinBox: [property('from', 'number'), property('to', 'number'), property('value', 'number'), property('stepSize', 'number'), property('editable', 'boolean'), property('onValueChanged', 'handler')],
  ProgressBar: [property('from', 'number'), property('to', 'number'), property('value', 'number'), property('indeterminate', 'boolean')],
  TextField: [property('text', 'string'), property('placeholderText', 'string'), property('readOnly', 'boolean'), property('echoMode', 'enum', ['TextInput.Normal', 'TextInput.Password', 'TextInput.NoEcho', 'TextInput.PasswordEchoOnEdit']), property('onTextChanged', 'handler'), property('onAccepted', 'handler')],
  TextInput: [],
  TextArea: [property('text', 'string'), property('placeholderText', 'string'), property('readOnly', 'boolean'), property('wrapMode', 'enum', ['TextEdit.NoWrap', 'TextEdit.WordWrap', 'TextEdit.WrapAnywhere']), property('onTextChanged', 'handler')],
  TextEdit: [],
  ComboBox: [property('model', 'model'), property('textRole', 'string'), property('currentIndex', 'number'), property('currentText', 'string', undefined, 'Read-only current display text', true), property('editText', 'string'), property('placeholderText', 'string'), property('editable', 'boolean'), property('onAccepted', 'handler'), property('onActivated', 'handler'), property('onCurrentIndexChanged', 'handler')],
  ListView: [property('model', 'model'), property('delegate', 'component'), property('currentIndex', 'number'), property('spacing', 'number'), property('orientation', 'enum', ['ListView.Vertical', 'ListView.Horizontal']), property('onActivated', 'handler')],
  GridView: [property('model', 'model'), property('delegate', 'component'), property('currentIndex', 'number'), property('cellWidth', 'number'), property('cellHeight', 'number')],
  PathView: [property('model', 'model'), property('delegate', 'component'), property('currentIndex', 'number'), property('pathItemCount', 'number'), property('path', 'component')],
  Path: [property('startX', 'number'), property('startY', 'number')],
  PathLine: [property('x', 'number'), property('y', 'number')],
  PathQuad: [property('x', 'number'), property('y', 'number'), property('controlX', 'number'), property('controlY', 'number')],
  PathCubic: [property('x', 'number'), property('y', 'number'), property('control1X', 'number'), property('control1Y', 'number'), property('control2X', 'number'), property('control2Y', 'number')],
  Repeater: [property('model', 'model'), property('delegate', 'component')],
  Loader: [property('active', 'boolean'), property('source', 'url'), property('sourceComponent', 'component'), property('onLoaded', 'handler')],
  Tumbler: [property('model', 'model'), property('currentIndex', 'number')],
  TabBar: [property('currentIndex', 'number'), property('onCurrentIndexChanged', 'handler')],
  TabButton: [],
  StackLayout: [property('currentIndex', 'number')],
  SwipeView: [property('currentIndex', 'number'), property('orientation', 'enum', ['Qt.Horizontal', 'Qt.Vertical'])],
  StackView: [property('currentIndex', 'number'), property('initialItem', 'component')],
  SplitView: [property('orientation', 'enum', ['Qt.Horizontal', 'Qt.Vertical'])],
  Dialog: [property('title', 'string'), property('standardButtons', 'enum', ['Dialog.Ok', 'Dialog.Cancel', 'Dialog.Yes', 'Dialog.No', 'Dialog.Close', 'Dialog.Ok | Dialog.Cancel', 'Dialog.Yes | Dialog.No']), property('onAccepted', 'handler'), property('onRejected', 'handler')],
  Drawer: [property('edge', 'enum', ['Qt.LeftEdge', 'Qt.RightEdge', 'Qt.TopEdge', 'Qt.BottomEdge']), property('position', 'number')],
  ToolTip: [property('text', 'string'), property('delay', 'number'), property('timeout', 'number'), property('visible', 'boolean')],
  ScrollBar: [property('orientation', 'enum', ['Qt.Horizontal', 'Qt.Vertical']), property('position', 'number'), property('size', 'number'), property('active', 'boolean')],
  TableView: [property('model', 'model'), property('delegate', 'component'), property('currentIndex', 'number'), property('columns', 'array'), property('headers', 'array'), property('columnWidths', 'array'), property('editable', 'boolean'), property('selectionMode', 'enum', selectionModeValues), property('resizableColumns', 'boolean')],
  TreeView: [property('model', 'model'), property('delegate', 'component'), property('currentIndex', 'number'), property('idRole', 'string'), property('parentRole', 'string'), property('textRole', 'string'), property('expanded', 'boolean'), property('selectionMode', 'enum', selectionModeValues)],
  GroupBox: [property('title', 'string')],
  BusyIndicator: [property('running', 'boolean')],
  Menu: [property('title', 'string'), property('enabled', 'boolean')],
  MenuItem: [property('shortcut', 'string')],
  Action: [property('text', 'string'), property('enabled', 'boolean'), property('checkable', 'boolean'), property('checked', 'boolean'), property('shortcut', 'string'), property('onTriggered', 'handler')],
  Timer: [property('interval', 'number'), property('running', 'boolean'), property('repeat', 'boolean'), property('triggeredOnStart', 'boolean'), property('onTriggered', 'handler')],
  Connections: [property('target', 'expression'), property('enabled', 'boolean')],
  Calendar: [property('selectedDate', 'date'), property('displayedMonth', 'date'), property('locale', 'string'), property('onClicked', 'handler')],
  DatePicker: [property('date', 'date'), property('value', 'date'), property('onValueChanged', 'handler')],
  TimePicker: [property('time', 'time'), property('value', 'time'), property('onValueChanged', 'handler')],
  WebEngineView: [property('url', 'url'), property('onLoadingChanged', 'handler')],
  VideoOutput: [property('source', 'expression'), property('fillMode', 'enum', ['VideoOutput.Stretch', 'VideoOutput.PreserveAspectFit', 'VideoOutput.PreserveAspectCrop']), property('autoPlay', 'boolean'), property('muted', 'boolean'), property('controls', 'boolean')],
  DropShadow: [property('source', 'expression'), property('radius', 'number'), property('samples', 'number'), property('color', 'color'), property('horizontalOffset', 'number'), property('verticalOffset', 'number')],
  OpacityMask: [property('source', 'expression'), property('maskSource', 'expression'), property('opacity', 'number')],
  ShaderEffect: [property('fragmentShader', 'url'), property('vertexShader', 'url'), property('opacity', 'number')],
  ChartView: [property('title', 'string'), property('legend.visible', 'boolean'), property('antialiasing', 'boolean')],
  LineSeries: [property('name', 'string'), property('color', 'color')],
  SplineSeries: [],
  BarSeries: [property('name', 'string'), property('color', 'color')],
  BarSet: [property('label', 'string'), property('values', 'array')],
  PieSeries: [property('name', 'string')],
  PieSlice: [property('label', 'string'), property('value', 'number'), property('color', 'color')],
  XYPoint: [property('x', 'number'), property('y', 'number')],
  NumberAnimation: [property('target', 'expression'), property('property', 'string'), property('from', 'number'), property('to', 'number'), property('duration', 'number'), property('running', 'boolean'), property('loops', 'number'), property('easing.type', 'enum', ['Easing.Linear', 'Easing.InQuad', 'Easing.OutQuad', 'Easing.InOutQuad', 'Easing.OutInQuad', 'Easing.InCubic', 'Easing.OutCubic', 'Easing.InOutCubic', 'Easing.OutInCubic', 'Easing.InQuart', 'Easing.OutQuart', 'Easing.InOutQuart', 'Easing.OutInQuart', 'Easing.InQuint', 'Easing.OutQuint', 'Easing.InOutQuint', 'Easing.OutInQuint', 'Easing.InSine', 'Easing.OutSine', 'Easing.InOutSine', 'Easing.OutInSine', 'Easing.InExpo', 'Easing.OutExpo', 'Easing.InOutExpo', 'Easing.OutInExpo', 'Easing.InCirc', 'Easing.OutCirc', 'Easing.InOutCirc', 'Easing.OutInCirc', 'Easing.InElastic', 'Easing.OutElastic', 'Easing.InOutElastic', 'Easing.OutInElastic', 'Easing.InBack', 'Easing.OutBack', 'Easing.InOutBack', 'Easing.OutInBack', 'Easing.InBounce', 'Easing.OutBounce', 'Easing.InOutBounce', 'Easing.OutInBounce'])],
  ColorAnimation: [property('target', 'expression'), property('property', 'string'), property('from', 'color'), property('to', 'color'), property('duration', 'number'), property('running', 'boolean')],
  PropertyAnimation: [property('target', 'expression'), property('property', 'string'), property('from', 'expression'), property('to', 'expression'), property('duration', 'number'), property('running', 'boolean')],
}

const supportedTypes = builtinQmlTypeDefinitions.map(type => type.name)

const methodsByType: Record<string, string[]> = {
  Button: ['toggle()'],
  Dialog: ['open()', 'close()', 'accept()', 'reject()'],
  Popup: ['open()', 'close()'],
  Drawer: ['open()', 'close()'],
  ListModel: ['append()', 'remove()', 'set()', 'setProperty()', 'get()', 'clear()'],
  StackView: ['push()', 'pop()', 'replace()', 'clear()'],
  Loader: ['setSource()'],
  WebEngineView: ['reload()', 'stop()', 'goBack()', 'goForward()'],
  NumberAnimation: ['start()', 'restart()', 'stop()'],
  ColorAnimation: ['start()', 'restart()', 'stop()'],
  PropertyAnimation: ['start()', 'restart()', 'stop()'],
}

export const qmlTypes: QmlTypeDefinition[] = supportedTypes.map(name => {
  const nonVisualTypes = new Set(['ListModel', 'ListElement', 'Connections', 'Component', 'Action', 'ActionGroup', 'Shortcut', 'Timer', 'Path', 'PathLine', 'PathQuad', 'PathCubic', 'LineSeries', 'SplineSeries', 'BarSeries', 'BarSet', 'PieSeries', 'PieSlice', 'XYPoint', 'NumberAnimation', 'ColorAnimation', 'PropertyAnimation'])
  const windowTypes = new Set(['ApplicationWindow', 'Window'])

  // Walk the inheritance chain to collect ancestor properties (parent first, child last)
  const ancestorChain: string[] = []
  let current: string | undefined = typeExtends[name]
  const visited = new Set<string>()
  while (current && !visited.has(current)) {
    visited.add(current)
    ancestorChain.unshift(current)
    current = typeExtends[current]
  }
  const inheritedFromAncestors = ancestorChain.flatMap(ancestor => typeProperties[ancestor] || [])

  const baseProperties = nonVisualTypes.has(name)
    ? commonProperties.filter(item => item.name === 'id')
    : windowTypes.has(name)
      ? commonProperties.filter(item => ['id', 'x', 'y', 'width', 'height', 'visible', 'opacity'].includes(item.name))
      : commonProperties

  // Merge: base → ancestors (parent first) → own properties. Later entries override earlier ones.
  const mergedProperties = [...baseProperties, ...inheritedFromAncestors, ...(typeProperties[name] || [])]
  return {
    name,
    extends: typeExtends[name],
    properties: [...new Map(mergedProperties.map(item => [item.name, item])).values()],
    methods: methodsByType[name] || [],
    detail: 'QML control supported by preview',
  }
})

export const qmlTypeMap = new Map(qmlTypes.map(type => [type.name, type]))

export const groupedProperties: Record<string, QmlPropertyDefinition[]> = {
  anchors: commonProperties.filter(item => item.name.startsWith('anchors.')).map(item => ({ ...item, name: item.name.slice(8) })),
  Layout: commonProperties.filter(item => item.name.startsWith('Layout.')).map(item => ({ ...item, name: item.name.slice(7) })),
  font: textProperties.filter(item => item.name.startsWith('font.')).map(item => ({ ...item, name: item.name.slice(5) })),
  border: (typeProperties.Rectangle || []).filter(item => item.name.startsWith('border.')).map(item => ({ ...item, name: item.name.slice(7) })),
}

export const namespaceMembers: Record<string, string[]> = {
  Qt: ['Horizontal', 'Vertical', 'AlignLeft', 'AlignRight', 'AlignHCenter', 'AlignTop', 'AlignBottom', 'AlignVCenter', 'AlignCenter', 'LeftEdge', 'RightEdge', 'TopEdge', 'BottomEdge'],
  Dialog: ['Ok', 'Cancel', 'Yes', 'No', 'Close'],
  Popup: ['NoAutoClose', 'CloseOnPressOutside', 'CloseOnEscape'],
  Text: ['AlignLeft', 'AlignHCenter', 'AlignRight', 'AlignJustify', 'AlignTop', 'AlignVCenter', 'AlignBottom', 'NoWrap', 'WordWrap', 'WrapAnywhere', 'WrapAtWordBoundaryOrAnywhere'],
  Image: ['Stretch', 'PreserveAspectFit', 'PreserveAspectCrop', 'Tile'],
}

export const qmlImports = ['QtQuick', 'QtQuick.Controls', 'QtQuick.Layouts', 'QtQuick.Window', 'QtQuick.Dialogs', 'QtQuick.Shapes', 'QtMultimedia', 'QtWebEngine']

export const qmlPragmas = [
  'Singleton',
  'ComponentBehavior: Bound',
  'NativeMethodBehavior: AcceptThisObject',
]

export const qmlSyntaxSnippets: Array<{ label: string; insertText: string; command?: { id: string; title: string } }> = [
  { label: 'property', insertText: 'property ', command: { id: 'editor.action.triggerSuggest', title: 'Suggest property type' } },
  { label: 'readonly property', insertText: 'readonly property ', command: { id: 'editor.action.triggerSuggest', title: 'Suggest property type' } },
  { label: 'required property', insertText: 'required property ', command: { id: 'editor.action.triggerSuggest', title: 'Suggest property type' } },
  { label: 'default property', insertText: 'default property ', command: { id: 'editor.action.triggerSuggest', title: 'Suggest property type' } },
  { label: 'signal', insertText: 'signal ${1:name}(${2})' },
  { label: 'function', insertText: 'function ${1:name}(${2}) {\n\t$0\n}' },
  { label: 'component', insertText: 'component ${1:Name}: ${2:Item} {\n\t$0\n}' },
]

const visualContent = [
  'Label', 'Text', 'Image', 'Button', 'CheckBox', 'RadioButton', 'Switch',
  'TextField', 'TextArea', 'ComboBox', 'Slider', 'ProgressBar', 'Rectangle',
  'Row', 'Column', 'RowLayout', 'ColumnLayout', 'GridLayout', 'Item',
]

export const recommendedChildren: Record<string, string[]> = {
  ApplicationWindow: ['Page', 'ColumnLayout', 'RowLayout', 'ToolBar', 'MenuBar', 'Dialog', 'Popup', ...visualContent],
  Window: ['ColumnLayout', 'RowLayout', 'Dialog', 'Popup', ...visualContent],
  Page: ['ColumnLayout', 'RowLayout', 'GridLayout', 'ToolBar', ...visualContent],
  Pane: visualContent,
  Frame: visualContent,
  GroupBox: visualContent,
  Rectangle: visualContent,
  Item: visualContent,
  Row: visualContent,
  Column: visualContent,
  Flow: visualContent,
  RowLayout: visualContent,
  ColumnLayout: visualContent,
  GridLayout: visualContent,
  ScrollView: ['Column', 'Row', 'ListView', 'GridView', 'TextArea', ...visualContent],
  Flickable: ['Item', 'Column', 'Row', 'Image', 'Rectangle'],
  MenuBar: ['Menu'],
  Menu: ['MenuItem', 'MenuSeparator', 'Menu'],
  TabBar: ['TabButton'],
  Dialog: ['ColumnLayout', 'RowLayout', 'Label', 'TextField', 'Button', 'CheckBox'],
  Popup: visualContent,
  Drawer: visualContent,
  StackLayout: ['Page', 'Item', 'ColumnLayout', 'RowLayout', ...visualContent],
  SwipeView: ['Page', 'Item', 'ColumnLayout', ...visualContent],
}

export function controlSnippet(type: string): string {
  const snippets: Record<string, string> = {
    ApplicationWindow: 'ApplicationWindow {\n\tid: ${1:root}\n\twidth: ${2:800}\n\theight: ${3:600}\n\tvisible: true\n\t$0\n}',
    Rectangle: 'Rectangle {\n\twidth: ${1:120}\n\theight: ${2:80}\n\tcolor: "${3:steelblue}"\n\t$0\n}',
    Text: 'Text {\n\ttext: "${1:Text}"\n\t$0\n}',
    Label: 'Label {\n\ttext: "${1:Label}"\n\t$0\n}',
    Button: 'Button {\n\ttext: "${1:Button}"\n\t$0\n}',
    TextField: 'TextField {\n\tplaceholderText: "${1:Enter text}"\n\t$0\n}',
    Dialog: 'Dialog {\n\tid: ${1:dialog}\n\ttitle: "${2:Dialog}"\n\tstandardButtons: Dialog.Ok | Dialog.Cancel\n\t$0\n}',
    Popup: 'Popup {\n\tid: ${1:popup}\n\twidth: ${2:240}\n\theight: ${3:120}\n\t$0\n}',
    ListView: 'ListView {\n\tmodel: ${1:model}\n\tdelegate: ${2:ItemDelegate} {\n\t\ttext: ${3:modelData}\n\t}\n\t$0\n}',
  }
  return snippets[type] || `${type} {\n\t$0\n}`
}