import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// ================================================================
// Text / Label 属性综合验证
// 验证项：
//   wrapMode: NoWrap / Wrap / WordWrap / WrapAnywhere
//   elide: ElideNone / ElideLeft / ElideMiddle / ElideRight
//   horizontalAlignment / verticalAlignment 对齐
//   font.pixelSize / pointSize / bold / italic / family
//   color 文字颜色
//   lineHeight / maximumLineCount 行高与行数限制
//   font 继承：父级 font.pixelSize 传递至子 Text
//   Label vs Text 区别（Label 继承 Control padding/background）
// ================================================================

ColumnLayout {
    spacing: 16
    // 期望：父级 font 设置通过继承传递给未显式设置 font 的子 Text
    font.family: "sans-serif"

    // ---- wrapMode ----
    // 期望：各 mode 在宽度固定时展现不同换行行为
    Text { text: "wrapMode"; color: "#e8e8e8"; font.pixelSize: 14 }
    GridLayout {
        columns: 2; columnSpacing: 12; rowSpacing: 8
        Repeater {
            model: [
                { mode: Text.NoWrap,     label: "NoWrap"     },
                { mode: Text.Wrap,       label: "Wrap"       },
                { mode: Text.WordWrap,   label: "WordWrap"   },
                { mode: Text.WrapAnywhere, label: "WrapAnywhere" },
            ]
            RowLayout {
                spacing: 6
                Rectangle {
                    width: 200; height: 48; color: "#1e293b"; radius: 4
                    clip: true
                    Text {
                        anchors.fill: parent; anchors.margins: 4
                        // 期望：NoWrap 时文字溢出不换行；WordWrap 在词边界断行
                        text: "The quick brown fox jumps over the lazy dog"
                        wrapMode: modelData.mode
                        color: "#e2e8f0"; font.pixelSize: 12
                    }
                }
                Text { text: modelData.label; color: "#94a3b8"; font.pixelSize: 11 }
            }
        }
    }

    // ---- elide ----
    // 期望：超出宽度时显示省略号（…）；位置由 elide 属性决定
    Text { text: "elide"; color: "#e8e8e8"; font.pixelSize: 14 }
    ColumnLayout {
        spacing: 4
        Repeater {
            model: [
                { mode: Text.ElideLeft,   label: "ElideLeft   " },
                { mode: Text.ElideMiddle, label: "ElideMiddle " },
                { mode: Text.ElideRight,  label: "ElideRight  " },
            ]
            RowLayout {
                spacing: 6
                Text {
                    width: 200
                    text: "Very long text that cannot fit in the available width"
                    elide: modelData.mode
                    color: "#e2e8f0"; font.pixelSize: 13
                }
                Text { text: modelData.label; color: "#94a3b8"; font.pixelSize: 11 }
            }
        }
    }

    // ---- horizontalAlignment / verticalAlignment ----
    // 期望：文字在固定宽高容器内按指定方向对齐
    Text { text: "alignment"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 8
        Repeater {
            model: [
                { h: Text.AlignLeft,   v: Text.AlignTop,    label: "L+T" },
                { h: Text.AlignHCenter,v: Text.AlignVCenter, label: "C+M" },
                { h: Text.AlignRight,  v: Text.AlignBottom, label: "R+B" },
            ]
            Rectangle {
                width: 90; height: 60; color: "#1e293b"; radius: 4
                Text {
                    anchors.fill: parent; anchors.margins: 4
                    text: modelData.label
                    horizontalAlignment: modelData.h
                    verticalAlignment:   modelData.v
                    color: "#7dd3fc"; font.pixelSize: 13; font.bold: true
                }
            }
        }
    }

    // ---- font 属性 ----
    // 期望：各行展示对应字体样式；bold 加粗；italic 斜体；大号字清晰可辨
    Text { text: "font properties"; color: "#e8e8e8"; font.pixelSize: 14 }
    ColumnLayout {
        spacing: 4
        Text { text: "Default (inherited 14px sans-serif)";    color: "#e2e8f0" }
        Text { text: "font.pixelSize: 22";  color: "#e2e8f0"; font.pixelSize: 22 }
        Text { text: "font.bold: true";     color: "#e2e8f0"; font.bold: true }
        Text { text: "font.italic: true";   color: "#e2e8f0"; font.italic: true }
        Text { text: "bold + italic";       color: "#e2e8f0"; font.bold: true; font.italic: true }
        Text { text: "color: #f59e0b";      color: "#f59e0b" }
    }

    // ---- lineHeight + maximumLineCount ----
    // 期望：lineHeight:1.8 行间距变大；maximumLineCount:2 超出部分截断
    Text { text: "lineHeight + maximumLineCount"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 16
        Rectangle {
            width: 200; height: 80; color: "#1e293b"; radius: 4
            Text {
                anchors.fill: parent; anchors.margins: 6
                text: "Line height 1.8\nSecond line\nThird line"
                lineHeight: 1.8
                wrapMode: Text.WordWrap
                color: "#a5f3fc"; font.pixelSize: 12
            }
        }
        Rectangle {
            width: 200; height: 60; color: "#1e293b"; radius: 4
            Text {
                anchors.fill: parent; anchors.margins: 6
                text: "Max 2 lines — this text is long enough to require more than two lines to display fully"
                wrapMode: Text.WordWrap
                maximumLineCount: 2
                elide: Text.ElideRight
                color: "#fde68a"; font.pixelSize: 12
            }
        }
    }

    // ---- Label vs Text ----
    // 期望：Label 有 padding（来自 Control）；背景矩形由 Control 样式驱动；
    //       Text 没有 padding 和 background，更轻量
    Text { text: "Label (Control) vs Text (Item)"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 16
        Label {
            text: "Label with padding: 8"
            padding: 8
            background: Rectangle { color: "#1e3a5f"; radius: 4 }
            color: "#93c5fd"
        }
        Text {
            text: "Plain Text — no padding"
            color: "#a5b4fc"
        }
    }
}
