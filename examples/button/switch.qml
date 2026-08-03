import QtQuick
import QtQuick.Controls

// ================================================================
// Switch 属性与信号综合验证
// 验证项：
//   checked 初始状态
//   toggled / clicked 信号
//   checked 属性绑定联动（主开关控制子开关）
//   enabled / disabled 状态渲染
//   开关状态颜色实时绑定
// ================================================================

ColumnLayout {
    spacing: 12

    // ---- 基本开关 + toggled / clicked 信号 ----
    Text { text: "Signals: toggled / clicked"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        Switch {
            id: wifiSwitch
            text: qsTr("Wi-Fi")
            checked: true
            onToggled: statusText.text = "toggled: " + text + " → " + checked
            onClicked:  console.log("clicked:", text, checked)
        }
        // 颜色绑定到 checked 状态
        Text {
            text: wifiSwitch.checked ? "ON" : "OFF"
            color: wifiSwitch.checked ? "#4ade80" : "#f87171"
            font.pixelSize: 14
        }
    }

    Switch {
        id: btSwitch
        text: qsTr("Bluetooth")
        onToggled: statusText.text = "toggled: " + text + " → " + checked
    }

    // ---- checked 绑定联动：主开关同步所有子开关 ----
    Text { text: "Binding: master switch controls all"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        Switch {
            id: masterSwitch
            text: "All Services"
            onToggled: {
                wifiSwitch.checked = checked
                btSwitch.checked   = checked
                statusText.text = "master toggled → all=" + checked
            }
        }
        Text {
            text: "controls Wi-Fi & Bluetooth"
            color: "#9ca3af"
            font.pixelSize: 12
        }
    }

    // ---- enabled / disabled 状态 ----
    Text { text: "State: enabled / disabled"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        Switch {
            text: "Enabled"
            checked: true
            onToggled: statusText.text = "toggled: Enabled → " + checked
        }
        Switch {
            text: "Disabled (on)"
            checked: true
            enabled: false
        }
        Switch {
            text: "Disabled (off)"
            enabled: false
        }
    }

    // ---- 状态反馈 ----
    Text {
        id: statusText
        text: "Status: (toggle a switch)"
        color: "#60a5fa"
        font.pixelSize: 13
    }
}
