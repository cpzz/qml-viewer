import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// ================================================================
// Slider / RangeSlider / Dial 属性综合验证
// 验证项：
//   from / to / stepSize / value 范围与步进
//   orientation 水平 / 垂直
//   live 实时更新与移动后更新
//   snapMode 对齐步进
//   RangeSlider first.value / second.value 双端滑块
//   Dial from / to / value / snapMode
//   enabled / disabled 状态渲染
//   valueChanged / moved 信号
// ================================================================

ColumnLayout {
    spacing: 14

    // ---- 基本水平 Slider ----
    // 期望：拖动滑块实时更新 value；track 左侧 fill 随 value 增大
    Text { text: "Slider: horizontal + valueChanged"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 12
        Slider {
            id: hSlider
            from: 0; to: 100; stepSize: 1; value: 40
            onMoved: statusLabel.text = "moved: " + value.toFixed(0)
        }
        Text {
            text: hSlider.value.toFixed(0)
            color: "#a3e635"; font.pixelSize: 14; font.bold: true
        }
    }

    // ---- stepSize + snapMode ----
    // 期望：value 只能落在 0 / 25 / 50 / 75 / 100 五个刻度上
    Text { text: "Slider: stepSize 25 + SnapAlways"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 12
        Slider {
            id: snapSlider
            from: 0; to: 100; stepSize: 25
            snapMode: Slider.SnapAlways
            value: 50
            onMoved: statusLabel.text = "snap: " + value.toFixed(0)
        }
        Text {
            text: snapSlider.value.toFixed(0)
            color: "#fb923c"; font.pixelSize: 14
        }
    }

    // ---- 垂直 Slider ----
    // 期望：滑块垂直排列；track 在垂直方向填充；高度固定
    Text { text: "Slider: vertical orientation"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 24
        Slider {
            id: vSlider1
            from: 0; to: 100; value: 70
            orientation: Qt.Vertical
            implicitHeight: 120
            onMoved: statusLabel.text = "V1: " + value.toFixed(0)
        }
        Slider {
            id: vSlider2
            from: 0; to: 100; value: 30
            orientation: Qt.Vertical
            implicitHeight: 120
            onMoved: statusLabel.text = "V2: " + value.toFixed(0)
        }
        ColumnLayout {
            spacing: 4
            Text { text: "Ch1: " + vSlider1.value.toFixed(0); color: "#e8e8e8"; font.pixelSize: 12 }
            Text { text: "Ch2: " + vSlider2.value.toFixed(0); color: "#e8e8e8"; font.pixelSize: 12 }
        }
    }

    // ---- RangeSlider 双端 ----
    // 期望：两个独立滑块；first.value ≤ second.value；中间 track 高亮
    Text { text: "RangeSlider: first / second values"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 12
        RangeSlider {
            id: rangeSl
            from: 0; to: 200; stepSize: 1
            first.value: 40; second.value: 160
            first.onMoved:  statusLabel.text = "range: [" + first.value.toFixed(0) + ", " + second.value.toFixed(0) + "]"
            second.onMoved: statusLabel.text = "range: [" + first.value.toFixed(0) + ", " + second.value.toFixed(0) + "]"
        }
        Text {
            text: "[" + rangeSl.first.value.toFixed(0) + " – " + rangeSl.second.value.toFixed(0) + "]"
            color: "#a3e635"; font.pixelSize: 13
        }
    }

    // ---- Dial ----
    // 期望：旋钮从 -135° 到 +135° 旋转；value 实时更新
    Text { text: "Dial: rotary knob control"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 24
        Dial {
            id: dial1
            from: 0; to: 100; value: 60
            onMoved: statusLabel.text = "dial: " + value.toFixed(0)
        }
        Dial {
            id: dial2
            from: -50; to: 50; value: 0
            stepSize: 5
            snapMode: Dial.SnapAlways
            onMoved: statusLabel.text = "snap dial: " + value.toFixed(0)
        }
        ColumnLayout {
            spacing: 4
            Text { text: "Level: " + dial1.value.toFixed(0); color: "#a3e635"; font.pixelSize: 13 }
            Text { text: "Tune:  " + dial2.value.toFixed(0); color: "#fb923c"; font.pixelSize: 13 }
        }
    }

    // ---- disabled ----
    // 期望：disabled Slider/Dial 整体变灰，无法拖动
    Text { text: "State: disabled"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 16
        Slider { from: 0; to: 100; value: 60; enabled: false }
        Dial   { from: 0; to: 100; value: 40; enabled: false }
    }

    Label {
        id: statusLabel
        text: "Status: (drag a slider or dial)"
        color: "#60a5fa"; font.pixelSize: 13
    }
}
