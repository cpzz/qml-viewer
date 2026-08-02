import QtQuick.Controls 2.12

ApplicationWindow {
    id: root
    width: 640
    height: 480
    visible: true

    menuBar: MenuBar {
        height: 40
        Menu {
            title: "File"
            MenuItem {
                text: "Open"
                onClicked: {
                    console.log("File -> Open")
                }
            }
            MenuItem {
                text: "Save"
                onClicked: {
                    console.log("File -> Save")
                }
            }
            MenuSeparator { }
            MenuItem {
                text: "Exit"
                onClicked: {
                    console.log("File -> Exit")
                }
            }
        }

        Menu {
            title: "Edit"
            MenuItem {
                text: "Copy"
                onClicked: {
                    console.log("Edit -> Copy")
                }
            }
            MenuItem {
                text: "Paste"
                onClicked: {
                    console.log("Edit -> Paste")
                }
            }
        }

        Menu {
            title: "Help"
            MenuItem {
                text: "About"
                onClicked: {
                    console.log("Help -> About")
                }
            }
        }
    }

    header: ToolBar {
        height: 40
        ToolButton {
            text: "Button1"
            onClicked: {
                console.log("ToolButton: ", text)
            }
        }

    }

    footer: TabBar {
        id: tabBar
        TabButton {
            text: "Tab1"
        }
        TabButton {
            text: "Tab2"
        }
    }
    ColumnLayout {
        Rectangle {
            width: 400
            height: 200
            color: "green"
            
            Label {
                anchors.centerIn: parent
                text: "centerIn"
                color: "red"
                font.pixelSize: 10
            }
            // ---- anchors 位置类型测试 ----
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
                anchors.baseline: parent.baseline
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

        StackLayout {
            id: stack
            anchors.fill: parent
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
}
