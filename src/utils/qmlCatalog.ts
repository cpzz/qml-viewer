export type QmlPropertyKind = 'string' | 'number' | 'boolean' | 'color' | 'enum' | 'expression' | 'handler'

export interface QmlPropertyDefinition {
  name: string
  kind: QmlPropertyKind
  values?: string[]
  detail?: string
}

export interface QmlTypeDefinition {
  name: string
  properties: QmlPropertyDefinition[]
  methods?: string[]
  detail?: string
}

const property = (
  name: string,
  kind: QmlPropertyKind = 'expression',
  values?: string[],
  detail?: string,
): QmlPropertyDefinition => ({ name, kind, values, detail })

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
  property('onClicked', 'handler'), property('onPressed', 'handler'), property('onReleased', 'handler'),
]

const typeProperties: Record<string, QmlPropertyDefinition[]> = {
  ApplicationWindow: [property('title', 'string'), property('color', 'color'), property('visible', 'boolean'), property('header'), property('footer')],
  Window: [property('title', 'string'), property('color', 'color'), property('visible', 'boolean')],
  Rectangle: [property('color', 'color'), property('radius', 'number'), property('border.width', 'number'), property('border.color', 'color')],
  Text: textProperties,
  Label: textProperties,
  Image: [property('source', 'string'), property('fillMode', 'enum', ['Image.Stretch', 'Image.PreserveAspectFit', 'Image.PreserveAspectCrop', 'Image.Tile'])],
  Row: [property('spacing', 'number'), property('padding', 'number')],
  Column: [property('spacing', 'number'), property('padding', 'number')],
  Flow: [property('spacing', 'number'), property('flow', 'enum', ['Flow.LeftToRight', 'Flow.TopToBottom'])],
  RowLayout: [property('spacing', 'number')],
  ColumnLayout: [property('spacing', 'number')],
  GridLayout: [property('columns', 'number'), property('rows', 'number'), property('rowSpacing', 'number'), property('columnSpacing', 'number')],
  Button: clickProperties,
  RoundButton: [...clickProperties, property('radius', 'number')],
  ToolButton: clickProperties,
  DelayButton: [...clickProperties, property('delay', 'number'), property('progress', 'number')],
  CheckBox: [property('text', 'string'), property('checked', 'boolean'), property('onClicked', 'handler'), property('onToggled', 'handler')],
  RadioButton: [property('text', 'string'), property('checked', 'boolean'), property('Group', 'expression'), property('onClicked', 'handler')],
  Switch: [property('text', 'string'), property('checked', 'boolean'), property('onClicked', 'handler'), property('onToggled', 'handler')],
  Slider: [property('from', 'number'), property('to', 'number'), property('value', 'number'), property('stepSize', 'number'), property('orientation', 'enum', ['Qt.Horizontal', 'Qt.Vertical']), property('onValueChanged', 'handler')],
  RangeSlider: [property('from', 'number'), property('to', 'number'), property('first.value', 'number'), property('second.value', 'number'), property('orientation', 'enum', ['Qt.Horizontal', 'Qt.Vertical'])],
  Dial: [property('from', 'number'), property('to', 'number'), property('value', 'number'), property('stepSize', 'number'), property('onValueChanged', 'handler')],
  SpinBox: [property('from', 'number'), property('to', 'number'), property('value', 'number'), property('stepSize', 'number'), property('editable', 'boolean'), property('onValueChanged', 'handler')],
  ProgressBar: [property('from', 'number'), property('to', 'number'), property('value', 'number'), property('indeterminate', 'boolean')],
  TextField: [property('text', 'string'), property('placeholderText', 'string'), property('readOnly', 'boolean'), property('echoMode', 'enum', ['TextInput.Normal', 'TextInput.Password', 'TextInput.NoEcho', 'TextInput.PasswordEchoOnEdit']), property('onTextChanged', 'handler'), property('onAccepted', 'handler')],
  TextInput: [property('text', 'string'), property('readOnly', 'boolean'), property('echoMode', 'enum', ['TextInput.Normal', 'TextInput.Password', 'TextInput.NoEcho']), property('onTextChanged', 'handler'), property('onAccepted', 'handler')],
  TextArea: [property('text', 'string'), property('placeholderText', 'string'), property('readOnly', 'boolean'), property('wrapMode', 'enum', ['TextEdit.NoWrap', 'TextEdit.WordWrap', 'TextEdit.WrapAnywhere']), property('onTextChanged', 'handler')],
  TextEdit: [property('text', 'string'), property('readOnly', 'boolean'), property('wrapMode', 'enum', ['TextEdit.NoWrap', 'TextEdit.WordWrap', 'TextEdit.WrapAnywhere']), property('onTextChanged', 'handler')],
  ComboBox: [property('model'), property('currentIndex', 'number'), property('currentText', 'string'), property('placeholderText', 'string'), property('editable', 'boolean'), property('onActivated', 'handler'), property('onCurrentIndexChanged', 'handler')],
  ListView: [property('model'), property('delegate'), property('currentIndex', 'number'), property('spacing', 'number'), property('orientation', 'enum', ['ListView.Vertical', 'ListView.Horizontal']), property('onActivated', 'handler')],
  GridView: [property('model'), property('delegate'), property('currentIndex', 'number'), property('cellWidth', 'number'), property('cellHeight', 'number')],
  Repeater: [property('model'), property('delegate')],
  Loader: [property('active', 'boolean'), property('source', 'string'), property('sourceComponent'), property('onLoaded', 'handler')],
  TabBar: [property('currentIndex', 'number'), property('onCurrentIndexChanged', 'handler')],
  TabButton: clickProperties,
  StackLayout: [property('currentIndex', 'number')],
  SwipeView: [property('currentIndex', 'number'), property('orientation', 'enum', ['Qt.Horizontal', 'Qt.Vertical'])],
  StackView: [property('currentIndex', 'number'), property('initialItem')],
  SplitView: [property('orientation', 'enum', ['Qt.Horizontal', 'Qt.Vertical'])],
  Dialog: [property('title', 'string'), property('modal', 'boolean'), property('visible', 'boolean'), property('standardButtons', 'enum', ['Dialog.Ok', 'Dialog.Cancel', 'Dialog.Yes', 'Dialog.No', 'Dialog.Close', 'Dialog.Ok | Dialog.Cancel', 'Dialog.Yes | Dialog.No']), property('onAccepted', 'handler'), property('onRejected', 'handler'), property('onOpened', 'handler'), property('onClosed', 'handler')],
  Popup: [property('modal', 'boolean'), property('visible', 'boolean'), property('closePolicy', 'enum', ['Popup.NoAutoClose', 'Popup.CloseOnPressOutside', 'Popup.CloseOnEscape', 'Popup.CloseOnPressOutside | Popup.CloseOnEscape']), property('onOpened', 'handler'), property('onClosed', 'handler')],
  Drawer: [property('edge', 'enum', ['Qt.LeftEdge', 'Qt.RightEdge', 'Qt.TopEdge', 'Qt.BottomEdge']), property('position', 'number'), property('modal', 'boolean')],
  ToolTip: [property('text', 'string'), property('delay', 'number'), property('timeout', 'number'), property('visible', 'boolean')],
  ScrollBar: [property('orientation', 'enum', ['Qt.Horizontal', 'Qt.Vertical']), property('position', 'number'), property('size', 'number'), property('active', 'boolean')],
  TableView: [property('model'), property('delegate'), property('currentIndex', 'number'), property('columns'), property('headers'), property('editable', 'boolean'), property('selectionMode', 'enum', ['SingleSelection', 'MultiSelection']), property('resizableColumns', 'boolean')],
  TreeView: [property('model'), property('delegate'), property('currentIndex', 'number'), property('idRole', 'string'), property('parentRole', 'string'), property('textRole', 'string'), property('expanded', 'boolean'), property('selectionMode', 'enum', ['SingleSelection', 'MultiSelection'])],
  Menu: [property('title', 'string'), property('enabled', 'boolean')],
  MenuItem: [...clickProperties, property('shortcut', 'string')],
  Action: [property('text', 'string'), property('enabled', 'boolean'), property('checkable', 'boolean'), property('checked', 'boolean'), property('shortcut', 'string'), property('onTriggered', 'handler')],
  Timer: [property('interval', 'number'), property('running', 'boolean'), property('repeat', 'boolean'), property('triggeredOnStart', 'boolean'), property('onTriggered', 'handler')],
  Connections: [property('target'), property('enabled', 'boolean')],
  Calendar: [property('selectedDate'), property('onClicked', 'handler')],
  DatePicker: [property('date'), property('value'), property('onValueChanged', 'handler')],
  TimePicker: [property('time'), property('value'), property('onValueChanged', 'handler')],
  WebEngineView: [property('url', 'string'), property('onLoadingChanged', 'handler')],
  VideoOutput: [property('source'), property('fillMode', 'enum', ['VideoOutput.Stretch', 'VideoOutput.PreserveAspectFit', 'VideoOutput.PreserveAspectCrop'])],
}

