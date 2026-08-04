import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// ================================================================
// Popup / Dialog / ToolTip 综合验证
// 验证项：
// Popup open() / close() 显示与关闭
// Popup modal + dim 遮罩
// Popup closePolicy 关闭策略
// Popup anchors.centerIn overlay 居中
// Dialog title + standardButtons 标准按钮
// Dialog accepted / rejected 信号
// ToolTip delay / timeout 悬停提示
// ToolTip text 附加属性简写
// ================================================================

ColumnLayout {
    spacing: 14

    // ---- 基本 Popup ----
    // 期望：点击按钮后在页面中央弹出半透明卡片；点击外部关闭
    Text { text: "Popup: open / close + closePolicy"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 10
        Button {
            text: "Open Popup"
            onClicked: basicPopup.open()
        }
        Button {
            text: "Open Modal"
            onClicked: modalPopup.open()
        }
    }

    // ---- Dialog 标准按钮 ----
    // 期望：对话框居中，有标题栏；OK/Cancel 按钮在底部；accepted/rejected 触发状态更新
    Text { text: "Dialog: title + standardButtons"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 10
        Button {
            text: "Open Dialog"
            onClicked: confirmDialog.open()
        }
        Button {
            text: "Info Dialog"
            onClicked: infoDialog.open()
        }
    }

    // ---- ToolTip 悬停提示 ----
    // 期望：悬停 500ms 后出现提示框；离开后 2000ms 内消失；直接点击立即显示
    Text { text: "ToolTip: delay / timeout / attached property"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 10
        Button {
            text: "Hover me (500ms)"
            // 期望：悬停 500ms 显示，2s 后自动消失
            ToolTip.visible: hovered
            ToolTip.delay: 500
            ToolTip.timeout: 2000
            ToolTip.text: "Tooltip via attached property"
        }
        Button {
            text: "Click ToolTip"
            onClicked: clickTip.open()
            ToolTip {
                id: clickTip
                text: "Opened on click — closes in 1.5s"
                timeout: 1500
            }
        }
    }

    // ---- 状态反馈 ----
    Label {
        id: statusLabel
        text: "Status: (open a popup or dialog)"
        color: "#60a5fa"; font.pixelSize: 13
    }

    // ================================================================
    // Popup 定义
    // ================================================================

    Popup {
        id: basicPopup
        // 期望：居中于 overlay；背景白色圆角卡片；宽 260px
        anchors.centerIn: Overlay.overlay
        width: 260; height: 120
        closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 16
            spacing: 10
            Label { text: "Basic Popup"; font.pixelSize: 16; font.bold: true }
            Label { text: "Click outside or press Esc to close"; font.pixelSize: 12; color: "#64748b" }
            Button {
                text: "Close"
                Layout.alignment: Qt.AlignRight
                onClicked: basicPopup.close()
            }
        }
    }

    Popup {
        id: modalPopup
        // 期望：dim:true 时背景遮罩变暗；modal:true 时点击外部不关闭
        anchors.centerIn: Overlay.overlay
        width: 280; height: 140
        modal: true
        dim: true
        closePolicy: Popup.CloseOnEscape

        ColumnLayout {
            anchors.fill: parent
            anchors.margins: 16
            spacing: 10
            Label { text: "Modal Popup"; font.pixelSize: 16; font.bold: true }
            Label { text: "Background is dimmed (dim: true)"; font.pixelSize: 12; color: "#64748b" }
            Label { text: "Press Esc or button to close"; font.pixelSize: 12; color: "#64748b" }
            Button {
                text: "Close"
                Layout.alignment: Qt.AlignRight
                onClicked: modalPopup.close()
            }
        }
    }

    Dialog {
        id: confirmDialog
        // 期望：标题栏显示 "Confirm"；底部 OK + Cancel 水平排列
        anchors.centerIn: Overlay.overlay
        title: "Confirm Action"
        standardButtons: Dialog.Ok | Dialog.Cancel
        modal: true

        ColumnLayout {

            Label {
                text: "Do you want to proceed with this action?"
                wrapMode: Label.WordWrap
                width: 260
            }

            Button {
                text: "Ok"
            }

            Button {
                text: "Cancel"
            }
        }

        onAccepted: statusLabel.text = "Dialog: accepted"
        onRejected: statusLabel.text = "Dialog: rejected"
    }

    Dialog {
        id: infoDialog
        anchors.centerIn: Overlay.overlay
        title: "Information"
        standardButtons: Dialog.Ok
        modal: true

        Label {
            text: "This is an informational dialog\nwith only an OK button."
            wrapMode: Label.WordWrap
            width: 240
        }

        onAccepted: statusLabel.text = "Info dialog: closed"
    }
}
