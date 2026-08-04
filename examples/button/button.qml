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
    // 期望：highlighted 按钮背景为 accent 色；flat 按钮无背景边框；default 按钮有边框阴影
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
    // 期望：mousedown → pressed；mouseup → released + clicked；依次触发，不乱序
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
    // 期望：disabled 按钮文字变灰（palette.disabled.buttonText）；不响应点击
    //       width: 200 的按钮应忽略 implicitWidth，实际宽度为 200px
    Text { text: "State: enabled / disabled"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        Button {
            id: toggleTarget
            text: "Toggle target"
            onClicked: statusText.text = "clicked: toggle target"
        }
        Button {
            width: 200
            height: 120
            text: toggleTarget.enabled ? "Disable it" : "Enable it"
            onClicked: toggleTarget.enabled = !toggleTarget.enabled
        }
        Button {
            text: "Always Disabled"
            enabled: false
        }
    }

    // ---- checkable / checked（Toggle Button）----
    // 期望：checkable 按钮点击后保持按下视觉；checked:true 时显示 aria-pressed
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
    // 期望：按下 400ms 后开始重复；之后每 100ms 触发一次 clicked；count 连续递增
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
