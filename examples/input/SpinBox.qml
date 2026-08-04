import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// ================================================================
// SpinBox 属性综合验证
// 验证项：
//   from / to / stepSize 数值范围与步进
//   value 初始值与绑定
//   editable 可手动输入
//   wrap 边界回绕
//   valueFromText / textFromValue 自定义文字格式
//   validator 输入验证
//   enabled / disabled 状态渲染
//   valueModified / valueChanged 信号
// ================================================================

ColumnLayout {
    spacing: 14

    // ---- 基本 from / to / stepSize ----
    // 期望：+/− 按钮每次步进 stepSize；超出范围后按钮禁用变灰
    Text { text: "Basic: from / to / stepSize"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 16
        SpinBox {
            id: basicSpin
            from: 0; to: 100; stepSize: 5; value: 50
            onValueModified: statusLabel.text = "valueModified: " + value
        }
        Text {
            text: "value = " + basicSpin.value
            color: "#a3e635"; font.pixelSize: 13
        }
    }

    // ---- wrap 边界回绕 ----
    // 期望：到达上限后再加回到下限；下限再减回到上限
    Text { text: "Behavior: wrap (boundary wraparound)"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 16
        SpinBox {
            id: wrapSpin
            from: 1; to: 5; stepSize: 1; value: 1
            wrap: true
            onValueModified: statusLabel.text = "wrap: " + value
        }
        Text {
            text: "1 – 5，超出后回绕"
            color: "#e8e8e8"; font.pixelSize: 12
        }
    }

    // ---- editable：手动输入 ----
    // 期望：输入框可直接编辑；输入不在范围内时自动夹回边界
    Text { text: "editable: manual text input"; color: "#e8e8e8"; font.pixelSize: 14 }
    SpinBox {
        id: editSpin
        from: -50; to: 50; stepSize: 1; value: 0
        editable: true
        onValueModified: statusLabel.text = "editable: " + value
    }

    // ---- textFromValue 自定义格式 ----
    // 期望：显示形如 "0.5 x"；+/− 步进 0.1 精度
    Text { text: "textFromValue: custom display format"; color: "#e8e8e8"; font.pixelSize: 14 }
    SpinBox {
        id: scaleSpin
        from: 1; to: 30; stepSize: 1; value: 10
        editable: true
        // 以 0.1 为单位显示；内部值 × 0.1
        textFromValue: function(v) { return (v / 10).toFixed(1) + " x" }
        valueFromText: function(t) { return Math.round(parseFloat(t) * 10) }
        onValueModified: statusLabel.text = "scale: " + (value / 10).toFixed(1)
    }

    // ---- enabled / disabled ----
    // 期望：disabled 整体变灰，+/− 及输入框均不可交互
    Text { text: "State: enabled / disabled"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 16
        SpinBox { from: 0; to: 10; value: 3 }
        SpinBox { from: 0; to: 10; value: 7; enabled: false }
    }

    Label {
        id: statusLabel
        text: "Status: (interact with spin boxes)"
        color: "#60a5fa"; font.pixelSize: 13
    }
}
