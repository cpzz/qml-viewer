import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

// ================================================================
// ListView 属性综合验证
// 验证项：
//   model 数组 / ListModel 数据源
//   delegate 委托项渲染
//   currentIndex / currentItem 当前选中
//   highlight 高亮委托
//   section.property / section.delegate 分组标题
//   clip 超出裁剪
//   spacing / orientation
//   ScrollBar.vertical 附加滚动条
//   itemAdded / itemRemoved 动态增删
// ================================================================

ColumnLayout {
    spacing: 14

    // ---- 基本 model + delegate + 选中 ----
    // 期望：每项显示序号和文字；点击后高亮条跟随；currentIndex 绑定文字更新
    Text { text: "ListView: basic model / delegate / highlight"; color: "#e8e8e8"; font.pixelSize: 14 }
    RowLayout {
        spacing: 12
        ListView {
            id: basicList
            width: 260; height: 180
            clip: true
            spacing: 2
            model: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta"]
            currentIndex: 1

            // 期望：选中项背景为 accent 蓝色；文字白色
            highlight: Rectangle { color: "#3b82f6"; radius: 3 }
            highlightMoveDuration: 120

            delegate: ItemDelegate {
                width: basicList.width
                // 期望：模型索引 + 文字左对齐；高度 32px
                text: (index + 1) + ". " + modelData
                highlighted: basicList.currentIndex === index
                onClicked: {
                    basicList.currentIndex = index
                    statusLabel.text = "selected: " + modelData
                }
            }

            ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded }
        }
        ColumnLayout {
            spacing: 6
            Text { text: "current: " + (basicList.currentItem?.text ?? "—"); color: "#a3e635"; font.pixelSize: 12 }
            Button {
                text: "Select 3rd"
                onClicked: basicList.currentIndex = 2
            }
        }
    }

    // ---- ListModel + section 分组 ----
    // 期望：语言分组各有标题行（粗体 + 背景），组内项缩进
    Text { text: "ListView: ListModel + section.delegate"; color: "#e8e8e8"; font.pixelSize: 14 }
    ListView {
        id: sectionList
        width: 320; height: 200
        clip: true
        spacing: 1

        model: ListModel {
            ListElement { lang: "Frontend"; name: "JavaScript" }
            ListElement { lang: "Frontend"; name: "TypeScript" }
            ListElement { lang: "Frontend"; name: "CSS" }
            ListElement { lang: "Backend";  name: "Python" }
            ListElement { lang: "Backend";  name: "Go" }
            ListElement { lang: "Systems";  name: "Rust" }
            ListElement { lang: "Systems";  name: "C++" }
        }
        section.property: "lang"
        // 期望：分组标题行背景深色，文字白色粗体
        section.delegate: Rectangle {
            width: sectionList.width; height: 24
            color: "#334155"
            Text {
                anchors.verticalCenter: parent.verticalCenter
                x: 8
                text: section
                color: "#e2e8f0"; font.pixelSize: 12; font.bold: true
            }
        }
        delegate: ItemDelegate {
            width: sectionList.width
            leftPadding: 20
            text: name
            onClicked: statusLabel.text = "section item: " + name
        }

        ScrollBar.vertical: ScrollBar {}
    }

    // ---- 水平 ListView ----
    // 期望：项目水平排列；超出宽度可横向滚动
    Text { text: "ListView: horizontal orientation"; color: "#e8e8e8"; font.pixelSize: 14 }
    ListView {
        id: hList
        width: 380; height: 60
        clip: true
        orientation: Qt.Horizontal
        spacing: 6
        model: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        delegate: Rectangle {
            width: 54; height: hList.height
            color: hList.currentIndex === index ? "#3b82f6" : "#334155"
            radius: 4
            Text {
                anchors.centerIn: parent
                text: modelData
                color: "white"; font.pixelSize: 12
            }
            MouseArea {
                anchors.fill: parent
                onClicked: {
                    hList.currentIndex = index
                    statusLabel.text = "month: " + modelData
                }
            }
        }
        ScrollBar.horizontal: ScrollBar { policy: ScrollBar.AsNeeded }
    }

    Label {
        id: statusLabel
        text: "Status: (click list items)"
        color: "#60a5fa"; font.pixelSize: 13
    }
}
