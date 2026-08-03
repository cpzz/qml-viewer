import QtQuick
import QtQuick.Controls

// ================================================================
// RadioButton 属性与信号综合验证
// 验证项：
//   同父级内互斥选择（Qt 自动 autoExclusive）
//   checked 初始状态
//   clicked / toggled 信号
//   enabled / disabled 状态渲染
//   选中项文本实时绑定
// ================================================================

ColumnLayout {
    spacing: 8

    // ---- 互斥分组：同一父级内只有一项选中 ----
    Text { text: "Group: mutually exclusive (auto-exclusive)"; color: "#e8e8e8"; font.pixelSize: 14 }
    RadioButton {
        id: rb1
        text: qsTr("First")
        checked: true
        onClicked:  statusText.text = "clicked: " + text
        onToggled:  console.log("toggled:", text, "checked=", checked)
    }
    RadioButton {
        id: rb2
        text: qsTr("Second")
        onClicked: statusText.text = "clicked: " + text
    }
    RadioButton {
        id: rb3
        text: qsTr("Third")
        onClicked: statusText.text = "clicked: " + text
    }
    // 实时反映当前选中项
    Text {
        text: "Selected: " + (rb1.checked ? "First" : rb2.checked ? "Second" : "Third")
        color: "#a3e635"
        font.pixelSize: 13
    }

    Rectangle { Layout.fillWidth: true; height: 1; color: "#444444" }

    // ---- enabled / disabled：部分选项不可用 ----
    Text { text: "State: one option disabled"; color: "#e8e8e8"; font.pixelSize: 14 }
    RadioButton {
        text: qsTr("Option A")
        checked: true
        onClicked: statusText.text = "clicked: Option A"
    }
    RadioButton {
        text: qsTr("Option B  (disabled)")
        enabled: false
    }
    RadioButton {
        text: qsTr("Option C")
        onClicked: statusText.text = "clicked: Option C"
    }

    // ---- 状态反馈 ----
    Text {
        id: statusText
        text: "Status: (click a radio button)"
        color: "#60a5fa"
        font.pixelSize: 13
    }
}