const supportedTypes = [
  'Rectangle', 'Text', 'Image', 'Item', 'Row', 'Column', 'RowLayout', 'ColumnLayout', 'Flickable', 'ScrollView',
  'GridLayout', 'Flow', 'Repeater', 'ListModel', 'ListElement', 'Connections', 'Component', 'Loader', 'ScrollBar',
  'GroupBox', 'Button', 'RoundButton', 'ToolButton', 'CheckBox', 'RadioButton', 'Switch', 'Slider', 'RangeSlider',
  'Dial', 'SpinBox', 'Tumbler', 'DelayButton', 'ProgressBar', 'TextField', 'TextArea', 'TextInput', 'TextEdit',
  'ComboBox', 'TabBar', 'TabButton', 'StackLayout', 'SwipeView', 'StackView', 'SplitView', 'Page', 'Pane', 'Frame',
  'Drawer', 'Popup', 'ToolTip', 'ListView', 'GridView', 'PathView', 'TableView', 'TreeView', 'HorizontalHeaderView',
  'VerticalHeaderView', 'ItemDelegate', 'BusyIndicator', 'ScrollIndicator', 'ApplicationWindow', 'Window', 'Dialog',
  'MenuBar', 'Menu', 'MenuItem', 'MenuSeparator', 'Action', 'ActionGroup', 'Shortcut', 'Calendar', 'DatePicker',
  'TimePicker', 'ShaderEffect', 'DropShadow', 'OpacityMask', 'ChartView', 'WebEngineView', 'VideoOutput', 'Label', 'Timer',
]

const methodsByType: Record<string, string[]> = {
  Dialog: ['open()', 'close()', 'accept()', 'reject()'],
  Popup: ['open()', 'close()'],
  Drawer: ['open()', 'close()'],
  ListModel: ['append()', 'remove()', 'set()', 'setProperty()', 'get()', 'clear()'],
  StackView: ['push()', 'pop()', 'replace()', 'clear()'],
  Loader: ['setSource()'],
}

export const qmlTypes: QmlTypeDefinition[] = supportedTypes.map(name => {
  const mergedProperties = [...commonProperties, ...(typeProperties[name] || [])]
  return {
    name,
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

export const qmlSyntaxSnippets = [
  { label: 'property', insertText: 'property ${1:var} ${2:name}: ${3:value}' },
  { label: 'readonly property', insertText: 'readonly property ${1:var} ${2:name}: ${3:value}' },
  { label: 'required property', insertText: 'required property ${1:var} ${2:name}' },
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