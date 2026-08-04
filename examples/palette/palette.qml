import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// ================================================================
// palette 综合验证
// 验证项：
//   palette.windowText  → Text / Label 默认文字色
//   palette.window      → ApplicationWindow / Rectangle 背景色
//   palette.button / buttonText → Button 背景与文字色
//   palette.accent      → highlighted Button 背景色
//   palette.disabled.*  → enabled: false 时自动切换颜色组
//   palette.base / text → TextField 背景与文字色
//   palette.placeholderText → TextField 占位符颜色
//   palette 继承        → 子控件自动继承父级 palette 角色
// ================================================================

ApplicationWindow {
    id: root
    width: 620
    height: 560
    visible: true
    palette.window: "#1e1e2e"
    palette.windowText: "#cdd6f4"
    palette.button: "#313244"
    palette.buttonText: "#cdd6f4"
    palette.accent: "#89b4fa"
    palette.base: "#181825"
    palette.text: "#cdd6f4"
    palette.placeholderText: "#6c7086"
    palette.highlight: "#89b4fa"
    palette.highlightedText: "#1e1e2e"
    // disabled 组：文字变灰
    palette.disabled.buttonText: "#6c7086"
    palette.disabled.text: "#6c7086"
    palette.disabled.windowText: "#6c7086"

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 16
        spacing: 14

        // ---- palette.windowText → Label 文字色 ----
        Text {
            text: "Section: palette.windowText → Label / Text color"
            font.pixelSize: 13
            font.bold: true
        }
        RowLayout {
            Label { text: "Label（继承 palette.windowText）" }
            Label { text: "显式 color 覆盖"; color: "#f38ba8" }
        }

        // ---- palette.button / buttonText / accent ----
        Text {
            text: "Section: palette.button / buttonText / accent"
            font.pixelSize: 13
            font.bold: true
        }
        RowLayout {
            Button { text: "Default（palette.button）" }
            Button { text: "Highlighted（palette.accent）"; highlighted: true }
            Button { text: "Flat"; flat: true }
        }

        // ---- palette.disabled.* → enabled: false 时的颜色组 ----
        Text {
            text: "Section: palette.disabled.* — enabled: false"
            font.pixelSize: 13
            font.bold: true
        }
        RowLayout {
            Button { text: "Enabled Button" }
            Button { text: "Disabled Button"; enabled: false }
            Label { text: "Enabled Label" }
            Label { text: "Disabled Label"; enabled: false }
        }

        // ---- palette.base / text / placeholderText → TextField ----
        Text {
            text: "Section: palette.base / text / placeholderText → TextField"
            font.pixelSize: 13
            font.bold: true
        }
        RowLayout {
            TextField {
                placeholderText: "占位符（palette.placeholderText）"
                width: 260
            }
            TextField {
                text: "有内容（palette.text）"
                width: 200
            }
        }

        // ---- palette 继承：子控件自动继承父级覆盖 ----
        Text {
            text: "Section: palette 继承 — 子区域覆盖父级角色"
            font.pixelSize: 13
            font.bold: true
        }
        Rectangle {
            Layout.fillWidth: true
            height: 80
            // 子区域局部覆盖 palette，不影响父级
            palette.button: "#a6e3a1"
            palette.buttonText: "#1e1e2e"
            palette.accent: "#f9e2af"
            color: "#2a2a3e"
            radius: 6
            RowLayout {
                anchors.centerIn: parent
                spacing: 10
                Button { text: "局部绿色"; width: 100 }
                Button { text: "局部高亮"; width: 100; highlighted: true }
                Label { text: "继承绿区 windowText" }
            }
        }

        // ---- 状态反馈 ----
        Label {
            id: statusLabel
            text: "Status: (interact with controls)"
            font.pixelSize: 12
        }
    }
}
