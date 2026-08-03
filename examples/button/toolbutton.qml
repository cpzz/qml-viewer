import QtQuick
import QtQuick.Controls

// ================================================================
// ToolButton 在 ApplicationWindow / ToolBar 中的验证
// 验证项：
//   ToolBar 内 ToolButton 基本点击与布局
//   checkable ToolButton（按压保持）
//   enabled / disabled 状态渲染
//   Label 填充剩余宽度（Layout.fillWidth）
//   clicked / toggled 信号
// ================================================================

ApplicationWindow {
    visible: true
    width: 440
    height: 340

    header: ToolBar {
        RowLayout {
            anchors.fill: parent

            // ---- 导航按钮 ----
            ToolButton {
                text: qsTr("‹")
                onClicked: statusLabel.text = "clicked: back"
            }

            // ---- 居中标题（fillWidth 拉伸）----
            Label {
                text: "Title"
                elide: Label.ElideRight
                horizontalAlignment: Qt.AlignHCenter
                verticalAlignment: Qt.AlignVCenter
                Layout.fillWidth: true
            }

            // ---- checkable ToolButton（选中保持）----
            ToolButton {
                id: boldBtn
                text: "B"
                checkable: true
                font.bold: true
                onToggled: statusLabel.text = "Bold: " + checked
            }

            // ---- 溢出菜单按钮 ----
            ToolButton {
                text: qsTr("⋮")
                onClicked: statusLabel.text = "clicked: overflow menu"
            }

            // ---- disabled ToolButton ----
            ToolButton {
                text: "Off"
                enabled: false
            }
        }
    }

    // ---- 状态反馈 ----
    Label {
        id: statusLabel
        anchors.centerIn: parent
        text: "Status: (click a toolbar button)"
        color: "#60a5fa"
        font.pixelSize: 14
    }
}
