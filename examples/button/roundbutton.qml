import QtQuick
import QtQuick.Controls

// ================================================================
// RoundButton 属性与信号综合验证
// 验证项：
//   radius 默认 999（全圆）与自定义圆角
//   highlighted / flat / default 外观样式
//   enabled / disabled 状态渲染
//   宽高不等时的椭圆裁切效果
//   clicked 信号反馈
// ================================================================

ColumnLayout {
    spacing: 12

    // ---- 外观样式：highlighted / flat / default（radius 默认 999 = 全圆）----
    Text { text: "Style: highlighted / flat / default  (radius=999, circle)"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        RoundButton {
            text: "●"
            width: 60; height: 60
            highlighted: true
            onClicked: statusText.text = "clicked: highlighted circle"
        }
        RoundButton {
            text: "●"
            width: 60; height: 60
            flat: true
            onClicked: statusText.text = "clicked: flat circle"
        }
        RoundButton {
            text: "●"
            width: 60; height: 60
            enabled: false
        }
    }

    // ---- 自定义 radius：小圆角 / 胶囊形 ----
    Text { text: "Radius: custom (r=6 sharp, r=18 capsule)"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        RoundButton {
            text: "r = 6"
            width: 180; height: 36
            radius: 6
            onClicked: statusText.text = "clicked: radius 6"
        }
        RoundButton {
            text: "r = 18  (capsule)"
            width: 180; height: 36
            radius: 18
            onClicked: statusText.text = "clicked: radius 18"
        }
    }

    // ---- 宽高不等：椭圆裁切效果 ----
    Text { text: "Shape: non-square (ellipse clipping)"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        RoundButton {
            text: "wide"
            width: 160; height: 48
            onClicked: statusText.text = "clicked: wide ellipse"
        }
        RoundButton {
            text: "tall"
            width: 48; height: 120
            onClicked: statusText.text = "clicked: tall ellipse"
        }
    }

    // ---- 状态反馈 ----
    Text {
        id: statusText
        text: "Status: (click a button)"
        color: "#60a5fa"
        font.pixelSize: 13
    }
}
