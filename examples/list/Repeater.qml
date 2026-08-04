import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// ================================================================
// Repeater + GridView 综合验证
// 验证项：
//   Repeater model 数字 / 数组 / ListModel
//   Repeater itemAt() 访问指定项
//   Repeater 动态 count + 增删
//   GridView cellWidth / cellHeight / columns
//   GridView currentIndex / highlight
//   GridView ScrollBar 滚动
// ================================================================

ColumnLayout {
    spacing: 14

    // ---- Repeater + 数字 model ----
    // 期望：生成 8 个等宽正方形色块，颜色循环；所有项在 Flow 中自动换行
    Text { text: "Repeater: numeric model → colored tiles"; color: "#e8e8e8"; font.pixelSize: 14 }
    Flow {
        spacing: 6
        Repeater {
            model: 8
            Rectangle {
                width: 48; height: 48; radius: 4
                // 期望：色调按 index 均匀分布 (HSL 色环)
                color: Qt.hsla(index / 8, 0.7, 0.55, 1)
                Text {
                    anchors.centerIn: parent
                    text: index
                    color: "white"; font.pixelSize: 14; font.bold: true
                }
            }
        }
    }

    // ---- Repeater + 数组 model ----
    // 期望：每项显示 modelData；RowLayout 自动调整列宽
    Text { text: "Repeater: array model → buttons"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 6
        Repeater {
            model: ["Cut", "Copy", "Paste", "Delete"]
            Button {
                text: modelData
                onClicked: statusLabel.text = "clicked: " + modelData
            }
        }
    }

    // ---- Repeater + ListModel + itemAt() ----
    // 期望：点击任意项后通过 itemAt() 改变指定项颜色
    Text { text: "Repeater: ListModel + itemAt()"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 6
        Repeater {
            id: rep
            model: ListModel {
                ListElement { label: "A"; active: false }
                ListElement { label: "B"; active: false }
                ListElement { label: "C"; active: false }
                ListElement { label: "D"; active: false }
            }
            Rectangle {
                required property string label
                required property bool   active
                required property int    index
                width: 44; height: 44; radius: 4
                // 期望：active 时背景 accent 蓝色；否则灰色
                color: active ? "#3b82f6" : "#374151"
                Text {
                    anchors.centerIn: parent
                    text: label
                    color: "white"; font.pixelSize: 16; font.bold: true
                }
                MouseArea {
                    anchors.fill: parent
                    onClicked: {
                        rep.model.setProperty(index, "active", !active)
                        statusLabel.text = "toggled: " + label
                    }
                }
            }
        }
    }

    // ---- GridView ----
    // 期望：固定列宽 80、行高 80；选中项显示高亮框；超出区域可滚动
    Text { text: "GridView: cellWidth / cellHeight + highlight"; color: "#e8e8e8"; font.pixelSize: 14 }
    GridView {
        id: grid
        width: 340; height: 200
        clip: true
        cellWidth: 80; cellHeight: 80
        currentIndex: 0

        model: ListModel {
            ListElement { icon: "🍎"; name: "Apple"  }
            ListElement { icon: "🍊"; name: "Orange" }
            ListElement { icon: "🍋"; name: "Lemon"  }
            ListElement { icon: "🍇"; name: "Grape"  }
            ListElement { icon: "🍓"; name: "Berry"  }
            ListElement { icon: "🥝"; name: "Kiwi"   }
            ListElement { icon: "🍑"; name: "Peach"  }
            ListElement { icon: "🍍"; name: "Mango"  }
            ListElement { icon: "🥭"; name: "Mango2" }
        }

        // 期望：当前项显示蓝色圆角描边
        highlight: Rectangle {
            color: "transparent"
            border.color: "#3b82f6"; border.width: 2; radius: 6
        }

        delegate: Rectangle {
            width: grid.cellWidth - 4; height: grid.cellHeight - 4
            color: "#1e293b"; radius: 6
            ColumnLayout {
                anchors.centerIn: parent; spacing: 2
                Text { text: icon; font.pixelSize: 24; Layout.alignment: Qt.AlignHCenter }
                Text { text: name; color: "#e2e8f0"; font.pixelSize: 10; Layout.alignment: Qt.AlignHCenter }
            }
            MouseArea {
                anchors.fill: parent
                onClicked: {
                    grid.currentIndex = index
                    statusLabel.text = "grid: " + name
                }
            }
        }

        ScrollBar.vertical: ScrollBar {}
    }

    Label {
        id: statusLabel
        text: "Status: (interact with items)"
        color: "#60a5fa"; font.pixelSize: 13
    }
}
