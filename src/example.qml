import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: root
    width: 900
    height: 700
    visible: true
    title: "Qt 6 Quick Controls Demo"

    // ---------- 菜单栏（header 属性） ----------
    header: MenuBar {
        Menu {
            title: "File"
            MenuItem { text: "Exit" }
        }
        Menu {
            title: "Help"
            MenuItem { text: "About" }
        }
    }

    // ---------- 可滚动内容区 ----------
    Flickable {
        anchors.fill: parent
        contentHeight: column.implicitHeight
        clip: true

        ColumnLayout {
            id: column
            spacing: 16
            width: parent.width
            anchors.margins: 16

            // ---------- 标题 ----------
            Label {
                text: "Qt 6 Quick Controls Demo"
                font.pixelSize: 22
                font.bold: true
            }

            // ---------- 按钮组 ----------
            Label { text: "Buttons:"; font.bold: true }
            RowLayout {
                Button { text: "Push Button" }
                RoundButton { text: "R" }
                ToolButton { text: "Tool" }
            }

            // ---------- 复选框 & 单选框 ----------
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
            Label { text: "Switches & Sliders:"; font.bold: true }
            RowLayout {
                Label { text: "Switch:" }
                Switch { checked: true }
                Label { text: "Slider:" }
                Slider { from: 0; to: 100; value: 40; Layout.fillWidth: true }
            }

            ProgressBar { value: 0.65; Layout.fillWidth: true }

            // ---------- 文本输入 ----------
            Label { text: "Text Input:"; font.bold: true }
            TextField { placeholderText: "Single line input"; Layout.fillWidth: true }
            TextArea { placeholderText: "Multi-line text area"; Layout.fillWidth: true; implicitHeight: 80 }

            // ---------- 下拉框 ----------
            Label { text: "Combo Box:"; font.bold: true }
            ComboBox { model: ["Option 1", "Option 2", "Option 3"]; Layout.fillWidth: true }

            // ---------- 标签页 ----------
            Label { text: "Tab Bar:"; font.bold: true }
            TabBar { Layout.fillWidth: true
                TabButton { text: "Tab 1" }
                TabButton { text: "Tab 2" }
                TabButton { text: "Tab 3" }
            }
            StackLayout { Layout.fillWidth: true; currentIndex: 0
                Label { text: "Content of Tab 1" }
                Label { text: "Content of Tab 2" }
                Label { text: "Content of Tab 3" }
            }

            // ---------- ListView（delegate + 整数 model） ----------
            Label { text: "List Items (model: 10):"; font.bold: true }
            ListView {
                width: parent.width
                height: 130
                model: 10
                delegate: ItemDelegate {
                    text: "Item #${index}"
                    width: listView.width
                }
            }

            // ---------- BusyIndicator ----------
            Label { text: "Busy Indicator:"; font.bold: true }
            BusyIndicator { running: true }
        }
    }

    // ---------- Dialogs ----------
    Dialog {
        id: demoDialog
        modal: true
        title: "Demo Dialog"
        standardButtons: Dialog.Ok | Dialog.Cancel
        Label { text: "This is a Qt 6 Dialog"; padding: 20 }
    }

    Dialog {
        id: aboutDialog
        modal: true
        title: "About"
        standardButtons: Dialog.Ok
        Label { text: "Qt 6 Quick Controls Example"; padding: 20 }
    }
}
