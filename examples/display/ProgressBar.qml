import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// ================================================================
// ProgressBar / BusyIndicator 属性综合验证
// 验证项：
//   ProgressBar from / to / value 进度范围与当前值
//   ProgressBar indeterminate 不确定进度（循环动画）
//   value 绑定与动态更新（Timer 驱动）
//   BusyIndicator running 启动 / 停止
//   enabled / disabled 状态渲染
// ================================================================

ColumnLayout {
    spacing: 14

    // ---- 静态确定进度 ----
    // 期望：填充条从左到右按 value/to 比例绘制；value=0 时无填充，value=to 时全满
    Text { text: "ProgressBar: static value"; color: "#e8e8e8"; font.pixelSize: 14 }
    ColumnLayout {
        spacing: 6
        ProgressBar { from: 0; to: 100; value: 0  }
        ProgressBar { from: 0; to: 100; value: 25 }
        ProgressBar { from: 0; to: 100; value: 60 }
        ProgressBar { from: 0; to: 100; value: 100 }
    }

    // ---- Timer 驱动动态进度 ----
    // 期望：进度条每 80ms 增加 1%；达到 100 后重置为 0；数值实时显示
    Text { text: "ProgressBar: Timer-driven animation"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 12
        ProgressBar {
            id: animBar
            from: 0; to: 100; value: 0
        }
        Text {
            text: animBar.value.toFixed(0) + " %"
            color: "#a3e635"; font.pixelSize: 13; font.bold: true
        }
    }
    Timer {
        interval: 80; running: true; repeat: true
        onTriggered: animBar.value = (animBar.value >= 100) ? 0 : animBar.value + 1
    }

    // ---- indeterminate 不确定进度 ----
    // 期望：显示循环移动的条纹动画，无确定端点；通常用于"加载中"场景
    Text { text: "ProgressBar: indeterminate"; color: "#e8e8e8"; font.pixelSize: 14 }
    ProgressBar {
        indeterminate: true
    }

    // ---- BusyIndicator ----
    // 期望：running=true 时显示旋转的圆形动画；false 时静止或隐藏
    Text { text: "BusyIndicator: running / stopped"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 24
        ColumnLayout {
            spacing: 4
            BusyIndicator { id: busyOn; running: true  }
            Label { text: "running: true";  color: "#e8e8e8"; font.pixelSize: 11 }
        }
        ColumnLayout {
            spacing: 4
            BusyIndicator { running: false }
            Label { text: "running: false"; color: "#e8e8e8"; font.pixelSize: 11 }
        }
        Button {
            text: busyOn.running ? "Stop" : "Start"
            onClicked: busyOn.running = !busyOn.running
        }
    }

    // ---- disabled ----
    // 期望：disabled ProgressBar 整体变灰
    Text { text: "State: disabled"; color: "#e8e8e8"; font.pixelSize: 14 }
    ProgressBar { from: 0; to: 100; value: 45; enabled: false }
}
