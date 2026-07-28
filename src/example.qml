import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: root
    width: 900
    height: 700
    visible: true
    title: 'Qt 6 Compatibility Demo'
    property int counter: 0
    property bool showLoaded: true

    function incCounter() {
        root.counter = root.counter + 1
    }

    // ---------- 菜单栏（header 属性） ----------
    // 预期：顶部显示 File、Help，底部显示 Status；菜单项默认隐藏，点击菜单标题后展开。
    header: MenuBar {
        Menu {
            title: "File"
            MenuItem { text: 'Exit' }
        }
        Menu {
            title: "Help"
            MenuItem { text: 'About' }
        }
    }

    footer: MenuBar {
        Menu {
            title: "Status"
            MenuItem { text: 'Ready' }
        }
    }

    // ---------- 可滚动内容区 ----------
    ScrollView {
        anchors.fill: parent

        ColumnLayout {
            id: column
            spacing: 16
            width: parent.width
            anchors.margins: 16

            // ---------- 标题 ----------
            // 预期：主标题以 22px 粗体显示；下一行粗体文字在内容区水平居中。
            Label {
                text: 'Qt 6 Compatibility Demo'
                font.pixelSize: 22
                font.bold: true
            }

            Label {
                text: "Parser check: single quote + enum OR"
                font.bold: true
                Layout.alignment: Qt.AlignHCenter | Qt.AlignVCenter
            }

            // 预期：初始为 counter=0；点击 +1 或 +5 后计数分别累加 1 或 5。
            Label { text: "JS binding / function / onClicked:"; font.bold: true }
            RowLayout {
                Button {
                    id: incBtn
                    text: "+1"
                    onClicked: { incCounter() }
                }
                Button {
                    id: addFiveBtn
                    text: "+5 (Connections)"
                }
                Label { text: "counter=" + root.counter }
            }

            Connections {
                target: addFiveBtn
                function onClicked() {
                    root.counter = root.counter + 5
                }
            }

            // 预期：偶数时蓝色矩形宽 120、x=10；奇数时变红、宽 220、x=180，并有 220ms 过渡。
            // 第二个矩形偶数为绿色、奇数为红色，文字显示当前 when-state。
            Label { text: "states / transitions:"; font.bold: true }
            Rectangle {
                id: stateRect
                width: 120
                height: 36
                x: 10
                radius: 6
                color: "#80cfff"
                state: root.counter % 2 === 0 ? "idle" : "hot"
                states: [
                    State {
                        name: "idle"
                        PropertyChanges {
                            target: stateRect
                            x: 10
                            width: 120
                            color: "#80cfff"
                        }
                    },
                    State {
                        name: "hot"
                        PropertyChanges {
                            target: stateRect
                            x: 180
                            width: 220
                            color: "#ff9a9a"
                        }
                    }
                ]
                transitions: [
                    Transition {
                        NumberAnimation {
                            properties: "x, width"
                            duration: 220
                        }
                    }
                ]
                Label { anchors.centerIn: parent; text: "state=" + stateRect.state }
            }

            Rectangle {
                id: stateWhenRect
                width: 220
                height: 28
                radius: 5
                color: "#e6f4ff"
                states: [
                    State {
                        name: "odd"
                        when: root.counter % 2 === 1
                        PropertyChanges {
                            target: stateWhenRect
                            color: "#ffd6d6"
                        }
                    },
                    State {
                        name: "even"
                        when: root.counter % 2 === 0
                        PropertyChanges {
                            target: stateWhenRect
                            color: "#d9f7be"
                        }
                    }
                ]
                Label { anchors.centerIn: parent; text: "when-state=" + stateWhenRect.state }
            }

            // 预期：列表依次显示 Alice、Bob、Cora、Tom、Jerry 及各自年龄，可在 100px 高区域内滚动。
            Label { text: "ListModel / ListElement:"; font.bold: true }
            ListModel {
                id: peopleModel
                ListElement { name: "Alice"; age: "23" }
                ListElement { name: "Bob"; age: "31" }
                ListElement { name: "Cora"; age: "29" }
                ListElement { name: "Tom"; age: "39" }
                ListElement { name: "Jerry"; age: "39" }
            }
            ListView {
                width: parent.width
                height: 100
                model: peopleModel
                delegate: ItemDelegate {
                    text: name + " (" + age + ")"
                }
            }

            // 预期：初始显示绿色 Loaded from Component；点击 Toggle Loader 后隐藏/恢复，active 文本同步变化。
            Label { text: "Loader lifecycle:"; font.bold: true }
            RowLayout {
                Button {
                    text: "Toggle Loader"
                    onClicked: { root.showLoaded = !root.showLoaded }
                }
                Label { text: "active=" + root.showLoaded }
            }
            Loader {
                id: dynLoader
                active: root.showLoaded
                sourceComponent: Component {
                    Rectangle {
                        width: 220
                        height: 34
                        radius: 6
                        color: "#d9f7be"
                        border.width: 1
                        border.color: "#95de64"
                        Label { anchors.centerIn: parent; text: "Loaded from Component" }
                    }
                }
            }

            // 预期：引用 externalCard 的 Loader 始终显示黄色 sourceComponent by id 卡片。
            Component {
                id: externalCard
                Rectangle {
                    width: 260
                    height: 34
                    radius: 6
                    color: "#fff1b8"
                    border.width: 1
                    border.color: "#d4b106"
                    Label { anchors.centerIn: parent; text: "sourceComponent by id" }
                }
            }
            Loader {
                id: externalLoader
                active: true
                sourceComponent: externalCard
            }

            // ---------- 按钮组 ----------
            // 预期：依次显示普通矩形按钮、圆形 R 按钮和透明工具按钮，悬停时有高亮反馈。
            Label { text: "Buttons:"; font.bold: true }
            RowLayout {
                Button { text: "Push Button" }
                RoundButton { text: "R" }
                ToolButton { text: "Tool" }
            }

            // ---------- 复选框 & 单选框 ----------
            // 预期：分组框内 Enable feature 和 Option A 初始选中；点击后选择标记可切换。
            GroupBox {
                title: "Checkboxes & Radios"
                Layout.fillWidth: true
                ColumnLayout {
                    CheckBox { text: "Enable feature"; checked: true }
                    CheckBox { text: "Auto save" }
                    RadioButton { text: "Option A"; checked: true }
                    RadioButton { text: "Option B" }
                }
            }

            // ---------- 开关 & 滑块 ----------
            // 预期：开关初始开启；滑块位于 40%，进度条填充 65%，控件横向铺开且不重叠。
            Label { text: "Switches & Sliders:"; font.bold: true }
            RowLayout {
                Label { text: "Switch:" }
                Switch { checked: true }
                Label { text: "Slider:" }
                Slider { from: 0; to: 100; value: 40; Layout.fillWidth: true }
            }

            ProgressBar { value: 0.65; Layout.fillWidth: true }

            // ---------- 文本输入 ----------
            // 预期：单行输入框和约 80px 高的多行输入框纵向排列，均显示 placeholder 且可输入。
            Label { text: "Text Input:"; font.bold: true }
            TextField { placeholderText: "Single line input"; Layout.fillWidth: true }
            TextArea { placeholderText: "Multi-line text area"; Layout.fillWidth: true; implicitHeight: 80 }

            // ---------- 下拉框 ----------
            // 预期：普通下拉框初始选中 Option 2；可编辑下拉框可输入过滤，输入 Gamma 后按 Enter 接受。
            Label { text: "Combo Box:"; font.bold: true }
            ComboBox { model: ["Option 1", "Option 2", "Option 3"]; currentIndex: 1; Layout.fillWidth: true }
            ComboBox {
                id: editableCombo
                model: ["Alpha", "Beta", "Gamma"]
                editable: true
                currentIndex: 0
                placeholderText: "Type to filter"
                Layout.fillWidth: true
            }

            // ---------- 新增控件展示 ----------
            // 预期：SpinBox 显示 3 并可加减；DelayButton 长按约 1 秒填充；Dial 初始为 65%，可鼠标拖动修改。
            Label { text: "Newly Added Controls:"; font.bold: true }
            RowLayout {
                spacing: 10
                SpinBox { from: 0; to: 10; value: 3 }
                DelayButton { text: "Delay 1s"; delay: 1000 }
                Dial { from: 0; to: 100; value: 65 }
            }

            // 预期：RangeSlider 两个滑块初始位于 20% 和 80% 且均可拖动；Tumbler 可点击或滚轮循环切换。
            Label { text: "RangeSlider / Tumbler:"; font.bold: true }
            RowLayout {
                spacing: 10
                RangeSlider { from: 0; to: 100; first.value: 20; second.value: 80; width: 220 }
                Tumbler { model: ["A", "B", "C", "D"]; currentIndex: 2 }
            }

            // 预期：P0、P1、P2 沿二次曲线排列，中间项高于两端；水平拖动可改变 currentIndex。
            Label { text: "PathView geometry:"; font.bold: true }
            PathView {
                id: pathDemo
                width: parent.width
                height: 150
                model: 3
                currentIndex: 0
                delegate: Rectangle {
                    width: 44
                    height: 28
                    radius: 4
                    color: "#5b8def"
                    Label { anchors.centerIn: parent; text: "P" + index; color: "white" }
                }
                path: Path {
                    startX: 40
                    startY: 110
                    PathQuad { x: 500; y: 110; controlX: 270; controlY: 10 }
                }
            }

            // 预期：内容区可纵向滚动；右侧 attached ScrollBar 随滚动同步，并可拖动滑块。
            Label { text: "Attached ScrollBar:"; font.bold: true }
            Flickable {
                width: parent.width
                height: 100
                contentHeight: 260
                Rectangle {
                    width: parent.width
                    height: 260
                    color: "#eef5ff"
                    Label { anchors.centerIn: parent; text: "Scrollable 260px content" }
                }
                ScrollBar.vertical: ScrollBar { active: true }
            }

            // 预期：SwipeView 仅显示居中的第 2 页，StackView 仅显示居中的第 1 页，文字不被裁剪；SplitView 左右并排。
            Label { text: "SwipeView / StackView / SplitView:"; font.bold: true }
            SwipeView {
                width: parent.width
                height: 70
                currentIndex: 1
                Rectangle { color: "#e6f7ff"; Label { anchors.centerIn: parent; text: "Swipe Page 1" } }
                Rectangle { color: "#fff7e6"; Label { anchors.centerIn: parent; text: "Swipe Page 2" } }
                Rectangle { color: "#f6ffed"; Label { anchors.centerIn: parent; text: "Swipe Page 3" } }
            }
            StackView {
                id: stackDemo
                width: parent.width
                height: 70
                currentIndex: 0
                Rectangle { id: stackPage1; color: "#f9f0ff"; Label { anchors.centerIn: parent; text: "Stack Page 1" } }
                Rectangle { id: stackPage2; color: "#fff1f0"; Label { anchors.centerIn: parent; text: "Stack Page 2" } }
            }
            RowLayout {
                Button { text: "Stack Pop"; onClicked: stackDemo.pop() }
                Button { text: "Stack Push"; onClicked: stackDemo.push(1) }
                Button { text: "Stack Replace"; onClicked: stackDemo.replace(0) }
            }
            SplitView {
                width: parent.width
                height: 70
                Rectangle { color: "#f5f5f5"; width: 120; Label { anchors.centerIn: parent; text: "Left" } }
                Rectangle { color: "#e6fffb"; Layout.fillWidth: true; Label { anchors.centerIn: parent; text: "Right" } }
            }

            // 预期：Page > Pane > Frame 呈三层边框；Drawer、ToolTip 在 root 页面显示。
            // Popup 被抽取到 settingsPopup Tab，左上对齐显示标题、说明、输入框、选项、复选框和操作按钮。
            Label { text: "Page / Pane / Frame / Drawer / Popup / ToolTip:"; font.bold: true }
            Page {
                width: parent.width
                Pane {
                    width: parent.width
                    Frame {
                        width: parent.width
                        Label { text: "Page > Pane > Frame" }
                    }
                }
            }
            RowLayout {
                Drawer { width: 140; height: 48; Label { text: "Drawer" } }
                Popup {
                    id: settingsPopup
                    width: 320
                    height: 230

                    ColumnLayout {
                        width: 298
                        spacing: 10

                        Label { text: "Popup settings"; font.bold: true; font.pixelSize: 18 }
                        Label { text: "Configure this preview item:"; color: "#777777" }
                        TextField { width: 298; placeholderText: "Item name"; text: "Sample item" }
                        ComboBox { width: 298; model: ["Small", "Medium", "Large"]; currentIndex: 1 }
                        CheckBox { text: "Enable notifications"; checked: true }
                        RowLayout {
                            spacing: 8
                            Button { text: "Cancel" }
                            Button { text: "Apply" }
                        }
                    }
                }
                ToolTip { text: "ToolTip" }
            }

            // 预期：TableView 显示独立标准表头带、完整网格和排序箭头；3 列可拖动表头右缘调宽。
            // Ctrl/Command+点击支持多选；ScrollIndicator 在浅灰矩形右侧显示一条细竖向滚动指示条。
            Label { text: "Table/Tree/Header/Indicator:"; font.bold: true }
            HorizontalHeaderView { width: parent.width; Label { text: "H1" }; Label { text: "H2" }; Label { text: "H3" } }
            ListModel {
                id: employeeModel
                ListElement { name: "Alice"; department: "Design"; status: "Active" }
                ListElement { name: "Bob"; department: "Engineering"; status: "Active" }
                ListElement { name: "Cora"; department: "QA"; status: "Review" }
                ListElement { name: "Tom"; department: "Support"; status: "Away" }
            }
            TableView {
                id: employeeTable
                width: parent.width
                height: 150
                model: employeeModel
                columns: ["name", "department", "status"]
                headers: ["Name", "Department", "Status"]
                columnWidths: [180, 260, 140]
                resizableColumns: true
                editable: true
                selectionMode: ExtendedSelection
            }
            RowLayout {
                Button { text: "Select row 2"; onClicked: employeeTable.select(1, "Add") }
                Button { text: "Clear table selection"; onClicked: employeeTable.clearSelection() }
            }
            ListModel {
                id: projectTreeModel
                ListElement { nodeId: "workspace"; parentId: ""; name: "Workspace" }
                ListElement { nodeId: "src"; parentId: "workspace"; name: "src" }
                ListElement { nodeId: "components"; parentId: "src"; name: "components" }
                ListElement { nodeId: "preview"; parentId: "components"; name: "PreviewPanel.tsx" }
                ListElement { nodeId: "renderer"; parentId: "src"; name: "renderer" }
                ListElement { nodeId: "elements"; parentId: "renderer"; name: "elements.ts" }
                ListElement { nodeId: "readme"; parentId: "workspace"; name: "README.md" }
            }
            TreeView {
                id: projectTree
                width: parent.width
                height: 170
                model: projectTreeModel
                idRole: "nodeId"
                parentRole: "parentId"
                textRole: "name"
                expanded: true
                selectionMode: ExtendedSelection
            }
            RowLayout {
                Button { text: "Select src"; onClicked: projectTree.select("src", "Add") }
                Button { text: "Clear tree selection"; onClicked: projectTree.clearSelection() }
            }
            Rectangle {
                width: parent.width
                height: 56
                color: "#fafafa"
                border.width: 1
                border.color: "#ddd"
                ScrollIndicator { }
                Label { anchors.centerIn: parent; text: "ScrollIndicator" }
            }

            // 预期：显示 February 2024、29 天且 29 日高亮；左右箭头切换月份，星期标题按 locale 生成。
            Label { text: "Calendar / DatePicker / TimePicker:"; font.bold: true }
            Calendar {
                width: parent.width
                height: 220
                selectedDate: "2024-02-29"
                displayedMonth: "2024-02-01"
                locale: "en-US"
            }
            RowLayout {
                DatePicker { }
                TimePicker { }
            }

            // 预期：ShaderEffect 保留内容；DropShadow 使用蓝灰阴影；OpacityMask 应用透明度。
            // ChartView 显示折线和柱形 SVG；VideoOutput 尝试播放远程 MP4；WebEngineView 加载能力受目标站点 CSP 限制。
            Label { text: "Effects / Chart / Media:"; font.bold: true }
            ShaderEffect {
                width: parent.width
                height: 40
                opacity: 0.9
                Rectangle { anchors.fill: parent; color: "#e8f3ff"; Label { anchors.centerIn: parent; text: "ShaderEffect" } }
            }
            DropShadow {
                width: parent.width
                height: 40
                radius: 10
                horizontalOffset: 3
                verticalOffset: 5
                color: "steelblue"
                Rectangle { anchors.fill: parent; color: "#fffbe6"; Label { anchors.centerIn: parent; text: "DropShadow" } }
            }
            OpacityMask {
                width: parent.width
                height: 40
                opacity: 0.65
                Rectangle { anchors.fill: parent; color: "#f6ffed"; Label { anchors.centerIn: parent; text: "OpacityMask" } }
            }
            ChartView {
                width: parent.width
                height: 180
                LineSeries {
                    color: "steelblue"
                    XYPoint { x: 0; y: 1 }
                    XYPoint { x: 1; y: 3 }
                    XYPoint { x: 2; y: 2 }
                    XYPoint { x: 3; y: 5 }
                }
                BarSeries {
                    color: "#65a765"
                    BarSet { label: "Values"; values: [2, 4, 3, 5] }
                }
            }
            WebEngineView { width: parent.width; height: 120; url: "https://example.com" }
            VideoOutput {
                width: parent.width
                height: 160
                source: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
                fillMode: VideoOutput.PreserveAspectFit
                muted: true
                controls: true
            }

            // 预期：点击 Replay 后蓝色矩形在 2.2 秒内从 x=0 移动到 x=220；可反复点击重新播放。
            Label { text: "Standalone animation:"; font.bold: true }
            Rectangle { id: animatedBox; width: 52; height: 28; radius: 4; color: "#4f86e8" }
            Button { text: "Replay animation"; onClicked: standaloneAnimation.restart() }
            NumberAnimation {
                id: standaloneAnimation
                target: animatedBox
                property: "x"
                from: 0
                to: 220
                duration: 2200
                easing.type: Easing.OutCubic
                running: false
            }

            // 预期：Action、ActionGroup、Shortcut 是非可视对象，预览中不应占据空间。
            Action { id: saveAction; text: "Save" }
            ActionGroup { id: modeGroup }
            Shortcut { sequence: "Ctrl+S" }

            // ---------- 标签页（验证 currentIndex） ----------
            // 预期：Tab 2 为选中样式，StackLayout 仅显示 Content of Tab 2；点击标签后内容同步切换。
            Label { text: "Tab Bar (currentIndex=1):"; font.bold: true }
            TabBar {
                Layout.fillWidth: true
                currentIndex: 1
                TabButton { text: "Tab 1" }
                TabButton { text: "Tab 2" }
                TabButton { text: "Tab 3" }
            }
            StackLayout {
                Layout.fillWidth: true
                currentIndex: 1
                Label { text: "Content of Tab 1" }
                Label { text: "Content of Tab 2" }
                Label { text: "Content of Tab 3" }
            }

            // ---------- ListView（delegate + 整数 model） ----------
            // 预期：130px 高列表展开 Item #0 到 Item #9，初始选中 Item #0；点击或方向键可改变当前项。
            Label { text: "List Items (model: 10):"; font.bold: true }
            ListView {
                id: listView
                width: parent.width
                height: 130
                model: 10
                currentIndex: 0
                delegate: ItemDelegate {
                    text: "Item #${index}"
                    width: listView.width
                }
            }

            // ---------- Repeater（验证 delegate 展开） ----------
            // 预期：横向显示 6 个蓝色小块，文字依次为 0-5。
            Label { text: 'Repeater (model: 6):'; font.bold: true }
            RowLayout {
                Repeater {
                    model: 6
                    delegate: Rectangle {
                        width: 36
                        height: 24
                        radius: 4
                        color: '#6aa9ff'
                        Label {
                            anchors.centerIn: parent
                            text: '${index}'
                        }
                    }
                }
            }

            // ---------- GridLayout ----------
            // 预期：6 个不同颜色的 80x40 矩形按 3 列、2 行排列，间距 8px。
            Label { text: "GridLayout:"; font.bold: true }
            GridLayout {
                columns: 3
                spacing: 8
                Rectangle { width: 80; height: 40; color: "#d5e8ff" }
                Rectangle { width: 80; height: 40; color: "#d5ffd8" }
                Rectangle { width: 80; height: 40; color: "#ffe3d5" }
                Rectangle { width: 80; height: 40; color: "#f0d5ff" }
                Rectangle { width: 80; height: 40; color: "#fff8d5" }
                Rectangle { width: 80; height: 40; color: "#d5fff8" }
            }

            // ---------- Flow ----------
            // 预期：Chip 0-11 以 120x30 灰色块从左到右排列，宽度不足时自动换行。
            Label { text: "Flow:"; font.bold: true }
            Flow {
                width: parent.width
                spacing: 8
                Repeater {
                    model: 12
                    delegate: Rectangle {
                        width: 120
                        height: 30
                        radius: 4
                        color: '#eeeeee'
                        border.width: 1
                        border.color: '#cccccc'
                        Label { anchors.centerIn: parent; text: "Chip ${index}" }
                    }
                }
            }

            // ---------- BusyIndicator ----------
            // 预期：显示一个持续旋转的 24px 圆形加载指示器。
            Label { text: "Busy Indicator:"; font.bold: true }
            BusyIndicator { running: true }

            // ---------- Layout.alignment Demo ----------
            // 预期：第一块中的蓝/绿/橙矩形分别顶端、垂直居中、底端对齐；第二块分别左、中、右对齐。
            Label { text: "Layout.alignment Demo:"; font.bold: true }
            GroupBox {
                title: "Alignment"
                Layout.fillWidth: true
                ColumnLayout {
                    width: parent.width
                    spacing: 8

                    // RowLayout: 垂直对齐（Top / VCenter / Bottom）
                    Rectangle {
                        width: parent.width
                        height: 90
                        color: "#f4f4f4"
                        border.width: 1
                        border.color: "#cccccc"

                        RowLayout {
                            anchors.fill: parent
                            spacing: 10
                            Rectangle { width: 80; height: 24; color: "#99c2ff"; Layout.alignment: Qt.AlignTop }
                            Rectangle { width: 80; height: 24; color: "#99ffcc"; Layout.alignment: Qt.AlignVCenter }
                            Rectangle { width: 80; height: 24; color: "#ffcc99"; Layout.alignment: Qt.AlignBottom }
                        }
                    }

                    // ColumnLayout: 水平对齐（Left / HCenter / Right）
                    Rectangle {
                        width: parent.width
                        height: 120
                        color: "#f4f4f4"
                        border.width: 1
                        border.color: "#cccccc"

                        ColumnLayout {
                            anchors.fill: parent
                            spacing: 10
                            Rectangle { width: 100; height: 24; color: "#99c2ff"; Layout.alignment: Qt.AlignLeft }
                            Rectangle { width: 100; height: 24; color: "#99ffcc"; Layout.alignment: Qt.AlignHCenter }
                            Rectangle { width: 100; height: 24; color: "#ffcc99"; Layout.alignment: Qt.AlignRight }
                        }
                    }
                }
            }
        }
    }

    // ---------- Dialogs ----------
    // 预期：两个 Dialog 默认 display:none，不显示也不占空间；当前示例没有触发它们打开的按钮。
    Dialog {
        id: demoDialog
        modal: true
        title: 'Demo Dialog'
        standardButtons: Dialog.Ok | Dialog.Cancel
        Label { text: 'This is a Qt 6 Dialog'; padding: 20 }
    }

    Dialog {
        id: aboutDialog
        modal: true
        title: "About"
        standardButtons: Dialog.Ok
        Label { text: 'Qt 6 Quick Controls Example'; padding: 20 }
    }
}
