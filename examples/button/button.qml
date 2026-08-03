import QtQuick
import QtQuick.Controls

// ================================================================
// Button 属性与信号综合验证
// 验证项：
//   highlighted / flat / default 外观样式
//   enabled / disabled 状态渲染
//   checkable + checked 切换（Toggle Button）
//   clicked / pressed / released / pressAndHold 信号
//   autoRepeat 持续重复触发
// ================================================================

ColumnLayout {
    spacing: 12

    // ---- 外观样式：highlighted / flat / default ----
    Text { text: "Style: highlighted / flat / default"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        Button {
            text: "Highlighted"
            highlighted: true
            onClicked:      statusText.text = "clicked: Highlighted"
            onPressAndHold: statusText.text = "pressAndHold: Highlighted"
        }
        Button {
            text: "Flat"
            flat: true
            onClicked: statusText.text = "clicked: Flat"
        }
        Button {
            text: "Default"
            onClicked: statusText.text = "clicked: Default"
        }
    }

    // ---- 信号：pressed / released ----
    Text { text: "Signals: pressed / released / pressAndHold"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        Button {
            text: "Press & Release"
            onPressed:  statusText.text = "pressed"
            onReleased: statusText.text = "released"
            onClicked:  statusText.text = "clicked"
        }
        Button {
            text: "Hold me"
            onPressAndHold: statusText.text = "pressAndHold"
            onReleased:     statusText.text = "released (after hold)"
        }
    }

    // ---- enabled / disabled 状态 ----
    Text { text: "State: enabled / disabled"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        Button {
            id: toggleTarget
            text: "Toggle target"
            onClicked: statusText.text = "clicked: toggle target"
        }
        Button {
            text: toggleTarget.enabled ? "Disable it" : "Enable it"
            onClicked: toggleTarget.enabled = !toggleTarget.enabled
        }
        Button {
            text: "Always Disabled"
            enabled: false
        }
    }

    // ---- checkable / checked（Toggle Button）----
    Text { text: "Behavior: checkable toggle button"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        Button {
            id: checkBtn
            text: checked ? "Checked ✓" : "Unchecked"
            checkable: true
            onToggled: statusText.text = "toggled → checked=" + checked
            onClicked: console.log("checkable clicked, checked=", checked)
        }
        Button {
            text: "Reset"
            onClicked: { checkBtn.checked = false; statusText.text = "reset" }
        }
    }

    // ---- autoRepeat：持续按住持续触发 ----
    Text { text: "Behavior: autoRepeat (hold to count)"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        property int count: 0
        Button {
            text: "+1"
            autoRepeat: true
            autoRepeatDelay: 400
            autoRepeatInterval: 100
            onClicked: { parent.count++; statusText.text = "autoRepeat count=" + parent.count }
        }
        Button {
            text: "Reset"
            onClicked: { parent.count = 0; statusText.text = "reset count" }
        }
        Text { text: "count: " + parent.count; color: "#e8e8e8" }
    }

    // ---- 状态反馈 ----
    Text {
        id: statusText
        text: "Status: (interact with the buttons above)"
        color: "#60a5fa"
        font.pixelSize: 13
    }
}
