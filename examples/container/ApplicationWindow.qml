import QtQuick
import QtQuick.Controls 2.12
import QtQuick.Layouts

// ================================================================
// ApplicationWindow 容器综合验证
// 验证项：
//   menuBar：MenuBar / Menu / MenuItem / MenuSeparator
//   header：ToolBar + ToolButton
//   footer：TabBar + TabButton + StackLayout 页切换
//   anchors 位置类型：9 种对齐方式（centerIn / left+top / right+top 等）
//   StackLayout.currentIndex 与 TabBar.currentIndex 联动
// ================================================================

ApplicationWindow {
    id: root
    width: 600
    height: 480
    color: "steelblue"
    visible: true

    menuBar: MenuBar {
        height: 40
        // ---- File 菜单：Open / Save / Exit，带 MenuSeparator ----
        Menu {
            title: "File"
            MenuItem {
                text: "Open"
                onClicked: statusLabel.text = "Menu: File → Open"
            }
            MenuItem {
                text: "Save"
                onClicked: statusLabel.text = "Menu: File → Save"
            }
            MenuSeparator { }
            MenuItem {
                text: "Exit"
                onClicked: statusLabel.text = "Menu: File → Exit"
            }
        }
        Menu {
            title: "Edit"
            MenuItem {
                text: "Copy"
                onClicked: statusLabel.text = "Menu: Edit → Copy"
            }
            MenuItem {
                text: "Paste"
                onClicked: statusLabel.text = "Menu: Edit → Paste"
            }
        }
        Menu {
            title: "Help"
            MenuItem {
                text: "About"
                onClicked: statusLabel.text = "Menu: Help → About"
            }
        }
    }

    header: ToolBar {
        // ToolBar 内容应包在 RowLayout 中（Qt 规范）
        RowLayout {
            anchors.fill: parent
            ToolButton {
                text: "Button1"
                onClicked: statusLabel.text = "ToolBar: clicked Button1"
            }
        }
    }

    // ---- footer TabBar 与 StackLayout 联动切页 ----
    footer: TabBar {
        id: tabBar
        TabButton { text: "Tab1" }
        TabButton { text: "Tab2" }
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // ---- anchors 九种对齐方式综合展示 ----
        Rectangle {
            // 顶部演示区横向填满，避免右侧留白
            Layout.fillWidth: true
            Layout.preferredHeight: 100
            color: "green"
            clip: true

            Label {
                id: centerLabel
                anchors.centerIn: parent
                text: "centerIn"
                color: "red"
                font.pixelSize: 10
            }
            Label {
                anchors.left: parent.left
                anchors.top: parent.top
                text: "left+top"
                color: "white"
                font.pixelSize: 10
            }
            Label {
                anchors.right: parent.right
                anchors.top: parent.top
                text: "right+top"
                color: "yellow"
                font.pixelSize: 10
            }
            Label {
                anchors.left: parent.left
                anchors.bottom: parent.bottom
                text: "left+bottom"
                color: "cyan"
                font.pixelSize: 10
            }
            Label {
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                text: "right+bottom"
                color: "magenta"
                font.pixelSize: 10
            }
            Label {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "hCenter"
                color: "#00ff00"
                font.pixelSize: 10
            }
            Label {
                anchors.verticalCenter: parent.verticalCenter
                text: "vCenter"
                color: "#ff8800"
                font.pixelSize: 10
            }
            Label {
                anchors.baseline: centerLabel.baseline
                text: "baseline"
                color: "#ffffff"
                font.pixelSize: 10
            }
            Label {
                anchors.bottom: parent.bottom
                anchors.horizontalCenter: parent.horizontalCenter
                text: "hCenter+bottom"
                color: "#00ff00"
                font.pixelSize: 10
            }
            Label {
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                text: "vCenter+right"
                color: "#ff8800"
                font.pixelSize: 10
            }
        }

        // ---- StackLayout 页内容由 TabBar.currentIndex 控制 ----
        StackLayout {
            id: stack
            // ColumnLayout 子项用 Layout.fill* 而非 anchors（Qt 规范）
            Layout.fillWidth: true
            Layout.fillHeight: true
            currentIndex: tabBar.currentIndex

            Rectangle {
                width: 200
                height: 60
                color: "#2d5c8f"
                Label {
                    anchors.centerIn: parent
                    text: "Page 1"
                    color: "red"
                    font.pixelSize: 20
                }
            }
            Rectangle {
                color: "#3f7f3f"
                Label {
                    anchors.centerIn: parent
                    text: "Page 2"
                    color: "white"
                    font.pixelSize: 20
                }
            }
        }
    }

    // ---- 状态反馈（悬浮在右下角）----
    Label {
        id: statusLabel
        anchors.bottom: parent.bottom
        anchors.right: parent.right
        anchors.margins: 8
        text: "Status: (use menu or toolbar)"
        color: "#60a5fa"
        font.pixelSize: 10
    }
}
