import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// ================================================================
// GridLayout / Flow 属性综合验证
// 验证项：
//   GridLayout columns / rows / columnSpacing / rowSpacing
//   GridLayout Layout.row / column / rowSpan / columnSpan
//   GridLayout Layout.alignment 网格内对齐
//   Flow 水平换行 + spacing
//   Flow 垂直换行（Flow.TopToBottom）
// ================================================================

ColumnLayout {
    spacing: 14

    // ---- 基本 columns × rows ----
    // 期望：3 列均匀分布；columnSpacing=8，rowSpacing=6；各格内容居中
    Text { text: "GridLayout: 3 columns"; color: "#e8e8e8"; font.pixelSize: 14 }
    GridLayout {
        columns: 3
        columnSpacing: 8; rowSpacing: 6

        Repeater {
            model: 9
            Rectangle {
                Layout.preferredWidth: 100; Layout.preferredHeight: 40
                color: Qt.hsla(index / 9, 0.65, 0.50, 1)
                radius: 4
                Text {
                    anchors.centerIn: parent
                    text: "Cell " + (index + 1)
                    color: "white"; font.pixelSize: 12
                }
            }
        }
    }

    // ---- rowSpan / columnSpan ----
    // 期望：左上角格跨 2 列；右下角格跨 2 行；其余格 1×1
    Text { text: "GridLayout: rowSpan / columnSpan"; color: "#e8e8e8"; font.pixelSize: 14 }
    GridLayout {
        columns: 3; rows: 3
        columnSpacing: 6; rowSpacing: 6

        // 期望：跨 2 列的大格，宽约为 2 个普通格 + 间距
        Rectangle {
            Layout.columnSpan: 2
            Layout.preferredWidth: 120; Layout.preferredHeight: 50
            color: "#3b82f6"; radius: 4
            Text { anchors.centerIn: parent; text: "span 2 cols"; color: "white"; font.pixelSize: 11 }
        }
        Rectangle {
            Layout.preferredWidth: 56; Layout.preferredHeight: 50
            color: "#6366f1"; radius: 4
            Text { anchors.centerIn: parent; text: "1×1"; color: "white"; font.pixelSize: 11 }
        }
        Rectangle {
            Layout.preferredWidth: 56; Layout.preferredHeight: 50
            color: "#8b5cf6"; radius: 4
            Text { anchors.centerIn: parent; text: "1×1"; color: "white"; font.pixelSize: 11 }
        }
        // 期望：跨 2 行的高格，高度约为 2 个普通格 + 间距
        Rectangle {
            Layout.rowSpan: 2
            Layout.preferredWidth: 56; Layout.preferredHeight: 110
            color: "#ec4899"; radius: 4
            Text { anchors.centerIn: parent; text: "span\n2 rows"; color: "white"; font.pixelSize: 11 }
        }
        Rectangle {
            Layout.preferredWidth: 56; Layout.preferredHeight: 50
            color: "#f59e0b"; radius: 4
            Text { anchors.centerIn: parent; text: "1×1"; color: "white"; font.pixelSize: 11 }
        }
        Rectangle {
            Layout.preferredWidth: 56; Layout.preferredHeight: 50
            color: "#10b981"; radius: 4
            Text { anchors.centerIn: parent; text: "1×1"; color: "white"; font.pixelSize: 11 }
        }
        Rectangle {
            Layout.preferredWidth: 56; Layout.preferredHeight: 50
            color: "#14b8a6"; radius: 4
            Text { anchors.centerIn: parent; text: "1×1"; color: "white"; font.pixelSize: 11 }
        }
    }

    // ---- Layout.alignment 网格内对齐 ----
    // 期望：3 列各按 Left / HCenter / Right 对齐；2 行各按 Top / Bottom 对齐
    Text { text: "GridLayout: Layout.alignment"; color: "#e8e8e8"; font.pixelSize: 14 }
    GridLayout {
        columns: 3; columnSpacing: 6; rowSpacing: 6
        Rectangle {
            Layout.preferredWidth: 180; Layout.preferredHeight: 60
            Layout.alignment: Qt.AlignLeft | Qt.AlignTop
            color: "#1e40af"; radius: 4
            Text { anchors.centerIn: parent; text: "Left+Top"; color: "white"; font.pixelSize: 11 }
        }
        Rectangle {
            Layout.preferredWidth: 180; Layout.preferredHeight: 60
            Layout.alignment: Qt.AlignHCenter | Qt.AlignVCenter
            color: "#0e7490"; radius: 4
            Text { anchors.centerIn: parent; text: "HCenter+VCenter"; color: "white"; font.pixelSize: 11 }
        }
        Rectangle {
            Layout.preferredWidth: 180; Layout.preferredHeight: 60
            Layout.alignment: Qt.AlignRight | Qt.AlignBottom
            color: "#7c3aed"; radius: 4
            Text { anchors.centerIn: parent; text: "Right+Bottom"; color: "white"; font.pixelSize: 11 }
        }
    }

    // ---- Flow 水平换行 ----
    // 期望：项目从左到右排列；超出父宽度自动换行；间距 8px
    Text { text: "Flow: horizontal wrap"; color: "#e8e8e8"; font.pixelSize: 14 }
    Flow {
        width: 420; spacing: 8
        Repeater {
            model: ["JavaScript", "TypeScript", "Python", "Go", "Rust", "C++", "Swift", "Kotlin", "Dart"]
            Rectangle {
                height: 28; radius: 14
                width: tagText.implicitWidth + 20
                color: "#334155"
                Text {
                    id: tagText
                    anchors.centerIn: parent
                    text: modelData
                    color: "#94a3b8"; font.pixelSize: 12
                }
            }
        }
    }

    // ---- Flow 垂直换行（TopToBottom）----
    // 期望：项目从上到下排列；超出高度后向右换列
    Text { text: "Flow: TopToBottom"; color: "#e8e8e8"; font.pixelSize: 14 }
    Flow {
        height: 80; spacing: 6
        flow: Flow.TopToBottom
        Repeater {
            model: 12
            Rectangle {
                width: 36; height: 36; radius: 4
                color: Qt.hsla(index / 12, 0.6, 0.5, 1)
                Text {
                    anchors.centerIn: parent
                    text: index + 1
                    color: "white"; font.pixelSize: 11
                }
            }
        }
    }
}
