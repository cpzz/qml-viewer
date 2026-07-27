# QML Compatibility Checklist (Validation-Oriented)

Scope: this checklist targets visualization validation for typical Qt Quick / Qt Quick Controls files, not full Qt runtime equivalence.

Status legend:
- PASS: works for common usage in this project
- PARTIAL: works for common patterns but has semantic gaps
- TODO: not implemented yet

## 1) Parsing and Syntax

| # | Item | Example | Status | Notes |
|---|---|---|---|---|
| 1 | Single/double quoted strings | `text: 'abc'`, `text: "abc"` | PASS | Parser handles both quote styles. |
| 2 | Enum OR expressions | `Dialog.Ok | Dialog.Cancel` | PASS | Basic parsing and value retention supported. |
| 3 | Property declarations | `property int count: 0` | PASS | Typed declarations parsed into reactive property storage. |
| 4 | Inline function declarations | `function inc(){ ... }` | PASS | Registered and callable from handlers/bindings. |
| 5 | Block properties | `header: MenuBar {}`, `delegate: ItemDelegate {}` | PASS | Parsed via blockProperties path. |
| 6 | Generic expressions in value | `text: "Count=" + root.count` | PASS | Retained and runtime-evaluated. |

## 2) Geometry and Layout

| # | Item | Example | Status | Notes |
|---|---|---|---|---|
| 7 | Anchors basics | `anchors.fill`, `anchors.centerIn` | PASS | Supported in layout conversion. |
| 8 | Position and size | `x/y/width/height` | PASS | Includes runtime updates from state/binding writes. |
| 9 | Layout containers | `Row/Column/RowLayout/ColumnLayout/GridLayout/Flow` | PASS | Includes spacing and basic alignment behavior. |
| 10 | Layout alignment flags | `Layout.alignment: Qt.AlignHCenter | Qt.AlignVCenter` | PASS | Common combinations mapped for row/column parents. |
| 11 | Visibility and opacity | `visible`, `opacity` | PASS | Static + runtime property updates supported. |
| 12 | Clipping and z-order | `clip: true`, `z: 10` | PASS | Mapped to overflow hidden and z-index. |

## 3) Controls and Interaction

| # | Item | Example | Status | Notes |
|---|---|---|---|---|
| 13 | Basic controls render | Button, Switch, Slider, TextField, ComboBox | PASS | Main controls mapped with visual defaults. |
| 14 | Event handlers | `onClicked`, `onTriggered`, `onActivated` | PASS | Generic onXxx attribute routing added. |
| 15 | Tab + stack sync | TabBar + StackLayout currentIndex | PASS | Initial and interactive index sync supported. |
| 16 | Menu interactions | Menu / MenuItem | PARTIAL | Basic open/trigger path works; advanced keyboard/focus semantics missing. |

## 4) Model/Data and Dynamic UI

| # | Item | Example | Status | Notes |
|---|---|---|---|---|
| 17 | Repeater/ListView numeric model | `model: 10` | PASS | Delegate expansion implemented. |
| 18 | ListModel/ListElement binding | `model: peopleModel` | PASS | Delegate data mapping and refresh path present. |
| 19 | Dynamic model API | `append/remove/setProperty/clear` | PARTIAL | Runtime API exists; covers common validation workflows. |
| 20 | Loader lifecycle | `active`, `sourceComponent` inline/id | PASS | Active toggle destroy/restore + id component resolution supported. |

## 5) State and Animation Semantics

| # | Item | Example | Status | Notes |
|---|---|---|---|---|
| 21 | states + PropertyChanges | `states: [State { ... }]` | PASS | PropertyChanges application supported. |
| 22 | State.when auto state | `when: root.count > 0` | PASS | Re-evaluated in binding cycle. |
| 23 | Transition base behavior | `Transition { NumberAnimation { ... } }` | PASS | duration/properties mapped to CSS transition. |
| 24 | Sequential/Parallel animation blocks | nested animation groups | PARTIAL | Duration/property aggregation implemented; full interpolation semantics not Qt-identical. |

## 6) Signals and Object Wiring

| # | Item | Example | Status | Notes |
|---|---|---|---|---|
| 25 | Connections target signal routing | `Connections { target: btn; onClicked: ... }` | PASS | onXxx/function onXxx supported for common cases. |
| 26 | Property-changed signal style | `onCountChanged` | PARTIAL | Trigger path exists; ordering/details may differ from Qt runtime. |

## 7) Newly Added Control Coverage

| # | Control/Area | Status | Notes |
|---|---|---|---|
| 27 | SpinBox / DelayButton | PASS | SpinBox supports +/- and value update; DelayButton supports delayed triggered behavior. |
| 28 | Dial / RangeSlider / Tumbler | PARTIAL | Visual + basic value semantics; advanced interaction semantics differ from Qt. |
| 29 | SwipeView / StackView / SplitView | PARTIAL | Page switching via currentIndex works; full navigation stack API not implemented. |
| 30 | Page / Pane / Frame / Drawer / Popup / ToolTip | PASS | Visualization-level rendering and basic structure support. |
| 31 | TableView / TreeView / HeaderView | PARTIAL | Structural rendering available; full model/delegate virtualization not implemented. |
| 32 | MenuSeparator / Action / ActionGroup / Shortcut | PARTIAL | Render/placeholder support for validation; full action/shortcut dispatch not implemented. |
| 33 | ScrollIndicator | PASS | Visual indicator rendering supported. |
| 34 | Calendar / DatePicker / TimePicker | PARTIAL | Calendar/date/time visualization supported; full locale/calendar semantics not Qt-identical. |
| 35 | ShaderEffect / DropShadow / OpacityMask | PARTIAL | Validation-oriented visual approximation only. |
| 36 | ChartView / WebEngineView / VideoOutput | PARTIAL | Placeholder/approximate rendering for visual validation; not feature-complete runtime engines. |

## Deferred (outside validation-first scope)

- TODO: Full JavaScript engine parity (scope chain edge cases, async/event loop parity, object model parity)
- TODO: Full animation subsystem parity (all easing curves, keyframes, behaviors, exact interpolation and timing model)
- TODO: Complete Loader source URL/module loading and full component lifetime guarantees
- TODO: Full focus, key navigation, accessibility, and input-method semantics

## Suggested Regression Set

Use this order for quick confidence checks:
1. example.qml renders with header/footer, state block, list model, loader sections
2. Click +1 / +5 buttons and verify counter, state color/position, and labels update
3. Toggle Loader and verify content destroy/restore
4. Verify ListModel-based ListView contents and dynamic updates from handlers
5. Validate one menu trigger and one tab switch interaction
6. Validate SpinBox +/- and DelayButton delayed trigger
7. Validate SwipeView/StackView currentIndex and SplitView layout
8. Validate DatePicker/TimePicker/WebEngineView placeholder rendering

## File anchors

- Renderer runtime: src/renderer/renderer.ts
- Parser: src/renderer/parser.ts
- Layout mapping: src/renderer/layouts.ts
- Element mapping: src/renderer/elements.ts
- Demo file: src/example.qml
